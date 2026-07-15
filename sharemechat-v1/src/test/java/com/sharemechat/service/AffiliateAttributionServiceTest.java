package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.AffiliateClickEvent;
import com.sharemechat.entity.FavoriteClient;
import com.sharemechat.entity.FavoriteModel;
import com.sharemechat.entity.User;
import com.sharemechat.exception.IllegalReferralOverwriteException;
import com.sharemechat.repository.AffiliateClickEventRepository;
import com.sharemechat.repository.FavoriteClientRepository;
import com.sharemechat.repository.FavoriteModelRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-049 Subpasada 2B: unit test de {@link AffiliateAttributionService}.
 * Cubre: attribute happy (referred_by + favorito + evento + bono),
 * silent_skip por code invalido (D18) y por modelo no APPROVED,
 * inmutabilidad D19.
 */
class AffiliateAttributionServiceTest {

    private UserRepository userRepository;
    private FavoriteModelRepository favoriteModelRepository;
    private FavoriteClientRepository favoriteClientRepository;
    private AffiliateClickEventRepository clickEventRepository;
    private AffiliateBonusService bonusService;
    private EmailService emailService;
    private EmailCopyRenderer emailCopyRenderer;
    private AffiliateAttributionService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        favoriteModelRepository = mock(FavoriteModelRepository.class);
        favoriteClientRepository = mock(FavoriteClientRepository.class);
        clickEventRepository = mock(AffiliateClickEventRepository.class);
        bonusService = mock(AffiliateBonusService.class);
        emailService = mock(EmailService.class);
        emailCopyRenderer = mock(EmailCopyRenderer.class);
        service = new AffiliateAttributionService(
                userRepository, favoriteModelRepository, favoriteClientRepository,
                clickEventRepository, bonusService, emailService, emailCopyRenderer);
    }

    private User makeUser(Long id, String role, String verification, String code) {
        User u = new User();
        u.setEmail("u" + id + "@x.com");
        u.setRole(role);
        u.setVerificationStatus(verification);
        u.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        u.setReferralCodeOwner(code);
        try {
            Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return u;
    }

    @Test
    @DisplayName("Attribute happy: set referred_by + primer favorito REFERRAL/AFFILIATE_INVITATION + evento REGISTERED + bono")
    void attribute_happy() {
        User model = makeUser(97L, Constants.Roles.MODEL,
                Constants.VerificationStatuses.APPROVED, "ABCDEFGHJKMN");
        User client = makeUser(200L, Constants.Roles.USER, null, null);
        when(userRepository.findByReferralCodeOwner("ABCDEFGHJKMN")).thenReturn(Optional.of(model));
        when(userRepository.findById(200L)).thenReturn(Optional.of(client));

        Optional<AffiliateAttributionService.AttributionResult> result =
                service.attributeOnRegister(200L, "abcdefghjkmn");
        assertTrue(result.isPresent());
        assertEquals(200L, result.get().client().getId());
        assertEquals(97L, result.get().model().getId());

        assertEquals(97L, client.getReferredByUserId());
        assertNotNull(client.getReferredAt());

        ArgumentCaptor<FavoriteModel> favCap = ArgumentCaptor.forClass(FavoriteModel.class);
        verify(favoriteModelRepository, times(1)).save(favCap.capture());
        assertEquals(200L, favCap.getValue().getClientId());
        assertEquals(97L, favCap.getValue().getModelId());
        assertEquals("active", favCap.getValue().getStatus());
        // 2026-07-15: invited='accepted' (no 'REFERRAL'): 'invited' es enum funcional
        // usado por canUsersMessage y filtros frontend; REFERRAL bloqueaba silenciosamente
        // el chat. La marca de origen se conserva en favorite_source='AFFILIATE_INVITATION'.
        assertEquals("accepted", favCap.getValue().getInvited());
        assertEquals("AFFILIATE_INVITATION", favCap.getValue().getFavoriteSource());

        // Fila reciproca en favorites_clients (perspectiva del modelo).
        ArgumentCaptor<FavoriteClient> favReciprocalCap = ArgumentCaptor.forClass(FavoriteClient.class);
        verify(favoriteClientRepository, times(1)).save(favReciprocalCap.capture());
        assertEquals(97L, favReciprocalCap.getValue().getModelId());
        assertEquals(200L, favReciprocalCap.getValue().getClientId());
        assertEquals("active", favReciprocalCap.getValue().getStatus());
        assertEquals("accepted", favReciprocalCap.getValue().getInvited());

        ArgumentCaptor<AffiliateClickEvent> evtCap = ArgumentCaptor.forClass(AffiliateClickEvent.class);
        verify(clickEventRepository, times(1)).save(evtCap.capture());
        assertEquals(97L, evtCap.getValue().getModelUserId());
        assertEquals("REGISTERED", evtCap.getValue().getEventType());
        assertEquals(200L, evtCap.getValue().getClientUserId());

        verify(bonusService, times(1)).grantWelcomeBonusIfEligible(200L, 97L);
    }

    @Test
    @DisplayName("Silent skip D18: codigo no existe → Optional.empty + sin efectos")
    void attribute_codeNotFound() {
        when(userRepository.findByReferralCodeOwner(any())).thenReturn(Optional.empty());

        Optional<AffiliateAttributionService.AttributionResult> result =
                service.attributeOnRegister(200L, "NONEXISTENT1");
        assertTrue(result.isEmpty());

        verify(favoriteModelRepository, never()).save(any());
        verify(favoriteClientRepository, never()).save(any());
        verify(clickEventRepository, never()).save(any());
        verify(bonusService, never()).grantWelcomeBonusIfEligible(any(), any());
    }

    @Test
    @DisplayName("Silent skip: modelo con verificationStatus PENDING → Optional.empty")
    void attribute_modelNotApproved() {
        User model = makeUser(97L, Constants.Roles.MODEL,
                Constants.VerificationStatuses.PENDING, "ABCDEFGHJKMN");
        when(userRepository.findByReferralCodeOwner("ABCDEFGHJKMN")).thenReturn(Optional.of(model));

        Optional<AffiliateAttributionService.AttributionResult> result =
                service.attributeOnRegister(200L, "ABCDEFGHJKMN");
        assertTrue(result.isEmpty());
        verify(favoriteModelRepository, never()).save(any());
        verify(favoriteClientRepository, never()).save(any());
    }

    @Test
    @DisplayName("Guard inmutabilidad D19: si client ya tiene referred_by_user_id → IllegalReferralOverwriteException")
    void attribute_immutableGuard() {
        User model = makeUser(97L, Constants.Roles.MODEL,
                Constants.VerificationStatuses.APPROVED, "ABCDEFGHJKMN");
        User client = makeUser(200L, Constants.Roles.USER, null, null);
        client.setReferredByUserId(555L);
        when(userRepository.findByReferralCodeOwner("ABCDEFGHJKMN")).thenReturn(Optional.of(model));
        when(userRepository.findById(200L)).thenReturn(Optional.of(client));

        assertThrows(IllegalReferralOverwriteException.class,
                () -> service.attributeOnRegister(200L, "ABCDEFGHJKMN"));
    }
}
