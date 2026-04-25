package com.sharemechat.service;

import com.sharemechat.constants.AuthRiskConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class AuthRiskService {

    private static final Logger log = LoggerFactory.getLogger(AuthRiskService.class);

    private final StringRedisTemplate redis;
    private final boolean enabled;
    private final String env;
    private final String salt;
    private final Duration shortTtl;
    private final Duration longTtl;

    private final boolean responseEnabled;
    private final long highDelayMinMs;
    private final long highDelayMaxMs;
    private final Duration criticalBlockTtl;

    private final AtomicBoolean saltWarnLogged = new AtomicBoolean(false);

    public AuthRiskService(
            StringRedisTemplate redis,
            @Value("${authrisk.enabled:false}") boolean enabled,
            @Value("${authrisk.env:local}") String env,
            @Value("${authrisk.email-hash-salt:}") String salt,
            @Value("${authrisk.ttl.short-seconds:900}") int shortSeconds,
            @Value("${authrisk.ttl.long-seconds:3600}") int longSeconds,
            @Value("${authrisk.response.enabled:false}") boolean responseEnabled,
            @Value("${authrisk.response.high-delay-min-ms:750}") long highDelayMinMs,
            @Value("${authrisk.response.high-delay-max-ms:1500}") long highDelayMaxMs,
            @Value("${authrisk.response.critical-block-seconds:600}") int criticalBlockSeconds
    ) {
        this.redis = redis;
        this.enabled = enabled;
        this.env = (env == null || env.isBlank()) ? "local" : env;
        this.salt = salt;
        this.shortTtl = Duration.ofSeconds(shortSeconds);
        this.longTtl = Duration.ofSeconds(longSeconds);
        this.responseEnabled = responseEnabled;
        this.highDelayMinMs = Math.max(0L, highDelayMinMs);
        this.highDelayMaxMs = Math.max(this.highDelayMinMs, highDelayMaxMs);
        this.criticalBlockTtl = Duration.ofSeconds(Math.max(1, criticalBlockSeconds));
    }

    public boolean isEmailBlocked(AuthRiskContext ctx) {
        if (!enabled || !responseEnabled) return false;
        if (ctx == null) return false;
        if (salt == null || salt.isBlank()) return false;
        if (ctx.emailHash() == null || ctx.emailHash().isBlank() || "-".equals(ctx.emailHash())) return false;
        try {
            Boolean exists = redis.hasKey(keyLoginBlockEmail(ctx));
            return Boolean.TRUE.equals(exists);
        } catch (DataAccessException e) {
            return false;
        }
    }

    public AuthRiskContext buildContext(String ip, String userAgent, String email, Long userId, String channel) {
        return AuthRiskContext.of(ip, userAgent, email, userId, channel, env, salt);
    }

    public void record(String event, AuthRiskContext ctx) {
        if (!enabled) return;
        if (event == null || ctx == null) return;

        if (salt == null || salt.isBlank()) {
            if (saltWarnLogged.compareAndSet(false, true)) {
                log.warn("[AUTH-RISK] enabled=true pero authrisk.email-hash-salt vacío. Funcionando en modo no-op.");
            }
            return;
        }

        try {
            // Si el email está bloqueado y se trata de un FAILURE, no contaminar métricas:
            // solo loguear con reason temporal_block_active y salir.
            if (AuthRiskConstants.Events.LOGIN_FAILURE.equals(event) && isEmailBlocked(ctx)) {
                List<String> blockReasons = new ArrayList<>();
                blockReasons.add(AuthRiskConstants.Reasons.TEMPORAL_BLOCK_ACTIVE);
                emitLog(event, ctx, AuthRiskConstants.Levels.CRITICAL, 100, blockReasons);
                return;
            }

            switch (event) {
                case AuthRiskConstants.Events.LOGIN_ATTEMPT -> updateSetsForLogin(ctx);
                case AuthRiskConstants.Events.LOGIN_FAILURE -> {
                    incrementFailures(ctx);
                    updateSetsForLogin(ctx);
                }
                case AuthRiskConstants.Events.LOGIN_SUCCESS -> {
                    // no incrementa fallos, solo lee para scoring
                }
                default -> {
                    return;
                }
            }

            int failsByEmail = readCounter(keyLoginFailEmail(ctx));
            int failsByIp = readCounter(keyLoginFailIp(ctx));
            long distinctIpsByEmail = readSetSize(keyLoginIpsByEmail(ctx));
            long distinctEmailsByIp = readSetSize(keyLoginEmailsByIp(ctx));

            List<String> reasons = new ArrayList<>();
            int score = 0;

            if (failsByEmail >= 5) {
                score += 40;
                reasons.add("email_fail_5");
            } else if (failsByEmail >= 3) {
                score += 20;
                reasons.add("email_fail_3");
            }

            if (failsByIp >= 10) {
                score += 30;
                reasons.add("ip_fail_10");
            }

            if (distinctIpsByEmail >= 3) {
                score += 25;
                reasons.add("email_distinct_ips_3");
            }

            if (distinctEmailsByIp >= 5) {
                score += 20;
                reasons.add("ip_distinct_emails_5");
            }

            if (AuthRiskConstants.Events.LOGIN_SUCCESS.equals(event) && failsByEmail >= 3) {
                score += 15;
                reasons.add("success_after_failures");
            }

            String level = levelFor(score);
            emitLog(event, ctx, level, score, reasons);

            // Respuesta progresiva: solo en LOGIN_FAILURE y solo si está habilitada.
            if (responseEnabled && AuthRiskConstants.Events.LOGIN_FAILURE.equals(event)) {
                if (AuthRiskConstants.Levels.CRITICAL.equals(level)) {
                    boolean created = createEmailBlock(ctx);
                    if (created) {
                        applyHighDelay();
                    }
                } else if (AuthRiskConstants.Levels.HIGH.equals(level)) {
                    applyHighDelay();
                }
            }

        } catch (Exception ex) {
            // Fail-open absoluto: nunca debe afectar al login.
        }
    }

    private void applyHighDelay() {
        try {
            long delayMs = (highDelayMaxMs <= highDelayMinMs)
                    ? highDelayMinMs
                    : ThreadLocalRandom.current().nextLong(highDelayMinMs, highDelayMaxMs + 1L);
            if (delayMs <= 0L) return;
            TimeUnit.MILLISECONDS.sleep(delayMs);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        } catch (Exception ignored) {
        }
    }

    private boolean createEmailBlock(AuthRiskContext ctx) {
        try {
            if (ctx == null || ctx.emailHash() == null || ctx.emailHash().isBlank() || "-".equals(ctx.emailHash())) {
                return false;
            }
            Boolean created = redis.opsForValue().setIfAbsent(keyLoginBlockEmail(ctx), "1", criticalBlockTtl);
            return Boolean.TRUE.equals(created);
        } catch (DataAccessException e) {
            return false;
        }
    }

    private void updateSetsForLogin(AuthRiskContext ctx) {
        try {
            SetOperations<String, String> ops = redis.opsForSet();

            String kIpsByEmail = keyLoginIpsByEmail(ctx);
            Long addedA = ops.add(kIpsByEmail, ctx.ip());
            if (addedA != null && addedA > 0L) {
                ensureExpire(kIpsByEmail, longTtl);
            }

            String kEmailsByIp = keyLoginEmailsByIp(ctx);
            Long addedB = ops.add(kEmailsByIp, ctx.emailHash());
            if (addedB != null && addedB > 0L) {
                ensureExpire(kEmailsByIp, longTtl);
            }
        } catch (DataAccessException ignored) {
        }
    }

    private void incrementFailures(AuthRiskContext ctx) {
        try {
            ValueOperations<String, String> ops = redis.opsForValue();

            String kEmail = keyLoginFailEmail(ctx);
            Long nE = ops.increment(kEmail);
            if (nE != null && nE == 1L) {
                redis.expire(kEmail, shortTtl);
            }

            String kIp = keyLoginFailIp(ctx);
            Long nI = ops.increment(kIp);
            if (nI != null && nI == 1L) {
                redis.expire(kIp, shortTtl);
            }
        } catch (DataAccessException ignored) {
        }
    }

    private void ensureExpire(String key, Duration ttl) {
        try {
            Long current = redis.getExpire(key);
            if (current == null || current < 0L) {
                redis.expire(key, ttl);
            }
        } catch (DataAccessException ignored) {
        }
    }

    private int readCounter(String key) {
        try {
            String v = redis.opsForValue().get(key);
            if (v == null || v.isBlank()) return 0;
            return Integer.parseInt(v.trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private long readSetSize(String key) {
        try {
            Long n = redis.opsForSet().size(key);
            return n == null ? 0L : n;
        } catch (DataAccessException e) {
            return 0L;
        }
    }

    private String levelFor(int score) {
        if (score >= 80) return AuthRiskConstants.Levels.CRITICAL;
        if (score >= 50) return AuthRiskConstants.Levels.HIGH;
        if (score >= 20) return AuthRiskConstants.Levels.SUSPICIOUS;
        return AuthRiskConstants.Levels.NORMAL;
    }

    private void emitLog(String event, AuthRiskContext ctx, String level, int score, List<String> reasons) {
        String userIdStr = ctx.userId() == null ? "-" : ctx.userId().toString();
        String reasonsStr = reasons.isEmpty() ? "-" : String.join(",", reasons);

        String msg = String.format(
                "[AUTH-RISK] env=%s event=%s channel=%s level=%s score=%d ip=%s uaHash=%s emailHash=%s userId=%s reasons=%s",
                ctx.env(), event, ctx.channel(), level, score,
                ctx.ip(), ctx.uaHash(), ctx.emailHash(), userIdStr, reasonsStr
        );

        if (AuthRiskConstants.Levels.HIGH.equals(level) || AuthRiskConstants.Levels.CRITICAL.equals(level)) {
            log.warn(msg);
        } else {
            log.info(msg);
        }
    }

    private String keyLoginFailEmail(AuthRiskContext ctx) {
        return "ar:" + ctx.env() + ":login:fail:email:" + ctx.emailHash();
    }

    private String keyLoginFailIp(AuthRiskContext ctx) {
        return "ar:" + ctx.env() + ":login:fail:ip:" + ctx.ip();
    }

    private String keyLoginIpsByEmail(AuthRiskContext ctx) {
        return "ar:" + ctx.env() + ":login:ips:email:" + ctx.emailHash();
    }

    private String keyLoginEmailsByIp(AuthRiskContext ctx) {
        return "ar:" + ctx.env() + ":login:emails:ip:" + ctx.ip();
    }

    private String keyLoginBlockEmail(AuthRiskContext ctx) {
        return "ar:" + ctx.env() + ":" + AuthRiskConstants.Keys.LOGIN_BLOCK_EMAIL_PREFIX + ctx.emailHash();
    }
}