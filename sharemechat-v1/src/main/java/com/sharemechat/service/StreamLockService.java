package com.sharemechat.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
public class StreamLockService {

    private final StringRedisTemplate redis;

    private static final DefaultRedisScript<Long> RELEASE_IF_OWNER = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                    "return redis.call('del', KEYS[1]) " +
                    "else return 0 end",
            Long.class
    );

    public StreamLockService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public String newOwnerToken() {
        return UUID.randomUUID().toString();
    }

    public boolean tryLockClient(Long clientId, String owner, Duration ttl) {
        return tryLock(keyClient(clientId), owner, ttl);
    }

    public boolean tryLockModel(Long modelId, String owner, Duration ttl) {
        return tryLock(keyModel(modelId), owner, ttl);
    }

    public void unlockClient(Long clientId, String owner) {
        unlock(keyClient(clientId), owner);
    }

    public void unlockModel(Long modelId, String owner) {
        unlock(keyModel(modelId), owner);
    }

    private boolean tryLock(String key, String owner, Duration ttl) {
        Boolean ok = redis.opsForValue().setIfAbsent(key, owner, ttl);
        return Boolean.TRUE.equals(ok);
    }

    private void unlock(String key, String owner) {
        try {
            redis.execute(RELEASE_IF_OWNER, List.of(key), owner);
        } catch (Exception ignore) {
            // si Redis falla liberando, TTL evitará lock permanente
        }
    }

    private String keyClient(Long clientId) {
        return "lock:stream:client:" + clientId;
    }

    private String keyModel(Long modelId) {
        return "lock:stream:model:" + modelId;
    }
}
