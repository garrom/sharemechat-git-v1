package com.sharemechat.dto;

/**
 * pending-hardening §5.3: respuesta del endpoint de traduccion de un mensaje.
 *
 * @param messageId          id del mensaje traducido
 * @param targetLang         idioma destino de la traduccion (BCP-47)
 * @param translatedText     texto traducido
 * @param provider           proveedor que sirvio la traduccion ("google", ...)
 * @param detectedSourceLang idioma origen detectado por el proveedor (BCP-47)
 * @param cached             true si vino de cache tabla, false si se llamo al API
 */
public record MessageTranslationDTO(
        Long messageId,
        String targetLang,
        String translatedText,
        String provider,
        String detectedSourceLang,
        boolean cached
) {}
