package com.sharemechat.support.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ADR-054 Fase T3.5 — tests unitarios del cache in-memory de pending offers.
 */
class TicketOfferPendingCacheTest {

    private TicketOfferPendingCache cache;

    @BeforeEach
    void setUp() {
        cache = new TicketOfferPendingCache();
    }

    @Test
    @DisplayName("put + get: devuelve la oferta guardada")
    void put_and_get() {
        cache.put(100L, "STREAM_INTERRUPTED", "se cayo el stream");
        Optional<TicketOfferPendingCache.PendingOffer> p = cache.get(100L);
        assertTrue(p.isPresent());
        assertEquals("STREAM_INTERRUPTED", p.get().category);
        assertEquals("se cayo el stream", p.get().originalMessage);
    }

    @Test
    @DisplayName("get sin put previo -> Optional.empty")
    void get_without_put_empty() {
        assertTrue(cache.get(200L).isEmpty());
    }

    @Test
    @DisplayName("clear elimina la entrada")
    void clear_removes() {
        cache.put(100L, "OTHER", "algo");
        cache.clear(100L);
        assertTrue(cache.get(100L).isEmpty());
    }

    @Test
    @DisplayName("put sustituye entrada previa por la misma conversationId")
    void put_replaces_previous() {
        cache.put(100L, "OTHER", "primera");
        cache.put(100L, "ACCOUNT_ISSUE", "segunda");
        Optional<TicketOfferPendingCache.PendingOffer> p = cache.get(100L);
        assertEquals("ACCOUNT_ISSUE", p.get().category);
        assertEquals("segunda", p.get().originalMessage);
    }

    @Test
    @DisplayName("TTL expirado -> get devuelve empty + limpia entrada")
    @SuppressWarnings("unchecked")
    void ttl_expiration() throws Exception {
        cache.put(100L, "OTHER", "hola");
        // Forzar offeredAt a hace 20 min (>10 min TTL).
        Field storeField = TicketOfferPendingCache.class.getDeclaredField("store");
        storeField.setAccessible(true);
        ConcurrentHashMap<Long, TicketOfferPendingCache.PendingOffer> store =
                (ConcurrentHashMap<Long, TicketOfferPendingCache.PendingOffer>) storeField.get(cache);
        TicketOfferPendingCache.PendingOffer expired =
                new TicketOfferPendingCache.PendingOffer("OTHER", "hola", LocalDateTime.now().minusMinutes(20));
        store.put(100L, expired);
        assertTrue(cache.get(100L).isEmpty());
        // Entrada expirada tambien limpiada del store.
        assertNull(store.get(100L));
    }

    @Test
    @DisplayName("null conversationId no rompe")
    void null_safe() {
        cache.put(null, "OTHER", "x");
        assertTrue(cache.get(null).isEmpty());
        cache.clear(null);
    }
}
