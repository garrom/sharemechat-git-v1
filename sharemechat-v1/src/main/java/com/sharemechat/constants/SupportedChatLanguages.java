package com.sharemechat.constants;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * pending-hardening §5.3: idiomas soportados por la feature de traduccion
 * automatica de chat P2P (proveedor Google Cloud Translate soporta 130+
 * idiomas; aqui limitamos a los 15 relevantes para el mercado objetivo).
 *
 * Racional del corte:
 *  - ES, EN, PT: mercados principales.
 *  - FR, IT, DE, NL: EU con clientes de gasto medio-alto.
 *  - PL, RU, RO, TR: origen frecuente de modelos.
 *  - JA, ZH, KO: mercado Asia oriental (aunque menor share).
 *  - AR: mercado MENA relevante.
 *
 * Ampliar con cuidado: cada idioma anadido multiplica combinaciones y
 * potencial de cache misses; los primeros meses deberian bastar. Si un
 * mercado emerge fuerte, se anade aqui + selector Perfil se recarga.
 */
public final class SupportedChatLanguages {

    private SupportedChatLanguages() {}

    public static final List<String> CODES = List.of(
            "es", "en", "pt", "fr", "it", "de", "nl",
            "pl", "ru", "ja", "zh", "ko", "ar", "tr", "ro",
            // Fase 2 i18n (2026-08-21): idioma raro seleccionable como idioma
            // PERSONAL/de chat (modelos de Madagascar). El motor traduce a
            // cualquiera (normalizeLang no gatea); esta lista solo controla qué
            // se OFRECE en el card "Idiomas que hablo".
            "mg"
    );

    private static final Set<String> CODES_SET = Set.copyOf(CODES);

    /**
     * Normaliza a lowercase 2 chars y valida que este en la lista.
     * Devuelve null si el input es blank o no soportado.
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
