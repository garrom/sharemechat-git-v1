package com.sharemechat.support.exception;

/**
 * Recurso del sub-paquete soporte no encontrado. Mapeado a HTTP 404 por el
 * controller admin.
 */
public class SupportNotFoundException extends RuntimeException {
    public SupportNotFoundException(String message) {
        super(message);
    }
}
