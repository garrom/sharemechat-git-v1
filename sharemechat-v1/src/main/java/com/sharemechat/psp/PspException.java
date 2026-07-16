package com.sharemechat.psp;

/**
 * Excepción runtime del subsistema PSP. Usada por los adapters cuando
 * el vendor rechaza una request, timeout, credenciales inválidas, etc.
 * El orquestador la traduce a HTTP 502 PSP_UPSTREAM_ERROR o 503
 * PSP_UNAVAILABLE según el caso.
 */
public class PspException extends RuntimeException {

    public PspException(String message) {
        super(message);
    }

    public PspException(String message, Throwable cause) {
        super(message, cause);
    }
}
