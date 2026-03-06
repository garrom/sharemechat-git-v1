package com.sharemechat.handler;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class MessagesRuntimeState {

    private final Map<Long, Set<WebSocketSession>> sessions = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionUserIds = new ConcurrentHashMap<>();
    private final Map<Long, String> activeCallOwners = new ConcurrentHashMap<>();
    private final Map<Long, Long> activeCalls = new ConcurrentHashMap<>();
    private final Set<Long> ringing = ConcurrentHashMap.newKeySet();

    public Map<Long, Set<WebSocketSession>> getSessions() {
        return sessions;
    }

    public Map<String, Long> getSessionUserIds() {
        return sessionUserIds;
    }

    public Map<Long, String> getActiveCallOwners() {
        return activeCallOwners;
    }

    public Map<Long, Long> getActiveCalls() {
        return activeCalls;
    }

    public Set<Long> getRinging() {
        return ringing;
    }
}