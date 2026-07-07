package com.sharemechat.support.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.entity.BackofficeAgentProfile;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportMessage;
import com.sharemechat.support.exception.SupportConflictException;
import com.sharemechat.support.exception.SupportNotFoundException;
import com.sharemechat.support.exception.SupportPermissionDeniedException;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SupportHumanHandlingServiceTest {

    private SupportConversationRepository convRepo;
    private SupportMessageRepository msgRepo;
    private BackofficeAgentProfileRepository profileRepo;
    private BackofficeAgentProfileGrantService grantService;
    private UserRepository userRepo;
    private SupportHumanHandlingService svc;

    private static final Long AGENT_ID = 42L;
    private static final Long OTHER_AGENT_ID = 43L;
    private static final Long PROFILE_ID = 7L;
    private static final Long CONV_ID = 100L;
    private static final Long USER_ID = 30L;

    @BeforeEach
    void setUp() {
        convRepo = mock(SupportConversationRepository.class);
        msgRepo = mock(SupportMessageRepository.class);
        profileRepo = mock(BackofficeAgentProfileRepository.class);
        grantService = mock(BackofficeAgentProfileGrantService.class);
        userRepo = mock(UserRepository.class);
        svc = new SupportHumanHandlingService(convRepo, msgRepo, profileRepo, grantService, userRepo);
    }

    // ------------------------------------------------------------
    // Claim
    // ------------------------------------------------------------

    @Test
    @DisplayName("claim happy path: grant activo + ESCALATED + rowCount=1 -> HUMAN_HANDLING + mensaje SYSTEM")
    void claimHappyPath() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID, Constants.SupportResolutionStatuses.ESCALATED, null, null);
        BackofficeAgentProfile p = buildProfile(PROFILE_ID, "Pepito (Soporte)", true);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        when(profileRepo.findById(PROFILE_ID)).thenReturn(Optional.of(p));
        when(grantService.hasActiveGrant(AGENT_ID, PROFILE_ID)).thenReturn(true);
        when(convRepo.claimIfUnassigned(eq(CONV_ID), eq(AGENT_ID), eq(PROFILE_ID),
                any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(1);
        User user = new User();
        user.setUiLocale("es");
        when(userRepo.findById(USER_ID)).thenReturn(Optional.of(user));

        // Segunda lectura tras el UPDATE devuelve la conv "ya asignada".
        SupportConversation assigned = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, AGENT_ID, PROFILE_ID);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv), Optional.of(assigned));

        SupportConversation out = svc.claim(CONV_ID, AGENT_ID, PROFILE_ID);
        assertEquals(Constants.SupportResolutionStatuses.HUMAN_HANDLING, out.getResolutionStatus());
        assertEquals(AGENT_ID, out.getAssignedAgentId());
        assertEquals(PROFILE_ID, out.getAssignedProfileId());

        ArgumentCaptor<SupportMessage> cap = ArgumentCaptor.forClass(SupportMessage.class);
        verify(msgRepo).save(cap.capture());
        SupportMessage sys = cap.getValue();
        assertEquals(Constants.SupportSenderTypes.SYSTEM, sys.getSender());
        assertTrue(sys.getContent().contains("Pepito (Soporte)"));
    }

    @Test
    @DisplayName("claim sin grant activo -> SupportPermissionDeniedException (403)")
    void claimWithoutGrant() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID, Constants.SupportResolutionStatuses.ESCALATED, null, null);
        BackofficeAgentProfile p = buildProfile(PROFILE_ID, "Pepito", true);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        when(profileRepo.findById(PROFILE_ID)).thenReturn(Optional.of(p));
        when(grantService.hasActiveGrant(AGENT_ID, PROFILE_ID)).thenReturn(false);

        assertThrows(SupportPermissionDeniedException.class,
                () -> svc.claim(CONV_ID, AGENT_ID, PROFILE_ID));
        verify(convRepo, never()).claimIfUnassigned(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("claim con race lost (rowCount=0) -> SupportConflictException (409)")
    void claimRaceLost() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID, Constants.SupportResolutionStatuses.ESCALATED, null, null);
        BackofficeAgentProfile p = buildProfile(PROFILE_ID, "Pepito", true);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        when(profileRepo.findById(PROFILE_ID)).thenReturn(Optional.of(p));
        when(grantService.hasActiveGrant(AGENT_ID, PROFILE_ID)).thenReturn(true);
        when(convRepo.claimIfUnassigned(any(), any(), any(), any(), any())).thenReturn(0);

        assertThrows(SupportConflictException.class,
                () -> svc.claim(CONV_ID, AGENT_ID, PROFILE_ID));
        verify(msgRepo, never()).save(any());
    }

    @Test
    @DisplayName("claim sobre conv que no esta ESCALATED -> SupportConflictException")
    void claimOnNonEscalatedFails() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID, Constants.SupportResolutionStatuses.OPEN, null, null);
        BackofficeAgentProfile p = buildProfile(PROFILE_ID, "Pepito", true);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        when(profileRepo.findById(PROFILE_ID)).thenReturn(Optional.of(p));
        when(grantService.hasActiveGrant(AGENT_ID, PROFILE_ID)).thenReturn(true);

        assertThrows(SupportConflictException.class,
                () -> svc.claim(CONV_ID, AGENT_ID, PROFILE_ID));
    }

    @Test
    @DisplayName("claim con profile inactive -> IllegalArgumentException")
    void claimOnInactiveProfile() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID, Constants.SupportResolutionStatuses.ESCALATED, null, null);
        BackofficeAgentProfile p = buildProfile(PROFILE_ID, "Pepito", false);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        when(profileRepo.findById(PROFILE_ID)).thenReturn(Optional.of(p));

        assertThrows(IllegalArgumentException.class,
                () -> svc.claim(CONV_ID, AGENT_ID, PROFILE_ID));
    }

    @Test
    @DisplayName("claim con locale EN -> mensaje SYSTEM en ingles")
    void claimEnglishLocale() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID, Constants.SupportResolutionStatuses.ESCALATED, null, null);
        BackofficeAgentProfile p = buildProfile(PROFILE_ID, "Mary (Support)", true);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        when(profileRepo.findById(PROFILE_ID)).thenReturn(Optional.of(p));
        when(grantService.hasActiveGrant(AGENT_ID, PROFILE_ID)).thenReturn(true);
        when(convRepo.claimIfUnassigned(any(), any(), any(), any(), any())).thenReturn(1);
        User user = new User();
        user.setUiLocale("en");
        when(userRepo.findById(USER_ID)).thenReturn(Optional.of(user));
        SupportConversation assigned = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, AGENT_ID, PROFILE_ID);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv), Optional.of(assigned));

        svc.claim(CONV_ID, AGENT_ID, PROFILE_ID);
        ArgumentCaptor<SupportMessage> cap = ArgumentCaptor.forClass(SupportMessage.class);
        verify(msgRepo).save(cap.capture());
        assertTrue(cap.getValue().getContent().contains("Your case"));
        assertTrue(cap.getValue().getContent().contains("Mary (Support)"));
    }

    // ------------------------------------------------------------
    // Release
    // ------------------------------------------------------------

    @Test
    @DisplayName("release por otro agent -> SupportPermissionDeniedException")
    void releaseByOtherAgentForbidden() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, AGENT_ID, PROFILE_ID);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));

        assertThrows(SupportPermissionDeniedException.class,
                () -> svc.release(CONV_ID, OTHER_AGENT_ID));
        verify(convRepo, never()).releaseIfOwnedBy(any(), any(), any());
    }

    @Test
    @DisplayName("release happy path -> ESCALATED restaurado")
    void releaseHappyPath() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, AGENT_ID, PROFILE_ID);
        SupportConversation after = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.ESCALATED, null, null);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv), Optional.of(after));
        when(convRepo.releaseIfOwnedBy(eq(CONV_ID), eq(AGENT_ID), any())).thenReturn(1);

        SupportConversation out = svc.release(CONV_ID, AGENT_ID);
        assertEquals(Constants.SupportResolutionStatuses.ESCALATED, out.getResolutionStatus());
    }

    // ------------------------------------------------------------
    // Resolve
    // ------------------------------------------------------------

    @Test
    @DisplayName("resolve por otro agent -> SupportPermissionDeniedException")
    void resolveByOtherAgentForbidden() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, AGENT_ID, PROFILE_ID);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));

        assertThrows(SupportPermissionDeniedException.class,
                () -> svc.resolve(CONV_ID, OTHER_AGENT_ID));
    }

    @Test
    @DisplayName("resolve happy path -> RESOLVED sin limpiar assigned_*")
    void resolveHappyPath() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, AGENT_ID, PROFILE_ID);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        when(convRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SupportConversation out = svc.resolve(CONV_ID, AGENT_ID);
        assertEquals(Constants.SupportResolutionStatuses.RESOLVED, out.getResolutionStatus());
        assertEquals(AGENT_ID, out.getAssignedAgentId(), "assigned_agent_id se mantiene en histórico");
        assertEquals(PROFILE_ID, out.getAssignedProfileId(), "assigned_profile_id se mantiene en histórico");
        assertNotNull(out.getEndedAt());
    }

    // ------------------------------------------------------------
    // sendHumanMessage
    // ------------------------------------------------------------

    @Test
    @DisplayName("sendHumanMessage happy path -> persistido con HUMAN + sent_by_user_id + sent_by_profile_id")
    void sendHumanMessageHappyPath() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, AGENT_ID, PROFILE_ID);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        when(msgRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SupportMessage saved = svc.sendHumanMessage(CONV_ID, AGENT_ID, "hola cliente, dime que pasa");
        assertEquals(Constants.SupportSenderTypes.HUMAN, saved.getSender());
        assertEquals(AGENT_ID, saved.getSentByUserId());
        assertEquals(PROFILE_ID, saved.getSentByProfileId());
        assertEquals("hola cliente, dime que pasa", saved.getContent());
    }

    @Test
    @DisplayName("sendHumanMessage por otro agent -> SupportPermissionDeniedException")
    void sendHumanMessageByOtherAgentForbidden() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, AGENT_ID, PROFILE_ID);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));

        assertThrows(SupportPermissionDeniedException.class,
                () -> svc.sendHumanMessage(CONV_ID, OTHER_AGENT_ID, "hola"));
    }

    @Test
    @DisplayName("sendHumanMessage vacio -> IllegalArgumentException")
    void sendHumanMessageEmpty() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, AGENT_ID, PROFILE_ID);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        assertThrows(IllegalArgumentException.class,
                () -> svc.sendHumanMessage(CONV_ID, AGENT_ID, "   "));
    }

    @Test
    @DisplayName("sendHumanMessage demasiado largo -> IllegalArgumentException")
    void sendHumanMessageTooLong() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, AGENT_ID, PROFILE_ID);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        String big = "x".repeat(5000);
        assertThrows(IllegalArgumentException.class,
                () -> svc.sendHumanMessage(CONV_ID, AGENT_ID, big));
    }

    @Test
    @DisplayName("sendHumanMessage a conv no HUMAN_HANDLING -> SupportConflictException")
    void sendHumanMessageOnNonHumanHandling() {
        SupportConversation conv = buildConv(CONV_ID, USER_ID,
                Constants.SupportResolutionStatuses.ESCALATED, AGENT_ID, PROFILE_ID);
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.of(conv));
        assertThrows(SupportConflictException.class,
                () -> svc.sendHumanMessage(CONV_ID, AGENT_ID, "hola"));
    }

    // ------------------------------------------------------------
    // Not found genericos
    // ------------------------------------------------------------

    @Test
    @DisplayName("claim con conv inexistente -> SupportNotFoundException")
    void claimConvNotFound() {
        when(convRepo.findById(CONV_ID)).thenReturn(Optional.empty());
        assertThrows(SupportNotFoundException.class,
                () -> svc.claim(CONV_ID, AGENT_ID, PROFILE_ID));
    }

    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------

    private static SupportConversation buildConv(Long id, Long userId, String status,
                                                  Long agentId, Long profileId) {
        SupportConversation c = new SupportConversation();
        try {
            Field f = SupportConversation.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(c, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        c.setUserId(userId);
        c.setResolutionStatus(status);
        c.setAssignedAgentId(agentId);
        c.setAssignedProfileId(profileId);
        if (agentId != null) c.setAssignedAt(LocalDateTime.now());
        return c;
    }

    private static BackofficeAgentProfile buildProfile(Long id, String displayName, boolean active) {
        BackofficeAgentProfile p = new BackofficeAgentProfile();
        try {
            Field f = BackofficeAgentProfile.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(p, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        p.setDisplayName(displayName);
        p.setActive(active);
        return p;
    }
}
