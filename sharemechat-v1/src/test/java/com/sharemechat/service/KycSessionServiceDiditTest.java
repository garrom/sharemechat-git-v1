package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import org.json.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests del mapeo / extraccion / replay protection del webhook entrante de
 * Didit (paso 2 del frente Didit, ADR-035).
 *
 * Paralelo a {@link KycSessionServiceMappingTest} pero para los helpers
 * Didit (case-sensitive status, event_id, webhook_type, isDiditTimestampFresh).
 * Los helpers son package-private para poder ejercitarlos sin tocar la capa
 * HTTP ni los repositorios.
 *
 * Status case-sensitive verificados en docs.didit.me/integration/webhooks
 * el 2026-06-13: "Approved", "Declined", "In Review", "In Progress",
 * "Not Started", "Abandoned", "Expired", "Kyc Expired" (K mayuscula),
 * "Resubmitted", "Awaiting User".
 */
class KycSessionServiceDiditTest {

    private static KycSessionService svc() {
        return new KycSessionService(null, null, null, null, null, null, null, null, null);
    }

    // -------------------- V9 assertWorkflowIdMatchesSessionType --------------

    private static KycSessionService svcWithProps(String modelWf, String clientWf) {
        com.sharemechat.config.DiditProperties props = new com.sharemechat.config.DiditProperties();
        props.setModelWorkflowId(modelWf);
        props.setClientWorkflowId(clientWf);
        return new KycSessionService(null, null, null, null, null, null, null, null, props);
    }

    @Test
    @DisplayName("workflow_id NULL en payload -> sin barrera (acepta)")
    void workflowId_null_noBarrier() {
        KycSessionService s = svcWithProps("wf-model", "wf-client");
        s.assertWorkflowIdMatchesSessionType(null, Constants.SessionTypes.MODEL, "sess-1");
        s.assertWorkflowIdMatchesSessionType("", Constants.SessionTypes.CLIENT, "sess-2");
    }

    @Test
    @DisplayName("workflow_id desconocido (ni model ni client) -> log warn pero acepta")
    void workflowId_unknown_acceptsWithWarn() {
        KycSessionService s = svcWithProps("wf-model", "wf-client");
        s.assertWorkflowIdMatchesSessionType("wf-other", Constants.SessionTypes.MODEL, "sess-1");
        s.assertWorkflowIdMatchesSessionType("wf-other", Constants.SessionTypes.CLIENT, "sess-2");
    }

    @Test
    @DisplayName("workflow_id de MODEL + session_type MODEL -> OK")
    void workflowId_model_sessionModel_ok() {
        KycSessionService s = svcWithProps("wf-model", "wf-client");
        s.assertWorkflowIdMatchesSessionType("wf-model", Constants.SessionTypes.MODEL, "sess-1");
    }

    @Test
    @DisplayName("workflow_id de CLIENT + session_type CLIENT -> OK")
    void workflowId_client_sessionClient_ok() {
        KycSessionService s = svcWithProps("wf-model", "wf-client");
        s.assertWorkflowIdMatchesSessionType("wf-client", Constants.SessionTypes.CLIENT, "sess-1");
    }

    @Test
    @DisplayName("workflow_id de MODEL pero session_type CLIENT -> IllegalStateException")
    void workflowId_modelButSessionClient_throws() {
        KycSessionService s = svcWithProps("wf-model", "wf-client");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                s.assertWorkflowIdMatchesSessionType("wf-model", Constants.SessionTypes.CLIENT, "sess-x"));
        assertTrue(ex.getMessage().toLowerCase().contains("mismatch"));
    }

    @Test
    @DisplayName("workflow_id de CLIENT pero session_type MODEL -> IllegalStateException")
    void workflowId_clientButSessionModel_throws() {
        KycSessionService s = svcWithProps("wf-model", "wf-client");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                s.assertWorkflowIdMatchesSessionType("wf-client", Constants.SessionTypes.MODEL, "sess-y"));
        assertTrue(ex.getMessage().toLowerCase().contains("mismatch"));
    }

    // -------------------- V9 extractDiditAgeEstimation -----------------------
    // Path real (hot-fix #4 del frente Didit cliente, 2026-06-14): el Adaptive
    // Workflow guarda los datos de Age Estimation en
    // decision.liveness_checks[0].{age_estimation, score}, no en
    // decision.age_estimation (que es el shape de la API Standalone). El path
    // se confirmo capturando los webhooks 22 y 25 en TEST durante el paso 4-bis.

    private static org.json.JSONObject buildLivenessPayload(Object age, Object score) {
        org.json.JSONObject lc = new org.json.JSONObject();
        if (age != null) lc.put("age_estimation", age);
        if (score != null) lc.put("score", score);
        return new org.json.JSONObject()
                .put("decision", new org.json.JSONObject()
                        .put("liveness_checks", new org.json.JSONArray().put(lc)));
    }

    @Test
    @DisplayName("extractDiditAgeEstimation con payload completo: persiste age y score desde liveness_checks[0]")
    void ageEstimation_fullPayload() {
        org.json.JSONObject payload = buildLivenessPayload(27.33, 92.5);
        com.sharemechat.entity.KycSession session = new com.sharemechat.entity.KycSession();
        svc().extractDiditAgeEstimation(payload, session);
        assertEquals(0, new java.math.BigDecimal("27.33").compareTo(session.getEstimatedAgeDecimal()));
        assertEquals(0, new java.math.BigDecimal("92.5").compareTo(session.getConfidenceScore()));
    }

    @Test
    @DisplayName("Payload real del webhook id=25 (demo+register2 Approved 2026-06-14): age=44.55, score=100")
    void ageEstimation_realWebhook25Shape() {
        org.json.JSONObject payload = buildLivenessPayload(44.55, 100);
        com.sharemechat.entity.KycSession session = new com.sharemechat.entity.KycSession();
        svc().extractDiditAgeEstimation(payload, session);
        assertEquals(0, new java.math.BigDecimal("44.55").compareTo(session.getEstimatedAgeDecimal()));
        assertEquals(0, new java.math.BigDecimal("100").compareTo(session.getConfidenceScore()));
    }

    @Test
    @DisplayName("extractDiditAgeEstimation sin decision -> ambos null")
    void ageEstimation_noDecision() {
        org.json.JSONObject payload = new org.json.JSONObject().put("status", "Approved");
        com.sharemechat.entity.KycSession session = new com.sharemechat.entity.KycSession();
        svc().extractDiditAgeEstimation(payload, session);
        assertNull(session.getEstimatedAgeDecimal());
        assertNull(session.getConfidenceScore());
    }

    @Test
    @DisplayName("decision sin liveness_checks (array ausente) -> ambos null")
    void ageEstimation_noLivenessChecksArray() {
        org.json.JSONObject payload = new org.json.JSONObject()
                .put("decision", new org.json.JSONObject().put("face_matches", new org.json.JSONArray()));
        com.sharemechat.entity.KycSession session = new com.sharemechat.entity.KycSession();
        svc().extractDiditAgeEstimation(payload, session);
        assertNull(session.getEstimatedAgeDecimal());
        assertNull(session.getConfidenceScore());
    }

    @Test
    @DisplayName("liveness_checks array vacio -> ambos null")
    void ageEstimation_emptyLivenessChecks() {
        org.json.JSONObject payload = new org.json.JSONObject()
                .put("decision", new org.json.JSONObject()
                        .put("liveness_checks", new org.json.JSONArray()));
        com.sharemechat.entity.KycSession session = new com.sharemechat.entity.KycSession();
        svc().extractDiditAgeEstimation(payload, session);
        assertNull(session.getEstimatedAgeDecimal());
        assertNull(session.getConfidenceScore());
    }

    @Test
    @DisplayName("liveness_checks[0] sin age_estimation -> solo score si esta presente")
    void ageEstimation_livenessCheckWithoutAge() {
        org.json.JSONObject lc = new org.json.JSONObject().put("score", 87.5);
        org.json.JSONObject payload = new org.json.JSONObject()
                .put("decision", new org.json.JSONObject()
                        .put("liveness_checks", new org.json.JSONArray().put(lc)));
        com.sharemechat.entity.KycSession session = new com.sharemechat.entity.KycSession();
        svc().extractDiditAgeEstimation(payload, session);
        assertNull(session.getEstimatedAgeDecimal());
        assertEquals(0, new java.math.BigDecimal("87.5").compareTo(session.getConfidenceScore()));
    }

    @Test
    @DisplayName("Valores extremos: age=18.0 (gate), age=99.99 (alto), score=0 (limite)")
    void ageEstimation_edgeValues() {
        com.sharemechat.entity.KycSession s1 = new com.sharemechat.entity.KycSession();
        svc().extractDiditAgeEstimation(buildLivenessPayload(18.0, 50), s1);
        assertEquals(0, new java.math.BigDecimal("18.0").compareTo(s1.getEstimatedAgeDecimal()));

        com.sharemechat.entity.KycSession s2 = new com.sharemechat.entity.KycSession();
        svc().extractDiditAgeEstimation(buildLivenessPayload(99.99, 100), s2);
        assertEquals(0, new java.math.BigDecimal("99.99").compareTo(s2.getEstimatedAgeDecimal()));

        com.sharemechat.entity.KycSession s3 = new com.sharemechat.entity.KycSession();
        svc().extractDiditAgeEstimation(buildLivenessPayload(25.5, 0), s3);
        assertEquals(0, new java.math.BigDecimal("0").compareTo(s3.getConfidenceScore()));
    }

    @Test
    @DisplayName("Regresion: payload con shape antiguo (decision.age_estimation directo) -> ambos null (path obsoleto)")
    void ageEstimation_oldShapeIgnored() {
        // El shape pre-hot-fix #4 (decision.age_estimation.{age_estimation,score})
        // YA no se extrae: confirma que el path migro al nuevo y no hay
        // doble lectura accidental.
        org.json.JSONObject payload = new org.json.JSONObject()
                .put("decision", new org.json.JSONObject()
                        .put("age_estimation", new org.json.JSONObject()
                                .put("age_estimation", 27.33)
                                .put("score", 92.5)));
        com.sharemechat.entity.KycSession session = new com.sharemechat.entity.KycSession();
        svc().extractDiditAgeEstimation(payload, session);
        assertNull(session.getEstimatedAgeDecimal());
        assertNull(session.getConfidenceScore());
    }

    // -------------------- mapInternalStatusFromDiditStatus --------------------

    @Test
    @DisplayName("'Approved' -> APPROVED (decision final)")
    void statusApproved_approved() {
        assertEquals(Constants.VerificationStatuses.APPROVED,
                svc().mapInternalStatusFromDiditStatus("Approved", "sess-1"));
    }

    @Test
    @DisplayName("'Declined' -> REJECTED")
    void statusDeclined_rejected() {
        assertEquals(Constants.VerificationStatuses.REJECTED,
                svc().mapInternalStatusFromDiditStatus("Declined", "sess-1"));
    }

    @Test
    @DisplayName("'Expired' / 'Abandoned' / 'Kyc Expired' -> REJECTED")
    void statusTerminalNonDeclined_rejected() {
        assertEquals(Constants.VerificationStatuses.REJECTED,
                svc().mapInternalStatusFromDiditStatus("Expired", "sess-1"));
        assertEquals(Constants.VerificationStatuses.REJECTED,
                svc().mapInternalStatusFromDiditStatus("Abandoned", "sess-1"));
        // "Kyc Expired" con K mayuscula y el resto minusculas — case-sensitive a proposito.
        assertEquals(Constants.VerificationStatuses.REJECTED,
                svc().mapInternalStatusFromDiditStatus("Kyc Expired", "sess-1"));
    }

    @Test
    @DisplayName("'Resubmitted' / 'In Review' / 'In Progress' / 'Not Started' / 'Awaiting User' -> PENDING")
    void statusInProgress_pending() {
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromDiditStatus("Resubmitted", "sess-1"));
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromDiditStatus("In Review", "sess-1"));
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromDiditStatus("In Progress", "sess-1"));
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromDiditStatus("Not Started", "sess-1"));
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromDiditStatus("Awaiting User", "sess-1"));
    }

    @Test
    @DisplayName("Status desconocido / null -> PENDING (NO se asume APPROVED por defecto)")
    void unknownStatus_pending() {
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromDiditStatus(null, "sess-1"));
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromDiditStatus("WhateverFutureStatus", "sess-1"));
    }

    @Test
    @DisplayName("Case-sensitive: 'approved' (minusculas) -> PENDING (NO matchea 'Approved')")
    void caseSensitive_lowercaseDoesNotMatch() {
        // Didit envia los strings con el case-sensitive del enum. Si nuestro
        // mapeo fuera tolerante a case (equalsIgnoreCase), saltarian falsos
        // positivos. Este test blinda que somos estrictos.
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromDiditStatus("approved", "sess-1"));
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromDiditStatus("APPROVED", "sess-1"));
        // "KYC EXPIRED" todo mayusculas tampoco matchea "Kyc Expired".
        assertEquals(Constants.VerificationStatuses.PENDING,
                svc().mapInternalStatusFromDiditStatus("KYC EXPIRED", "sess-1"));
    }

    // -------------------- extractDiditEventId / Type / SessionId / Status -----

    private static JSONObject diditPayload(String eventId, String sessionId, String status, String type) {
        JSONObject p = new JSONObject();
        if (eventId != null) p.put("event_id", eventId);
        if (sessionId != null) p.put("session_id", sessionId);
        if (status != null) p.put("status", status);
        if (type != null) p.put("webhook_type", type);
        return p;
    }

    @Test
    @DisplayName("extractDiditEventId lee event_id explicito")
    void eventId_fromExplicit() {
        JSONObject p = diditPayload("ev-uuid-1", "sess-1", "Approved", "status.updated");
        assertEquals("ev-uuid-1", svc().extractDiditEventId(p));
    }

    @Test
    @DisplayName("extractDiditEventId cae a webhook_id si no hay event_id")
    void eventId_fallbackWebhookId() {
        JSONObject p = new JSONObject().put("webhook_id", "wh-xyz");
        assertEquals("wh-xyz", svc().extractDiditEventId(p));
    }

    @Test
    @DisplayName("extractDiditEventId devuelve null si no hay nada")
    void eventId_null() {
        JSONObject p = new JSONObject().put("session_id", "sess-1");
        assertNull(svc().extractDiditEventId(p));
    }

    @Test
    @DisplayName("extractDiditEventType lee webhook_type literal")
    void eventType_fromWebhookType() {
        JSONObject p = diditPayload("ev-1", "sess-1", "Approved", "status.updated");
        assertEquals("status.updated", svc().extractDiditEventType(p));
    }

    @Test
    @DisplayName("extractDiditEventType cae a event_type si no hay webhook_type")
    void eventType_fallback() {
        JSONObject p = new JSONObject().put("event_type", "data.updated");
        assertEquals("data.updated", svc().extractDiditEventType(p));
    }

    @Test
    @DisplayName("extractDiditSessionId lee session_id literal")
    void sessionId_literal() {
        JSONObject p = diditPayload("ev-1", "sess-abc", "Approved", "status.updated");
        assertEquals("sess-abc", svc().extractDiditSessionId(p));
    }

    @Test
    @DisplayName("extractDiditStatus lee status case-sensitive literal")
    void status_literal() {
        JSONObject p = diditPayload("ev-1", "sess-1", "In Review", "status.updated");
        assertEquals("In Review", svc().extractDiditStatus(p));
    }

    @Test
    @DisplayName("extractDiditStatus devuelve null si no hay status")
    void status_null() {
        JSONObject p = new JSONObject().put("session_id", "sess-1");
        assertNull(svc().extractDiditStatus(p));
    }

    // -------------------- isDiditTimestampFresh (replay protection) ----------

    @Test
    @DisplayName("Timestamp dentro de la ventana (300s) -> fresh")
    void timestamp_withinWindow() {
        long now = Instant.now().getEpochSecond();
        assertTrue(svc().isDiditTimestampFresh(String.valueOf(now)));
        assertTrue(svc().isDiditTimestampFresh(String.valueOf(now - 100)));
        assertTrue(svc().isDiditTimestampFresh(String.valueOf(now + 100)));
        // limite (300s) inclusive
        assertTrue(svc().isDiditTimestampFresh(String.valueOf(now - 300)));
    }

    @Test
    @DisplayName("Timestamp viejo (>300s) -> NO fresh (rechazo replay)")
    void timestamp_tooOld() {
        long now = Instant.now().getEpochSecond();
        assertFalse(svc().isDiditTimestampFresh(String.valueOf(now - 301)));
        assertFalse(svc().isDiditTimestampFresh(String.valueOf(now - 3600)));
        // Anti-replay tipico: webhook re-emitido al dia siguiente.
        assertFalse(svc().isDiditTimestampFresh(String.valueOf(now - 86400)));
    }

    @Test
    @DisplayName("Timestamp en el futuro lejano (>300s) -> NO fresh (clock skew o adversarial)")
    void timestamp_tooFarInFuture() {
        long now = Instant.now().getEpochSecond();
        assertFalse(svc().isDiditTimestampFresh(String.valueOf(now + 301)));
        assertFalse(svc().isDiditTimestampFresh(String.valueOf(now + 86400)));
    }

    @Test
    @DisplayName("Timestamp ausente / vacio / no numerico -> NO fresh")
    void timestamp_invalidHeader() {
        assertFalse(svc().isDiditTimestampFresh(null));
        assertFalse(svc().isDiditTimestampFresh(""));
        assertFalse(svc().isDiditTimestampFresh("   "));
        assertFalse(svc().isDiditTimestampFresh("not-a-number"));
        assertFalse(svc().isDiditTimestampFresh("123.456")); // decimal no permitido (esperamos long)
    }
}
