package com.sharemechat.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Service
public class NextRateLimitService {

    private final StringRedisTemplate redis;
    private final int limitPerWindow;
    private final Duration windowTtl;

    public NextRateLimitService(
            StringRedisTemplate redis,
            @Value("${matching.next.limit-per-window:20}") int limitPerWindow,
            @Value("${matching.next.window-seconds:60}") int windowSeconds
    ) {
        this.redis = redis;
        this.limitPerWindow = limitPerWindow;
        this.windowTtl = Duration.ofSeconds(windowSeconds);
    }

    private String key(Long userId) {
        return "rl:next:" + userId;
    }

    /**
     * @return Optional.empty() si permitido; Optional(retryAfterMs) si rate-limited
     */
    public Optional<Long> checkAndConsume(Long userId) {
        if (userId == null) return Optional.empty();

        try {
            String k = key(userId);

            Long n = redis.opsForValue().increment(k);
            if (n == null) return Optional.empty();

            if (n == 1L) {
                redis.expire(k, windowTtl);
            }

            if (n <= limitPerWindow) {
                return Optional.empty();
            }

            Long ttlSec = redis.getExpire(k);
            if (ttlSec == null || ttlSec < 0) ttlSec = (long) windowTtl.getSeconds();

            long retryAfterMs = ttlSec * 1000L;

            // Penalización suave adicional por exceso (backpressure progresivo) sin tocar lógica de negocio
            long excess = n - limitPerWindow;
            long extraMs = Math.min(8000L, excess * 400L); // cap 8s
            retryAfterMs = Math.max(retryAfterMs, extraMs);

            return Optional.of(retryAfterMs);

        } catch (DataAccessException e) {
            return Optional.empty(); // si Redis falla, no bloqueamos producto
        }
    }
}
