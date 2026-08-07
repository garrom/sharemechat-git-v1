package com.sharemechat.service.translation;

/**
 * pending-hardening §5.3: se lanza cuando el proveedor de traduccion no
 * esta configurado (modo degradado) o falla al traducir. El caller HTTP
 * mapea esto a 503 Service Unavailable para que el frontend oculte el
 * toggle de traduccion.
 */
public class TranslationUnavailableException extends RuntimeException {
    public TranslationUnavailableException(String message) {
        super(message);
    }

    public TranslationUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
