package com.sharemechat.constants;

import java.util.Locale;
import java.util.Map;

/**
 * Fase 3 i18n (2026-08-22): mapa país (ISO-3166 alpha-2) -> idioma personal por
 * defecto (código de {@link SupportedChatLanguages}).
 *
 * <p>Se usa al REGISTRAR para sembrar el idioma personal/de chat cuando el
 * {@code Accept-Language} del navegador no da una pista válida. Solo mapea a
 * idiomas soportados por el chat.
 *
 * <p>NO es exhaustivo: los países sin entrada caen al fallback
 * (ui_locale/"en"). Nota de producto: Madagascar (MG) -> {@code mg} (malgache),
 * NO francés, aunque el francés sea cooficial allí.
 */
public final class CountryLanguageDefaults {

    private CountryLanguageDefaults() {}

    private static final Map<String, String> MAP = Map.ofEntries(
            // Español
            Map.entry("ES", "es"), Map.entry("MX", "es"), Map.entry("AR", "es"),
            Map.entry("CO", "es"), Map.entry("PE", "es"), Map.entry("CL", "es"),
            Map.entry("VE", "es"), Map.entry("EC", "es"), Map.entry("GT", "es"),
            Map.entry("CU", "es"), Map.entry("BO", "es"), Map.entry("DO", "es"),
            Map.entry("HN", "es"), Map.entry("PY", "es"), Map.entry("SV", "es"),
            Map.entry("NI", "es"), Map.entry("CR", "es"), Map.entry("PA", "es"),
            Map.entry("UY", "es"),
            // Inglés
            Map.entry("GB", "en"), Map.entry("US", "en"), Map.entry("IE", "en"),
            Map.entry("AU", "en"), Map.entry("NZ", "en"), Map.entry("CA", "en"),
            Map.entry("ZA", "en"), Map.entry("NG", "en"), Map.entry("PH", "en"),
            Map.entry("IN", "en"),
            // Portugués
            Map.entry("PT", "pt"), Map.entry("BR", "pt"), Map.entry("AO", "pt"),
            Map.entry("MZ", "pt"),
            // Francés
            Map.entry("FR", "fr"), Map.entry("BE", "fr"), Map.entry("CI", "fr"),
            Map.entry("SN", "fr"), Map.entry("CM", "fr"), Map.entry("CD", "fr"),
            // Alemán
            Map.entry("DE", "de"), Map.entry("AT", "de"), Map.entry("CH", "de"),
            // Italiano / Neerlandés / Polaco
            Map.entry("IT", "it"), Map.entry("NL", "nl"), Map.entry("PL", "pl"),
            // Ruso
            Map.entry("RU", "ru"), Map.entry("BY", "ru"), Map.entry("KZ", "ru"),
            // Asia oriental
            Map.entry("JP", "ja"), Map.entry("CN", "zh"), Map.entry("TW", "zh"),
            Map.entry("HK", "zh"), Map.entry("KR", "ko"),
            // Árabe
            Map.entry("SA", "ar"), Map.entry("EG", "ar"), Map.entry("AE", "ar"),
            Map.entry("MA", "ar"), Map.entry("DZ", "ar"), Map.entry("TN", "ar"),
            Map.entry("IQ", "ar"), Map.entry("JO", "ar"),
            // Turco / Rumano
            Map.entry("TR", "tr"), Map.entry("RO", "ro"), Map.entry("MD", "ro"),
            // Malgache (decisión de producto)
            Map.entry("MG", "mg")
    );

    /** Idioma por defecto para un país ISO-2, o null si no está mapeado. */
    public static String languageFor(String countryIso2) {
        if (countryIso2 == null) return null;
        return MAP.get(countryIso2.trim().toUpperCase(Locale.ROOT));
    }
}
