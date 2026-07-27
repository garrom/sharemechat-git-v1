package com.sharemechat.support.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.entity.PaymentSession;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.entity.StreamStatusEvent;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.repository.PaymentSessionRepository;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.repository.StreamStatusEventRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.support.entity.SupportTicket;
import com.sharemechat.support.repository.SupportTicketRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * ADR-054 Fase T1.6 — tests unitarios de {@link TicketVerificationService}.
 * Cubre las 2 categorias soportadas en T1 (STREAM_INTERRUPTED,
 * PAYMENT_NOT_CREDITED) y el fallback NEUTRAL para categorias sin checks.
 */
class TicketVerificationServiceTest {

    private SupportTicketRepository ticketRepo;
    private StreamRecordRepository streamRepo;
    private StreamStatusEventRepository streamEventsRepo;
    private PaymentSessionRepository paymentRepo;
    private TransactionRepository txRepo;
    private TicketVerificationService svc;
    private ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ticketRepo = mock(SupportTicketRepository.class);
        streamRepo = mock(StreamRecordRepository.class);
        streamEventsRepo = mock(StreamStatusEventRepository.class);
        paymentRepo = mock(PaymentSessionRepository.class);
        txRepo = mock(TransactionRepository.class);
        when(ticketRepo.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));
        svc = new TicketVerificationService(ticketRepo, streamRepo, streamEventsRepo,
                paymentRepo, txRepo, mapper);
    }

    // ============================================================
    // STREAM_INTERRUPTED
    // ============================================================

    @Test
    @DisplayName("STREAM_INTERRUPTED sin linkedStreamRecordId -> NEUTRAL con nota")
    void stream_interrupted_no_link_neutral() throws Exception {
        SupportTicket t = ticket(1L, 10L, "STREAM_INTERRUPTED");
        when(ticketRepo.findById(1L)).thenReturn(Optional.of(t));

        JsonNode res = mapper.readTree(svc.verify(1L));
        assertEquals("NEUTRAL", res.get("signalStrength").asText());
        assertEquals("MANUAL_REVIEW", res.get("recommendation").asText());
    }

    @Test
    @DisplayName("STREAM_INTERRUPTED con evento DISCONNECT -> STRONG_POSITIVE")
    void stream_interrupted_with_disconnect_strong_positive() throws Exception {
        SupportTicket t = ticket(1L, 10L, "STREAM_INTERRUPTED");
        t.setLinkedStreamRecordId(500L);
        when(ticketRepo.findById(1L)).thenReturn(Optional.of(t));

        StreamRecord sr = streamRecord(500L, 10L, 20L,
                LocalDateTime.now().minusMinutes(10),
                LocalDateTime.now().minusMinutes(7));
        when(streamRepo.findById(500L)).thenReturn(Optional.of(sr));

        StreamStatusEvent ev = new StreamStatusEvent();
        setField(ev, "eventType", "DISCONNECT");
        setField(ev, "createdAt", LocalDateTime.now().minusMinutes(7));
        when(streamEventsRepo.findByStreamRecordIdOrderByCreatedAtDesc(eq(500L), any(Pageable.class)))
                .thenReturn(List.of(ev));

        JsonNode res = mapper.readTree(svc.verify(1L));
        assertEquals("STRONG_POSITIVE", res.get("signalStrength").asText());
    }

    @Test
    @DisplayName("STREAM_INTERRUPTED con stream vivo (sin end_time) -> NEGATIVE")
    void stream_interrupted_still_alive_negative() throws Exception {
        SupportTicket t = ticket(1L, 10L, "STREAM_INTERRUPTED");
        t.setLinkedStreamRecordId(500L);
        when(ticketRepo.findById(1L)).thenReturn(Optional.of(t));

        StreamRecord sr = streamRecord(500L, 10L, 20L,
                LocalDateTime.now().minusMinutes(1), null); // sin end_time
        when(streamRepo.findById(500L)).thenReturn(Optional.of(sr));
        when(streamEventsRepo.findByStreamRecordIdOrderByCreatedAtDesc(eq(500L), any(Pageable.class)))
                .thenReturn(List.of());

        JsonNode res = mapper.readTree(svc.verify(1L));
        assertEquals("NEGATIVE", res.get("signalStrength").asText());
    }

    @Test
    @DisplayName("STREAM_INTERRUPTED con user distinto al client/model del stream -> NEGATIVE (posible fraude)")
    void stream_interrupted_wrong_owner_negative() throws Exception {
        SupportTicket t = ticket(1L, 999L, "STREAM_INTERRUPTED"); // userId 999 no coincide
        t.setLinkedStreamRecordId(500L);
        when(ticketRepo.findById(1L)).thenReturn(Optional.of(t));

        StreamRecord sr = streamRecord(500L, 10L, 20L,
                LocalDateTime.now().minusMinutes(10),
                LocalDateTime.now().minusMinutes(7));
        when(streamRepo.findById(500L)).thenReturn(Optional.of(sr));

        JsonNode res = mapper.readTree(svc.verify(1L));
        assertEquals("NEGATIVE", res.get("signalStrength").asText());
    }

    // ============================================================
    // PAYMENT_NOT_CREDITED
    // ============================================================

    @Test
    @DisplayName("PAYMENT_NOT_CREDITED con session SUCCESS pero sin Transaction match -> STRONG_POSITIVE")
    void payment_not_credited_success_but_no_tx_strong_positive() throws Exception {
        SupportTicket t = ticket(1L, 10L, "PAYMENT_NOT_CREDITED");
        t.setLinkedPaymentSessionId(700L);
        when(ticketRepo.findById(1L)).thenReturn(Optional.of(t));

        PaymentSession ps = paymentSession(700L, 10L, "SUCCESS",
                new BigDecimal("10.00"), "order-abc-123");
        when(paymentRepo.findById(700L)).thenReturn(Optional.of(ps));

        // Sin transactions matching orderId.
        when(txRepo.findAll(any(Pageable.class))).thenReturn(
                new PageImpl<>(List.of()));

        JsonNode res = mapper.readTree(svc.verify(1L));
        assertEquals("STRONG_POSITIVE", res.get("signalStrength").asText());
    }

    @Test
    @DisplayName("PAYMENT_NOT_CREDITED con session FAILED -> NEUTRAL (rechazo legitimo, no incidencia)")
    void payment_not_credited_failed_neutral() throws Exception {
        SupportTicket t = ticket(1L, 10L, "PAYMENT_NOT_CREDITED");
        t.setLinkedPaymentSessionId(700L);
        when(ticketRepo.findById(1L)).thenReturn(Optional.of(t));

        PaymentSession ps = paymentSession(700L, 10L, "FAILED",
                new BigDecimal("10.00"), "order-abc-123");
        when(paymentRepo.findById(700L)).thenReturn(Optional.of(ps));

        JsonNode res = mapper.readTree(svc.verify(1L));
        assertEquals("NEUTRAL", res.get("signalStrength").asText());
    }

    // ============================================================
    // Categoria no soportada en T1
    // ============================================================

    @Test
    @DisplayName("MODERATION_FALSE_POSITIVE en T1 -> NEUTRAL con nota (sin checks automaticos T1)")
    void moderation_no_checks_in_t1() throws Exception {
        SupportTicket t = ticket(1L, 10L, "MODERATION_FALSE_POSITIVE");
        when(ticketRepo.findById(1L)).thenReturn(Optional.of(t));
        JsonNode res = mapper.readTree(svc.verify(1L));
        assertEquals("NEUTRAL", res.get("signalStrength").asText());
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static SupportTicket ticket(Long id, Long userId, String category) {
        SupportTicket t = new SupportTicket();
        t.setUserId(userId);
        t.setCategory(category);
        t.setStatus("INVESTIGATING");
        t.setDescription("test");
        setField(t, "id", id);
        return t;
    }

    private static StreamRecord streamRecord(Long id, Long clientUserId, Long modelUserId,
                                             LocalDateTime start, LocalDateTime end) {
        StreamRecord sr = new StreamRecord();
        User client = new User(); setField(client, "id", clientUserId);
        User model = new User(); setField(model, "id", modelUserId);
        setField(sr, "id", id);
        setField(sr, "client", client);
        setField(sr, "model", model);
        setField(sr, "startTime", start);
        setField(sr, "endTime", end);
        setField(sr, "streamType", "RANDOM");
        return sr;
    }

    private static PaymentSession paymentSession(Long id, Long userId, String status,
                                                 BigDecimal amount, String orderId) {
        PaymentSession ps = new PaymentSession();
        User u = new User(); setField(u, "id", userId);
        setField(ps, "id", id);
        setField(ps, "user", u);
        setField(ps, "status", status);
        setField(ps, "amount", amount);
        setField(ps, "orderId", orderId);
        setField(ps, "packId", "P10");
        setField(ps, "currency", "EUR");
        setField(ps, "createdAt", LocalDateTime.now().minusHours(1));
        return ps;
    }

    private static void setField(Object obj, String fieldName, Object value) {
        try {
            java.lang.reflect.Field f = null;
            Class<?> c = obj.getClass();
            while (c != null && f == null) {
                try { f = c.getDeclaredField(fieldName); }
                catch (NoSuchFieldException nsfe) { c = c.getSuperclass(); }
            }
            if (f == null) throw new NoSuchFieldException(fieldName);
            f.setAccessible(true);
            f.set(obj, value);
        } catch (ReflectiveOperationException ex) {
            throw new RuntimeException(ex);
        }
    }

    // Mockito eq bridge (evita colision con anyLong).
    private static <T> T eq(T value) { return org.mockito.ArgumentMatchers.eq(value); }
}
