package com.sharemechat.handler;

import com.sharemechat.dto.MessageDTO;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class MessagesWsHandler extends TextWebSocketHandler {

    private final MessagesWsHandlerSupport support;

    public MessagesWsHandler(MessagesWsHandlerSupport support) {
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

    public void broadcastNew(MessageDTO saved) {
        support.broadcastNew(saved);
    }

    public boolean isUserOnline(Long userId) {
        return support.isUserOnline(userId);
    }

    public boolean isBusy(Long userId) {
        return support.isBusy(userId);
    }

    public void adminKillCallPair(Long clientId, Long modelId, String reason) {
        support.adminKillCallPair(clientId, modelId, reason);
    }

    public java.util.Map<String, Object> adminRuntimeSnapshot() {
        return support.adminRuntimeSnapshot();
    }
}