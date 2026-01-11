package com.sharemechat.handler;

import com.sharemechat.dto.MessageDTO;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.*;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.entity.Balance;
import com.sharemechat.constants.Constants;

import java.math.BigDecimal;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.time.Duration;


@Component
public class MatchingHandler extends TextWebSocketHandler {

    private final Queue<WebSocketSession> waitingModels  = new ConcurrentLinkedQueue<>();
    private final Queue<WebSocketSession> waitingClients = new ConcurrentLinkedQueue<>();

    private final Map<String, WebSocketSession> pairs = new ConcurrentHashMap<>();
    private final Map<String, String> roles = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionUserIds = new ConcurrentHashMap<>();
    private final Map<String, Long> lastMatchAt = new ConcurrentHashMap<>();
    private final Set<String> switching = Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final Map<String, String> pairLockOwnerBySessionId = new ConcurrentHashMap<>();

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
    private final SeenService seenService;
    private final int seenMaxScan;
    private final StreamLockService streamLockService;
    private final Duration streamLockTtl = Duration.ofSeconds(15);


    public MatchingHandler(JwtUtil jwtUtil,
                           UserRepository userRepository,
                           StreamService streamService,
                           TransactionService transactionService,
                           MessageService messageService,
                           MessagesWsHandler messagesWsHandler,
                           StatusService statusService,
                           BalanceRepository balanceRepository,
                           UserTrialService userTrialService,
                           UserBlockService userBlockService,
                           SeenService seenService,
                           StreamLockService streamLockService,
                           @Value("${matching.seen.max-scan:60}") int seenMaxScan) {
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
        this.seenService = seenService;
        this.seenMaxScan = seenMaxScan;
        this.streamLockService = streamLockService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long userId = resolveUserId(session);
        if (userId == null) {
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
        lastMatchAt.remove(session.getId());

        if ("model".equals(role)) {
            waitingModels.remove(session);
            if (userId != null) statusService.setOffline(userId);
        } else if ("client".equals(role)) {
            waitingClients.remove(session);
        }

        WebSocketSession peer = pairs.remove(session.getId());
        if (peer != null) {
            pairs.remove(peer.getId());

            Long myId = userId;
            Long peerId = sessionUserIds.get(peer.getId());
            String myRole = role;
            String peerRole = roles.get(peer.getId());

            endStreamIfPairKnown(
                    session.getId(), myId, myRole,
                    peer.getId(), peerId, peerRole,
                    "DISCONNECT"
            );

            if (peer.isOpen()) {
                safeSend(peer, "{\"type\":\"peer-disconnected\",\"reason\":\"peer-closed\"}");
                safeRequeue(peer, peerRole);
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();

        try {
            JSONObject json = new JSONObject(payload);
            String type = json.getString("type");

            if ("ping".equals(type)) {

                confirmIfBillablePair(session);
                checkCutoffAndMaybeEnd(session);
                handleTrialPingAndMaybeEnd(session);

                Long me = sessionUserIds.get(session.getId());
                String role = roles.get(session.getId());
                if (me != null && "model".equals(role)) {
                    try { statusService.heartbeat(me); } catch (Exception ignore) {}
                }
                return;
            }

            if ("set-role".equals(type)) {
                String role = json.getString("role");
                roles.put(session.getId(), role);
                Long userId = sessionUserIds.get(session.getId());

                if ("model".equals(role)) {
                    waitingModels.remove(session);
                    waitingModels.add(session);
                    if (userId != null) statusService.setAvailable(userId);
                } else if ("client".equals(role)) {
                    waitingClients.remove(session);
                    waitingClients.add(session);
                }

            } else if ("start-match".equals(type)) {
                String role = roles.get(session.getId());
                if ("client".equals(role)) matchClient(session);
                else if ("model".equals(role)) matchModel(session);

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
                            try { peer.sendMessage(tm); } catch (Exception ignore) {}
                        } catch (Exception ex) {
                            System.out.println("Persistencia chat falló: " + ex.getMessage());
                            try { peer.sendMessage(new TextMessage(payload)); } catch (Exception ignore) {}
                            try {
                                JSONObject err = new JSONObject().put("type", "msg:error").put("message", ex.getMessage());
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
                if (peer != null && peer.isOpen()) peer.sendMessage(message);
            }
        } catch (Exception e) {
            System.out.println("Error parseando JSON: " + e.getMessage());
        }
    }

    /* =========================================================
       MATCHING (con Seen TTL robusto)
       ========================================================= */

    private void matchClient(WebSocketSession client) throws Exception {
        waitingClients.remove(client);

        Long clientId = sessionUserIds.get(client.getId());
        if (clientId == null) {
            waitingClients.add(client);
            return;
        }

        // Pass 1: intentar evitar repetidos (UNSEEN)
        MatchAttemptResult r1 = tryMatchClientAgainstModels(client, clientId, true);
        if (r1.handled) return;

        // Pass 2: fallback permitir repetidos si no hay alternativas
        MatchAttemptResult r2 = tryMatchClientAgainstModels(client, clientId, false);
        if (r2.handled) return;

        safeSend(client, "{\"type\":\"no-model-available\"}");
        waitingClients.add(client);
    }

    private void matchModel(WebSocketSession model) throws Exception {
        waitingModels.remove(model);

        Long modelId = sessionUserIds.get(model.getId());
        if (modelId == null) {
            waitingModels.add(model);
            return;
        }

        // Pass 1: intentar evitar repetidos (UNSEEN para el viewer/clientId)
        MatchAttemptResult r1 = tryMatchModelAgainstClients(model, modelId, true);
        if (r1.handled) return;

        // Pass 2: fallback permitir repetidos si no hay alternativas
        MatchAttemptResult r2 = tryMatchModelAgainstClients(model, modelId, false);
        if (r2.handled) return;

        safeSend(model, "{\"type\":\"no-client-available\"}");
        waitingModels.add(model);
    }

    private static class MatchAttemptResult {
        final boolean handled; // true si ya enviamos algo / hicimos match / ya reencolamos y no hay que seguir
        MatchAttemptResult(boolean handled) { this.handled = handled; }
        static MatchAttemptResult HANDLED() { return new MatchAttemptResult(true); }
        static MatchAttemptResult NOT_HANDLED() { return new MatchAttemptResult(false); }
    }

    private MatchAttemptResult tryMatchClientAgainstModels(WebSocketSession client, Long clientId, boolean enforceUnseen) throws Exception {

        List<WebSocketSession> skipped = new ArrayList<>();
        int scanned = 0;

        WebSocketSession model;
        while (scanned++ < seenMaxScan && (model = waitingModels.poll()) != null) {

            if (!model.isOpen()) continue;

            Long modelId = sessionUserIds.get(model.getId());
            if (modelId == null) continue;

            if (!canMatch(clientId, modelId)) {
                skipped.add(model);
                continue;
            }

            if (enforceUnseen && seenService.hasSeen(clientId, modelId)) {
                skipped.add(model);
                continue;
            }

            String owner = streamLockService.newOwnerToken();
            if (!tryAcquirePairLocks(clientId, modelId, owner)) {
                skipped.add(model);
                continue;
            }

            boolean matched = false;

            try {
                User viewer = userRepository.findById(clientId).orElse(null);
                String realRole = viewer != null ? viewer.getRole() : null;

                if (Constants.Roles.USER.equals(realRole)) {
                    if (!userTrialService.canStartTrial(clientId)) {
                        safeSend(client, "{\"type\":\"trial-unavailable\"}");

                        skipped.add(model);
                        requeueModels(skipped);

                        waitingClients.add(client);
                        return MatchAttemptResult.HANDLED();
                    }
                    userTrialService.startTrialStream(clientId, modelId);
                } else {
                    streamService.startSession(clientId, modelId);
                }

                // Match real => marcar SEEN
                seenService.markSeen(clientId, modelId);

                pairs.put(client.getId(), model);
                pairs.put(model.getId(), client);

                long now = System.currentTimeMillis();
                lastMatchAt.put(client.getId(), now);
                lastMatchAt.put(model.getId(), now);

                // Guardar owner del lock para liberar al cerrar
                pairLockOwnerBySessionId.put(client.getId(), owner);
                pairLockOwnerBySessionId.put(model.getId(), owner);

                sendMatchMessage(client, model.getId());
                sendMatchMessage(model, client.getId());

                requeueModels(skipped);

                matched = true;
                return MatchAttemptResult.HANDLED();

            } catch (Exception ex) {
                System.out.println("startSession/startTrialStream falló: " + ex.getMessage());

                pairs.remove(client.getId());
                pairs.remove(model.getId());

                skipped.add(model);
                requeueModels(skipped);

                if (isLowBalance(ex)) safeSend(client, "{\"type\":\"no-balance\"}");
                else safeSend(client, "{\"type\":\"no-model-available\"}");

                waitingClients.add(client);
                return MatchAttemptResult.HANDLED();

            } finally {
                // OJO: si hubo match, NO liberamos aquí. Se libera al cerrar el stream (o por TTL).
                if (!matched) {
                    releasePairLocks(clientId, modelId, owner);
                }
            }
        }

        requeueModels(skipped);
        return MatchAttemptResult.NOT_HANDLED();
    }

    private MatchAttemptResult tryMatchModelAgainstClients(WebSocketSession model, Long modelId, boolean enforceUnseen) throws Exception {

        List<WebSocketSession> skipped = new ArrayList<>();
        int scanned = 0;

        WebSocketSession client;
        while (scanned++ < seenMaxScan && (client = waitingClients.poll()) != null) {

            if (!client.isOpen()) continue;

            Long clientId = sessionUserIds.get(client.getId());
            if (clientId == null) continue;

            if (!canMatch(clientId, modelId)) {
                skipped.add(client);
                continue;
            }

            if (enforceUnseen && seenService.hasSeen(clientId, modelId)) {
                skipped.add(client);
                continue;
            }

            String owner = streamLockService.newOwnerToken();
            if (!tryAcquirePairLocks(clientId, modelId, owner)) {
                skipped.add(client);
                continue;
            }

            boolean matched = false;

            try {
                User viewer = userRepository.findById(clientId).orElse(null);
                String realRole = viewer != null ? viewer.getRole() : null;

                if (Constants.Roles.USER.equals(realRole)) {

                    if (!userTrialService.canStartTrial(clientId)) {
                        safeSend(client, "{\"type\":\"trial-unavailable\"}");

                        skipped.add(client);
                        requeueClients(skipped);

                        waitingModels.add(model);
                        return MatchAttemptResult.HANDLED();
                    }

                    userTrialService.startTrialStream(clientId, modelId);

                } else {
                    streamService.startSession(clientId, modelId);
                }

                // Match real => marcar SEEN (viewer=clientId)
                seenService.markSeen(clientId, modelId);

                pairs.put(model.getId(), client);
                pairs.put(client.getId(), model);

                long now = System.currentTimeMillis();
                lastMatchAt.put(model.getId(), now);
                lastMatchAt.put(client.getId(), now);

                // Guardar owner del lock para liberar al cerrar
                pairLockOwnerBySessionId.put(model.getId(), owner);
                pairLockOwnerBySessionId.put(client.getId(), owner);

                sendMatchMessage(model, client.getId());
                sendMatchMessage(client, model.getId());

                requeueClients(skipped);

                matched = true;
                return MatchAttemptResult.HANDLED();

            } catch (Exception ex) {
                System.out.println("startSession/startTrialStream falló: " + ex.getMessage());

                pairs.remove(model.getId());
                pairs.remove(client.getId());

                if (isLowBalance(ex)) safeSend(client, "{\"type\":\"no-balance\"}");

                skipped.add(client);
                requeueClients(skipped);

                waitingModels.add(model);
                return MatchAttemptResult.HANDLED();

            } finally {
                // OJO: si hubo match, NO liberamos aquí. Se libera al cerrar el stream (o por TTL).
                if (!matched) {
                    releasePairLocks(clientId, modelId, owner);
                }
            }
        }

        requeueClients(skipped);
        return MatchAttemptResult.NOT_HANDLED();
    }


    private void requeueModels(List<WebSocketSession> list) {
        for (WebSocketSession s : list) {
            if (s != null && s.isOpen()) waitingModels.add(s);
        }
    }

    private void requeueClients(List<WebSocketSession> list) {
        for (WebSocketSession s : list) {
            if (s != null && s.isOpen()) waitingClients.add(s);
        }
    }

    /* =========================================================
       NEXT / STREAM END / OTHER EVENTS
       ========================================================= */

    private void handleNext(WebSocketSession session) throws Exception {
        if (!switching.add(session.getId())) return;
        try {

            Long t = lastMatchAt.get(session.getId());
            if (t != null && (System.currentTimeMillis() - t) < 1500L) {
                safeSend(session, "{\"type\":\"next-ignored\",\"reason\":\"grace\"}");
                return;
            }

            WebSocketSession peer = pairs.remove(session.getId());
            if (peer != null) {
                pairs.remove(peer.getId());

                Long myId = sessionUserIds.get(session.getId());
                Long peerId = sessionUserIds.get(peer.getId());
                String myRole = roles.get(session.getId());
                String peerRole = roles.get(peer.getId());
                endStreamIfPairKnown(
                        session.getId(), myId, myRole,
                        peer.getId(), peerId, peerRole,
                        "NEXT"
                );


                if (peer.isOpen()) {
                    safeSend(peer, "{\"type\":\"peer-disconnected\",\"reason\":\"next\"}");
                    safeRequeue(peer, peerRole);
                }
            }

            String role = roles.get(session.getId());
            if ("client".equals(role)) matchClient(session);
            else if ("model".equals(role)) matchModel(session);
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
        try { streamId = statusService.getActiveSession(senderId, peerUserId).orElse(null); } catch (Exception ignore) {}

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
            org.json.JSONObject err = new org.json.JSONObject().put("type", "gift:error").put("message", ex.getMessage());
            safeSend(session, err.toString());
        }
    }

    private void endStreamIfPairKnown(String sessionIdA, Long idA, String roleA, String sessionIdB, Long idB, String roleB, String closeReason) {
        if (idA == null || idB == null || roleA == null || roleB == null) {
            return;
        }

        Long viewerId;
        Long modelId;

        if ("client".equals(roleA) && "model".equals(roleB)) {
            viewerId = idA;
            modelId = idB;
        } else if ("model".equals(roleA) && "client".equals(roleB)) {
            viewerId = idB;
            modelId = idA;
        } else {
            return;
        }

        try {
            System.out.println(
                    "endStreamIfPairKnown: reason=" + closeReason +
                            " viewerId=" + viewerId +
                            " modelId=" + modelId
            );

            User viewer = userRepository.findById(viewerId).orElse(null);
            String realRole = viewer != null ? viewer.getRole() : null;

            if (Constants.Roles.CLIENT.equals(realRole)) {
                streamService.endSession(viewerId, modelId);
            } else if (Constants.Roles.USER.equals(realRole)) {
                userTrialService.endTrialStream(viewerId, modelId, closeReason);
            }

        } catch (Exception ex) {
            System.out.println("endSession/endTrialSession falló: " + ex.getMessage());

        } finally {
            // 🔐 liberar locks de forma segura e idempotente
            String ownerA = null;
            String ownerB = null;

            if (sessionIdA != null) {
                ownerA = pairLockOwnerBySessionId.remove(sessionIdA);
            }
            if (sessionIdB != null) {
                ownerB = pairLockOwnerBySessionId.remove(sessionIdB);
            }

            // Si por cualquier razón no estaba por sessionId, intentamos fallback por userId (sin NPE)
            if (ownerA == null) {
                String sid = findSessionIdByUserId(viewerId);
                if (sid != null) ownerA = pairLockOwnerBySessionId.remove(sid);
            }
            if (ownerB == null) {
                String sid = findSessionIdByUserId(modelId);
                if (sid != null) ownerB = pairLockOwnerBySessionId.remove(sid);
            }

            String owner = ownerA != null ? ownerA : ownerB;

            if (owner != null) {
                try {
                    releasePairLocks(viewerId, modelId, owner);
                } catch (Exception ex) {
                    System.out.println("Error liberando locks: " + ex.getMessage());
                }
            }
        }
    }



    private void sendMatchMessage(WebSocketSession session, String peerSessionId) {
        try {
            Long peerUserId = sessionUserIds.get(peerSessionId);
            String peerRole = roles.get(peerSessionId);

            BigDecimal clientBalance = null;

            if ("client".equals(peerRole)) {
                clientBalance = getCurrentBalanceOrZero(peerUserId);
            }

            String msg = String.format(
                    "{\"type\":\"match\",\"peerId\":\"%s\",\"peerUserId\":%s,\"peerRole\":\"%s\",\"clientBalance\":%s}",
                    peerSessionId,
                    peerUserId != null ? peerUserId.toString() : "null",
                    peerRole != null ? peerRole : "",
                    clientBalance != null ? ("\"" + clientBalance.toPlainString() + "\"") : "null"
            );

            session.sendMessage(new TextMessage(msg));
        } catch (Exception e) {
            System.out.println("Error enviando match a sessionId=" + session.getId() + ": " + e.getMessage());
        }
    }

    private void safeRequeue(WebSocketSession session, String role) {
        if (session != null && session.isOpen()) {
            if ("model".equals(role)) waitingModels.add(session);
            else if ("client".equals(role)) waitingClients.add(session);
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
        } catch (Exception ignored) {}

        try {
            List<String> auths = session.getHandshakeHeaders().get("Authorization");
            if (auths != null && !auths.isEmpty()) {
                String h = auths.get(0);
                if (h != null && h.startsWith("Bearer ")) return h.substring(7);
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
            try { s.sendMessage(new TextMessage(json)); } catch (Exception ignore) {}
        }
    }

    private boolean checkCutoffAndMaybeEnd(WebSocketSession session) {
        WebSocketSession peer = pairs.get(session.getId());
        if (peer == null) return false;

        String myRole = roles.get(session.getId());
        String peerRole = roles.get(peer.getId());
        if (myRole == null || peerRole == null) return false;

        Long myUserId = sessionUserIds.get(session.getId());
        Long peerUserId = sessionUserIds.get(peer.getId());
        if (myUserId == null || peerUserId == null) return false;

        Long clientId;
        Long modelId;

        if ("client".equals(myRole) && "model".equals(peerRole)) {
            clientId = myUserId;
            modelId = peerUserId;
        } else if ("model".equals(myRole) && "client".equals(peerRole)) {
            clientId = peerUserId;
            modelId = myUserId;
        } else {
            return false;
        }

        try {
            User clientUser = userRepository.findById(clientId).orElse(null);
            if (clientUser == null || !Constants.Roles.CLIENT.equals(clientUser.getRole())) return false;
        } catch (Exception ex) {
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
            safeSend(peer, "{\"type\":\"peer-disconnected\",\"reason\":\"low-balance\"}");
            pairs.remove(session.getId());
            pairs.remove(peer.getId());
        }
        return closed;
    }

    private void handleTrialPingAndMaybeEnd(WebSocketSession session) {
        WebSocketSession peer = pairs.get(session.getId());
        if (peer == null) return;

        String myRole = roles.get(session.getId());
        String peerRole = roles.get(peer.getId());
        if (myRole == null || peerRole == null) return;

        Long myUserId = sessionUserIds.get(session.getId());
        Long peerUserId = sessionUserIds.get(peer.getId());
        if (myUserId == null || peerUserId == null) return;

        Long viewerId;
        Long modelId;
        WebSocketSession viewerSession;
        WebSocketSession modelSession;

        if ("client".equals(myRole) && "model".equals(peerRole)) {
            viewerId = myUserId;
            modelId = peerUserId;
            viewerSession = session;
            modelSession = peer;
        } else if ("model".equals(myRole) && "client".equals(peerRole)) {
            viewerId = peerUserId;
            modelId = myUserId;
            viewerSession = peer;
            modelSession = session;
        } else {
            return;
        }

        try {
            
            User viewer = userRepository.findById(viewerId).orElse(null);

            if (viewer == null || !Constants.Roles.USER.equals(viewer.getRole())) return;

            boolean ended = userTrialService.endTrialIfTimeExceeded(viewerId, modelId);
            if (!ended) return;

            safeSend(viewerSession, "{\"type\":\"peer-disconnected\",\"reason\":\"trial-ended\"}");
            safeSend(modelSession, "{\"type\":\"peer-disconnected\",\"reason\":\"trial-ended\"}");

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

    private BigDecimal getCurrentBalanceOrZero(Long userId) {
        if (userId == null) return BigDecimal.ZERO;
        try {
            return balanceRepository
                    .findTopByUserIdOrderByTimestampDesc(userId)
                    .map(Balance::getBalance)
                    .orElse(BigDecimal.ZERO);
        } catch (Exception ex) {
            return BigDecimal.ZERO;
        }
    }

    private void sendQueueStats(WebSocketSession s) {
        try {
            int waitingModelsCount = waitingModels.size();
            int waitingClientsCount = waitingClients.size();

            String role = roles.get(s.getId());
            int myPosition = -1;
            if ("model".equals(role)) myPosition = positionInQueue(waitingModels, s);

            int activePairs = computeActivePairs();
            int modelsStreaming = activePairs;
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

    private void confirmIfBillablePair(WebSocketSession session) {
        try {
            WebSocketSession peer = pairs.get(session.getId());
            if (peer == null) return;

            String myRole = roles.get(session.getId());
            String peerRole = roles.get(peer.getId());
            if (myRole == null || peerRole == null) return;

            Long myUserId = sessionUserIds.get(session.getId());
            Long peerUserId = sessionUserIds.get(peer.getId());
            if (myUserId == null || peerUserId == null) return;

            Long clientId;
            Long modelId;

            if ("client".equals(myRole) && "model".equals(peerRole)) {
                clientId = myUserId; modelId = peerUserId;
            } else if ("model".equals(myRole) && "client".equals(peerRole)) {
                clientId = peerUserId; modelId = myUserId;
            } else {
                return;
            }

            User clientUser = userRepository.findById(clientId).orElse(null);
            if (clientUser == null || !Constants.Roles.CLIENT.equals(clientUser.getRole())) {
                return; // no confirmamos trials (USER)
            }

            streamService.confirmActiveSession(clientId, modelId);

        } catch (Exception ignore) {}
    }

    private boolean canMatch(Long userAId, Long userBId) {
        if (userAId == null || userBId == null) return false;
        try {
            return !userBlockService.isBlockedBetween(userAId, userBId);
        } catch (Exception ex) {
            return false;
        }
    }

    private boolean tryAcquirePairLocks(Long clientId, Long modelId, String owner) {
        // Orden fijo para evitar “deadlocks” lógicos en el futuro
        // (aunque aquí usemos tryLock, el orden consistente es buena práctica)
        boolean clientLocked = streamLockService.tryLockClient(clientId, owner, streamLockTtl);
        if (!clientLocked) return false;

        boolean modelLocked = streamLockService.tryLockModel(modelId, owner, streamLockTtl);
        if (!modelLocked) {
            streamLockService.unlockClient(clientId, owner);
            return false;
        }

        return true;
    }

    private void releasePairLocks(Long clientId, Long modelId, String owner) {
        streamLockService.unlockModel(modelId, owner);
        streamLockService.unlockClient(clientId, owner);
    }

    private String findSessionIdByUserId(Long userId) {
        if (userId == null) return null;

        for (Map.Entry<String, Long> e : sessionUserIds.entrySet()) {
            if (userId.equals(e.getValue())) {
                return e.getKey();
            }
        }
        return null;
    }


}
