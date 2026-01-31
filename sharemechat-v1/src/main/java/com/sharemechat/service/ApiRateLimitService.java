package com.sharemechat.service;

import com.sharemechat.exception.TooManyRequestsException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class ApiRateLimitService {

    private final StringRedisTemplate redis;

    private final int loginLimitPerWindow;
    private final Duration loginWindow;

    private final int resetLimitPerWindow;
    private final Duration resetWindow;

    private final int registerLimitPerWindow;
    private final Duration registerWindow;

    public ApiRateLimitService(
            StringRedisTemplate redis,
            @Value("${security.ratelimit.login.limit:10}") int loginLimitPerWindow,
            @Value("${security.ratelimit.login.window-seconds:300}") int loginWindowSeconds,
            @Value("${security.ratelimit.reset.limit:5}") int resetLimitPerWindow,
            @Value("${security.ratelimit.reset.window-seconds:900}") int resetWindowSeconds,
            @Value("${security.ratelimit.register.limit:5}") int registerLimitPerWindow,
            @Value("${security.ratelimit.register.window-seconds:900}") int registerWindowSeconds
    ) {
        this.redis = redis;

        this.loginLimitPerWindow = loginLimitPerWindow;
        this.loginWindow = Duration.ofSeconds(loginWindowSeconds);

        this.resetLimitPerWindow = resetLimitPerWindow;
        this.resetWindow = Duration.ofSeconds(resetWindowSeconds);

        this.registerLimitPerWindow = registerLimitPerWindow;
        this.registerWindow = Duration.ofSeconds(registerWindowSeconds);
    }

    public void checkLogin(String ip, String emailMaybe) {
        // Por IP + por email (si llega) para evitar bruteforce distribuido
        consumeOrThrow(key("login:ip", ip), loginLimitPerWindow, loginWindow, "Demasiados intentos de login");
        if (emailMaybe != null && !emailMaybe.isBlank()) {
            consumeOrThrow(key("login:email", emailMaybe.toLowerCase()), loginLimitPerWindow, loginWindow, "Demasiados intentos de login");
        }
    }

    public void checkPasswordReset(String ip, String emailMaybe) {
        consumeOrThrow(key("reset:ip", ip), resetLimitPerWindow, resetWindow, "Demasiadas solicitudes de reset");
        if (emailMaybe != null && !emailMaybe.isBlank()) {
            consumeOrThrow(key("reset:email", emailMaybe.toLowerCase()), resetLimitPerWindow, resetWindow, "Demasiadas solicitudes de reset");
        }
    }

    public void checkRegister(String ip) {
        consumeOrThrow(key("register:ip", ip), registerLimitPerWindow, registerWindow, "Demasiados registros desde esta IP");
    }

    private String key(String scope, String id) {
        String safe = (id == null || id.isBlank()) ? "unknown" : id.trim();
        return "rl:api:" + scope + ":" + safe;
    }

    private void consumeOrThrow(String redisKey, int limit, Duration window, String msg) {
        try {
            Long n = redis.opsForValue().increment(redisKey);
            if (n == null) return;

            if (n == 1L) {
                redis.expire(redisKey, window);
            }

            if (n <= limit) {
                return;
            }

            Long ttlSec = redis.getExpire(redisKey);
            if (ttlSec == null || ttlSec < 0) ttlSec = window.getSeconds();

            long retryAfterMs = ttlSec * 1000L;
            throw new TooManyRequestsException(msg, retryAfterMs);

        } catch (DataAccessException e) {
            // Si Redis cae: NO bloqueamos el producto (industrial pragmático)
        }
    }
}
