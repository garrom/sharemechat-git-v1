package com.sharemechat.handler;

import com.sharemechat.config.BillingProperties;
import com.sharemechat.dto.MessageDTO;
import com.sharemechat.entity.Balance;
import com.sharemechat.exception.UserBlockedException;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.*;
import org.json.JSONObject;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.apache.commons.lang3.tuple.Pair;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.Duration;


@Component
public class MessagesWsHandler extends TextWebSocketHandler {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final MessageService messageService;
    private final FavoriteService favoriteService;
    private final TransactionService transactionService;
    private final StreamService streamService;
    private final ClientRepository clientRepository;
    private final BillingProperties billing;
    private final StatusService statusService;
    private final UserBlockService userBlockService;
    private final BalanceRepository balanceRepository;
    private final StreamLockService streamLockService;

    private static final Logger log = LoggerFactory.getLogger(MessagesWsHandler.class);
    private final Map<Long, Set<WebSocketSession>> sessions = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionUserIds = new ConcurrentHashMap<>();
    private final Map<Long, String> activeCallOwners = new ConcurrentHashMap<>();
    private final Map<Long, Long> activeCalls = new ConcurrentHashMap<>();
    private final Set<Long> ringing = ConcurrentHashMap.newKeySet();

    public MessagesWsHandler(JwtUtil jwtUtil,
                             UserRepository userRepository,
                             FavoriteService favoriteService,
                             MessageService messageService,
                             TransactionService transactionService,
                             StreamService streamService,
                             ClientRepository clientRepository,
                             BillingProperties billing,
                             StatusService statusService,
                             UserBlockService userBlockService,
                             BalanceRepository balanceRepository,
                             StreamLockService streamLockService) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.favoriteService = favoriteService;
        this.messageService = messageService;
        this.transactionService = transactionService;
        this.streamService = streamService;
        this.clientRepository = clientRepository;
        this.billing = billing;
        this.statusService = statusService;
        this.userBlockService = userBlockService;
        this.balanceRepository = balanceRepository;
        this.streamLockService = streamLockService;
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

        var u = userRepository.findById(userId).orElse(null);
        if (u != null && com.sharemechat.constants.Constants.Roles.MODEL.equals(u.getRole())) {
            statusService.setAvailable(userId);
        }
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

            var u2 = userRepository.findById(userId).orElse(null);
            if (u2 != null && com.sharemechat.constants.Constants.Roles.MODEL.equals(u2.getRole())) {
                boolean stillOnline = sessions.getOrDefault(userId, java.util.Set.of()).size() > 0;
                if (!stillOnline && inCallWith(userId) == null) statusService.setOffline(userId);
            }

            if (ringing.remove(userId)) {
                broadcastToUser(userId, new org.json.JSONObject()
                        .put("type", "call:canceled")
                        .put("reason", "receiver_ws_closed")
                        .toString());
            }

            Long peer = inCallWith(userId);
            if (peer != null) {
                try {
                    endCallAndSession(userId, peer, "ws_closed");
                } catch (Exception ex) {
                    log.warn("afterConnectionClosed endCall error userId={} peer={} err={}", userId, peer, ex.getMessage());
                }
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        if (log.isTraceEnabled()) log.trace("WS /messages in: {}", message.getPayload());

        Long me = sessionUserIds.get(session.getId());
        if (me == null) return;

        JSONObject json = new JSONObject(message.getPayload());
        String type = json.optString("type", "");

        if ("msg:send".equals(type)) {
            Object toObj = json.opt("to");
            String toRaw = (toObj != null) ? String.valueOf(toObj) : null;
            Long to = null;
            try { if (toRaw != null) to = Long.valueOf(toRaw); } catch (Exception ignore) {}

            String body = json.optString("body", "");
            body = (body != null) ? body.trim() : "";

            log.info("WS msg:send IN session={} me={} rawTo='{}' parsedTo={} bodyLen={}",
                    session.getId(), me, toRaw, to, (body != null ? body.length() : 0));

            if (to == null || to <= 0L) {
                safeSend(session, new JSONObject().put("type","msg:error").put("message","Destinatario inválido").toString());
                return;
            }
            if (java.util.Objects.equals(me, to)) {
                safeSend(session, new JSONObject().put("type","msg:error").put("message","No puedes enviarte mensajes a ti mismo").toString());
                return;
            }
            if (body.isEmpty()) {
                safeSend(session, new JSONObject().put("type","msg:error").put("message","Mensaje vacío").toString());
                return;
            }

            try {
                // === FIX: bloqueo en cualquier dirección (me <-> to)
                if (userBlockService.isBlockedBetween(me, to)) {
                    safeSend(session, new JSONObject().put("type","msg:error").put("message","Mensajería bloqueada: usuario bloqueado").toString());
                    return;
                }

                if (!favoriteService.canUsersMessage(me, to)) {
                    safeSend(session, new JSONObject().put("type","msg:error").put("message","Mensajería bloqueada: relación no aceptada").toString());
                    return;
                }

                MessageDTO saved = messageService.send(me, to, body);

                broadcastToUser(me, new JSONObject().put("type","msg:new").put("from", me).put("message", toJson(saved)).toString());
                broadcastToUser(to, new JSONObject().put("type","msg:new").put("from", me).put("message", toJson(saved)).toString());
            } catch (Exception ex) {
                safeSend(session, new JSONObject().put("type","msg:error").put("message", ex.getMessage()).toString());
            }
            return;
        }

        if ("msg:gift".equals(type)) {
            handleMsgGift(session, json);
            return;
        }

        if ("msg:read".equals(type)) {
            Long withUser = json.optLong("with");
            messageService.markRead(me, withUser);
            broadcastToUser(withUser, new JSONObject().put("type","msg:read").put("by", me).put("with", withUser).toString());
            return;
        }

        if ("ping".equals(type)) {
            try {
                Long meId = me;
                if (meId != null) {
                    var u = userRepository.findById(meId).orElse(null);
                    if (u != null && com.sharemechat.constants.Constants.Roles.MODEL.equals(u.getRole())) {
                        statusService.heartbeat(meId);
                    }
                }
            } catch (Exception ignore) {}
            return;
        }

        if ("call:invite".equals(type)) {
            Long to = json.has("to") ? json.optLong("to", 0L) : null;
            if (to == null || to <= 0L) {
                safeSend(session, new JSONObject().put("type","call:error").put("message","Destinatario inválido").toString());
                return;
            }
            if (Objects.equals(me, to)) {
                safeSend(session, new JSONObject().put("type","call:error").put("message","No puedes llamarte a ti mismo").toString());
                return;
            }

            try {
                // === FIX: bloqueo en cualquier dirección (me <-> to)
                if (userBlockService.isBlockedBetween(me, to)) {
                    safeSend(session, new JSONObject().put("type","call:error").put("message","Llamadas bloqueadas: usuario bloqueado").toString());
                    return;
                }

                if (!favoriteService.canUsersMessage(me, to)) {
                    safeSend(session, new JSONObject().put("type","call:error").put("message","Llamadas bloqueadas: relación no aceptada").toString());
                    return;
                }
            } catch (Exception ex) {
                safeSend(session, new JSONObject().put("type","call:error").put("message", ex.getMessage()).toString());
                return;
            }

            if (isBusy(me)) {
                safeSend(session, new JSONObject().put("type","call:busy").put("who","me").toString());
                return;
            }
            if (isBusy(to)) {
                safeSend(session, new JSONObject().put("type","call:busy").put("who","peer_streaming").toString());
                return;
            }
            if (!isUserOnline(to)) {
                safeSend(session, new JSONObject().put("type","call:offline").toString());
                return;
            }
            if (ringing.contains(to)) {
                safeSend(session, new JSONObject().put("type","call:busy").put("who","peer_ringing").toString());
                return;
            }

            Pair<Long, Long> cm = resolveClientModel(me, to);
            if (cm == null) {
                safeSend(session, new JSONObject().put("type","call:error").put("message","Solo se permiten llamadas CLIENT↔MODEL").toString());
                return;
            }
            Long clientId = cm.getLeft();
            Long modelId  = cm.getRight();

            if (!hasSufficientBalance(clientId)) {
                safeSend(session, new JSONObject().put("type","call:no-balance").toString());
                return;
            }

            beginRinging(to);
            safeSend(session, new JSONObject().put("type","call:ringing").put("to", to).toString());

            String display = userRepository.findById(me)
                    .map(u -> Optional.ofNullable(u.getNickname()).orElse(Optional.ofNullable(u.getName()).orElse(u.getEmail())))
                    .orElse("Usuario " + me);

            broadcastToUser(to, new JSONObject()
                    .put("type", "call:incoming")
                    .put("from", me)
                    .put("displayName", display)
                    .toString());
            return;
        }

        if ("call:accept".equals(type)) {
            Long with = json.has("with") ? json.optLong("with", 0L) : null;
            if (with == null || with <= 0L) {
                safeSend(session, new JSONObject().put("type","call:error").put("message","Par inválido").toString());
                return;
            }
            if (!ringing.contains(me)) {
                safeSend(session, new JSONObject().put("type","call:error").put("message","No estás en RINGING").toString());
                return;
            }

            try {
                // === FIX: bloqueo en cualquier dirección (me <-> with)
                if (userBlockService.isBlockedBetween(me, with)) {
                    clearRinging(me);
                    safeSend(session, new JSONObject().put("type","call:error").put("message","Llamadas bloqueadas: usuario bloqueado").toString());
                    return;
                }

                if (!favoriteService.canUsersMessage(me, with)) {
                    safeSend(session, new JSONObject().put("type","call:error").put("message","Llamadas bloqueadas: relación no aceptada").toString());
                    return;
                }
            } catch (Exception ex) {
                safeSend(session, new JSONObject().put("type","call:error").put("message", ex.getMessage()).toString());
                return;
            }

            if (!isUserOnline(with)) {
                clearRinging(me);
                safeSend(session, new JSONObject().put("type","call:error").put("message","El usuario que te llamaba ya no está disponible").toString());
                return;
            }

            if (inCallWith(me) != null || inCallWith(with) != null) {
                clearRinging(me);
                safeSend(session, new JSONObject().put("type","call:busy").toString());
                return;
            }

            Pair<Long, Long> cm = resolveClientModel(me, with);
            if (cm == null) {
                clearRinging(me);
                safeSend(session, new JSONObject().put("type","call:error").put("message","Solo CLIENT↔MODEL").toString());
                return;
            }
            Long clientId = cm.getLeft();
            Long modelId  = cm.getRight();

            setActiveCall(me, with);
            clearRinging(me);

            statusService.setBusy(modelId);

            JSONObject accepted = new JSONObject()
                    .put("type","call:accepted")
                    .put("clientId", clientId)
                    .put("modelId", modelId);

            broadcastToUser(me, accepted.toString());
            broadcastToUser(with, accepted.toString());

            // === NUEVO: saldo del CLIENT -> MODEL (misma fuente que Random: BalanceRepository / tabla balances)
            try {
                BigDecimal bal = getCurrentBalanceOrZero(clientId);

                JSONObject out = new JSONObject()
                        .put("type", "call:saldo")
                        .put("clientBalance", bal.toPlainString());

                // solo lo necesita la MODEL emparejada
                broadcastToUser(modelId, out.toString());
            } catch (Exception ex) {
                log.warn("call:accept saldo error clientId={} modelId={} err={}", clientId, modelId, ex.getMessage());
            }

            return;
        }


        if ("call:connected".equals(type)) {
            Long with = json.has("with") ? json.optLong("with", 0L) : null;
            if (with == null || with <= 0L) {
                safeSend(session, new JSONObject()
                        .put("type","call:error")
                        .put("message","Par inválido (connected)")
                        .toString());
                return;
            }

            Long current = inCallWith(me);
            if (current == null || !current.equals(with)) {
                // idempotente: ignorar
                return;
            }

            Pair<Long, Long> cm = resolveClientModel(me, with);
            if (cm == null) {
                return;
            }

            Long clientId = cm.getLeft();
            Long modelId  = cm.getRight();

            // === INDUSTRIAL: LOCK DISTRIBUIDO POR PAR ===
            String owner = streamLockService.newOwnerToken();
            boolean lockedClient = false;
            boolean lockedModel  = false;

            try {
                lockedClient = streamLockService.tryLockClient(clientId, owner, Duration.ofSeconds(20));
                lockedModel  = streamLockService.tryLockModel(modelId, owner, Duration.ofSeconds(20));

                if (!lockedClient || !lockedModel) {
                    // Otro hilo/instancia ya está iniciando el stream
                    return;
                }

                // Guardar owner para liberar al final
                activeCallOwners.put(clientId, owner);
                activeCallOwners.put(modelId, owner);

                // === START SESSION (IDEMPOTENTE EN StreamService) ===
                try {
                    streamService.startSession(clientId, modelId);
                    streamService.confirmActiveSession(clientId, modelId);
                } catch (Exception ex) {
                    String msg = ex.getMessage() != null ? ex.getMessage() : "No se pudo iniciar la sesión";

                    if (msg.contains("Saldo insuficiente")) {
                        broadcastToUser(clientId, new JSONObject().put("type","call:no-balance").toString());
                        broadcastToUser(modelId,  new JSONObject().put("type","call:no-balance").toString());
                        broadcastToUser(clientId, new JSONObject().put("type","call:ended").put("reason","low-balance").toString());
                        broadcastToUser(modelId,  new JSONObject().put("type","call:ended").put("reason","low-balance").toString());
                    } else {
                        broadcastToUser(clientId, new JSONObject().put("type","call:error").put("message", msg).toString());
                        broadcastToUser(modelId,  new JSONObject().put("type","call:error").put("message", msg).toString());
                    }
                }

            } finally {
                // liberar locks inmediatamente (la sesión ya está creada)
                if (lockedClient) streamLockService.unlockClient(clientId, owner);
                if (lockedModel)  streamLockService.unlockModel(modelId, owner);
            }

            return;
        }


        if ("call:reject".equals(type)) {
            Long with = json.has("with") ? json.optLong("with", 0L) : null;
            if (with == null || with <= 0L) {
                safeSend(session, new JSONObject().put("type","call:error").put("message","Par inválido").toString());
                return;
            }
            if (ringing.remove(me)) {
                broadcastToUser(me, new JSONObject().put("type","call:rejected").put("by", me).toString());
                broadcastToUser(with, new JSONObject().put("type","call:rejected").put("by", me).toString());
            } else {
                safeSend(session, new JSONObject().put("type","call:error").put("message","No estabas en RINGING").toString());
            }
            return;
        }

        if ("call:cancel".equals(type)) {
            Long to = json.has("to") ? json.optLong("to", 0L) : null;
            if (to == null || to <= 0L) {
                safeSend(session, new JSONObject().put("type","call:error").put("message","Destinatario inválido").toString());
                return;
            }
            if (ringing.remove(to)) {
                broadcastToUser(me, new JSONObject().put("type","call:canceled").put("reason","caller_cancel").toString());
                broadcastToUser(to, new JSONObject().put("type","call:canceled").put("reason","caller_cancel").toString());
            } else {
                safeSend(session, new JSONObject().put("type","call:error").put("message","El receptor no estaba en RINGING").toString());
            }
            return;
        }

        if ("call:signal".equals(type)) {
            Long to = json.has("to") ? json.optLong("to", 0L) : null;
            JSONObject signal = json.optJSONObject("signal");
            if (to == null || to <= 0L || signal == null) {
                safeSend(session, new JSONObject().put("type","call:error").put("message","Signal inválido").toString());
                return;
            }
            Long peer = inCallWith(me);
            if (peer == null || !Objects.equals(peer, to)) {
                safeSend(session, new JSONObject().put("type","call:error").put("message","No hay llamada activa con el destinatario").toString());
                return;
            }
            broadcastToUser(to, new JSONObject().put("type","call:signal").put("from", me).put("signal", signal).toString());
            return;
        }

        if ("call:end".equals(type)) {
            Long peer = inCallWith(me);
            if (peer == null) {
                safeSend(session, new JSONObject().put("type","call:error").put("message","No estás en llamada").toString());
                return;
            }
            try {
                endCallAndSession(me, peer, "hangup");
            } catch (Exception ex) {
                log.warn("call:end error me={} peer={} err={}", me, peer, ex.getMessage());
                clearActiveCall(me, peer);
            }
            return;
        }

        if ("call:ping".equals(type)) {
            Long peer = inCallWith(me);
            if (peer == null) return;

            Pair<Long, Long> cm = resolveClientModel(me, peer);
            if (cm == null) return;

            Long clientId = cm.getLeft();
            Long modelId  = cm.getRight();

            // 1) Enviar saldo del CLIENT a la MODEL (misma fuente que Random: balances)
            try {
                BigDecimal bal = getCurrentBalanceOrZero(clientId);

                JSONObject out = new JSONObject()
                        .put("type", "call:saldo")
                        // como en Random, lo mandamos como string para no pelear con JSON/BigDecimal
                        .put("clientBalance", bal.toPlainString());

                // Solo lo necesita la MODEL (la que está en llamada con ese clientId)
                broadcastToUser(modelId, out.toString());
            } catch (Exception ex) {
                log.warn("call:ping saldo error clientId={} modelId={} err={}", clientId, modelId, ex.getMessage());
            }

            // 2) Cutoff (si cae por debajo del umbral, cerramos)
            try {
                boolean closed = streamService.endIfBelowThreshold(clientId, modelId);
                if (closed) {
                    streamService.endSessionAsync(clientId, modelId);
                    broadcastToUser(me, new JSONObject().put("type","call:ended").put("reason","low-balance").toString());
                    broadcastToUser(peer, new JSONObject().put("type","call:ended").put("reason","low-balance").toString());
                    clearActiveCall(me, peer);
                }
            } catch (Exception ex) {
                log.warn("call:ping cutoff error clientId={} modelId={} err={}", clientId, modelId, ex.getMessage());
            }
            return;
        }


        safeSend(session, new JSONObject().put("type","call:error").put("message","Tipo no soportado: " + type).toString());
    }


    private void handleMsgGift(WebSocketSession session, org.json.JSONObject json) {
        Long me = sessionUserIds.get(session.getId());
        if (me == null) { safeSend(session, "{\"type\":\"msg:error\",\"message\":\"No autenticado\"}"); return; }

        Object toObj = json.opt("to");
        String toRaw = (toObj != null) ? String.valueOf(toObj) : null;
        Long to = null; try { if (toRaw != null) to = Long.valueOf(toRaw); } catch (Exception ignore) {}
        long giftId = json.optLong("giftId", 0L);

        if (to == null || to <= 0L) { safeSend(session, "{\"type\":\"msg:error\",\"message\":\"Destinatario inválido\"}"); return; }
        if (java.util.Objects.equals(me, to)) { safeSend(session, "{\"type\":\"msg:error\",\"message\":\"No puedes enviarte regalos a ti mismo\"}"); return; }
        if (giftId <= 0L) { safeSend(session, "{\"type\":\"msg:error\",\"message\":\"giftId inválido\"}"); return; }

        // === FIX: bloqueo en cualquier dirección (me <-> to)
        try {
            if (userBlockService.isBlockedBetween(me, to)) {
                safeSend(session, new org.json.JSONObject().put("type","msg:error").put("message","Mensajería bloqueada: usuario bloqueado").toString());
                return;
            }
        } catch (Exception ex) {
            safeSend(session, new org.json.JSONObject().put("type","msg:error").put("message", ex.getMessage()).toString());
            return;
        }

        com.sharemechat.entity.User sender = userRepository.findById(me).orElse(null);
        com.sharemechat.entity.User recipient = userRepository.findById(to).orElse(null);
        if (sender == null || recipient == null) { safeSend(session, "{\"type\":\"msg:error\",\"message\":\"Usuarios inválidos\"}"); return; }
        if (!com.sharemechat.constants.Constants.Roles.CLIENT.equals(sender.getRole())) { safeSend(session, "{\"type\":\"msg:error\",\"message\":\"Solo un CLIENT puede enviar regalos\"}"); return; }
        if (!com.sharemechat.constants.Constants.Roles.MODEL.equals(recipient.getRole())) { safeSend(session, "{\"type\":\"msg:error\",\"message\":\"El destinatario debe ser MODEL\"}"); return; }

        try {
            if (!favoriteService.canUsersMessage(me, to)) {
                safeSend(session, "{\"type\":\"msg:error\",\"message\":\"Mensajería bloqueada entre estos usuarios\"}");
                return;
            }
        } catch (Exception ex) {
            safeSend(session, new org.json.JSONObject().put("type","msg:error").put("message", ex.getMessage()).toString());
            return;
        }

        try {
            com.sharemechat.entity.Gift g = transactionService.processGiftInChat(me, to, giftId);

            String marker = "[[GIFT:" + g.getId() + ":" + g.getName() + "]]";
            com.sharemechat.dto.MessageDTO saved = messageService.send(me, to, marker);

            org.json.JSONObject live = new org.json.JSONObject()
                    .put("type","msg:gift")
                    .put("messageId", saved.id())
                    .put("from", me)
                    .put("to", to)
                    .put("gift", new org.json.JSONObject()
                            .put("id", g.getId())
                            .put("name", g.getName())
                            .put("icon", g.getIcon())
                            .put("cost", g.getCost().toPlainString())
                    );

            String payload = live.toString();
            broadcastToUser(me, payload);
            broadcastToUser(to, payload);

            broadcastNew(saved);

        } catch (Exception ex) {
            safeSend(session, new org.json.JSONObject().put("type","msg:error").put("message", ex.getMessage()).toString());
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

        if (token == null) {
            log.warn("[WS][messages][AUTH_FAIL] sid={} reason=no_token uri={}",
                    session != null ? session.getId() : null,
                    session != null ? session.getUri() : null
            );
            return null;
        }

        try {
            if (!jwtUtil.isTokenValid(token)) {
                log.warn("[WS][messages][AUTH_FAIL] sid={} reason=invalid_token uri={}",
                        session != null ? session.getId() : null,
                        session != null ? session.getUri() : null
                );
                return null;
            }

            Long uid = jwtUtil.extractUserId(token);

            log.info("[WS][messages][AUTH_OK] sid={} uid={} uri={}",
                    session != null ? session.getId() : null,
                    uid,
                    session != null ? session.getUri() : null
            );

            return uid;
        } catch (Exception ex) {
            log.warn("[WS][messages][AUTH_FAIL] sid={} reason=exception exClass={} exMsg={}",
                    session != null ? session.getId() : null,
                    ex.getClass().getName(),
                    ex.getMessage()
            );
            return null;
        }
    }

    private String extractToken(WebSocketSession session) {

        // 1) Cookie "access_token" (NUEVO industrial)
        try {
            String cookieHeader = session.getHandshakeHeaders().getFirst("Cookie");
            String tokenFromCookie = readCookieFromHeader(cookieHeader, "access_token");
            if (tokenFromCookie != null) return tokenFromCookie;
        } catch (Exception ignore) {}

        // 2) Query param token (compat antigua: wss://.../messages?token=...)
        try {
            URI uri = session.getUri();
            if (uri != null && uri.getQuery() != null) {
                Map<String, String> qs = parseQuery(uri.getQuery());
                String t = qs.get("token");
                if (t != null && !t.isBlank()) return t;
            }
        } catch (Exception ignore) {}

        // 3) Authorization: Bearer ...
        try {
            String auth = session.getHandshakeHeaders().getFirst("Authorization");
            if (auth != null && auth.startsWith("Bearer ")) {
                String t = auth.substring(7);
                return (t == null || t.isBlank()) ? null : t;
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

    private String readCookieFromHeader(String cookieHeader, String name) {
        if (cookieHeader == null || cookieHeader.isBlank() || name == null || name.isBlank()) return null;

        try {
            String[] parts = cookieHeader.split(";");
            for (String p : parts) {
                String part = p != null ? p.trim() : "";
                if (part.isEmpty()) continue;

                int eq = part.indexOf('=');
                if (eq <= 0) continue;

                String k = part.substring(0, eq).trim();
                if (!name.equals(k)) continue;

                String v = part.substring(eq + 1).trim();
                if (v.isEmpty()) return null;

                // Por si viene URL-encoded
                try {
                    v = URLDecoder.decode(v, StandardCharsets.UTF_8);
                } catch (Exception ignore) {}

                return v.isBlank() ? null : v;
            }
        } catch (Exception ignore) {}

        return null;
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

    public boolean isUserOnline(Long userId) {
        var set = sessions.get(userId);
        boolean online = set != null && !set.isEmpty();
        if (log.isDebugEnabled()) log.debug("[WS] isUserOnline userId={} -> {}", userId, online);
        return online;
    }

    public boolean isBusy(Long userId) {
        if (inCallWith(userId) != null) {
            if (log.isDebugEnabled()) log.debug("[WS] isBusy userId={} -> true (activeCalls)", userId);
            return true;
        }
        try {
            if (streamService.isUserInActiveStream(userId)) {
                if (log.isDebugEnabled()) log.debug("[WS] isBusy userId={} -> true (active stream)", userId);
                return true;
            }
        } catch (Exception e) {
            if (log.isDebugEnabled()) log.debug("[WS] isBusy userId={} -> false (stream check error: {})", userId, e.getMessage());
        }
        try {
            String s = statusService.getStatus(userId);
            boolean busy = "BUSY".equals(s);
            if (log.isDebugEnabled()) log.debug("[WS] isBusy userId={} -> {} (redis={})", userId, busy, s);
            return busy;
        } catch (Exception e) {
            if (log.isDebugEnabled()) log.debug("[WS] isBusy userId={} -> false (redis error: {})", userId, e.getMessage());
            return false;
        }
    }

    private void setActiveCall(Long a, Long b) {
        if (a == null || b == null) return;
        activeCalls.put(a, b);
        activeCalls.put(b, a);
    }

    private void clearActiveCall(Long a, Long b) {
        if (a != null) activeCalls.remove(a);
        if (b != null) activeCalls.remove(b);
    }

    private Long inCallWith(Long userId) {

        return activeCalls.get(userId);
    }

    private void beginRinging(Long userId) {

        if (userId != null) ringing.add(userId);
    }

    private void clearRinging(Long userId) {

        if (userId != null) ringing.remove(userId);
    }

    private Pair<Long, Long> resolveClientModel(Long a, Long b) {
        if (a == null || b == null) return null;
        var ua = userRepository.findById(a).orElse(null);
        var ub = userRepository.findById(b).orElse(null);
        if (ua == null || ub == null) return null;

        String ra = ua.getRole();
        String rb = ub.getRole();

        if (com.sharemechat.constants.Constants.Roles.CLIENT.equals(ra)
                && com.sharemechat.constants.Constants.Roles.MODEL.equals(rb)) {
            return Pair.of(a, b);
        }
        if (com.sharemechat.constants.Constants.Roles.MODEL.equals(ra)
                && com.sharemechat.constants.Constants.Roles.CLIENT.equals(rb)) {
            return Pair.of(b, a);
        }
        return null;
    }

    private boolean hasSufficientBalance(Long clientId) {
        try {
            BigDecimal bal = balanceRepository
                    .findTopByUserIdOrderByTimestampDesc(clientId)
                    .map(Balance::getBalance)
                    .orElse(BigDecimal.ZERO);

            return bal.compareTo(billing.getRatePerMinute()) >= 0;
        } catch (Exception ex) {
            log.warn("hasSufficientBalance error clientId={} err={}", clientId, ex.getMessage());
            return false;
        }
    }


    private void endCallAndSession(Long a, Long b, String reason) {
        Pair<Long, Long> cm = resolveClientModel(a, b);
        if (cm != null) {
            Long clientId = cm.getLeft();
            Long modelId  = cm.getRight();

            try {
                streamService.endSession(clientId, modelId);
            } catch (Exception ex) {
                log.warn("endCallAndSession endSession error clientId={} modelId={} err={}",
                        clientId, modelId, ex.getMessage());
            }

            boolean modelStillOnline = sessions.getOrDefault(modelId, java.util.Set.of()).size() > 0;
            if (modelStillOnline) statusService.setAvailable(modelId);
            else statusService.setOffline(modelId);
        }

        broadcastToUser(a, new JSONObject().put("type","call:ended").put("reason", reason).toString());
        broadcastToUser(b, new JSONObject().put("type","call:ended").put("reason", reason).toString());

        // --- LIMPIEZA ESTADO ---
        clearActiveCall(a, b);
        clearRinging(a);
        clearRinging(b);

        // --- LIMPIEZA OWNER ---
        activeCallOwners.remove(a);
        activeCallOwners.remove(b);
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


}
