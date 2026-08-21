package com.sharemechat.constants;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Fase 1 i18n (2026-08-20): idiomas de la INTERFAZ de usuario (Nivel A).
 *
 * <p>Solo los idiomas que tenemos TRADUCIDOS (locale JSON en el frontend +
 * prefijo de URL + hreflang). Es un subconjunto pequeño y curado; distinto del
 * set AMPLIO de idiomas de CHAT ({@link SupportedChatLanguages}), que puede
 * crecer a idiomas raros (p. ej. malgache) sin traducir la página.
 *
 * <p>Debe mantenerse en paralelo con
 * {@code frontend/src/i18n/localeConfig.js} (constante {@code SUPPORTED_LOCALES}).
 * El {@link #DEFAULT} ('es') es el idioma sin prefijo de URL.
 *
 * <p>Doc del frente: {@code docs/07-roadmap/i18n-language-redesign-plan.md}.
 */
public final class SupportedUiLocales {

    private SupportedUiLocales() {}

    public static final String DEFAULT = "es";

    public static final List<String> CODES = List.of("es", "en", "fr", "de", "pt");

    private static final Set<String> CODES_SET = Set.copyOf(CODES);

    /**
     * Normaliza a lowercase 2 chars (recorta región tipo {@code es-ES}/{@code es_ES})
     * y valida que esté en la lista. Devuelve null si el input es blank o no
     * soportado como idioma de UI.
     */
    public static String normalize(String lang) {
        if (lang == null) return null;
        String s = lang.trim().toLowerCase(Locale.ROOT);
        if (s.isEmpty()) return null;
        int dash = s.indexOf('-');
        if (dash > 0) s = s.substring(0, dash);
        int underscore = s.indexOf('_');
        if (underscore > 0) s = s.substring(0, underscore);
        return CODES_SET.contains(s) ? s : null;
    }
}
