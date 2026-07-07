package com.sharemechat.support.exception;

/**
 * Conflicto de estado en el sub-paquete soporte. Ejemplos: claim sobre una
 * conversacion ya atendida por otro agente; create profile con display_name
 * duplicado; sendHumanMessage a una conversacion sin claim. Mapeado a HTTP 409.
 */
public class SupportConflictException extends RuntimeException {
    public SupportConflictException(String message) {
        super(message);
    }
}
