package com.sharemechat.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class SeenService {

    private final StringRedisTemplate redis;
    private final Duration ttl;

    public SeenService(
            StringRedisTemplate redis,
            @Value("${matching.seen.ttl-minutes:45}") int ttlMinutes
    ) {
        this.redis = redis;
        this.ttl = Duration.ofMinutes(ttlMinutes);
    }

    private String key(Long viewerId) {
        return "seen:" + viewerId;
    }

    public boolean hasSeen(Long viewerId, Long modelId) {
        if (viewerId == null || modelId == null) return false;
        try {
            Boolean member = redis.opsForSet().isMember(key(viewerId), String.valueOf(modelId));
            return Boolean.TRUE.equals(member);
        } catch (DataAccessException e) {
            // Degradación segura: si Redis cae, no bloqueamos matching.
            return false;
        }
    }

    public void markSeen(Long viewerId, Long modelId) {
        if (viewerId == null || modelId == null) return;
        try {
            String k = key(viewerId);
            redis.opsForSet().add(k, String.valueOf(modelId));
            redis.expire(k, ttl);
        } catch (DataAccessException ignored) {}
    }
}
