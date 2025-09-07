package com.sharemechat.handler;

import com.sharemechat.dto.MessageDTO;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.FavoriteService;
import com.sharemechat.service.MessageService;
import org.json.JSONObject;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class MessagesWsHandler extends TextWebSocketHandler {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final MessageService messageService;
    private final FavoriteService favoriteService;
    private static final Logger log = LoggerFactory.getLogger(MessagesWsHandler.class);

    // userId -> sockets
    private final Map<Long, Set<WebSocketSession>> sessions = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionUserIds = new ConcurrentHashMap<>();

    public MessagesWsHandler(JwtUtil jwtUtil,
                             UserRepository userRepository,
                             FavoriteService favoriteService,
                             MessageService messageService) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.favoriteService = favoriteService;
        this.messageService = messageService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long userId = resolveUserId(session);
        if (userId == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        log.info("WS /messages conectado: session={} userId={}", session.getId(), userId);
        sessionUserIds.put(session.getId(), userId);
        sessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        Long userId = sessionUserIds.remove(session.getId());
        if (userId != null) {
            var set = sessions.get(userId);
            if (set != null) {
                set.remove(session);
                if (set.isEmpty()) sessions.remove(userId);
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {

        log.debug("WS /messages in: {}", message.getPayload());
        Long me = sessionUserIds.get(session.getId());
        if (me == null) return;

        JSONObject json = new JSONObject(message.getPayload());
        String type = json.optString("type", "");

        if ("msg:send".equals(type)) {
            // --- parseo robusto del destinatario ---
            Object toObj = json.opt("to");
            String toRaw = (toObj != null) ? String.valueOf(toObj) : null;
            Long to = null;
            try { if (toRaw != null) to = Long.valueOf(toRaw); } catch (Exception ignore) {}

            String body = json.optString("body", "");
            body = (body != null) ? body.trim() : "";

            // --- logs de entrada para diagnóstico ---
            log.info("WS msg:send IN session={} me={} rawTo='{}' parsedTo={} bodyLen={}",
                    session.getId(), me, toRaw, to, (body != null ? body.length() : 0));

            // --- validaciones duras ---
            if (to == null || to <= 0L) {
                String err = "Destinatario inválido";
                log.warn("WS msg:send REJECT (invalid to) session={} me={} rawTo='{}' parsedTo={}", session.getId(), me, toRaw, to);
                safeSend(session, new JSONObject()
                        .put("type", "msg:error")
                        .put("message", err)
                        .toString());
                return;
            }
            if (java.util.Objects.equals(me, to)) {
                String err = "No puedes enviarte mensajes a ti mismo";
                log.warn("WS msg:send REJECT (self send) session={} me={} to={}", session.getId(), me, to);
                safeSend(session, new JSONObject()
                        .put("type", "msg:error")
                        .put("message", err)
                        .toString());
                return;
            }
            if (body.isEmpty()) {
                String err = "Mensaje vacío";
                log.warn("WS msg:send REJECT (empty body) session={} me={} to={}", session.getId(), me, to);
                safeSend(session, new JSONObject()
                        .put("type", "msg:error")
                        .put("message", err)
                        .toString());
                return;
            }

            // === BLOQUEO por favoritos: se exige aceptación mutua y activa ===
            try {
                if (!favoriteService.canUsersMessage(me, to)) {
                    String err = "Mensajería bloqueada: esta relación no está aceptada por ambas partes o fue rechazada.";
                    log.warn("WS msg:send REJECT (favorites gate) session={} me={} to={}", session.getId(), me, to);
                    safeSend(session, new JSONObject()
                            .put("type", "msg:error")
                            .put("message", err)
                            .toString());
                    return;
                }

                // Si pasa el gate, enviamos
                MessageDTO saved = messageService.send(me, to, body);

                log.info("WS msg:send SAVED id={} senderId={} recipientId={}",
                        saved.id(), saved.senderId(), saved.recipientId());

                // eco al remitente
                broadcastToUser(me, new JSONObject()
                        .put("type", "msg:new")
                        .put("from", me)
                        .put("message", toJson(saved))
                        .toString());
                // push al destinatario si está online
                broadcastToUser(to, new JSONObject()
                        .put("type", "msg:new")
                        .put("from", me)
                        .put("message", toJson(saved))
                        .toString());
            } catch (Exception ex) {
                log.warn("WS msg:send ERROR session={} me={} to={} err={}", session.getId(), me, to, ex.getMessage());
                safeSend(session, new JSONObject()
                        .put("type", "msg:error")
                        .put("message", ex.getMessage())
                        .toString());
            }
            return;
        }

        if ("msg:read".equals(type)) {
            Long withUser = json.optLong("with");
            messageService.markRead(me, withUser);
            // notifica al otro extremo (opcional)
            broadcastToUser(withUser, new JSONObject()
                    .put("type","msg:read")
                    .put("by", me)
                    .put("with", withUser)
                    .toString());
            return;
        }

        if ("ping".equals(type)) {
            return;
        }
    }



    private void broadcastToUser(Long userId, String json) {
        var set = sessions.get(userId);
        if (set == null) return;
        for (var s : set) safeSend(s, json);
    }

    public void broadcastNew(MessageDTO saved) {
        String json = new JSONObject()
                .put("type", "msg:new")
                .put("message", toJson(saved))
                .toString();

        // LOG útil para ver a quién estamos notificando
        org.slf4j.LoggerFactory.getLogger(MessagesWsHandler.class)
                .info("broadcastNew -> sender={}, recipient={}, sessions(sender)={}, sessions(recipient)={}",
                        saved.senderId(), saved.recipientId(),
                        Optional.ofNullable(sessions.get(saved.senderId())).map(Set::size).orElse(0),
                        Optional.ofNullable(sessions.get(saved.recipientId())).map(Set::size).orElse(0));

        broadcastToUser(saved.senderId(), json);
        broadcastToUser(saved.recipientId(), json);
    }



    private void safeSend(WebSocketSession s, String json) {
        if (s != null && s.isOpen()) {
            try { s.sendMessage(new TextMessage(json)); } catch (Exception ignore) {}
        }
    }

    private Long resolveUserId(WebSocketSession session) {
        String token = extractToken(session);
        if (token == null) return null;
        try {
            if (!jwtUtil.isTokenValid(token)) return null;
            return jwtUtil.extractUserId(token);
        } catch (Exception ex) {
            return null;
        }
    }

    private String extractToken(WebSocketSession session) {
        try {
            URI uri = session.getUri();
            if (uri != null && uri.getQuery() != null) {
                Map<String, String> qs = parseQuery(uri.getQuery());
                if (qs.containsKey("token")) return qs.get("token");
            }
        } catch (Exception ignore) {}
        try {
            List<String> auths = session.getHandshakeHeaders().get("Authorization");
            if (auths != null && !auths.isEmpty()) {
                String h = auths.get(0);
                if (h != null && h.startsWith("Bearer ")) return h.substring(7);
            }
        } catch (Exception ignore) {}
        return null;
    }

    private Map<String, String> parseQuery(String q) {
        Map<String, String> m = new HashMap<>();
        for (String p : q.split("&")) {
            int i = p.indexOf('=');
            if (i > 0) {
                String k = URLDecoder.decode(p.substring(0, i), StandardCharsets.UTF_8);
                String v = URLDecoder.decode(p.substring(i + 1), StandardCharsets.UTF_8);
                m.put(k, v);
            } else {
                m.put(URLDecoder.decode(p, StandardCharsets.UTF_8), "");
            }
        }
        return m;
    }

    private JSONObject toJson(MessageDTO m) {
        return new JSONObject()
                .put("id", m.id())
                .put("senderId", m.senderId())
                .put("recipientId", m.recipientId())
                .put("body", m.body())
                .put("createdAt", String.valueOf(m.createdAt()))
                .put("readAt", m.readAt() == null ? JSONObject.NULL : String.valueOf(m.readAt()));
    }
}