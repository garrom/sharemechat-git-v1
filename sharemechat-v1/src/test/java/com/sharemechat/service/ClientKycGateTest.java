package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.exception.ClientKycRequiredException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Tests del guard ClientKycGate (frente Integracion Age Verification con
 * pago, 2026-06-15). El gate se aplica antes de processFirstTransaction
 * y addBalance.
 */
class ClientKycGateTest {

    private static ClientKycGate gate() {
        return new ClientKycGate();
    }

    private static User userWith(String clientKycStatus) {
        User u = new User();
        u.setClientKycStatus(clientKycStatus);
        return u;
    }

    @Test
    @DisplayName("APPROVED -> no lanza")
    void approved_doesNotThrow() {
        assertDoesNotThrow(() -> gate().assertClientKycApproved(
                userWith(Constants.VerificationStatuses.APPROVED)));
    }

    @Test
    @DisplayName("NULL -> lanza ClientKycRequiredException")
    void nullStatus_throws() {
        ClientKycRequiredException ex = assertThrows(ClientKycRequiredException.class,
                () -> gate().assertClientKycApproved(userWith(null)));
        assertEquals("CLIENT_KYC_REQUIRED", ex.getCode());
    }

    @Test
    @DisplayName("PENDING -> lanza ClientKycRequiredException")
    void pending_throws() {
        assertThrows(ClientKycRequiredException.class,
                () -> gate().assertClientKycApproved(
                        userWith(Constants.VerificationStatuses.PENDING)));
    }

    @Test
    @DisplayName("REJECTED -> lanza ClientKycRequiredException")
    void rejected_throws() {
        assertThrows(ClientKycRequiredException.class,
                () -> gate().assertClientKycApproved(
                        userWith(Constants.VerificationStatuses.REJECTED)));
    }

    @Test
    @DisplayName("user null -> lanza ClientKycRequiredException (defensa)")
    void nullUser_throws() {
        assertThrows(ClientKycRequiredException.class,
                () -> gate().assertClientKycApproved(null));
    }

    @Test
    @DisplayName("Valor desconocido -> lanza (no se asume aprobado por default)")
    void unknownValue_throws() {
        assertThrows(ClientKycRequiredException.class,
                () -> gate().assertClientKycApproved(userWith("WHATEVER")));
    }
}
