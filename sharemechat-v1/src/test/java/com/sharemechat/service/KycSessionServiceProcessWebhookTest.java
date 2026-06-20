package com.sharemechat.service;

import com.sharemechat.config.DiditProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.KycSession;
import com.sharemechat.entity.KycWebhookEvent;
import com.sharemechat.entity.User;
import com.sharemechat.repository.KycSessionRepository;
import com.sharemechat.repository.KycWebhookEventRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.HmacSha256;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests E2E de {@code processDiditWebhook} cubriendo los 9 gaps identificados
 * en el diagnostico del frente P1 idempotencia (2026-06-20):
 *
 *  1. Webhook valido APPROVED nuevo -> sesion + user actualizados.
 *  2. Idempotencia con event_id explicito -> 2o webhook no reprocesa.
 *  3. Firma HMAC invalida -> persistDiditRejection + return false.
 *  4. Timestamp expirado -> persistDiditRejection + return false.
 *  5. session_id desconocido -> persiste error, devuelve true (200).
 *  6. Payload no parseable -> persiste error invalid_payload, devuelve true.
 *  7. Transicion backwards APPROVED->REJECTED -> log warn (helper directo).
 *  8. event_id=null -> hash sintetico "synth_" usado como provider_event_id.
 *  9. Race condition (DataIntegrityViolationException) -> catch defensivo,
 *     return true sin propagar 500.
 *
 * Tests del helper {@code deriveSyntheticEventId} e {@code isBackwardsTransition}
 * son directos (package-private). Tests E2E usan Mockito con mocks de los
 * repos.
 */
class KycSessionServiceProcessWebhookTest {

    private static final String SECRET = "test-secret-shared-key";
    private static final String SESSION_ID = "sess-12345";
    private static final String EVENT_ID = "evt-abcdef-001";
    private static final String WF_CLIENT = "wf-client-uuid";

    private static DiditProperties propsWithSecret(String secret) {
        DiditProperties p = new DiditProperties();
        p.setApiSecret(secret);
        p.setClientWorkflowId(WF_CLIENT);
        return p;
    }

    private static KycSessionService newService(
            UserRepository userRepo,
            KycSessionRepository sessionRepo,
            KycWebhookEventRepository eventRepo,
            DiditProperties props) {
        return new KycSessionService(userRepo, sessionRepo, eventRepo, null, null, null, null, null, props);
    }

    private static String currentTimestamp() {
        return String.valueOf(Instant.now().getEpochSecond());
    }

    private static String expiredTimestamp() {
        return String.valueOf(Instant.now().getEpochSecond() - 3600L);
    }

    private static String signBody(String body) {
        return HmacSha256.hexHmacSha256(SECRET, body.getBytes(StandardCharsets.UTF_8));
    }

    private static String buildPayload(String eventId, String status) {
        StringBuilder sb = new StringBuilder("{");
        if (eventId != null) sb.append("\"event_id\":\"").append(eventId).append("\",");
        sb.append("\"webhook_type\":\"status.updated\",");
        sb.append("\"session_id\":\"").append(SESSION_ID).append("\",");
        sb.append("\"workflow_id\":\"").append(WF_CLIENT).append("\",");
        sb.append("\"status\":\"").append(status).append("\"}");
        return sb.toString();
    }

    private static KycSession pendingClientSession(Long userId) {
        KycSession s = new KycSession();
        s.setUserId(userId);
        s.setSessionType(Constants.SessionTypes.CLIENT);
        s.setProvider("DIDIT");
        s.setProviderSessionId(SESSION_ID);
        s.setKycStatus(Constants.VerificationStatuses.PENDING);
        return s;
    }

    private static User clientUser(Long id) {
        User u = new User();
        u.setId(id);
        u.setRole(Constants.Roles.USER);
        u.setUserType(Constants.UserTypes.FORM_CLIENT);
        return u;
    }

    // ---------- Test 1: webhook valido APPROVED nuevo ----------

    @Test
    @DisplayName("(1) Webhook valido APPROVED nuevo -> sesion + user actualizados, fila persistida sig=1 proc=1")
    void validApprovedNew_updatesSessionAndUser() {
        UserRepository userRepo = mock(UserRepository.class);
        KycSessionRepository sessionRepo = mock(KycSessionRepository.class);
        KycWebhookEventRepository eventRepo = mock(KycWebhookEventRepository.class);

        KycSession session = pendingClientSession(99L);
        User user = clientUser(99L);

        when(eventRepo.findByProviderAndProviderEventId("DIDIT", EVENT_ID))
                .thenReturn(Optional.empty());
        when(sessionRepo.findByProviderAndProviderSessionId("DIDIT", SESSION_ID))
                .thenReturn(Optional.of(session));
        when(userRepo.findById(99L)).thenReturn(Optional.of(user));

        KycSessionService svc = newService(userRepo, sessionRepo, eventRepo, propsWithSecret(SECRET));
        String body = buildPayload(EVENT_ID, "Approved");
        String ts = currentTimestamp();
        String sig = signBody(body);

        boolean ok = svc.processDiditWebhook(body.getBytes(StandardCharsets.UTF_8), sig, ts);

        assertTrue(ok);
        assertEquals(Constants.VerificationStatuses.APPROVED, session.getKycStatus());
        assertEquals(Constants.VerificationStatuses.APPROVED, user.getClientKycStatus());
        verify(sessionRepo, times(1)).save(session);
        verify(userRepo, times(1)).save(user);

        ArgumentCaptor<KycWebhookEvent> evCap = ArgumentCaptor.forClass(KycWebhookEvent.class);
        verify(eventRepo).save(evCap.capture());
        KycWebhookEvent ev = evCap.getValue();
        assertTrue(ev.isSignatureValid());
        assertTrue(ev.isProcessed());
        assertEquals(EVENT_ID, ev.getProviderEventId());
    }

    // ---------- Test 2: idempotencia event_id explicito ----------

    @Test
    @DisplayName("(2) Idempotencia: 2o webhook con mismo event_id no reprocesa ni persiste 2a fila")
    void idempotentReplayByEventId_noReprocess() {
        UserRepository userRepo = mock(UserRepository.class);
        KycSessionRepository sessionRepo = mock(KycSessionRepository.class);
        KycWebhookEventRepository eventRepo = mock(KycWebhookEventRepository.class);

        KycWebhookEvent existing = new KycWebhookEvent();
        existing.setProvider("DIDIT");
        existing.setProviderEventId(EVENT_ID);
        when(eventRepo.findByProviderAndProviderEventId("DIDIT", EVENT_ID))
                .thenReturn(Optional.of(existing));

        KycSessionService svc = newService(userRepo, sessionRepo, eventRepo, propsWithSecret(SECRET));
        String body = buildPayload(EVENT_ID, "Approved");
        String sig = signBody(body);

        boolean ok = svc.processDiditWebhook(body.getBytes(StandardCharsets.UTF_8), sig, currentTimestamp());

        assertTrue(ok);
        verify(sessionRepo, never()).findByProviderAndProviderSessionId(anyString(), anyString());
        verify(sessionRepo, never()).save(any());
        verify(userRepo, never()).save(any());
        verify(eventRepo, never()).save(any());
    }

    // ---------- Test 3: firma HMAC invalida ----------

    @Test
    @DisplayName("(3) Firma HMAC invalida -> persistDiditRejection sig=0 proc=0 error=invalid_signature, return false")
    void invalidSignature_rejectedAndPersisted() {
        UserRepository userRepo = mock(UserRepository.class);
        KycSessionRepository sessionRepo = mock(KycSessionRepository.class);
        KycWebhookEventRepository eventRepo = mock(KycWebhookEventRepository.class);

        KycSessionService svc = newService(userRepo, sessionRepo, eventRepo, propsWithSecret(SECRET));
        String body = buildPayload(EVENT_ID, "Approved");

        boolean ok = svc.processDiditWebhook(body.getBytes(StandardCharsets.UTF_8), "bad-sig-not-hex", currentTimestamp());

        assertFalse(ok);
        ArgumentCaptor<KycWebhookEvent> evCap = ArgumentCaptor.forClass(KycWebhookEvent.class);
        verify(eventRepo).save(evCap.capture());
        KycWebhookEvent ev = evCap.getValue();
        assertFalse(ev.isSignatureValid());
        assertFalse(ev.isProcessed());
        assertEquals("invalid_signature", ev.getProcessingError());
    }

    // ---------- Test 4: timestamp expirado ----------

    @Test
    @DisplayName("(4) Timestamp expirado -> persistDiditRejection sig=0 proc=0 error=invalid_timestamp, return false")
    void expiredTimestamp_rejectedAndPersisted() {
        UserRepository userRepo = mock(UserRepository.class);
        KycSessionRepository sessionRepo = mock(KycSessionRepository.class);
        KycWebhookEventRepository eventRepo = mock(KycWebhookEventRepository.class);

        KycSessionService svc = newService(userRepo, sessionRepo, eventRepo, propsWithSecret(SECRET));
        String body = buildPayload(EVENT_ID, "Approved");
        String sig = signBody(body);

        boolean ok = svc.processDiditWebhook(body.getBytes(StandardCharsets.UTF_8), sig, expiredTimestamp());

        assertFalse(ok);
        ArgumentCaptor<KycWebhookEvent> evCap = ArgumentCaptor.forClass(KycWebhookEvent.class);
        verify(eventRepo).save(evCap.capture());
        KycWebhookEvent ev = evCap.getValue();
        assertFalse(ev.isSignatureValid());
        assertFalse(ev.isProcessed());
        assertEquals("invalid_timestamp", ev.getProcessingError());
    }

    // ---------- Test 5: session_id desconocido ----------

    @Test
    @DisplayName("(5) session_id desconocido -> persiste error 'No existe sesion KYC', return true (200, irrecuperable)")
    void unknownSessionId_persistsErrorAndReturnsTrue() {
        UserRepository userRepo = mock(UserRepository.class);
        KycSessionRepository sessionRepo = mock(KycSessionRepository.class);
        KycWebhookEventRepository eventRepo = mock(KycWebhookEventRepository.class);

        when(eventRepo.findByProviderAndProviderEventId("DIDIT", EVENT_ID))
                .thenReturn(Optional.empty());
        when(sessionRepo.findByProviderAndProviderSessionId("DIDIT", SESSION_ID))
                .thenReturn(Optional.empty());

        KycSessionService svc = newService(userRepo, sessionRepo, eventRepo, propsWithSecret(SECRET));
        String body = buildPayload(EVENT_ID, "Approved");
        String sig = signBody(body);

        boolean ok = svc.processDiditWebhook(body.getBytes(StandardCharsets.UTF_8), sig, currentTimestamp());

        assertTrue(ok);
        ArgumentCaptor<KycWebhookEvent> evCap = ArgumentCaptor.forClass(KycWebhookEvent.class);
        verify(eventRepo).save(evCap.capture());
        KycWebhookEvent ev = evCap.getValue();
        assertTrue(ev.isSignatureValid());
        assertFalse(ev.isProcessed());
        assertNotNull(ev.getProcessingError());
        assertTrue(ev.getProcessingError().toLowerCase().contains("no existe"));
        verify(userRepo, never()).save(any());
    }

    // ---------- Test 6: payload no parseable como JSON ----------

    @Test
    @DisplayName("(6) Payload no parseable como JSON -> persiste sig=1 proc=0 error=invalid_payload, return true")
    void unparseablePayload_persistsErrorAndReturnsTrue() {
        UserRepository userRepo = mock(UserRepository.class);
        KycSessionRepository sessionRepo = mock(KycSessionRepository.class);
        KycWebhookEventRepository eventRepo = mock(KycWebhookEventRepository.class);

        KycSessionService svc = newService(userRepo, sessionRepo, eventRepo, propsWithSecret(SECRET));
        String body = "not valid json";
        String sig = signBody(body);

        boolean ok = svc.processDiditWebhook(body.getBytes(StandardCharsets.UTF_8), sig, currentTimestamp());

        assertTrue(ok);
        ArgumentCaptor<KycWebhookEvent> evCap = ArgumentCaptor.forClass(KycWebhookEvent.class);
        verify(eventRepo).save(evCap.capture());
        KycWebhookEvent ev = evCap.getValue();
        assertTrue(ev.isSignatureValid());
        assertFalse(ev.isProcessed());
        assertTrue(ev.getProcessingError().startsWith("invalid_payload"));
    }

    // ---------- Test 7: transicion backwards (helper directo) ----------

    @Test
    @DisplayName("(7) isBackwardsTransition: APPROVED->REJECTED true, NULL->APPROVED false")
    void backwardsTransition_helper() {
        KycSessionService svc = newService(null, null, null, propsWithSecret(SECRET));
        assertTrue(svc.isBackwardsTransition(
                Constants.VerificationStatuses.APPROVED, Constants.VerificationStatuses.REJECTED));
        assertTrue(svc.isBackwardsTransition(
                Constants.VerificationStatuses.APPROVED, Constants.VerificationStatuses.PENDING));
        assertTrue(svc.isBackwardsTransition(
                Constants.VerificationStatuses.REJECTED, Constants.VerificationStatuses.PENDING));
        assertTrue(svc.isBackwardsTransition(
                Constants.VerificationStatuses.REJECTED, Constants.VerificationStatuses.APPROVED));
        // Transiciones legitimas (desde no-terminal o iguales)
        assertFalse(svc.isBackwardsTransition(null, Constants.VerificationStatuses.APPROVED));
        assertFalse(svc.isBackwardsTransition(
                Constants.VerificationStatuses.PENDING, Constants.VerificationStatuses.APPROVED));
        assertFalse(svc.isBackwardsTransition(
                Constants.VerificationStatuses.APPROVED, Constants.VerificationStatuses.APPROVED));
    }

    // ---------- Test 8: event_id=null -> hash sintetico ----------

    @Test
    @DisplayName("(8) event_id=null -> hash sintetico prefijo 'synth_' usado como provider_event_id")
    void nullEventId_usesSyntheticHash() {
        UserRepository userRepo = mock(UserRepository.class);
        KycSessionRepository sessionRepo = mock(KycSessionRepository.class);
        KycWebhookEventRepository eventRepo = mock(KycWebhookEventRepository.class);

        when(eventRepo.findByProviderAndProviderEventId(eq("DIDIT"), anyString()))
                .thenReturn(Optional.empty());
        when(sessionRepo.findByProviderAndProviderSessionId("DIDIT", SESSION_ID))
                .thenReturn(Optional.of(pendingClientSession(42L)));
        when(userRepo.findById(42L)).thenReturn(Optional.of(clientUser(42L)));

        KycSessionService svc = newService(userRepo, sessionRepo, eventRepo, propsWithSecret(SECRET));
        String body = buildPayload(null, "Approved");
        String sig = signBody(body);

        boolean ok = svc.processDiditWebhook(body.getBytes(StandardCharsets.UTF_8), sig, currentTimestamp());

        assertTrue(ok);
        ArgumentCaptor<KycWebhookEvent> evCap = ArgumentCaptor.forClass(KycWebhookEvent.class);
        verify(eventRepo).save(evCap.capture());
        KycWebhookEvent ev = evCap.getValue();
        assertNotNull(ev.getProviderEventId());
        assertTrue(ev.getProviderEventId().startsWith("synth_"),
                "providerEventId debe empezar con 'synth_' cuando event_id viene NULL");
        // Verifica que el hash es determinista: regenerar y comparar.
        String expected = svc.deriveSyntheticEventId(body);
        assertEquals(expected, ev.getProviderEventId());
    }

    // ---------- Test 9: race condition DataIntegrityViolationException ----------

    @Test
    @DisplayName("(9) Race: save() lanza DataIntegrityViolationException -> catch defensivo, return true sin propagar")
    void raceCondition_caughtDefensively() {
        UserRepository userRepo = mock(UserRepository.class);
        KycSessionRepository sessionRepo = mock(KycSessionRepository.class);
        KycWebhookEventRepository eventRepo = mock(KycWebhookEventRepository.class);

        when(eventRepo.findByProviderAndProviderEventId("DIDIT", EVENT_ID))
                .thenReturn(Optional.empty());
        when(sessionRepo.findByProviderAndProviderSessionId("DIDIT", SESSION_ID))
                .thenReturn(Optional.of(pendingClientSession(7L)));
        when(userRepo.findById(7L)).thenReturn(Optional.of(clientUser(7L)));
        when(eventRepo.save(any(KycWebhookEvent.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        KycSessionService svc = newService(userRepo, sessionRepo, eventRepo, propsWithSecret(SECRET));
        String body = buildPayload(EVENT_ID, "Approved");
        String sig = signBody(body);

        boolean ok = svc.processDiditWebhook(body.getBytes(StandardCharsets.UTF_8), sig, currentTimestamp());

        assertTrue(ok, "processDiditWebhook debe devolver true (no propagar excepcion) ante UNIQUE violation");
    }
}
