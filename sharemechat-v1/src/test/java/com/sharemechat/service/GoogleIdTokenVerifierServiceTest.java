package com.sharemechat.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GoogleIdTokenVerifierServiceTest {

    @Test
    @DisplayName("no configurado si client-id vacio; verify() devuelve null")
    void unconfiguredWhenClientIdBlank() {
        GoogleIdTokenVerifierService svc = new GoogleIdTokenVerifierService("");
        assertFalse(svc.isConfigured());
        assertNull(svc.verify("cualquier.token.aqui"));
    }

    @Test
    @DisplayName("no configurado si client-id null; verify() devuelve null")
    void unconfiguredWhenClientIdNull() {
        GoogleIdTokenVerifierService svc = new GoogleIdTokenVerifierService(null);
        assertFalse(svc.isConfigured());
        assertNull(svc.verify("cualquier.token.aqui"));
    }

    @Test
    @DisplayName("no configurado si client-id solo espacios")
    void unconfiguredWhenClientIdWhitespace() {
        GoogleIdTokenVerifierService svc = new GoogleIdTokenVerifierService("   ");
        assertFalse(svc.isConfigured());
    }

    @Test
    @DisplayName("configurado si client-id valido; token invalido devuelve null sin lanzar")
    void configuredButInvalidTokenReturnsNull() {
        GoogleIdTokenVerifierService svc = new GoogleIdTokenVerifierService(
                "117683758639-example.apps.googleusercontent.com");
        assertTrue(svc.isConfigured());
        // Token con formato JWT sintacticamente valido pero firma bogus.
        // No debe lanzar; debe devolver null.
        String bogus = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJib2d1cyJ9.bogus_signature";
        assertNull(svc.verify(bogus));
    }

    @Test
    @DisplayName("verify() con token vacio devuelve null")
    void emptyTokenReturnsNull() {
        GoogleIdTokenVerifierService svc = new GoogleIdTokenVerifierService(
                "117683758639-example.apps.googleusercontent.com");
        assertNull(svc.verify(""));
        assertNull(svc.verify(null));
    }
}
