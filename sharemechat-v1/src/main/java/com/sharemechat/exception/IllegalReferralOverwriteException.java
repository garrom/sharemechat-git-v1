package com.sharemechat.exception;

/**
 * ADR-049 Subpasada 2B: intento de sobrescribir la atribucion de un
 * cliente que ya tiene {@code users.referred_by_user_id} distinto de
 * NULL. Por decision D3+D5 del ADR-049 la atribucion es <b>inmutable</b>
 * una vez fijada; cualquier intento posterior de reasignarla es un bug
 * del codigo llamante.
 *
 * <p>Se lanza desde {@code AffiliateAttributionService} como guard hard
 * fail defensivo. En condiciones normales nunca se alcanza (el registro
 * cliente sanea la ruta), asi que llegar aqui indica error real y no
 * debe ser silenciado.
 */
public class IllegalReferralOverwriteException extends RuntimeException {

    public IllegalReferralOverwriteException(Long clientUserId,
                                              Long existingReferrer,
                                              Long attemptedReferrer) {
        super("Intento de sobrescribir referral: clientUserId=" + clientUserId
                + " existingReferrer=" + existingReferrer
                + " attemptedReferrer=" + attemptedReferrer);
    }
}
