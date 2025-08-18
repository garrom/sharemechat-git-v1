package com.sharemechat.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;

@Service
public class ModelStatusService {

    private final StringRedisTemplate redis;
    private final Duration ttl;

    public ModelStatusService(StringRedisTemplate redis,
                              @Value("${stream.status.ttl-seconds:45}") int ttlSeconds) {
        this.redis = redis;
        this.ttl = Duration.ofSeconds(ttlSeconds);
    }

    private String statusKey(Long modelId) {
        return "model:status:" + modelId;
    }

    private String sessionKey(Long clientId, Long modelId) {
        return "session:active:" + clientId + ":" + modelId;
    }

    private String availableSet() {
        return "models:available";
    }

    // ---- Estado ----
    public void setAvailable(Long modelId) {
        try {
            String key = statusKey(modelId);
            redis.opsForValue().set(key, "AVAILABLE", ttl);
            redis.opsForSet().add(availableSet(), String.valueOf(modelId));
        } catch (DataAccessException ignored) {}
    }

    public void setBusy(Long modelId) {
        try {
            String key = statusKey(modelId);
            // Deja TTL para que si no hay heartbeats se caiga a OFFLINE
            redis.opsForValue().set(key, "BUSY", ttl);
            // Si estaba en disponibles, sácalo
            redis.opsForSet().remove(availableSet(), String.valueOf(modelId));
        } catch (DataAccessException ignored) {}
    }

    public void setOffline(Long modelId) {
        try {
            redis.delete(statusKey(modelId));
            redis.opsForSet().remove(availableSet(), String.valueOf(modelId));
        } catch (DataAccessException ignored) {}
    }

    public String getStatus(Long modelId) {
        try {
            return redis.opsForValue().get(statusKey(modelId));
        } catch (DataAccessException e) {
            return null;
        }
    }

    public boolean isAvailable(Long modelId) {
        try {
            Boolean member = redis.opsForSet().isMember(availableSet(), String.valueOf(modelId));
            return Boolean.TRUE.equals(member);
        } catch (DataAccessException e) {
            return false;
        }
    }

    // Heartbeat para renovar TTL (llámalo periódicamente desde tu WS handler si quieres)
    public void heartbeat(Long modelId) {
        try {
            String status = getStatus(modelId);
            if (status != null) {
                redis.expire(statusKey(modelId), ttl);
            }
        } catch (DataAccessException ignored) {}
    }

    // ---- Sesiones activas (lookup rápido) ----
    public void setActiveSession(Long clientId, Long modelId, Long sessionId) {
        try {
            redis.opsForValue().set(sessionKey(clientId, modelId), String.valueOf(sessionId), ttl);
        } catch (DataAccessException ignored) {}
    }

    public Optional<Long> getActiveSession(Long clientId, Long modelId) {
        try {
            String v = redis.opsForValue().get(sessionKey(clientId, modelId));
            if (v == null) return Optional.empty();
            try {
                return Optional.of(Long.parseLong(v));
            } catch (NumberFormatException ex) {
                return Optional.empty();
            }
        } catch (DataAccessException e) {
            return Optional.empty();
        }
    }

    public void clearActiveSession(Long clientId, Long modelId) {
        try {
            redis.delete(sessionKey(clientId, modelId));
        } catch (DataAccessException ignored) {}
    }

    // (Opcional) para depuración
    public Set<String> listAvailableModels() {
        try {
            return redis.opsForSet().members(availableSet());
        } catch (DataAccessException e) {
            return Set.of();
        }
    }
}
