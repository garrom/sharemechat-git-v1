package com.sharemechat.handler;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests del gate Age Verification del cliente en el WebSocket de matching
 * (sub-frente Didit cliente, 2026-06-20).
 *
 * Cubre los seis escenarios del bucketing pre-videochat:
 *  1. USER + FORM_CLIENT + client_kyc=NULL    -> bloqueado
 *  2. CLIENT + FORM_CLIENT + client_kyc=NULL  -> bloqueado (CLIENT legacy)
 *  3. USER + FORM_CLIENT + client_kyc=APPROVED -> pasa
 *  4. CLIENT + FORM_CLIENT + client_kyc=APPROVED -> pasa (caso normal premium)
 *  5. client_kyc=REJECTED                     -> bloqueado
 *  6. client_kyc=PENDING                      -> bloqueado
 *
 * Edge case adicional: user_type != FORM_CLIENT (p. ej. FORM_MODEL)
 * tambien queda bloqueado por el gate cliente (defensa: el flujo modelo
 * tiene su propio gate separado y NO debe pasar nunca por el gate cliente).
 *
 * Test directo de {@code isApprovedClient(Long)} via package-private. El
 * comportamiento de cierre del WebSocket (close-code 4030 + reason
 * CLIENT_KYC_REQUIRED) se valida implicitamente: el handler invoca
 * {@code blockClientSession} cuando {@code isApprovedClient} devuelve
 * {@code false}, sin necesidad de stub de WebSocketSession.
 */
class MatchingHandlerSupportTest {

    private static MatchingHandlerSupport newSupport(UserRepository userRepository) {
        return new MatchingHandlerSupport(
                null,               // MatchingRuntimeState
                null,               // JwtUtil
                userRepository,
                null,               // StreamService
                null,               // TransactionService
                null,               // MessageService
                null,               // MessagesWsHandler
                null,               // StatusService
                null,               // BalanceRepository
                null,               // StreamRecordRepository
                null,               // UserTrialService
                null,               // UserBlockService
                null,               // SeenService
                null,               // StreamLockService
                null,               // NextRateLimitService
                null,               // UserLanguageService
                null,               // AgeGatePolicyService
                null,               // ProductAccessGuardService
                null,               // LivenessChallengeService (ADR-050 Fase B)
                null,               // LivenessProperties      (ADR-050 Fase B)
                60                  // seenMaxScan
        );
    }

    private static User userWith(String role, String userType, String clientKycStatus) {
        User u = new User();
        u.setId(42L);
        u.setRole(role);
        u.setUserType(userType);
        u.setClientKycStatus(clientKycStatus);
        return u;
    }

    @Test
    @DisplayName("USER + FORM_CLIENT + client_kyc=NULL -> bloqueado")
    void userTrialWithoutKyc_blocked() {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findById(42L))
                .thenReturn(Optional.of(userWith(Constants.Roles.USER, Constants.UserTypes.FORM_CLIENT, null)));
        assertFalse(newSupport(repo).isApprovedClient(42L));
    }

    @Test
    @DisplayName("CLIENT + FORM_CLIENT + client_kyc=NULL -> bloqueado (CLIENT legacy)")
    void legacyClientWithoutKyc_blocked() {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findById(42L))
                .thenReturn(Optional.of(userWith(Constants.Roles.CLIENT, Constants.UserTypes.FORM_CLIENT, null)));
        assertFalse(newSupport(repo).isApprovedClient(42L));
    }

    @Test
    @DisplayName("USER + FORM_CLIENT + client_kyc=APPROVED -> pasa")
    void userTrialWithApprovedKyc_passes() {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findById(42L))
                .thenReturn(Optional.of(userWith(
                        Constants.Roles.USER,
                        Constants.UserTypes.FORM_CLIENT,
                        Constants.VerificationStatuses.APPROVED)));
        assertTrue(newSupport(repo).isApprovedClient(42L));
    }

    @Test
    @DisplayName("CLIENT + FORM_CLIENT + client_kyc=APPROVED -> pasa (premium normal)")
    void clientPremiumWithApprovedKyc_passes() {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findById(42L))
                .thenReturn(Optional.of(userWith(
                        Constants.Roles.CLIENT,
                        Constants.UserTypes.FORM_CLIENT,
                        Constants.VerificationStatuses.APPROVED)));
        assertTrue(newSupport(repo).isApprovedClient(42L));
    }

    @Test
    @DisplayName("client_kyc=REJECTED -> bloqueado")
    void rejectedKyc_blocked() {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findById(42L))
                .thenReturn(Optional.of(userWith(
                        Constants.Roles.USER,
                        Constants.UserTypes.FORM_CLIENT,
                        Constants.VerificationStatuses.REJECTED)));
        assertFalse(newSupport(repo).isApprovedClient(42L));
    }

    @Test
    @DisplayName("client_kyc=PENDING -> bloqueado (estado intermedio)")
    void pendingKyc_blocked() {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findById(42L))
                .thenReturn(Optional.of(userWith(
                        Constants.Roles.USER,
                        Constants.UserTypes.FORM_CLIENT,
                        Constants.VerificationStatuses.PENDING)));
        assertFalse(newSupport(repo).isApprovedClient(42L));
    }

    @Test
    @DisplayName("user_type=FORM_MODEL aunque tenga client_kyc=APPROVED -> bloqueado (defensa)")
    void modelTypeIsAlwaysBlockedByClientGate() {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findById(42L))
                .thenReturn(Optional.of(userWith(
                        Constants.Roles.USER,
                        Constants.UserTypes.FORM_MODEL,
                        Constants.VerificationStatuses.APPROVED)));
        assertFalse(newSupport(repo).isApprovedClient(42L));
    }

    @Test
    @DisplayName("userId=null -> bloqueado (fail-safe)")
    void nullUserId_blocked() {
        UserRepository repo = mock(UserRepository.class);
        assertFalse(newSupport(repo).isApprovedClient(null));
    }
}
