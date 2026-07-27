package com.sharemechat.support.service;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ADR-054 D2 b2: estado transitorio in-memory de la oferta de apertura de
 * ticket. Cuando el bot detecta senyal de incidencia, cachea aqui el
 * candidato (category + mensaje original) por conversationId; el siguiente
 * mensaje del user se interpreta como sí/no (o ambiguo). TTL 10 min: si el
 * user tarda mas en responder, se descarta y el flujo vuelve a normal.
 *
 * <p>Sin persistencia BD (aceptable: al reiniciar backend, si habia oferta
 * pendiente, el user simplemente reescribe el problema y le re-ofrecemos —
 * peor caso, un intercambio extra).
 */
@Component
public class TicketOfferPendingCache {

    static final Duration TTL = Duration.ofMinutes(10);

    private final ConcurrentHashMap<Long, PendingOffer> store = new ConcurrentHashMap<>();

    /** Guarda la oferta pendiente para la conversacion. Sustituye si ya habia. */
    public void put(Long conversationId, String category, String originalMessage) {
        if (conversationId == null || category == null) return;
        store.put(conversationId, new PendingOffer(category, originalMessage, LocalDateTime.now()));
    }

    /**
     * Devuelve la oferta si sigue vigente (TTL no expirado). Si expiro, la
     * limpia y devuelve vacio.
     */
    public Optional<PendingOffer> get(Long conversationId) {
        if (conversationId == null) return Optional.empty();
        PendingOffer p = store.get(conversationId);
        if (p == null) return Optional.empty();
        if (Duration.between(p.offeredAt, LocalDateTime.now()).compareTo(TTL) > 0) {
            store.remove(conversationId);
            return Optional.empty();
        }
        return Optional.of(p);
    }

    public void clear(Long conversationId) {
        if (conversationId != null) store.remove(conversationId);
    }

    /** Solo para tests. Limpia todo el estado in-memory. */
    void clearAll() {
        store.clear();
    }

    public static class PendingOffer {
        public final String category;
        public final String originalMessage;
        public final LocalDateTime offeredAt;

        public PendingOffer(String category, String originalMessage, LocalDateTime offeredAt) {
            this.category = category;
            this.originalMessage = originalMessage;
            this.offeredAt = offeredAt;
        }
    }
}
