package com.sharemechat.constants;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Fase 1 i18n: idiomas de UI (Nivel A). Cubre {@link SupportedUiLocales#normalize}
 * y las constantes {@code CODES}/{@code DEFAULT}, que deben ir en paralelo con el
 * frontend {@code localeConfig.js} (SUPPORTED_LOCALES).
 */
class SupportedUiLocalesTest {

    @Test
    void normalizeNullOrBlankReturnsNull() {
        assertNull(SupportedUiLocales.normalize(null));
        assertNull(SupportedUiLocales.normalize(""));
        assertNull(SupportedUiLocales.normalize("   "));
    }

    @Test
    void normalizeAcceptsAllSupportedCodes() {
        assertEquals("es", SupportedUiLocales.normalize("es"));
        assertEquals("en", SupportedUiLocales.normalize("en"));
        assertEquals("fr", SupportedUiLocales.normalize("fr"));
        assertEquals("de", SupportedUiLocales.normalize("de"));
        assertEquals("pt", SupportedUiLocales.normalize("pt"));
    }

    @Test
    void normalizeIsCaseInsensitive() {
        assertEquals("es", SupportedUiLocales.normalize("ES"));
        assertEquals("fr", SupportedUiLocales.normalize("Fr"));
    }

    @Test
    void normalizeStripsRegionSuffix() {
        assertEquals("es", SupportedUiLocales.normalize("es-ES"));
        assertEquals("es", SupportedUiLocales.normalize("es_ES"));
        assertEquals("pt", SupportedUiLocales.normalize("PT-BR"));
        assertEquals("en", SupportedUiLocales.normalize("en-US"));
    }

    @Test
    void normalizeTrimsWhitespace() {
        assertEquals("de", SupportedUiLocales.normalize("  de  "));
    }

    @Test
    void normalizeRejectsChatOnlyOrUnknownCodes() {
        // it/nl/pl/ru/ja... son de CHAT pero NO de UI -> null.
        assertNull(SupportedUiLocales.normalize("it"));
        assertNull(SupportedUiLocales.normalize("nl"));
        assertNull(SupportedUiLocales.normalize("mg"));
        assertNull(SupportedUiLocales.normalize("xx"));
        assertNull(SupportedUiLocales.normalize("zz-ZZ"));
    }

    @Test
    void codesAreExactlyTheCuratedUiSet() {
        assertEquals(List.of("es", "en", "fr", "de", "pt"), SupportedUiLocales.CODES);
    }

    @Test
    void defaultIsSpanish() {
        assertEquals("es", SupportedUiLocales.DEFAULT);
    }
}
