package com.sharemechat.streammoderation.service;

import com.sharemechat.entity.Model;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.streammoderation.config.ModelBanProperties;
import com.sharemechat.streammoderation.entity.ModelModerationBan;
import com.sharemechat.streammoderation.entity.ModelModerationStrike;
import com.sharemechat.streammoderation.repository.ModelModerationBanRepository;
import com.sharemechat.streammoderation.repository.ModelModerationStrikeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-037 frente trial-sfw Bloque 3: tests unitarios del motor de bans.
 * Cubren la escalada 15/30/60/360/1440 min, la ventana rodante de 30
 * dias, la idempotencia por session_id y la marca de manual_review a
 * partir del 5o strike.
 */
class ModelBanServiceTest {

    private ModelModerationStrikeRepository strikeRepo;
    private ModelModerationBanRepository banRepo;
    private ModelRepository modelRepo;
    private ModelBanProperties props;
    private ModelBanService svc;

    private Model model;

    @BeforeEach
    void setUp() {
        strikeRepo = mock(ModelModerationStrikeRepository.class);
        banRepo = mock(ModelModerationBanRepository.class);
        modelRepo = mock(ModelRepository.class);
        props = new ModelBanProperties();
        // Defaults: 15/30/60/360/1440 min, ventana 30 dias, manualReview desde 5
        svc = new ModelBanService(strikeRepo, banRepo, modelRepo, props);

        model = new Model();
        model.setUserId(42L);
        when(modelRepo.findById(42L)).thenReturn(Optional.of(model));

        // save del strike devuelve el mismo objeto con id sinteizado
        when(strikeRepo.saveAndFlush(any(ModelModerationStrike.class))).thenAnswer(inv -> {
            ModelModerationStrike s = inv.getArgument(0);
            // simular id generado
            java.lang.reflect.Field f;
            try {
                f = ModelModerationStrike.class.getDeclaredField("id");
                f.setAccessible(true);
                f.set(s, 1000L);
            } catch (Exception ignore) { /* noop */ }
            return s;
        });
    }

    @Test
    @DisplayName("1er strike -> ban 15 min + manualReview=false")
    void firstStrike15min() {
        when(strikeRepo.existsByStreamModerationSessionId(anyLong())).thenReturn(false);
        when(strikeRepo.countByModelUserIdAndCreatedAtGreaterThanEqual(eq(42L), any(LocalDateTime.class)))
                .thenReturn(1L);

        svc.recordStrike(42L, 500L, "CRITICAL", "NUDITY");

        ArgumentCaptor<ModelModerationBan> cap = ArgumentCaptor.forClass(ModelModerationBan.class);
        verify(banRepo).save(cap.capture());
        ModelModerationBan ban = cap.getValue();
        assertEquals(1, ban.getStrikeCountAtBan());
        assertEquals(42L, ban.getModelUserId());
        assertTrue(ban.getBanEndsAt().isAfter(LocalDateTime.now().plusMinutes(14)));
        assertTrue(ban.getBanEndsAt().isBefore(LocalDateTime.now().plusMinutes(16)));
        assertEquals(false, ban.isRequiresManualReview());
        assertNotNull(model.getStreamingBannedUntil());
    }

    @Test
    @DisplayName("2o strike -> 30 min")
    void secondStrike30min() {
        when(strikeRepo.existsByStreamModerationSessionId(anyLong())).thenReturn(false);
        when(strikeRepo.countByModelUserIdAndCreatedAtGreaterThanEqual(eq(42L), any(LocalDateTime.class)))
                .thenReturn(2L);

        svc.recordStrike(42L, 501L, "CRITICAL", "NUDITY");

        ArgumentCaptor<ModelModerationBan> cap = ArgumentCaptor.forClass(ModelModerationBan.class);
        verify(banRepo).save(cap.capture());
        assertEquals(2, cap.getValue().getStrikeCountAtBan());
        assertTrue(cap.getValue().getBanEndsAt().isAfter(LocalDateTime.now().plusMinutes(29)));
        assertTrue(cap.getValue().getBanEndsAt().isBefore(LocalDateTime.now().plusMinutes(31)));
    }

    @Test
    @DisplayName("3er strike -> 60 min")
    void thirdStrike60min() {
        when(strikeRepo.existsByStreamModerationSessionId(anyLong())).thenReturn(false);
        when(strikeRepo.countByModelUserIdAndCreatedAtGreaterThanEqual(eq(42L), any(LocalDateTime.class)))
                .thenReturn(3L);

        svc.recordStrike(42L, 502L, "CRITICAL", "NUDITY");

        ArgumentCaptor<ModelModerationBan> cap = ArgumentCaptor.forClass(ModelModerationBan.class);
        verify(banRepo).save(cap.capture());
        assertEquals(3, cap.getValue().getStrikeCountAtBan());
        assertTrue(cap.getValue().getBanEndsAt().isAfter(LocalDateTime.now().plusMinutes(59)));
        assertTrue(cap.getValue().getBanEndsAt().isBefore(LocalDateTime.now().plusMinutes(61)));
    }

    @Test
    @DisplayName("4o strike -> 6 h")
    void fourthStrike6h() {
        when(strikeRepo.existsByStreamModerationSessionId(anyLong())).thenReturn(false);
        when(strikeRepo.countByModelUserIdAndCreatedAtGreaterThanEqual(eq(42L), any(LocalDateTime.class)))
                .thenReturn(4L);

        svc.recordStrike(42L, 503L, "CRITICAL", "NUDITY");

        ArgumentCaptor<ModelModerationBan> cap = ArgumentCaptor.forClass(ModelModerationBan.class);
        verify(banRepo).save(cap.capture());
        assertEquals(4, cap.getValue().getStrikeCountAtBan());
        assertTrue(cap.getValue().getBanEndsAt().isAfter(LocalDateTime.now().plusMinutes(359)));
        assertTrue(cap.getValue().getBanEndsAt().isBefore(LocalDateTime.now().plusMinutes(361)));
    }

    @Test
    @DisplayName("5o strike -> 24 h + requires_manual_review=true")
    void fifthStrike24hAndManualReview() {
        when(strikeRepo.existsByStreamModerationSessionId(anyLong())).thenReturn(false);
        when(strikeRepo.countByModelUserIdAndCreatedAtGreaterThanEqual(eq(42L), any(LocalDateTime.class)))
                .thenReturn(5L);

        svc.recordStrike(42L, 504L, "CRITICAL", "NUDITY");

        ArgumentCaptor<ModelModerationBan> cap = ArgumentCaptor.forClass(ModelModerationBan.class);
        verify(banRepo).save(cap.capture());
        assertEquals(5, cap.getValue().getStrikeCountAtBan());
        assertTrue(cap.getValue().getBanEndsAt().isAfter(LocalDateTime.now().plusMinutes(1439)));
        assertTrue(cap.getValue().getBanEndsAt().isBefore(LocalDateTime.now().plusMinutes(1441)));
        assertTrue(cap.getValue().isRequiresManualReview());
    }

    @Test
    @DisplayName("6o+ strike -> 24 h (mantiene ultimo tier de escalada)")
    void sixthStrikeStillsAt24h() {
        when(strikeRepo.existsByStreamModerationSessionId(anyLong())).thenReturn(false);
        when(strikeRepo.countByModelUserIdAndCreatedAtGreaterThanEqual(eq(42L), any(LocalDateTime.class)))
                .thenReturn(9L);

        svc.recordStrike(42L, 505L, "CRITICAL", "NUDITY");

        ArgumentCaptor<ModelModerationBan> cap = ArgumentCaptor.forClass(ModelModerationBan.class);
        verify(banRepo).save(cap.capture());
        assertTrue(cap.getValue().getBanEndsAt().isAfter(LocalDateTime.now().plusMinutes(1439)));
        assertTrue(cap.getValue().isRequiresManualReview());
    }

    @Test
    @DisplayName("Strike sobre sesion ya con strike previo -> no-op (idempotencia UK)")
    void duplicateStrikeIsNoop() {
        when(strikeRepo.existsByStreamModerationSessionId(500L)).thenReturn(true);

        svc.recordStrike(42L, 500L, "CRITICAL", "NUDITY");

        verify(strikeRepo, never()).saveAndFlush(any());
        verify(banRepo, never()).save(any());
    }

    @Test
    @DisplayName("computeBanDurationMinutes: mapping directo con escalada por defecto")
    void computeBanDurationMinutesEscalation() {
        assertEquals(15L, svc.computeBanDurationMinutes(1));
        assertEquals(30L, svc.computeBanDurationMinutes(2));
        assertEquals(60L, svc.computeBanDurationMinutes(3));
        assertEquals(360L, svc.computeBanDurationMinutes(4));
        assertEquals(1440L, svc.computeBanDurationMinutes(5));
        // Sobre el limite superior mantiene 24h
        assertEquals(1440L, svc.computeBanDurationMinutes(20));
    }
}
