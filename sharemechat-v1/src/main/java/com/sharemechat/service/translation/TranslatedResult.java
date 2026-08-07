package com.sharemechat.service.translation;

/**
 * pending-hardening §5.3: resultado de traducir un texto. Vendor-agnostic.
 *
 * @param translatedText    texto traducido al idioma destino
 * @param provider          identificador del proveedor ("google", "deepl", ...)
 * @param detectedSourceLang idioma origen detectado por el proveedor (BCP-47,
 *                          ej. "es", "en"). Puede ser null si el proveedor no
 *                          lo devuelve.
 */
public record TranslatedResult(
        String translatedText,
        String provider,
        String detectedSourceLang
) {}
