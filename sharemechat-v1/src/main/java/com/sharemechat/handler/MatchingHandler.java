package com.sharemechat.handler;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class MatchingHandler extends TextWebSocketHandler {

    private final MatchingHandlerSupport support;

    public MatchingHandler(MatchingHandlerSupport support) {
        this.support = support;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        support.afterConnectionEstablished(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        support.afterConnectionClosed(session, status);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        support.handleTextMessage(session, message);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        support.handleTransportError(session, exception);
        super.handleTransportError(session, exception);
    }

    public void adminKillPair(Long clientUserId, Long modelUserId, String reason) {
        support.adminKillPair(clientUserId, modelUserId, reason);
    }

    public java.util.Map<String, Object> adminRuntimeSnapshot() {
        return support.adminRuntimeSnapshot();
    }
}