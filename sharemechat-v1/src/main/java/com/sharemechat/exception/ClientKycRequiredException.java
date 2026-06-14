package com.sharemechat.exception;

/**
 * Lanzada cuando un endpoint adulto exige que el CLIENTE tenga el KYC de
 * edad APROBADO (Didit Adaptive Age Verification, ADR-035) y aun no lo
 * tiene.
 *
 * Mapeada en {@code GlobalExceptionHandler} a HTTP 403 con
 * {@code error="CLIENT_KYC_REQUIRED"} para que el frontend la detecte y
 * redirija al usuario a {@code /client-kyc} antes de continuar.
 *
 * Patron analogo a {@link EmailVerificationRequiredException}.
 */
public class ClientKycRequiredException extends RuntimeException {

    public static final String CODE = "CLIENT_KYC_REQUIRED";

    public ClientKycRequiredException() {
        super("Client KYC verification required before this operation");
    }

    public ClientKycRequiredException(String message) {
        super(message);
    }

    public String getCode() {
        return CODE;
    }
}
