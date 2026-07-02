package com.sharemechat.support.service;

import com.sharemechat.support.config.ClaudeApiProperties;
import com.sharemechat.support.entity.SupportRateLimitDaily;
import com.sharemechat.support.repository.SupportRateLimitDailyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SupportRateLimitServiceTest {

    private SupportRateLimitDailyRepository repo;
    private ClaudeApiProperties props;
    private SupportRateLimitService svc;

    @BeforeEach
    void setUp() {
        repo = mock(SupportRateLimitDailyRepository.class);
        props = mock(ClaudeApiProperties.class);
        when(props.getRateLimitMessagesPerDay()).thenReturn(30);
        when(props.getRateLimitTokensPerDay()).thenReturn(50000L);
        when(repo.save(any(SupportRateLimitDaily.class))).thenAnswer(inv -> inv.getArgument(0));
        svc = new SupportRateLimitService(repo, props);
    }

    @Test
    @DisplayName("shouldRateLimit sin fila -> false")
    void notLimitedNoRow() {
        when(repo.findByUserIdAndUsageDate(anyLong(), any())).thenReturn(Optional.empty());
        assertFalse(svc.shouldRateLimit(1L));
    }

    @Test
    @DisplayName("shouldRateLimit por mensajes >= cap -> true")
    void limitedByMessages() {
        SupportRateLimitDaily r = new SupportRateLimitDaily();
        r.setMessagesCount(30);
        r.setTokensCount(10L);
        when(repo.findByUserIdAndUsageDate(anyLong(), any())).thenReturn(Optional.of(r));
        assertTrue(svc.shouldRateLimit(1L));
    }

    @Test
    @DisplayName("shouldRateLimit por tokens >= cap -> true")
    void limitedByTokens() {
        SupportRateLimitDaily r = new SupportRateLimitDaily();
        r.setMessagesCount(5);
        r.setTokensCount(50000L);
        when(repo.findByUserIdAndUsageDate(anyLong(), any())).thenReturn(Optional.of(r));
        assertTrue(svc.shouldRateLimit(1L));
    }

    @Test
    @DisplayName("registerUsage incrementa contador messages y tokens")
    void registerUsageIncrements() {
        when(repo.findByUserIdAndUsageDate(anyLong(), any())).thenReturn(Optional.empty());
        SupportRateLimitDaily saved = svc.registerUsage(7L, 250);
        assertEquals(1, saved.getMessagesCount());
        assertEquals(250L, saved.getTokensCount());
        assertNull(saved.getExceededAt());
    }

    @Test
    @DisplayName("registerUsage al cruzar cap tokens -> exceeded_at poblado")
    void exceededAtSet() {
        SupportRateLimitDaily existing = new SupportRateLimitDaily();
        existing.setUserId(7L);
        existing.setUsageDate(LocalDate.now(ZoneOffset.UTC));
        existing.setMessagesCount(5);
        existing.setTokensCount(49900L);
        when(repo.findByUserIdAndUsageDate(anyLong(), any())).thenReturn(Optional.of(existing));

        SupportRateLimitDaily saved = svc.registerUsage(7L, 200);
        assertEquals(6, saved.getMessagesCount());
        assertEquals(50100L, saved.getTokensCount());
        assertNotNull(saved.getExceededAt());
    }

    @Test
    @DisplayName("remainingMessages sin fila -> cap completo")
    void remainingFull() {
        when(repo.findByUserIdAndUsageDate(anyLong(), any())).thenReturn(Optional.empty());
        assertEquals(30, svc.remainingMessages(1L));
        assertEquals(50000L, svc.remainingTokens(1L));
    }
}
