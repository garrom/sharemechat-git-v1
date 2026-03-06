package com.sharemechat.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class StatusService {

    private static final Pattern ACTIVE_SESSION_KEY =
            Pattern.compile("^session:active:(\\d+):(\\d+)$");

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

    public void setAvailable(Long userId) {
        try {
            redis.opsForValue().set(statusKey(userId), "AVAILABLE", ttl);
            redis.opsForSet().add(availableSet(), String.valueOf(userId));
        } catch (DataAccessException ignored) {}
    }

    public void setBusy(Long userId) {
        try {
            redis.opsForValue().set(statusKey(userId), "BUSY", ttl);
            redis.opsForSet().remove(availableSet(), String.valueOf(userId));
        } catch (DataAccessException ignored) {}
    }

    public void setOffline(Long userId) {
        try {
            redis.delete(statusKey(userId));
            redis.opsForSet().remove(availableSet(), String.valueOf(userId));
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
            Boolean member = redis.opsForSet().isMember(availableSet(), String.valueOf(userId));
            if (Boolean.TRUE.equals(member)) return true;
            Boolean legacy = redis.opsForSet().isMember("models:available", String.valueOf(userId));
            return Boolean.TRUE.equals(legacy);
        } catch (DataAccessException e) {
            return false;
        }
    }

    public void heartbeat(Long userId) {
        try {
            String current = redis.opsForValue().get(statusKey(userId));
            if (current != null) {
                redis.expire(statusKey(userId), ttl);
                return;
            }
            String legacy = redis.opsForValue().get("model:status:" + userId);
            if (legacy != null) {
                redis.expire("model:status:" + userId, ttl);
            }
        } catch (DataAccessException ignored) {}
    }

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

    public Set<String> listAvailableModels() {
        try {
            Set<String> out = new HashSet<>();
            Set<String> cur = redis.opsForSet().members(availableSet());
            if (cur != null) out.addAll(cur);
            Set<String> legacy = redis.opsForSet().members("models:available");
            if (legacy != null) out.addAll(legacy);
            return out;
        } catch (DataAccessException e) {
            return Set.of();
        }
    }

    // =========================
    // READ-ONLY helpers audit
    // =========================

    public Map<Long, String> listCurrentStatuses() {
        Map<Long, String> out = new LinkedHashMap<>();
        try {
            Set<String> keys = new HashSet<>();
            Set<String> cur = redis.keys("user:status:*");
            if (cur != null) keys.addAll(cur);
            Set<String> legacy = redis.keys("model:status:*");
            if (legacy != null) keys.addAll(legacy);

            for (String key : keys) {
                if (key == null) continue;
                String[] parts = key.split(":");
                if (parts.length == 3 || parts.length == 4) {
                    String last = parts[parts.length - 1];
                    try {
                        Long userId = Long.parseLong(last);
                        String val = redis.opsForValue().get(key);
                        if (val != null && !val.isBlank()) {
                            out.put(userId, val);
                        }
                    } catch (NumberFormatException ignore) {}
                }
            }
        } catch (Exception ignore) {}
        return out;
    }

    public List<Map<String, Object>> listActiveSessionsSnapshot() {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            Set<String> keys = redis.keys("session:active:*");
            if (keys == null) return out;

            for (String key : keys) {
                if (key == null) continue;

                Matcher m = ACTIVE_SESSION_KEY.matcher(key);
                if (!m.matches()) continue;

                Long clientId;
                Long modelId;
                try {
                    clientId = Long.parseLong(m.group(1));
                    modelId = Long.parseLong(m.group(2));
                } catch (NumberFormatException ex) {
                    continue;
                }

                String raw = redis.opsForValue().get(key);
                Long streamId = null;
                if (raw != null) {
                    try {
                        streamId = Long.parseLong(raw);
                    } catch (NumberFormatException ignore) {}
                }

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("key", key);
                row.put("clientId", clientId);
                row.put("modelId", modelId);
                row.put("streamRecordId", streamId);
                out.add(row);
            }
        } catch (Exception ignore) {}
        return out;
    }
}