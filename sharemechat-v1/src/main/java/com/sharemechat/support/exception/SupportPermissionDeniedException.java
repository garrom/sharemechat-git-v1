package com.sharemechat.support.exception;

/**
 * El agente autenticado no puede ejecutar la accion pedida. Ejemplos: sin
 * grant activo sobre la profile solicitada; release/message sobre una conv que
 * pertenece a otro agente. Mapeado a HTTP 403.
 */
public class SupportPermissionDeniedException extends RuntimeException {
    public SupportPermissionDeniedException(String message) {
        super(message);
    }
}
