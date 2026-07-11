package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

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
 * ADR-049 Subpasada 2A: unit tests de {@link AffiliateCodeService}.
 * Sin Spring; Mockito puro sobre {@link UserRepository}.
 */
class AffiliateCodeServiceTest {

    private UserRepository userRepository;
    private AffiliateCodeService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        service = new AffiliateCodeService(userRepository, 12);
    }

    private User makeUser(Long id, String role, String verificationStatus, String accountStatus,
                          String existingCode) {
        User u = new User();
        u.setRole(role);
        u.setVerificationStatus(verificationStatus);
        u.setAccountStatus(accountStatus);
        u.setReferralCodeOwner(existingCode);
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
    @DisplayName("Charset: 32 caracteres exactos, excluye I L O U (Crockford Base32 sin ambiguos)")
    void charset_isCrockfordBase32() {
        String cs = AffiliateCodeService.CROCKFORD_BASE32;
        assertEquals(32, cs.length(), "Debe tener exactamente 32 caracteres.");
        assertTrue(cs.indexOf('I') < 0, "I no debe estar en el charset.");
        assertTrue(cs.indexOf('L') < 0, "L no debe estar en el charset.");
        assertTrue(cs.indexOf('O') < 0, "O no debe estar en el charset.");
        assertTrue(cs.indexOf('U') < 0, "U no debe estar en el charset.");
        assertEquals("0123456789ABCDEFGHJKMNPQRSTVWXYZ", cs);
    }

    @Test
    @DisplayName("Generacion basica: MODEL + APPROVED sin codigo → persiste y devuelve codigo con longitud correcta y charset valido")
    void generateForModel_firstCall_persistsAndReturnsCode() {
        User u = makeUser(1L, Constants.Roles.MODEL, Constants.VerificationStatuses.APPROVED,
                Constants.AccountStatuses.ACTIVE, null);
        when(userRepository.findById(1L)).thenReturn(Optional.of(u));
        when(userRepository.existsByReferralCodeOwner(any())).thenReturn(false);

        String code = service.generateForModel(1L);

        assertNotNull(code);
        assertEquals(12, code.length());
        assertTrue(code.matches("^[0-9A-HJKMNPQRSTVWXYZ]{12}$"),
                "El codigo debe cumplir el charset Crockford Base32 sin ambiguos.");
        assertEquals(code, u.getReferralCodeOwner(),
                "El codigo se debe persistir en users.referral_code_owner.");
        verify(userRepository).save(u);
    }

    @Test
    @DisplayName("Idempotencia: si user ya tiene codigo, se devuelve sin regenerar ni tocar BD")
    void generateForModel_idempotent_returnsExistingCode() {
        User u = makeUser(2L, Constants.Roles.MODEL, Constants.VerificationStatuses.APPROVED,
                Constants.AccountStatuses.ACTIVE, "PRE0EX1STING");
        when(userRepository.findById(2L)).thenReturn(Optional.of(u));

        String code = service.generateForModel(2L);

        assertEquals("PRE0EX1STING", code);
        verify(userRepository, never()).existsByReferralCodeOwner(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Guard rol: user con role distinto de MODEL → IllegalStateException(role_required)")
    void generateForModel_rejectsNonModel() {
        User u = makeUser(3L, Constants.Roles.CLIENT, Constants.VerificationStatuses.APPROVED,
                Constants.AccountStatuses.ACTIVE, null);
        when(userRepository.findById(3L)).thenReturn(Optional.of(u));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.generateForModel(3L));
        assertEquals(AffiliateCodeService.ERR_ROLE_REQUIRED, ex.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Guard KYC: user MODEL con verificationStatus != APPROVED → IllegalStateException(kyc_required:PENDING)")
    void generateForModel_rejectsNotApproved() {
        User u = makeUser(4L, Constants.Roles.MODEL, Constants.VerificationStatuses.PENDING,
                Constants.AccountStatuses.ACTIVE, null);
        when(userRepository.findById(4L)).thenReturn(Optional.of(u));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.generateForModel(4L));
        assertEquals(AffiliateCodeService.ERR_KYC_REQUIRED_PREFIX + "PENDING", ex.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Guard cuenta suspendida (D8): MODEL + APPROVED pero accountStatus=SUSPENDED → IllegalStateException(account_suspended)")
    void generateForModel_rejectsSuspendedAccount() {
        User u = makeUser(5L, Constants.Roles.MODEL, Constants.VerificationStatuses.APPROVED,
                Constants.AccountStatuses.SUSPENDED, null);
        when(userRepository.findById(5L)).thenReturn(Optional.of(u));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.generateForModel(5L));
        assertEquals(AffiliateCodeService.ERR_ACCOUNT_SUSPENDED, ex.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Colision con reintento: primer candidato existe, segundo no → save del segundo")
    void generateForModel_retriesOnCollision() {
        User u = makeUser(6L, Constants.Roles.MODEL, Constants.VerificationStatuses.APPROVED,
                Constants.AccountStatuses.ACTIVE, null);
        when(userRepository.findById(6L)).thenReturn(Optional.of(u));
        // Primer existsByReferralCodeOwner devuelve true, segundo false.
        when(userRepository.existsByReferralCodeOwner(any()))
                .thenReturn(true)
                .thenReturn(false);

        String code = service.generateForModel(6L);

        assertNotNull(code);
        verify(userRepository, times(2)).existsByReferralCodeOwner(any());
        verify(userRepository, times(1)).save(u);
    }

    @Test
    @DisplayName("Exhaustion de reintentos: 5 colisiones consecutivas → IllegalStateException(code_generation_exhausted)")
    void generateForModel_exhaustsRetries_throws() {
        User u = makeUser(7L, Constants.Roles.MODEL, Constants.VerificationStatuses.APPROVED,
                Constants.AccountStatuses.ACTIVE, null);
        when(userRepository.findById(7L)).thenReturn(Optional.of(u));
        when(userRepository.existsByReferralCodeOwner(any())).thenReturn(true);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.generateForModel(7L));
        assertEquals(AffiliateCodeService.ERR_CODE_EXHAUSTED, ex.getMessage());
        verify(userRepository, times(AffiliateCodeService.MAX_RETRIES))
                .existsByReferralCodeOwner(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("userId null → IllegalStateException(user_not_found)")
    void generateForModel_nullUserId_throws() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.generateForModel(null));
        assertEquals(AffiliateCodeService.ERR_USER_NOT_FOUND, ex.getMessage());
    }

    @Test
    @DisplayName("userId no encontrado → IllegalStateException(user_not_found)")
    void generateForModel_userNotFound_throws() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.generateForModel(999L));
        assertEquals(AffiliateCodeService.ERR_USER_NOT_FOUND, ex.getMessage());
    }

    @Test
    @DisplayName("Distribucion basica: 200 candidatos consecutivos son todos del charset y de longitud 12")
    void generateCandidate_producesValidCodes() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            String c = service.generateCandidate();
            assertEquals(12, c.length());
            assertTrue(c.matches("^[0-9A-HJKMNPQRSTVWXYZ]{12}$"),
                    "El candidato debe pertenecer al charset: " + c);
            seen.add(c);
        }
        // Con 32^12 combinaciones, 200 candidatos consecutivos deberian ser
        // todos distintos con probabilidad ~ 1.
        assertEquals(200, seen.size(),
                "Los 200 candidatos deberian ser todos distintos con entropia de 60 bits.");
    }
}
