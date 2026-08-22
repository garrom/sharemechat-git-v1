package com.sharemechat.constants;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Fase 3 i18n: mapa país ISO-2 -> idioma personal por defecto para la siembra en
 * el registro. Nota de producto: Madagascar (MG) mapea a malgache, no a francés.
 */
class CountryLanguageDefaultsTest {

    @Test
    void nullReturnsNull() {
        assertNull(CountryLanguageDefaults.languageFor(null));
    }

    @Test
    void unmappedCountryReturnsNull() {
        assertNull(CountryLanguageDefaults.languageFor("ZZ"));
        assertNull(CountryLanguageDefaults.languageFor("XX"));
    }

    @Test
    void mapsRepresentativeCountries() {
        assertEquals("es", CountryLanguageDefaults.languageFor("ES"));
        assertEquals("es", CountryLanguageDefaults.languageFor("MX"));
        assertEquals("en", CountryLanguageDefaults.languageFor("US"));
        assertEquals("en", CountryLanguageDefaults.languageFor("GB"));
        assertEquals("pt", CountryLanguageDefaults.languageFor("BR"));
        assertEquals("pt", CountryLanguageDefaults.languageFor("PT"));
        assertEquals("fr", CountryLanguageDefaults.languageFor("FR"));
        assertEquals("de", CountryLanguageDefaults.languageFor("DE"));
        assertEquals("ru", CountryLanguageDefaults.languageFor("RU"));
        assertEquals("ja", CountryLanguageDefaults.languageFor("JP"));
        assertEquals("ar", CountryLanguageDefaults.languageFor("SA"));
    }

    @Test
    void isCaseInsensitiveAndTrims() {
        assertEquals("es", CountryLanguageDefaults.languageFor("es"));
        assertEquals("pt", CountryLanguageDefaults.languageFor("  br  "));
    }

    @Test
    void madagascarMapsToMalagasyNotFrench() {
        assertEquals("mg", CountryLanguageDefaults.languageFor("MG"));
    }
}
