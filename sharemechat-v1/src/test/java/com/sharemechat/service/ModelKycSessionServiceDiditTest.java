package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import org.json.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests del mapeo / extraccion / replay protection del webhook entrante de
 * Didit (paso 2 del frente Didit, ADR-035).
 *
 * Paralelo a {@link ModelKycSessionServiceMappingTest} pero para los helpers
 * Didit (case-sensitive status, event_id, webhook_type, isDiditTimestampFresh).
 * Los helpers son package-private para poder ejercitarlos sin tocar la capa
 * HTTP ni los repositorios.
 *
 * Status case-sensitive verificados en docs.didit.me/integration/webhooks
 * el 2026-06-13: "Approved", "Declined", "In Review", "In Progress",
 * "Not Started", "Abandoned", "Expired", "Kyc Expired" (K mayuscula),
 * "Resubmitted", "Awaiting User".
 */
class ModelKycSessionServiceDiditTest {

    private static ModelKycSessionService svc() {
        return new ModelKycSessionService(null, null, null, null, null, null, null, null, null);
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
