package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import org.json.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Tests del mapeo de estados del webhook entrante de Veriff (paso 6 del
 * frente Veriff).
 *
 * Cada test instancia el service con dependencias nulas y ejecuta los helpers
 * de mapeo de forma aislada (son package-private). El procesamiento completo
 * de {@code processVeriffWebhook} se cubre por integración manual con Veriff
 * sandbox; estos tests blindan la unidad de mapeo contra futuras regresiones
 * del contrato.
 *
 * Los payloads sintéticos imitan la forma real del Decision webhook de Veriff
 * capturada en la fila id=3 de {@code kyc_webhook_events} en TEST el
 * 2026-06-13 (verification.{code,status,id,attemptId,reason,reasonCode}).
 */
class KycSessionServiceMappingTest {

    private static KycSessionService svc() {
        // Construir el service sin dependencias reales: solo se ejercitan los
        // helpers de extracción/mapeo, que no tocan repositorios ni externos.
        // Las dos ultimas posiciones (DiditClient + DiditProperties) se anadieron
        // en el frente Didit (ADR-035, 2026-06-13).
        return new KycSessionService(null, null, null, null, null, null, null, null, null);
    }

    private static JSONObject decisionPayload(Integer code, String verificationStatus) {
        JSONObject verification = new JSONObject()
                .put("id", "b36c00a2-be32-4f2b-9ca0-a7050e04a25a")
                .put("attemptId", "dd0b9df7-2a81-440f-8a22-7055de4e82ea")
                .put("vendorData", "smc:87");
        if (code != null) verification.put("code", code);
        if (verificationStatus != null) verification.put("status", verificationStatus);
        return new JSONObject()
                .put("status", "success") // top-level "webhook recibido OK"
                .put("verification", verification);
    }

    // -------------------- mapInternalStatusFromCode --------------------

    @Test
    @DisplayName("code 9001 -> APPROVED")
    void code9001_approved() {
        assertEquals(Constants.VerificationStatuses.APPROVED,
                svc().mapInternalStatusFromCode(9001, "sess-1"));
    }

    @Test
    @DisplayName("code 9102 -> REJECTED")
    void code9102_rejected() {
        assertEquals(Constants.VerificationStatuses.REJECTED,
                svc().mapInternalStatusFromCode(9102, "sess-1"));
    }

    @Test
    @DisplayName("code 9103 -> REJECTED")
    void code9103_rejected() {
        assertEquals(Constants.VerificationStatuses.REJECTED,
                svc().mapInternalStatusFromCode(9103, "sess-1"));
    }

    @Test
    @DisplayName("code 9104 -> REJECTED")
    void code9104_rejected() {
        assertEquals(Constants.VerificationStatuses.REJECTED,
                svc().mapInternalStatusFromCode(9104, "sess-1"));
    }

    @Test
    @DisplayName("code 9121 (resubmission) -> kyc_status PENDING (no es decisión final)")
    void code9121_pending_resubmission() {
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromCode(9121, "sess-1"));
    }

    @Test
    @DisplayName("code desconocido (0000) -> PENDING (no asume APPROVED por defecto)")
    void unknownCode_pending() {
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromCode(0, "sess-1"));
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromCode(7777, "sess-1"));
    }

    @Test
    @DisplayName("sin code -> PENDING (nunca APPROVED por defecto)")
    void nullCode_pending() {
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromCode(null, "sess-1"));
    }

    // -------------------- extractDecisionCode --------------------

    @Test
    @DisplayName("extractDecisionCode lee verification.code como Integer")
    void extractCode_int() {
        assertEquals(9102, svc().extractDecisionCode(decisionPayload(9102, "declined")));
        assertEquals(9001, svc().extractDecisionCode(decisionPayload(9001, "approved")));
    }

    @Test
    @DisplayName("extractDecisionCode acepta code como string numérica (defensa)")
    void extractCode_stringNumeric() {
        JSONObject p = new JSONObject().put("verification",
                new JSONObject().put("code", "9102"));
        assertEquals(9102, svc().extractDecisionCode(p));
    }

    @Test
    @DisplayName("extractDecisionCode devuelve null si no hay verification o no hay code")
    void extractCode_null() {
        assertNull(svc().extractDecisionCode(new JSONObject().put("status", "success")));
        assertNull(svc().extractDecisionCode(new JSONObject().put("verification", new JSONObject())));
    }

    // -------------------- extractProviderStatus --------------------

    @Test
    @DisplayName("extractProviderStatus lee verification.status LITERAL (no top-level)")
    void providerStatus_literalFromVerification() {
        // top-level.status="success", verification.status="declined" -> declined
        assertEquals("declined",
                svc().extractProviderStatus(decisionPayload(9102, "declined")));
        assertEquals("approved",
                svc().extractProviderStatus(decisionPayload(9001, "approved")));
        assertEquals("resubmission_requested",
                svc().extractProviderStatus(decisionPayload(9121, "resubmission_requested")));
    }

    @Test
    @DisplayName("extractProviderStatus devuelve null si verification.status no existe")
    void providerStatus_null() {
        JSONObject p = new JSONObject()
                .put("status", "success")
                .put("verification", new JSONObject().put("code", 9102));
        assertNull(svc().extractProviderStatus(p));
    }

    // -------------------- extractProviderEventId --------------------

    @Test
    @DisplayName("extractProviderEventId prefiere verification.attemptId (payload real Veriff)")
    void eventId_fromAttemptId() {
        assertEquals("dd0b9df7-2a81-440f-8a22-7055de4e82ea",
                svc().extractProviderEventId(decisionPayload(9102, "declined")));
    }

    @Test
    @DisplayName("extractProviderEventId cae a id/eventId/event_id top-level si no hay attemptId")
    void eventId_fallbackTopLevel() {
        JSONObject p = new JSONObject()
                .put("eventId", "ev-123")
                .put("verification", new JSONObject().put("id", "sess-xyz"));
        assertEquals("ev-123", svc().extractProviderEventId(p));
    }

    @Test
    @DisplayName("extractProviderEventId devuelve null si no hay nada usable")
    void eventId_null() {
        JSONObject p = new JSONObject().put("verification", new JSONObject().put("id", "sess-xyz"));
        assertNull(svc().extractProviderEventId(p));
    }

    // -------------------- extractProviderEventType --------------------

    @Test
    @DisplayName("extractProviderEventType deriva 'decision_<status>' del verification.status")
    void eventType_derivedFromVerificationStatus() {
        assertEquals("decision_declined",
                svc().extractProviderEventType(decisionPayload(9102, "declined")));
        assertEquals("decision_approved",
                svc().extractProviderEventType(decisionPayload(9001, "approved")));
    }

    @Test
    @DisplayName("extractProviderEventType usa eventType/action/type top-level si existen")
    void eventType_topLevelPriority() {
        JSONObject p = new JSONObject()
                .put("eventType", "verification.submitted")
                .put("verification", new JSONObject().put("status", "declined"));
        assertEquals("verification.submitted", svc().extractProviderEventType(p));
    }

    @Test
    @DisplayName("extractProviderEventType devuelve null si no hay ni eventType ni verification.status")
    void eventType_null() {
        JSONObject p = new JSONObject().put("status", "success");
        assertNull(svc().extractProviderEventType(p));
    }

    // -------------------- extractDecisionReason --------------------

    @Test
    @DisplayName("extractDecisionReason lee verification.reason")
    void reason_fromVerificationReason() {
        JSONObject p = decisionPayload(9102, "declined");
        p.getJSONObject("verification").put("reason", "Suspected document tampering");
        assertEquals("Suspected document tampering", svc().extractDecisionReason(p));
    }

    @Test
    @DisplayName("extractDecisionReason cae a reasonCode (numérico) si no hay reason string")
    void reason_fromReasonCodeNumeric() {
        JSONObject p = decisionPayload(9102, "declined");
        p.getJSONObject("verification").put("reasonCode", 102);
        assertEquals("102", svc().extractDecisionReason(p));
    }

    // -------------------- Integración del payload REAL capturado en TEST --------------------

    @Test
    @DisplayName("Payload REAL Veriff (declined 9102) -> internalStatus REJECTED, providerStatus 'declined'")
    void realPayload_declined_endToEnd() {
        // Replica EXACTA del payload de la fila id=3 de kyc_webhook_events en TEST.
        String real = "{"
                + "\"status\":\"success\","
                + "\"verification\":{"
                + "\"acceptanceTime\":\"2026-06-11T22:26:20.117914Z\","
                + "\"submissionTime\":\"2026-06-13T00:33:45.647214Z\","
                + "\"decisionTime\":\"2026-06-13T00:38:30.861285Z\","
                + "\"code\":9102,"
                + "\"id\":\"b36c00a2-be32-4f2b-9ca0-a7050e04a25a\","
                + "\"vendorData\":\"smc:87\","
                + "\"endUserId\":null,"
                + "\"status\":\"declined\","
                + "\"reason\":\"Suspected document tampering\","
                + "\"reasonCode\":102,"
                + "\"attemptId\":\"dd0b9df7-2a81-440f-8a22-7055de4e82ea\""
                + "},"
                + "\"technicalData\":{\"ip\":\"90.175.201.51\"}"
                + "}";
        JSONObject j = new JSONObject(real);
        KycSessionService s = svc();

        assertEquals("dd0b9df7-2a81-440f-8a22-7055de4e82ea", s.extractProviderEventId(j));
        assertEquals("decision_declined", s.extractProviderEventType(j));
        assertEquals("declined", s.extractProviderStatus(j));
        Integer code = s.extractDecisionCode(j);
        assertNotNull(code);
        assertEquals(9102, code);
        assertEquals(Constants.VerificationStatuses.REJECTED,
                s.mapInternalStatusFromCode(code, "b36c00a2-be32-4f2b-9ca0-a7050e04a25a"));
        assertEquals("Suspected document tampering", s.extractDecisionReason(j));
    }
}
