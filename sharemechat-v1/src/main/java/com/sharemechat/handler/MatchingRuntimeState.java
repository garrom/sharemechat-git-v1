package com.sharemechat.handler;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Component
public class MatchingRuntimeState {

    private final Map<String, Queue<WebSocketSession>> waitingModelsByBucket = new ConcurrentHashMap<>();
    private final Map<String, Queue<WebSocketSession>> waitingClientsByBucket = new ConcurrentHashMap<>();

    private final Map<String, WebSocketSession> pairs = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> sessionsById = new ConcurrentHashMap<>();
    private final Map<String, String> roles = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionUserIds = new ConcurrentHashMap<>();
    private final Map<String, Long> lastMatchAt = new ConcurrentHashMap<>();
    private final Set<String> switching = Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final Map<String, String> pairLockOwnerBySessionId = new ConcurrentHashMap<>();
    private final Map<String, String> sessionLang = new ConcurrentHashMap<>();
    private final Map<String, String> sessionCountry = new ConcurrentHashMap<>();
    private final Map<String, String> sessionBucketKey = new ConcurrentHashMap<>();

    public Map<String, Queue<WebSocketSession>> getWaitingModelsByBucket() {
        return waitingModelsByBucket;
    }

    public Map<String, Queue<WebSocketSession>> getWaitingClientsByBucket() {
        return waitingClientsByBucket;
    }

    public Map<String, WebSocketSession> getPairs() {
        return pairs;
    }

    public Map<String, WebSocketSession> getSessionsById() {
        return sessionsById;
    }

    public Map<String, String> getRoles() {
        return roles;
    }

    public Map<String, Long> getSessionUserIds() {
        return sessionUserIds;
    }

    public Map<String, Long> getLastMatchAt() {
        return lastMatchAt;
    }

    public Set<String> getSwitching() {
        return switching;
    }

    public Map<String, String> getPairLockOwnerBySessionId() {
        return pairLockOwnerBySessionId;
    }

    public Map<String, String> getSessionLang() {
        return sessionLang;
    }

    public Map<String, String> getSessionCountry() {
        return sessionCountry;
    }

    public Map<String, String> getSessionBucketKey() {
        return sessionBucketKey;
    }
}