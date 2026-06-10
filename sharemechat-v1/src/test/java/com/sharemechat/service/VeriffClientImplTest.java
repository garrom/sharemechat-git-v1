package com.sharemechat.service;

import com.sharemechat.config.VeriffProperties;
import com.sharemechat.dto.VeriffCreateSessionResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VeriffClientImplTest {

    @Test
    @DisplayName("MOCK sigue funcionando con enabled=false (no se rompe el camino mock)")
    void mockMode_whenDisabled() {
        VeriffProperties props = new VeriffProperties();
        props.setEnabled(false); // estado actual en los tres entornos
        props.setApiKey("");     // sin credenciales
        props.setApiSecret("");

        VeriffClientImpl client = new VeriffClientImpl(props);
        VeriffCreateSessionResult result = client.createSession(123L, "modelo@example.com");

        assertNotNull(result);
        assertNotNull(result.getSessionId());
        assertTrue(result.getSessionId().startsWith("veriff_mock_"),
                "El modo MOCK debe devolver un sessionId 'veriff_mock_*'");
        assertNotNull(result.getVerificationUrl());
    }

    @Test
    @DisplayName("MOCK también cuando enabled=true pero falta api-key")
    void mockMode_whenEnabledButNoApiKey() {
        VeriffProperties props = new VeriffProperties();
        props.setEnabled(true);
        props.setApiKey("");
        props.setApiSecret("whatever");

        VeriffClientImpl client = new VeriffClientImpl(props);
        VeriffCreateSessionResult result = client.createSession(1L, "a@b.com");

        assertTrue(result.getSessionId().startsWith("veriff_mock_"));
    }

    @Test
    @DisplayName("enabled=true + api-key presente + api-secret vacío -> falla con error claro (nunca TODO_SIGN)")
    void realMode_failsWhenSecretMissing() {
        VeriffProperties props = new VeriffProperties();
        props.setEnabled(true);
        props.setApiKey("some-api-key");
        props.setApiSecret(""); // falta el secret para firmar

        VeriffClientImpl client = new VeriffClientImpl(props);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> client.createSession(1L, "a@b.com"));
        assertTrue(ex.getMessage().toLowerCase().contains("api-secret"));
    }
}
