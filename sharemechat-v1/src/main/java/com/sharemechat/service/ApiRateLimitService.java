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

    private final int refreshLimitPerWindow;
    private final Duration refreshWindow;

    private final int resetLimitPerWindow;
    private final Duration resetWindow;

    private final int registerLimitPerWindow;
    private final Duration registerWindow;

    private final int wsMsgLimitPerWindow;
    private final Duration wsMsgWindow;

    private final int wsCallLimitPerWindow;
    private final Duration wsCallWindow;

    private final int wsPingLimitPerWindow;
    private final Duration wsPingWindow;

    public ApiRateLimitService(
            StringRedisTemplate redis,
            @Value("${security.ratelimit.login.limit:10}") int loginLimitPerWindow,
            @Value("${security.ratelimit.login.window-seconds:300}") int loginWindowSeconds,

            @Value("${security.ratelimit.refresh.limit:60}") int refreshLimitPerWindow,
            @Value("${security.ratelimit.refresh.window-seconds:300}") int refreshWindowSeconds,

            @Value("${security.ratelimit.reset.limit:5}") int resetLimitPerWindow,
            @Value("${security.ratelimit.reset.window-seconds:900}") int resetWindowSeconds,

            @Value("${security.ratelimit.register.limit:5}") int registerLimitPerWindow,
            @Value("${security.ratelimit.register.window-seconds:900}") int registerWindowSeconds,

            @Value("${security.ratelimit.ws.msg.limit:20}") int wsMsgLimitPerWindow,
            @Value("${security.ratelimit.ws.msg.window-seconds:10}") int wsMsgWindowSeconds,

            @Value("${security.ratelimit.ws.call.limit:5}") int wsCallLimitPerWindow,
            @Value("${security.ratelimit.ws.call.window-seconds:60}") int wsCallWindowSeconds,

            @Value("${security.ratelimit.ws.ping.limit:30}") int wsPingLimitPerWindow,
            @Value("${security.ratelimit.ws.ping.window-seconds:10}") int wsPingWindowSeconds

    ) {
        this.redis = redis;

        this.loginLimitPerWindow = loginLimitPerWindow;
        this.loginWindow = Duration.ofSeconds(loginWindowSeconds);

        this.refreshLimitPerWindow = refreshLimitPerWindow;
        this.refreshWindow = Duration.ofSeconds(refreshWindowSeconds);

        this.resetLimitPerWindow = resetLimitPerWindow;
        this.resetWindow = Duration.ofSeconds(resetWindowSeconds);

        this.registerLimitPerWindow = registerLimitPerWindow;
        this.registerWindow = Duration.ofSeconds(registerWindowSeconds);

        this.wsMsgLimitPerWindow = wsMsgLimitPerWindow;
        this.wsMsgWindow = Duration.ofSeconds(wsMsgWindowSeconds);

        this.wsCallLimitPerWindow = wsCallLimitPerWindow;
        this.wsCallWindow = Duration.ofSeconds(wsCallWindowSeconds);

        this.wsPingLimitPerWindow = wsPingLimitPerWindow;
        this.wsPingWindow = Duration.ofSeconds(wsPingWindowSeconds);

    }

    // =========================
    // LOGIN
    // =========================

    // IP-only (para usar en filtro)
    public void checkLoginIp(String ip) {
        consumeOrThrow(key("login:ip", ip), loginLimitPerWindow, loginWindow, "Demasiados intentos de login");
    }

    // Email-only (para usar en controller, donde ya tienes dto.getEmail())
    public void checkLoginEmail(String email) {
        if (email == null || email.isBlank()) return;
        consumeOrThrow(key("login:email", email.toLowerCase()), loginLimitPerWindow, loginWindow, "Demasiados intentos de login");
    }

    // =========================
    // REFRESH
    // =========================

    // IP-only (filtro + controller si quieres)
    public void checkRefreshIp(String ip) {
        consumeOrThrow(key("refresh:ip", ip), refreshLimitPerWindow, refreshWindow, "Demasiadas solicitudes de refresh");
    }

    // User-only (controller, cuando ya sabes userId)
    public void checkRefreshUser(Long userId) {
        if (userId == null) return;
        consumeOrThrow(key("refresh:user", String.valueOf(userId)), refreshLimitPerWindow, refreshWindow, "Demasiadas solicitudes de refresh");
    }

    // =========================
    // PASSWORD RESET
    // =========================

    // IP-only (filtro)
    public void checkPasswordResetIp(String ip) {
        consumeOrThrow(key("reset:ip", ip), resetLimitPerWindow, resetWindow, "Demasiadas solicitudes de reset");
    }

    // Email-only (controller)
    public void checkPasswordResetEmail(String email) {
        if (email == null || email.isBlank()) return;
        consumeOrThrow(key("reset:email", email.toLowerCase()), resetLimitPerWindow, resetWindow, "Demasiadas solicitudes de reset");
    }

    // =========================
    // REGISTER
    // =========================

    public void checkRegister(String ip) {
        consumeOrThrow(key("register:ip", ip), registerLimitPerWindow, registerWindow, "Demasiados registros desde esta IP");
    }

    // =========================
    // CORE
    // =========================

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

            if (n <= limit) return;

            Long ttlSec = redis.getExpire(redisKey);
            if (ttlSec == null || ttlSec < 0) ttlSec = window.getSeconds();

            long retryAfterMs = ttlSec * 1000L;
            throw new TooManyRequestsException(msg, retryAfterMs);

        } catch (DataAccessException e) {
            // Si Redis cae: NO bloqueamos el producto
        }
    }

    // =========================
    // WS /messages
    // =========================

    public void checkWsMsgUser(Long userId) {
        if (userId == null) return;
        consumeOrThrow(key("ws:msg:user", String.valueOf(userId)), wsMsgLimitPerWindow, wsMsgWindow,
                "Demasiados mensajes");
    }

    public void checkWsCallUser(Long userId) {
        if (userId == null) return;
        consumeOrThrow(key("ws:call:user", String.valueOf(userId)), wsCallLimitPerWindow, wsCallWindow,
                "Demasiadas llamadas");
    }

    public void checkWsPingUser(Long userId) {
        if (userId == null) return;
        consumeOrThrow(key("ws:ping:user", String.valueOf(userId)), wsPingLimitPerWindow, wsPingWindow,
                "Demasiados pings");
    }


}
