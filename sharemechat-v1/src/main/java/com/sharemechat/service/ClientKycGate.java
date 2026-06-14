package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.exception.ClientKycRequiredException;
import org.springframework.stereotype.Service;

/**
 * Guard service que bloquea endpoints adultos (pre-pago y recarga) si el
 * cliente no ha pasado la verificacion de edad de Didit (Adaptive Age
 * Verification, ADR-035).
 *
 * Por que aqui:
 *  - ADR-029 / ADR-035 exigen que la verificacion de edad ocurra ANTES de
 *    la primera recarga del monedero. El sitio natural para gatear es el
 *    pago: {@code TransactionService.processFirstTransaction} (USER ->
 *    CLIENT) y {@code TransactionService.addBalance} (CLIENT recarga).
 *  - Se extrae a guard service para evitar duplicar la politica inline
 *    en cada uno de los dos metodos y para tener un solo sitio donde
 *    extender en el futuro (p.ej. expiracion / recheck por antigueedad,
 *    o exencion temporal de usuarios allowlisted).
 *
 * Patron analogo a {@code EmailVerificationService.assertEmailVerified}:
 * recibe el {@link User} ya cargado por el caller (sin refetch a BD) y
 * lanza {@link ClientKycRequiredException} si el estado no es APPROVED.
 * El {@code GlobalExceptionHandler} la mapea a HTTP 403 con
 * {@code code="CLIENT_KYC_REQUIRED"}; el frontend lo detecta y redirige
 * a {@code /client-kyc}.
 */
@Service
public class ClientKycGate {

    /**
     * Bloquea si el {@code client_kyc_status} del user no es APPROVED.
     * NULL, PENDING, REJECTED y cualquier otro valor lanzan
     * {@link ClientKycRequiredException}.
     */
    public void assertClientKycApproved(User user) {
        if (user == null) {
            throw new ClientKycRequiredException();
        }
        if (!Constants.VerificationStatuses.APPROVED.equals(user.getClientKycStatus())) {
            throw new ClientKycRequiredException();
        }
    }
}
