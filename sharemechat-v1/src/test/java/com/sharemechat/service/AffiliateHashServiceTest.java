package com.sharemechat.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ADR-049 Subpasada 2B: unit test de {@link AffiliateHashService}.
 * Verifica shape (16 hex chars) + determinismo + salt-dependency +
 * fail-silent a NULL en inputs invalidos.
 */
class AffiliateHashServiceTest {

    private static final String SALT = "unit-test-salt-2026";

    @Test
    @DisplayName("Hash de un IP conocido: 16 hex chars, determinista, sensible a la salt")
    void hashTruncated_deterministicAndShape() {
        AffiliateHashService svc = new AffiliateHashService(SALT);
        String h1 = svc.hashTruncated("203.0.113.42");
        String h2 = svc.hashTruncated("203.0.113.42");
        assertEquals(h1, h2, "El hash debe ser determinista.");
        assertEquals(16, h1.length(), "Debe tener 16 caracteres hex (64 bits).");
        assertTrue(h1.matches("^[0-9a-f]{16}$"), "Solo chars hex minusculas.");
    }

    @Test
    @DisplayName("Cambiar la salt cambia el hash")
    void hashTruncated_saltSensitivity() {
        AffiliateHashService a = new AffiliateHashService("salt-A");
        AffiliateHashService b = new AffiliateHashService("salt-B");
        assertNotEquals(a.hashTruncated("203.0.113.42"), b.hashTruncated("203.0.113.42"));
    }

    @Test
    @DisplayName("Fail-silent a NULL: valor null/blank o salt vacia devuelve null")
    void hashTruncated_nullOnBlank() {
        AffiliateHashService svc = new AffiliateHashService(SALT);
        assertNull(svc.hashTruncated(null));
        assertNull(svc.hashTruncated(""));
        assertNull(svc.hashTruncated("   "));
        AffiliateHashService noSalt = new AffiliateHashService("");
        assertNull(noSalt.hashTruncated("203.0.113.42"));
    }
}
