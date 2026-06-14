package com.sharemechat.service;

import com.sharemechat.config.DiditProperties;
import com.sharemechat.dto.DiditCreateSessionResult;
import org.json.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests del cliente Didit (paso 2 del frente Didit modelo + V9 frente Didit
 * cliente, ADR-035).
 *
 * Modo MOCK + construccion del payload de POST /v3/session/. La llamada HTTP
 * real se valida con sandbox/integracion manual cuando lleguen las credenciales.
 *
 * V9: createSession acepta workflowId como parametro (uno por flujo: modelo /
 * cliente). Los tests siguen siendo agnosticos al flujo concreto.
 */
class DiditClientImplTest {

    private static final String WF_MODEL = "wf-model-uuid";
    private static final String WF_CLIENT = "wf-client-uuid";

    @Test
    @DisplayName("MOCK cuando enabled=false (defaults reales en application.properties)")
    void mockMode_whenDisabled() {
        DiditProperties props = new DiditProperties();
        props.setEnabled(false);
        props.setApiKey("");

        DiditClientImpl client = new DiditClientImpl(props);
        DiditCreateSessionResult result = client.createSession(
                123L, "modelo@example.com", "Ada", "Lovelace", WF_MODEL);

        assertNotNull(result);
        assertNotNull(result.getSessionId());
        assertTrue(result.getSessionId().startsWith("didit_mock_"),
                "El modo MOCK debe devolver un sessionId 'didit_mock_*'");
        assertNotNull(result.getVerificationUrl());
        assertEquals("smc:123", result.getVendorData());
    }

    @Test
    @DisplayName("MOCK tambien cuando enabled=true pero falta api-key (sin coste accidental)")
    void mockMode_whenEnabledButNoApiKey() {
        DiditProperties props = new DiditProperties();
        props.setEnabled(true);
        props.setApiKey("");
        props.setApiSecret("whatever");
        props.setModelWorkflowId(WF_MODEL);

        DiditClientImpl client = new DiditClientImpl(props);
        DiditCreateSessionResult result = client.createSession(1L, "a@b.com", null, null, WF_MODEL);

        assertTrue(result.getSessionId().startsWith("didit_mock_"));
    }

    @Test
    @DisplayName("enabled=true + api-key presente + workflowId vacio -> falla con error claro")
    void realMode_failsWhenWorkflowIdParamMissing() {
        DiditProperties props = new DiditProperties();
        props.setEnabled(true);
        props.setApiKey("some-api-key");
        props.setApiSecret("some-secret");
        props.setModelWorkflowId(WF_MODEL);

        DiditClientImpl client = new DiditClientImpl(props);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> client.createSession(1L, "a@b.com", "Ada", "Lovelace", ""));
        assertTrue(ex.getMessage().toLowerCase().contains("workflowid"));
    }

    // ----------------------------------------------------------------------
    // Tests del payload de POST /v3/session/. Mismo principio que en Veriff:
    // NO enviar strings vacios en campos de identidad (la regresion 400/1104
    // de Veriff del 2026-06-11 enseno la lección).
    // ----------------------------------------------------------------------

    private static DiditClientImpl payloadBuilderClient() {
        DiditProperties props = new DiditProperties();
        return new DiditClientImpl(props);
    }

    @Test
    @DisplayName("(a) workflow_id y vendor_data SIEMPRE presentes (obligatorios)")
    void payload_includesMandatoryFields() {
        String body = payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid-1234",
                "https://test.sharemechat.com/api/kyc/didit/webhook",
                "smc:42",
                "modelo@example.com",
                "Ada", "Lovelace");

        JSONObject json = new JSONObject(body);
        assertEquals("wf-uuid-1234", json.getString("workflow_id"));
        assertEquals("smc:42", json.getString("vendor_data"));
        assertEquals("https://test.sharemechat.com/api/kyc/didit/webhook", json.getString("callback"));
    }

    @Test
    @DisplayName("V9: workflowId pasado al payload se reflejes en el JSON (flujo modelo)")
    void payload_workflowIdModel() {
        String body = payloadBuilderClient().buildCreateSessionPayloadJson(
                WF_MODEL, "https://t.example/cb", "smc:99", "a@b.com", "Ada", "Lovelace");
        assertEquals(WF_MODEL, new JSONObject(body).getString("workflow_id"));
    }

    @Test
    @DisplayName("V9: workflowId pasado al payload se reflejes en el JSON (flujo cliente)")
    void payload_workflowIdClient() {
        String body = payloadBuilderClient().buildCreateSessionPayloadJson(
                WF_CLIENT, "https://t.example/cb", "smc:99", "a@b.com", "Ada", "Lovelace");
        assertEquals(WF_CLIENT, new JSONObject(body).getString("workflow_id"));
    }

    @Test
    @DisplayName("(b) email y nombre presentes -> contact_details y expected_details rellenos")
    void payload_includesContactAndExpectedWhenPresent() {
        String body = payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid",
                "https://t.example/cb",
                "smc:1",
                "modelo@example.com",
                "Ada", "Lovelace");

        JSONObject json = new JSONObject(body);
        JSONObject contact = json.getJSONObject("contact_details");
        assertEquals("modelo@example.com", contact.getString("email"));

        JSONObject expected = json.getJSONObject("expected_details");
        assertEquals("Ada", expected.getString("first_name"));
        assertEquals("Lovelace", expected.getString("last_name"));
        // identification_number nunca aparece (lo aporta Didit del documento).
        assertFalse(expected.has("identification_number"));
    }

    @Test
    @DisplayName("(c) email vacio/null -> contact_details NO aparece")
    void payload_omitsContactDetailsWhenEmail() {
        // null
        JSONObject j1 = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid", "https://t.example/cb", "smc:2", null, "Ada", "Lovelace"));
        assertFalse(j1.has("contact_details"), "contact_details no debe aparecer si no hay email");

        // vacio
        JSONObject j2 = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid", "https://t.example/cb", "smc:3", "  ", "Ada", "Lovelace"));
        assertFalse(j2.has("contact_details"), "contact_details no debe aparecer si email es solo whitespace");
    }

    @Test
    @DisplayName("(d) givenName/lastName null o vacios -> expected_details NO aparece")
    void payload_omitsExpectedDetailsWhenEmpty() {
        // null/null
        JSONObject j1 = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid", "https://t.example/cb", "smc:4", "a@b.com", null, null));
        assertFalse(j1.has("expected_details"));

        // vacios
        JSONObject j2 = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid", "https://t.example/cb", "smc:5", "a@b.com", "", ""));
        assertFalse(j2.has("expected_details"));

        // whitespace
        JSONObject j3 = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid", "https://t.example/cb", "smc:6", "a@b.com", "   ", "\t"));
        assertFalse(j3.has("expected_details"));
    }

    @Test
    @DisplayName("(d-mixto) solo uno de los dos campos presente -> expected_details solo lleva el lleno")
    void payload_includesOnlyPresentExpectedField() {
        // solo first_name
        JSONObject jA = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid", "https://t.example/cb", "smc:10", "a@b.com", "Ada", null));
        JSONObject expA = jA.getJSONObject("expected_details");
        assertEquals("Ada", expA.getString("first_name"));
        assertFalse(expA.has("last_name"));

        // solo last_name
        JSONObject jB = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid", "https://t.example/cb", "smc:11", "a@b.com", "", "Lovelace"));
        JSONObject expB = jB.getJSONObject("expected_details");
        assertEquals("Lovelace", expB.getString("last_name"));
        assertFalse(expB.has("first_name"));
    }

    @Test
    @DisplayName("Trim: campos con whitespace alrededor se almacenan trimeados")
    void payload_trimsFieldValues() {
        JSONObject j = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid", "  https://t.example/cb  ", "smc:30", "  a@b.com ", "  Ada  ", " Lovelace "));
        assertEquals("https://t.example/cb", j.getString("callback"));
        assertEquals("a@b.com", j.getJSONObject("contact_details").getString("email"));
        JSONObject exp = j.getJSONObject("expected_details");
        assertEquals("Ada", exp.getString("first_name"));
        assertEquals("Lovelace", exp.getString("last_name"));
    }

    @Test
    @DisplayName("callback null -> la clave 'callback' se omite del JSON")
    void payload_omitsCallbackWhenNull() {
        JSONObject j = new JSONObject(payloadBuilderClient().buildCreateSessionPayloadJson(
                "wf-uuid", null, "smc:50", "a@b.com", "Ada", "Lovelace"));
        assertFalse(j.has("callback"));
        // workflow_id y vendor_data siguen ahi
        assertEquals("wf-uuid", j.getString("workflow_id"));
        assertEquals("smc:50", j.getString("vendor_data"));
    }
}
