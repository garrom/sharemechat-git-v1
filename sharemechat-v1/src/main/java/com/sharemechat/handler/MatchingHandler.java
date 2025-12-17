package com.sharemechat.handler;

import com.sharemechat.dto.MessageDTO;
import com.sharemechat.entity.User;
import com.sharemechat.entity.UserBlock;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.*;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.entity.Balance;
import com.sharemechat.constants.Constants;

import java.math.BigDecimal;

import org.json.JSONObject;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Component
public class MatchingHandler extends TextWebSocketHandler {

    private final Queue<WebSocketSession> waitingModels  = new ConcurrentLinkedQueue<>();
    private final Queue<WebSocketSession> waitingClients = new ConcurrentLinkedQueue<>();

    // ==== IMPORTANTE: concurrentes para evitar race conditions ====
    private final Map<String, WebSocketSession> pairs       = new ConcurrentHashMap<>();
    private final Map<String, String>           roles       = new ConcurrentHashMap<>();
    private final Map<String, Long>             sessionUserIds = new ConcurrentHashMap<>();
    // =============================================================

    private final Set<String> switching = Collections.newSetFromMap(new ConcurrentHashMap<>());

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final StreamService streamService;
    private final StatusService statusService;
    private final MessageService messageService;
    private final MessagesWsHandler messagesWsHandler;
    private final TransactionService transactionService;
    private final BalanceRepository balanceRepository;
    private final UserTrialService userTrialService;
    private final UserBlockService userBlockService;

    public MatchingHandler(JwtUtil jwtUtil,
                           UserRepository userRepository,
                           StreamService streamService,
                           TransactionService transactionService,
                           MessageService messageService,
                           MessagesWsHandler messagesWsHandler,
                           StatusService statusService,
                           BalanceRepository balanceRepository,
                           UserTrialService userTrialService,
                           UserBlockService userBlockService) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.streamService = streamService;
        this.statusService = statusService;
        this.messageService = messageService;
        this.messagesWsHandler = messagesWsHandler;
        this.transactionService = transactionService;
        this.balanceRepository = balanceRepository;
        this.userTrialService = userTrialService;
        this.userBlockService = userBlockService;

    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        System.out.println("Nueva conexión establecida: sessionId=" + session.getId());
        System.out.println("WS URI recibida: " + session.getUri());
        Long userId = resolveUserId(session);
        if (userId == null) {
            System.out.println("Sin token válido, cerrando sesión: " + session.getId());
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        sessionUserIds.put(session.getId(), userId);
        // El rol se fija luego con "set-role"
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        System.out.println("Conexión cerrada: sessionId=" + session.getId() + ", status=" + status);
        String role = roles.remove(session.getId());
        Long userId = sessionUserIds.remove(session.getId());

        if ("model".equals(role)) {
            waitingModels.remove(session);
            System.out.println("Modelo eliminado de waitingModels: sessionId=" + session.getId());
            if (userId != null) statusService.setOffline(userId);
        } else if ("client".equals(role)) {
            waitingClients.remove(session);
            System.out.println("Cliente eliminado de waitingClients: sessionId=" + session.getId());
        }

        WebSocketSession peer = pairs.remove(session.getId());
        if (peer != null) {
            pairs.remove(peer.getId());
            System.out.println("Par eliminado del mapa: peerId=" + peer.getId());

            Long myId = userId;
            Long peerId = sessionUserIds.get(peer.getId());
            String myRole = role;
            String peerRole = roles.get(peer.getId());

            endStreamIfPairKnown(myId, myRole, peerId, peerRole, "DISCONNECT");

            if (peer.isOpen()) {
                safeSend(peer, "{\"type\":\"peer-disconnected\",\"reason\":\"peer-closed\"}");
                safeRequeue(peer, peerRole);
            } else {
                System.out.println("Peer no está abierto: peerId=" + peer.getId());
            }
        } else {
            System.out.println("No se encontró peer para sessionId=" + session.getId());
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();

        try {
            JSONObject json = new JSONObject(payload);
            String type = json.getString("type");

            if ("signal".equals(type)) {
                JSONObject sig = json.optJSONObject("signal");
                String sigType = sig != null ? sig.optString("type", "") : "";
                if ("offer".equalsIgnoreCase(sigType) || "answer".equalsIgnoreCase(sigType)) {
                    String sdp = sig.optString("sdp", "");
                    System.out.println("Señalización " + sigType + " recibida (SDP len=" + sdp.length() + ") sessionId=" + session.getId());
                } else if ("candidate".equalsIgnoreCase(sigType)) {
                    JSONObject cand = sig.optJSONObject("candidate");
                    String c = cand != null ? cand.optString("candidate", "") : "";
                    Integer mLine = cand != null ? cand.optInt("sdpMLineIndex", -1) : -1;
                    System.out.println("ICE candidate recibido (len=" + c.length() + ", mLine=" + mLine + ") sessionId=" + session.getId());
                } else {
                    System.out.println("Señalización recibida (tipo=" + sigType + ") sessionId=" + session.getId());
                }
            } else if ("chat".equals(type)) {
                String txt = json.optString("message", "");
                System.out.println("Chat recibido (" + txt.length() + " chars) sessionId=" + session.getId());
            } else if ("set-role".equals(type) || "start-match".equals(type) || "next".equals(type)) {
                System.out.println("Mensaje tipo='" + type + "' sessionId=" + session.getId());
            } else if (!"ping".equals(type)) {
                System.out.println("Mensaje recibido (tipo desconocido) sessionId=" + session.getId());
            }

            if ("ping".equals(type)) {
                checkCutoffAndMaybeEnd(session);
                handleTrialPingAndMaybeEnd(session);

                Long me = sessionUserIds.get(session.getId());
                String role = roles.get(session.getId());
                if (me != null && "model".equals(role)) {
                    try {
                        statusService.heartbeat(me);
                    } catch (Exception ignore) {}
                }
                return;
            }

            if ("set-role".equals(type)) {
                String role = json.getString("role"); // "client" o "model"
                roles.put(session.getId(), role);
                Long userId = sessionUserIds.get(session.getId());

                if ("model".equals(role)) {
                    waitingModels.remove(session);
                    waitingModels.add(session);
                    System.out.println("Modelo añadido a waitingModels: sessionId=" + session.getId());
                    if (userId != null) {
                        statusService.setAvailable(userId);
                    }
                } else if ("client".equals(role)) {
                    waitingClients.remove(session);
                    waitingClients.add(session);
                    System.out.println("Cliente añadido a waitingClients: sessionId=" + session.getId());
                }

            } else if ("start-match".equals(type)) {
                String role = roles.get(session.getId());
                if ("client".equals(role)) {
                    matchClient(session);
                } else if ("model".equals(role)) {
                    matchModel(session);
                }

            } else if ("next".equals(type)) {
                handleNext(session);

            } else if ("chat".equals(type)) {
                WebSocketSession peer = pairs.get(session.getId());
                if (peer != null && peer.isOpen()) {
                    Long senderId = sessionUserIds.get(session.getId());
                    Long recipientId = sessionUserIds.get(peer.getId());
                    String body = json.optString("message", "").trim();

                    if (senderId != null && recipientId != null && !body.isEmpty()) {
                        try {
                            MessageDTO saved = messageService.send(senderId, recipientId, body);
                            messagesWsHandler.broadcastNew(saved);

                            JSONObject out = new JSONObject()
                                    .put("type", "chat")
                                    .put("message", body)
                                    .put("senderId", saved.senderId())
                                    .put("recipientId", saved.recipientId())
                                    .put("msgId", saved.id())
                                    .put("createdAt", String.valueOf(saved.createdAt()))
                                    .put("readAt", saved.readAt() == null ? JSONObject.NULL : String.valueOf(saved.readAt()));

                            TextMessage tm = new TextMessage(out.toString());
                            try { session.sendMessage(tm); } catch (Exception ignore) {}
                            try { peer.sendMessage(tm); }    catch (Exception ignore) {}
                        } catch (Exception ex) {
                            System.out.println("Persistencia chat falló: " + ex.getMessage());
                            try { peer.sendMessage(new TextMessage(payload)); } catch (Exception ignore) {}
                            try {
                                JSONObject err = new JSONObject()
                                        .put("type", "msg:error")
                                        .put("message", ex.getMessage());
                                session.sendMessage(new TextMessage(err.toString()));
                            } catch (Exception ignore) {}
                        }
                    } else {
                        peer.sendMessage(new TextMessage(payload));
                    }
                }

            } else if ("gift".equals(type)) {
                handleGiftInMatch(session, json);
            } else if ("stats".equals(type)) {
                sendQueueStats(session);

            } else if (pairs.containsKey(session.getId())) {
                WebSocketSession peer = pairs.get(session.getId());
                if (peer != null && peer.isOpen()) {
                    peer.sendMessage(message);
                }
            }
        } catch (Exception e) {
            System.out.println("Error parseando JSON: " + e.getMessage());
        }
    }

    // EMPAREJA LADO CLIENT (viewer) CON MODELO Y ARRANCA SESIÓN (NORMAL O TRIAL)
    private void matchClient(WebSocketSession client) throws Exception {
        waitingClients.remove(client);

        Long clientId = sessionUserIds.get(client.getId());
        if (clientId == null) {
            waitingClients.add(client);
            return;
        }

        WebSocketSession model;

        while ((model = waitingModels.poll()) != null) {

            if (!model.isOpen()) continue;

            Long modelId = sessionUserIds.get(model.getId());
            if (modelId == null) continue;

            // ===== BLOQUEO (PRE-CHECK, NO ROMPE FLUJO) =====
            try {
                messagesWsHandler.assertNotBlocked(clientId, modelId);
            } catch (Exception ex) {
                // Par bloqueado → probamos otro modelo
                continue;
            }
            // ==============================================

            try {
                User viewer = userRepository.findById(clientId).orElse(null);
                String realRole = viewer != null ? viewer.getRole() : null;

                if (Constants.Roles.USER.equals(realRole)) {
                    // === MODO TRIAL ===
                    if (!userTrialService.canStartTrial(clientId)) {
                        safeSend(client, "{\"type\":\"trial-unavailable\"}");
                        waitingModels.add(model);
                        waitingClients.add(client);
                        return;
                    }

                    userTrialService.startTrialStream(clientId, modelId);
                } else {
                    // === MODO NORMAL ===
                    streamService.startSession(clientId, modelId);
                }

                pairs.put(client.getId(), model);
                pairs.put(model.getId(), client);

                sendMatchMessage(client, model.getId());
                sendMatchMessage(model, client.getId());
                return;

            } catch (Exception ex) {
                System.out.println("startSession/startTrialStream falló: " + ex.getMessage());

                pairs.remove(client.getId());
                pairs.remove(model.getId());

                waitingModels.add(model);

                if (isLowBalance(ex)) {
                    safeSend(client, "{\"type\":\"no-balance\"}");
                } else {
                    safeSend(client, "{\"type\":\"no-model-available\"}");
                }

                waitingClients.add(client);
                return;
            }
        }
        // No se encontró ningún modelo compatible
        safeSend(client, "{\"type\":\"no-model-available\"}");
        waitingClients.add(client);
    }


    // EMPAREJA LADO MODELO CON CLIENT (viewer) Y ARRANCA SESIÓN (NORMAL O TRIAL)
    private void matchModel(WebSocketSession model) throws Exception {
        waitingModels.remove(model);

        Long modelId = sessionUserIds.get(model.getId());
        if (modelId == null) {
            waitingModels.add(model);
            return;
        }

        WebSocketSession client;

        while ((client = waitingClients.poll()) != null) {

            if (!client.isOpen()) continue;

            Long clientId = sessionUserIds.get(client.getId());
            if (clientId == null) continue;

            // ===== BLOQUEO (PRE-CHECK, NO ROMPE FLUJO) =====
            try {
                messagesWsHandler.assertNotBlocked(clientId, modelId);
            } catch (Exception ex) {
                continue;
            }
            // ==============================================

            try {
                User viewer = userRepository.findById(clientId).orElse(null);
                String realRole = viewer != null ? viewer.getRole() : null;

                if (Constants.Roles.USER.equals(realRole)) {
                    userTrialService.startTrialStream(clientId, modelId);
                } else {
                    streamService.startSession(clientId, modelId);
                }

                pairs.put(model.getId(), client);
                pairs.put(client.getId(), model);

                sendMatchMessage(model, client.getId());
                sendMatchMessage(client, model.getId());
                return;

            } catch (Exception ex) {
                System.out.println("startSession/startTrialStream falló: " + ex.getMessage());

                pairs.remove(model.getId());
                pairs.remove(client.getId());

                if (isLowBalance(ex)) {
                    safeSend(client, "{\"type\":\"no-balance\"}");
                }

                waitingClients.add(client);
                waitingModels.add(model);
                return;
            }
        }

        safeSend(model, "{\"type\":\"no-client-available\"}");
        waitingModels.add(model);
    }


    private void handleNext(WebSocketSession session) throws Exception {
        if (!switching.add(session.getId())) {
            return;
        }
        try {
            WebSocketSession peer = pairs.remove(session.getId());
            if (peer != null) {
                pairs.remove(peer.getId());
                System.out.println("Peer encontrado para sessionId=" + session.getId() + ", peerId=" + peer.getId());

                Long myId   = sessionUserIds.get(session.getId());
                Long peerId = sessionUserIds.get(peer.getId());
                String myRole   = roles.get(session.getId());
                String peerRole = roles.get(peer.getId());
                endStreamIfPairKnown(myId, myRole, peerId, peerRole, "NEXT");

                if (peer.isOpen()) {
                    safeSend(peer, "{\"type\":\"peer-disconnected\",\"reason\":\"next\"}");
                    safeRequeue(peer, peerRole);
                } else {
                    System.out.println("Peer no está abierto: peerId=" + peer.getId());
                }
            } else {
                System.out.println("No se encontró peer para sessionId=" + session.getId());
            }

            String role = roles.get(session.getId());
            if ("client".equals(role)) {
                matchClient(session);
            } else if ("model".equals(role)) {
                matchModel(session);
            }
        } finally {
            switching.remove(session.getId());
        }
    }

    private void handleGiftInMatch(WebSocketSession session, org.json.JSONObject json) {
        Long senderId = sessionUserIds.get(session.getId());
        if (senderId == null) {
            safeSend(session, "{\"type\":\"gift:error\",\"message\":\"No autenticado\"}");
            return;
        }
        String senderRole = roles.get(session.getId());
        if (!"client".equals(senderRole)) {
            safeSend(session, "{\"type\":\"gift:error\",\"message\":\"Solo un CLIENT puede enviar regalos\"}");
            return;
        }

        long giftId = json.optLong("giftId", 0L);
        if (giftId <= 0L) {
            safeSend(session, "{\"type\":\"gift:error\",\"message\":\"giftId inválido\"}");
            return;
        }

        WebSocketSession peer = pairs.get(session.getId());
        if (peer == null || !peer.isOpen()) {
            safeSend(session, "{\"type\":\"gift:error\",\"message\":\"No hay destinatario conectado\"}");
            return;
        }

        Long peerUserId = sessionUserIds.get(peer.getId());
        String peerRole = roles.get(peer.getId());
        if (peerUserId == null || !"model".equals(peerRole)) {
            safeSend(session, "{\"type\":\"gift:error\",\"message\":\"Destinatario no es MODEL\"}");
            return;
        }

        Long streamId = null;
        try {
            streamId = statusService.getActiveSession(senderId, peerUserId).orElse(null);
        } catch (Exception ignore) {}

        try {
            com.sharemechat.entity.Gift g = transactionService.processGift(senderId, peerUserId, giftId, streamId);

            String marker = "[[GIFT:" + g.getId() + ":" + g.getName() + "]]";
            MessageDTO saved = messageService.send(senderId, peerUserId, marker);

            messagesWsHandler.broadcastNew(saved);

            BigDecimal newBal = balanceRepository
                    .findTopByUserIdOrderByTimestampDesc(senderId)
                    .map(Balance::getBalance)
                    .orElse(BigDecimal.ZERO);

            org.json.JSONObject out = new org.json.JSONObject()
                    .put("type", "gift")
                    .put("fromUserId", senderId)
                    .put("toUserId", peerUserId)
                    .put("gift", new org.json.JSONObject()
                            .put("id", g.getId())
                            .put("name", g.getName())
                            .put("icon", g.getIcon())
                            .put("cost", g.getCost().toPlainString())
                    )
                    .put("newBalance", newBal.toPlainString());

            String payload = out.toString();
            safeSend(session, payload);
            if (peer.isOpen()) safeSend(peer, payload);
        } catch (Exception ex) {
            org.json.JSONObject err = new org.json.JSONObject()
                    .put("type", "gift:error")
                    .put("message", ex.getMessage());
            safeSend(session, err.toString());
        }
    }

    // EL METODO FINALIZA LA SESION (NORMAL O TRIAL) CUANDO TENEMOS PAREJA CONOCIDA
    private void endStreamIfPairKnown(Long idA, String roleA, Long idB, String roleB, String closeReason) {
        if (idA == null || idB == null || roleA == null || roleB == null) return;

        Long viewerId;
        Long modelId;

        // El lado "client" del WebSocket es el viewer (sea CLIENT o USER)
        if ("client".equals(roleA) && "model".equals(roleB)) {
            viewerId = idA;
            modelId  = idB;
        } else if ("model".equals(roleA) && "client".equals(roleB)) {
            viewerId = idB;
            modelId  = idA;
        } else {
            // roles inconsistentes, no finalizamos
            return;
        }

        try {
            User viewer = userRepository.findById(viewerId).orElse(null);
            String realRole = viewer != null ? viewer.getRole() : null;

            if (Constants.Roles.CLIENT.equals(realRole)) {
                // Sesión normal de pago
                streamService.endSession(viewerId, modelId);
            } else if (Constants.Roles.USER.equals(realRole)) {
                // Sesión trial de USER
                userTrialService.endTrialStream(viewerId, modelId, closeReason);
            }
        } catch (Exception ex) {
            System.out.println("endSession/endTrialSession falló: " + ex.getMessage());
        }
    }

    private void sendMatchMessage(WebSocketSession session, String peerSessionId) {
        try {
            Long peerUserId = sessionUserIds.get(peerSessionId);
            String peerRole = roles.get(peerSessionId);

            String msg = String.format(
                    "{\"type\":\"match\",\"peerId\":\"%s\",\"peerUserId\":%s,\"peerRole\":\"%s\"}",
                    peerSessionId,
                    peerUserId != null ? peerUserId.toString() : "null",
                    peerRole != null ? peerRole : ""
            );

            System.out.println("Enviando mensaje de emparejamiento a sessionId=" + session.getId() + ": " + msg);
            session.sendMessage(new TextMessage(msg));
        } catch (Exception e) {
            System.out.println("Error enviando mensaje de emparejamiento a sessionId=" + session.getId() + ": " + e.getMessage());
        }
    }

    private void safeRequeue(WebSocketSession session, String role) {
        if (session != null && session.isOpen()) {
            if ("model".equals(role)) {
                waitingModels.add(session);
            } else if ("client".equals(role)) {
                waitingClients.add(session);
            }
        }
    }

    private Long resolveUserId(WebSocketSession session) {
        String token = extractToken(session);
        if (token == null) return null;
        try {
            if (!jwtUtil.isTokenValid(token)) return null;
            return jwtUtil.extractUserId(token);
        } catch (Exception ex) {
            System.out.println("Token inválido: " + ex.getMessage());
            return null;
        }
    }

    private String extractToken(WebSocketSession session) {
        try {
            URI uri = session.getUri();
            if (uri != null && uri.getQuery() != null) {
                Map<String, String> qs = parseQuery(uri.getQuery());
                if (qs.containsKey("token")) {
                    return qs.get("token");
                }
            }
        } catch (Exception ignored) {}

        try {
            List<String> auths = session.getHandshakeHeaders().get("Authorization");
            if (auths != null && !auths.isEmpty()) {
                String h = auths.get(0);
                if (h != null && h.startsWith("Bearer ")) {
                    return h.substring(7);
                }
            }
        } catch (Exception ignored) {}

        return null;
    }

    private Map<String, String> parseQuery(String query) {
        Map<String, String> map = new HashMap<>();
        String[] parts = query.split("&");
        for (String p : parts) {
            int i = p.indexOf('=');
            if (i > 0) {
                String k = URLDecoder.decode(p.substring(0, i), StandardCharsets.UTF_8);
                String v = URLDecoder.decode(p.substring(i + 1), StandardCharsets.UTF_8);
                map.put(k, v);
            } else {
                String k = URLDecoder.decode(p, StandardCharsets.UTF_8);
                map.put(k, "");
            }
        }
        return map;
    }

    private void safeSend(WebSocketSession s, String json) {
        if (s != null && s.isOpen()) {
            try { s.sendMessage(new TextMessage(json)); }
            catch (Exception ignore) {}
        }
    }

    private boolean checkCutoffAndMaybeEnd(WebSocketSession session) {
        WebSocketSession peer = pairs.get(session.getId());
        if (peer == null) return false;

        String myRole   = roles.get(session.getId());
        String peerRole = roles.get(peer.getId());
        if (myRole == null || peerRole == null) return false;

        Long myUserId   = sessionUserIds.get(session.getId());
        Long peerUserId = sessionUserIds.get(peer.getId());
        if (myUserId == null || peerUserId == null) return false;

        Long clientId;
        Long modelId;

        if ("client".equals(myRole) && "model".equals(peerRole)) {
            clientId = myUserId;  modelId = peerUserId;
        } else if ("model".equals(myRole) && "client".equals(peerRole)) {
            clientId = peerUserId; modelId = myUserId;
        } else {
            return false;
        }

        try {
            User clientUser = userRepository.findById(clientId).orElse(null);
            if (clientUser == null || !Constants.Roles.CLIENT.equals(clientUser.getRole())) {
                return false;
            }
        } catch (Exception ex) {
            System.out.println("checkCutoff: error obteniendo rol de cliente: " + ex.getMessage());
            return false;
        }

        boolean closed;
        try {
            closed = streamService.endIfBelowThreshold(clientId, modelId);
        } catch (Exception ex) {
            System.out.println("endIfBelowThreshold error: " + ex.getMessage());
            return false;
        }

        if (closed) {
            safeSend(session, "{\"type\":\"peer-disconnected\",\"reason\":\"low-balance\"}");
            safeSend(peer,    "{\"type\":\"peer-disconnected\",\"reason\":\"low-balance\"}");

            pairs.remove(session.getId());
            pairs.remove(peer.getId());
        }
        return closed;
    }

    private void handleTrialPingAndMaybeEnd(WebSocketSession session) {
        WebSocketSession peer = pairs.get(session.getId());
        if (peer == null) return;

        String myRole   = roles.get(session.getId());
        String peerRole = roles.get(peer.getId());
        if (myRole == null || peerRole == null) return;

        Long myUserId   = sessionUserIds.get(session.getId());
        Long peerUserId = sessionUserIds.get(peer.getId());
        if (myUserId == null || peerUserId == null) return;

        Long viewerId;
        Long modelId;
        WebSocketSession viewerSession;
        WebSocketSession modelSession;

        if ("client".equals(myRole) && "model".equals(peerRole)) {
            viewerId      = myUserId;
            modelId       = peerUserId;
            viewerSession = session;
            modelSession  = peer;
        } else if ("model".equals(myRole) && "client".equals(peerRole)) {
            viewerId      = peerUserId;
            modelId       = myUserId;
            viewerSession = peer;
            modelSession  = session;
        } else {
            return;
        }

        try {
            User viewer = userRepository.findById(viewerId).orElse(null);
            if (viewer == null || !Constants.Roles.USER.equals(viewer.getRole())) {
                return;
            }

            boolean ended = userTrialService.endTrialIfTimeExceeded(viewerId, modelId);
            if (!ended) return;

            safeSend(viewerSession, "{\"type\":\"peer-disconnected\",\"reason\":\"trial-ended\"}");
            safeSend(modelSession,  "{\"type\":\"peer-disconnected\",\"reason\":\"trial-ended\"}");

            pairs.remove(viewerSession.getId());
            pairs.remove(modelSession.getId());

        } catch (Exception ex) {
            System.out.println("handleTrialPingAndMaybeEnd error: " + ex.getMessage());
        }
    }

    private boolean isLowBalance(Exception ex) {
        String m = ex != null ? ex.getMessage() : null;
        return m != null && m.contains("Saldo insuficiente");
    }

    private int positionInQueue(Queue<WebSocketSession> q, WebSocketSession s) {
        int i = 0;
        for (WebSocketSession x : q) {
            if (x == s) return i;
            i++;
        }
        return -1;
    }

    private void sendQueueStats(WebSocketSession s) {
        try {
            int waitingModelsCount  = waitingModels.size();
            int waitingClientsCount = waitingClients.size();

            String role = roles.get(s.getId());
            int myPosition = -1;
            if ("model".equals(role)) {
                myPosition = positionInQueue(waitingModels, s);
            }

            int activePairs = computeActivePairs();
            int modelsStreaming  = activePairs;
            int clientsStreaming = activePairs;

            String json = String.format(
                    "{\"type\":\"queue-stats\",\"waitingModels\":%d,\"waitingClients\":%d," +
                            "\"position\":%d,\"modelsStreaming\":%d,\"clientsStreaming\":%d,\"activePairs\":%d}",
                    waitingModelsCount, waitingClientsCount, myPosition,
                    modelsStreaming, clientsStreaming, activePairs
            );
            safeSend(s, json);
        } catch (Exception ignore) {}
    }

    private int computeActivePairs() {
        Set<String> used = new HashSet<>();
        int count = 0;
        for (Map.Entry<String, WebSocketSession> e : pairs.entrySet()) {
            String a = e.getKey();
            WebSocketSession peer = e.getValue();
            if (peer == null) continue;
            String b = peer.getId();
            if (used.contains(a) || used.contains(b)) continue;

            String ra = roles.get(a);
            String rb = roles.get(b);
            if (("model".equals(ra) && "client".equals(rb)) || ("client".equals(ra) && "model".equals(rb))) {
                count++;
                used.add(a);
                used.add(b);
            }
        }
        return count;
    }

    private boolean canMatch(Long userAId, Long userBId) {
        if (userAId == null || userBId == null) return false;

        try {
            if (userBlockService.isBlockedBetween(userAId, userBId)) {
                return false;
            }
            return true;
        } catch (Exception ex) {
            // Fail-safe: ante cualquier error, NO emparejamos
            return false;
        }
    }


}
