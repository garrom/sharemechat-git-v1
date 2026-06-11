package com.sharemechat.service;

import com.sharemechat.config.VeriffProperties;
import com.sharemechat.dto.VeriffCreateSessionResult;
import org.json.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
        VeriffCreateSessionResult result = client.createSession(
                123L, "modelo@example.com", "Ada", "Lovelace");

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
        VeriffCreateSessionResult result = client.createSession(1L, "a@b.com", null, null);

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
                () -> client.createSession(1L, "a@b.com", null, null));
        assertTrue(ex.getMessage().toLowerCase().contains("api-secret"));
    }

    // ----------------------------------------------------------------------
    // Tests del payload de POST /v1/sessions (paso 5 del frente Veriff).
    // Regresion del 400/1104 reproducido en TEST el 2026-06-11: Veriff rechaza
    // strings vacios en verification.person.* — hay que OMITIR las claves
    // cuando no tenemos valor real.
    // ----------------------------------------------------------------------

    private static VeriffClientImpl payloadBuilderClient() {
        VeriffProperties props = new VeriffProperties();
        return new VeriffClientImpl(props);
    }

    @Test
    @DisplayName("(a) givenName+lastName con valor -> JSON los incluye")
    void payload_includesPersonFieldsWhenPresent() {
        String body = payloadBuilderClient().buildCreateSessionPayloadJson(
                "https://test.sharemechat.com/api/kyc/veriff/webhook",
                "smc:42", "Ada", "Lovelace");

        JSONObject verification = new JSONObject(body).getJSONObject("verification");
        assertEquals("https://test.sharemechat.com/api/kyc/veriff/webhook", verification.getString("callback"));
        assertEquals("smc:42", verification.getString("vendorData"));
        assertTrue(verification.has("person"), "person debe estar presente");

        JSONObject person = verification.getJSONObject("person");
        assertEquals("Ada", person.getString("givenName"));
        assertEquals("Lovelace", person.getString("lastName"));
        // idNumber NUNCA aparece (lo aporta Veriff al leer el documento).
        assertFalse(person.has("idNumber"), "idNumber nunca debe aparecer en el JSON");
    }

    @Test
    @DisplayName("(b) givenName/lastName null o vacios -> las claves NO existen en el JSON")
    void payload_omitsPersonFieldsWhenEmptyOrNull() {
        // null
        JSONObject p1 = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "https://t.example/cb", "smc:1", null, null))
                .getJSONObject("verification");
        assertFalse(p1.has("person"), "person no debe aparecer si no hay ningun campo");

        // vacios
        JSONObject p2 = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "https://t.example/cb", "smc:2", "", ""))
                .getJSONObject("verification");
        assertFalse(p2.has("person"), "person no debe aparecer si los campos son strings vacios");

        // blancos
        JSONObject p3 = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "https://t.example/cb", "smc:3", "   ", "\t"))
                .getJSONObject("verification");
        assertFalse(p3.has("person"), "person no debe aparecer si los campos son solo whitespace");
    }

    @Test
    @DisplayName("(b-mixto) solo uno de los dos campos presente -> el otro se omite, person solo lleva el lleno")
    void payload_includesOnlyPresentField() {
        // solo givenName
        JSONObject vA = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "https://t.example/cb", "smc:10", "Ada", null))
                .getJSONObject("verification");
        assertTrue(vA.has("person"));
        JSONObject pA = vA.getJSONObject("person");
        assertEquals("Ada", pA.getString("givenName"));
        assertFalse(pA.has("lastName"));
        assertFalse(pA.has("idNumber"));

        // solo lastName
        JSONObject vB = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "https://t.example/cb", "smc:11", "", "Lovelace"))
                .getJSONObject("verification");
        assertTrue(vB.has("person"));
        JSONObject pB = vB.getJSONObject("person");
        assertEquals("Lovelace", pB.getString("lastName"));
        assertFalse(pB.has("givenName"));
        assertFalse(pB.has("idNumber"));
    }

    @Test
    @DisplayName("(c) idNumber NUNCA aparece en el JSON (no es parametro del cliente)")
    void payload_idNumberNeverPresent() {
        // Con campos llenos
        JSONObject vFull = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "https://t.example/cb", "smc:20", "Ada", "Lovelace"))
                .getJSONObject("verification");
        assertFalse(vFull.getJSONObject("person").has("idNumber"));

        // Con campos vacios (person omitido entero, mas razon todavia)
        JSONObject vEmpty = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "https://t.example/cb", "smc:21", null, null))
                .getJSONObject("verification");
        assertFalse(vEmpty.has("person"));
        // Y tampoco aparece en verification a nivel raiz.
        assertFalse(vEmpty.has("idNumber"));
    }

    @Test
    @DisplayName("Trim: campos con whitespace alrededor se almacenan trimeados")
    void payload_trimsFieldValues() {
        JSONObject v = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "https://t.example/cb", "smc:30", "  Ada  ", " Lovelace "))
                .getJSONObject("verification");
        JSONObject p = v.getJSONObject("person");
        assertEquals("Ada", p.getString("givenName"));
        assertEquals("Lovelace", p.getString("lastName"));
    }
}
