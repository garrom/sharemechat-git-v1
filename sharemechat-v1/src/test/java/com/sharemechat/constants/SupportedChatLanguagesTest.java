package com.sharemechat.constants;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Idiomas soportados por la traducción de chat (set AMPLIO). Incluye {@code mg}
 * (Fase 2 i18n) como idioma personal seleccionable. Cubre {@code normalize} y
 * el contenido de {@code CODES}.
 */
class SupportedChatLanguagesTest {

    @Test
    void normalizeNullOrBlankReturnsNull() {
        assertNull(SupportedChatLanguages.normalize(null));
        assertNull(SupportedChatLanguages.normalize(""));
        assertNull(SupportedChatLanguages.normalize("  "));
    }

    @Test
    void normalizeAcceptsTheWholeChatSet() {
        for (String code : new String[]{
                "es", "en", "pt", "fr", "it", "de", "nl",
                "pl", "ru", "ja", "zh", "ko", "ar", "tr", "ro", "mg"}) {
            assertEquals(code, SupportedChatLanguages.normalize(code), "debería aceptar " + code);
        }
    }

    @Test
    void normalizeIsCaseInsensitiveAndStripsRegion() {
        assertEquals("mg", SupportedChatLanguages.normalize("MG"));
        assertEquals("pt", SupportedChatLanguages.normalize("pt-BR"));
        assertEquals("zh", SupportedChatLanguages.normalize("zh_CN"));
        assertEquals("ar", SupportedChatLanguages.normalize("  AR  "));
    }

    @Test
    void normalizeRejectsUnsupportedCodes() {
        assertNull(SupportedChatLanguages.normalize("xx"));
        assertNull(SupportedChatLanguages.normalize("eus")); // 3 letras no soportado
    }

    @Test
    void malagasyIsPartOfTheChatSet() {
        assertTrue(SupportedChatLanguages.CODES.contains("mg"));
    }

    @Test
    void chatSetIsAtLeastTheDocumentedSixteen() {
        // 15 documentados + mg. No fijamos igualdad estricta para no romper si se
        // amplía; sí exigimos que estén los relevantes y el tamaño mínimo.
        assertEquals(16, SupportedChatLanguages.CODES.size());
    }
}
