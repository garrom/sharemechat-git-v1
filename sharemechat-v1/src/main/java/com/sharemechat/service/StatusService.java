package com.sharemechat.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;

@Service
public class StatusService {

    private final StringRedisTemplate redis;
    private final Duration ttl;

    public StatusService(StringRedisTemplate redis,
                              @Value("${stream.status.ttl-seconds:45}") int ttlSeconds) {
        this.redis = redis;
        this.ttl = Duration.ofSeconds(ttlSeconds);
    }

    private String statusKey(Long userId) {
        return "user:status:" + userId;
    }

    private String sessionKey(Long clientId, Long modelId) {
        return "session:active:" + clientId + ":" + modelId;
    }

    private String availableSet() {
        return "user:available";
    }

    // ---- Estado ----
    public void setAvailable(Long userId) {
        try {
            // Escribir solo en las claves nuevas
            redis.opsForValue().set(statusKey(userId), "AVAILABLE", ttl);
            redis.opsForSet().add(availableSet(), String.valueOf(userId));
        } catch (DataAccessException ignored) {}
    }

    public void setBusy(Long userId) {
        try {
            // Escribir solo en las claves nuevas
            redis.opsForValue().set(statusKey(userId), "BUSY", ttl);
            redis.opsForSet().remove(availableSet(), String.valueOf(userId));
        } catch (DataAccessException ignored) {}
    }

    public void setOffline(Long userId) {
        try {
            // Borrar nueva
            redis.delete(statusKey(userId));
            redis.opsForSet().remove(availableSet(), String.valueOf(userId));
            // Compatibilidad simple: intentar borrar también las antiguas si siguen por ahí
            redis.delete("model:status:" + userId);
            redis.opsForSet().remove("models:available", String.valueOf(userId));
        } catch (DataAccessException ignored) {}
    }


    public String getStatus(Long userId) {
        try {
            String val = redis.opsForValue().get(statusKey(userId));
            return (val != null) ? val : redis.opsForValue().get("model:status:" + userId);
        } catch (DataAccessException e) {
            return null;
        }
    }

    public boolean isAvailable(Long userId) {
        try {
            // Primero set nuevo
            Boolean member = redis.opsForSet().isMember(availableSet(), String.valueOf(userId));
            if (Boolean.TRUE.equals(member)) return true;
            // Compat: comprobar set antiguo
            Boolean legacy = redis.opsForSet().isMember("models:available", String.valueOf(userId));
            return Boolean.TRUE.equals(legacy);
        } catch (DataAccessException e) {
            return false;
        }
    }

    // Heartbeat para renovar TTL (llámalo periódicamente desde tu WS handler si quieres)
    public void heartbeat(Long userId) {
        try {
            // Si hay clave nueva, renovar TTL en la nueva
            String current = redis.opsForValue().get(statusKey(userId));
            if (current != null) {
                redis.expire(statusKey(userId), ttl);
                return;
            }
            // Compat: si solo está la antigua, renovar allí
            String legacy = redis.opsForValue().get("model:status:" + userId);
            if (legacy != null) {
                redis.expire("model:status:" + userId, ttl);
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
            // Unir miembros de nuevo y antiguo para compatibilidad simple
            java.util.Set<String> out = new java.util.HashSet<>();
            Set<String> cur = redis.opsForSet().members(availableSet());
            if (cur != null) out.addAll(cur);
            Set<String> legacy = redis.opsForSet().members("models:available");
            if (legacy != null) out.addAll(legacy);
            return out;
        } catch (DataAccessException e) {
            return Set.of();
        }
    }

}
