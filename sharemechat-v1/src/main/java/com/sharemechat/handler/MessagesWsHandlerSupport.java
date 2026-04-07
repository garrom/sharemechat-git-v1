package com.sharemechat.handler;

import com.sharemechat.config.BillingProperties;
import com.sharemechat.consent.ConsentState;
import com.sharemechat.dto.MessageDTO;
import com.sharemechat.entity.Balance;
import com.sharemechat.entity.Gift;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.exception.TooManyRequestsException;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.AgeGatePolicyService;
import com.sharemechat.service.*;
import org.apache.commons.lang3.tuple.Pair;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class MessagesWsHandlerSupport {

    private static final Logger log = LoggerFactory.getLogger(MessagesWsHandlerSupport.class);

    private final MessagesRuntimeState state;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final MessageService messageService;
    private final FavoriteService favoriteService;
    private final TransactionService transactionService;
    private final StreamService streamService;
    private final ClientRepository clientRepository;
    private final StreamRecordRepository streamRecordRepository;
    private final BillingProperties billing;
    private final StatusService statusService;
    private final UserBlockService userBlockService;
    private final BalanceRepository balanceRepository;
    private final StreamLockService streamLockService;
    private final ApiRateLimitService apiRateLimitService;
    private final AgeGatePolicyService ageGatePolicyService;
    private final ProductAccessGuardService productAccessGuardService;

    public MessagesWsHandlerSupport(MessagesRuntimeState state,
                                    JwtUtil jwtUtil,
                                    UserRepository userRepository,
                                    FavoriteService favoriteService,
                                    MessageService messageService,
                                    TransactionService transactionService,
                                    StreamService streamService,
                                    ClientRepository clientRepository,
                                    StreamRecordRepository streamRecordRepository,
                                    BillingProperties billing,
                                    StatusService statusService,
                                    UserBlockService userBlockService,
                                    BalanceRepository balanceRepository,
                                    StreamLockService streamLockService,
                                    ApiRateLimitService apiRateLimitService,
                                    AgeGatePolicyService ageGatePolicyService,
                                    ProductAccessGuardService productAccessGuardService) {
        this.state = state;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.favoriteService = favoriteService;
        this.messageService = messageService;
        this.transactionService = transactionService;
        this.streamService = streamService;
        this.clientRepository = clientRepository;
        this.streamRecordRepository = streamRecordRepository;
        this.billing = billing;
        this.statusService = statusService;
        this.userBlockService = userBlockService;
        this.balanceRepository = balanceRepository;
        this.streamLockService = streamLockService;
        this.apiRateLimitService = apiRateLimitService;
        this.ageGatePolicyService = ageGatePolicyService;
        this.productAccessGuardService = productAccessGuardService;
    }

    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long userId = resolveUserId(session);
        if (userId == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        var user = userRepository.findById(userId).orElse(null);
        try {
            productAccessGuardService.requireNotSupport(user);
        } catch (Exception ex) {
            safeSend(session, new JSONObject()
                    .put("type", "forbidden")
                    .put("message", ex.getMessage())
                    .toString());
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        log.info("WS /messages conectado: session={} userId={}", session.getId(), userId);
        logConsentObservation(userId, "/messages");
        state.getSessionUserIds().put(session.getId(), userId);
        state.getSessions().computeIfAbsent(userId, k -> java.util.concurrent.ConcurrentHashMap.newKeySet()).add(session);

        var u = userRepository.findById(userId).orElse(null);
        if (u != null && com.sharemechat.constants.Constants.Roles.MODEL.equals(u.getRole())) {
            statusService.setAvailable(userId);
        }
    }

    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        Long userId = state.getSessionUserIds().remove(session.getId());
        if (userId != null) {
            var set = state.getSessions().get(userId);
            if (set != null) {
                set.remove(session);
                if (set.isEmpty()) state.getSessions().remove(userId);
            }

            var u2 = userRepository.findById(userId).orElse(null);
            if (u2 != null && com.sharemechat.constants.Constants.Roles.MODEL.equals(u2.getRole())) {
                boolean stillOnline = state.getSessions().getOrDefault(userId, java.util.Set.of()).size() > 0;
                if (!stillOnline && inCallWith(userId) == null) statusService.setOffline(userId);
            }

            if (state.getRinging().remove(userId)) {
                broadcastToUser(userId, new JSONObject()
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

    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        if (log.isTraceEnabled()) log.trace("WS /messages in: {}", message.getPayload());

        Long me = state.getSessionUserIds().get(session.getId());
        if (me == null) return;

        JSONObject json = new JSONObject(message.getPayload());
        String type = json.optString("type", "");

        if ("msg:send".equals(type)) {
            try {
                apiRateLimitService.checkWsMsgUser(me);
            } catch (TooManyRequestsException e) {
                safeSend(session, new JSONObject()
                        .put("type", "rate-limit")
                        .put("scope", "ws:msg")
                        .put("message", "Rate limit: mensajes")
                        .put("retryAfterMs", e.getRetryAfterMs())
                        .toString());
                return;
            }

            Object toObj = json.opt("to");
            String toRaw = (toObj != null) ? String.valueOf(toObj) : null;
            Long to = null;
            try {
                if (toRaw != null) to = Long.valueOf(toRaw);
            } catch (Exception ignore) {}

            String body = json.optString("body", "");
            body = (body != null) ? body.trim() : "";

            log.info("WS msg:send IN session={} me={} rawTo='{}' parsedTo={} bodyLen={}",
                    session.getId(), me, toRaw, to, (body != null ? body.length() : 0));

            if (to == null || to <= 0L) {
                safeSend(session, new JSONObject().put("type", "msg:error").put("message", "Destinatario inválido").toString());
                return;
            }
            if (Objects.equals(me, to)) {
                safeSend(session, new JSONObject().put("type", "msg:error").put("message", "No puedes enviarte mensajes a ti mismo").toString());
                return;
            }
            if (body.isEmpty()) {
                safeSend(session, new JSONObject().put("type", "msg:error").put("message", "Mensaje vacío").toString());
                return;
            }

            try {
                if (userBlockService.isBlockedBetween(me, to)) {
                    safeSend(session, new JSONObject().put("type", "msg:error").put("message", "Mensajería bloqueada: usuario bloqueado").toString());
                    return;
                }

                if (!favoriteService.canUsersMessage(me, to)) {
                    safeSend(session, new JSONObject().put("type", "msg:error").put("message", "Mensajería bloqueada: relación no aceptada").toString());
                    return;
                }

                MessageDTO saved = messageService.send(me, to, body);

                broadcastToUser(me, new JSONObject().put("type", "msg:new").put("from", me).put("message", toJson(saved)).toString());
                broadcastToUser(to, new JSONObject().put("type", "msg:new").put("from", me).put("message", toJson(saved)).toString());
            } catch (Exception ex) {
                safeSend(session, new JSONObject().put("type", "msg:error").put("message", ex.getMessage()).toString());
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
            broadcastToUser(withUser, new JSONObject().put("type", "msg:read").put("by", me).put("with", withUser).toString());
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
            try {
                apiRateLimitService.checkWsCallUser(me);
            } catch (TooManyRequestsException e) {
                safeSend(session, new JSONObject()
                        .put("type", "rate-limit")
                        .put("scope", "ws:call")
                        .put("message", "Rate limit: llamadas")
                        .put("retryAfterMs", e.getRetryAfterMs())
                        .toString());
                return;
            }

            Long to = json.has("to") ? json.optLong("to", 0L) : null;
            log.info("[CALL_INVITE_IN] me={} sid={} toRaw={} toParsed={}", me, session.getId(), json.opt("to"), to);
            if (to == null || to <= 0L) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "Destinatario inválido").toString());
                return;
            }
            if (Objects.equals(me, to)) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "No puedes llamarte a ti mismo").toString());
                return;
            }

            try {
                if (userBlockService.isBlockedBetween(me, to)) {
                    safeSend(session, new JSONObject().put("type", "call:error").put("message", "Llamadas bloqueadas: usuario bloqueado").toString());
                    return;
                }

                if (!favoriteService.canUsersMessage(me, to)) {
                    safeSend(session, new JSONObject().put("type", "call:error").put("message", "Llamadas bloqueadas: relación no aceptada").toString());
                    return;
                }
            } catch (Exception ex) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", ex.getMessage()).toString());
                return;
            }

            if (isBusy(me)) {
                safeSend(session, new JSONObject().put("type", "call:busy").put("who", "me").toString());
                return;
            }
            if (isBusy(to)) {
                safeSend(session, new JSONObject().put("type", "call:busy").put("who", "peer_streaming").toString());
                return;
            }
            if (!isUserOnline(to)) {
                safeSend(session, new JSONObject().put("type", "call:offline").toString());
                return;
            }
            if (state.getRinging().contains(to)) {
                safeSend(session, new JSONObject().put("type", "call:busy").put("who", "peer_ringing").toString());
                return;
            }

            Pair<Long, Long> cm = resolveClientModel(me, to);
            if (cm == null) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "Solo se permiten llamadas CLIENT↔MODEL").toString());
                return;
            }
            Long clientId = cm.getLeft();
            Long modelId = cm.getRight();

            if (!hasSufficientBalance(clientId)) {
                safeSend(session, new JSONObject().put("type", "call:no-balance").toString());
                return;
            }

            beginRinging(to);
            safeSend(session, new JSONObject().put("type", "call:ringing").put("to", to).toString());

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
            String reason = json.has("reason") ? json.optString("reason", null) : null;

            log.info("[CALL_ACCEPT_IN] me={} sid={} with={} inRinging={} currentCallMe={} currentCallWith={}",
                    me, session.getId(), with, state.getRinging().contains(me), inCallWith(me), (with != null ? inCallWith(with) : null));
            log.warn("call_accept_in actorUserId={} peerUserId={} localSid={} reason_raw={}",
                    me,
                    with,
                    session.getId(),
                    (reason != null ? reason : "none"));

            if (with == null || with <= 0L) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "Par inválido").toString());
                return;
            }
            if (!state.getRinging().contains(me)) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "No estás en RINGING").toString());
                return;
            }

            try {
                if (userBlockService.isBlockedBetween(me, with)) {
                    clearRinging(me);
                    safeSend(session, new JSONObject().put("type", "call:error").put("message", "Llamadas bloqueadas: usuario bloqueado").toString());
                    return;
                }

                if (!favoriteService.canUsersMessage(me, with)) {
                    safeSend(session, new JSONObject().put("type", "call:error").put("message", "Llamadas bloqueadas: relación no aceptada").toString());
                    return;
                }
            } catch (Exception ex) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", ex.getMessage()).toString());
                return;
            }

            if (!isUserOnline(with)) {
                clearRinging(me);
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "El usuario que te llamaba ya no está disponible").toString());
                return;
            }

            if (inCallWith(me) != null || inCallWith(with) != null) {
                clearRinging(me);
                safeSend(session, new JSONObject().put("type", "call:busy").toString());
                return;
            }

            Pair<Long, Long> cm = resolveClientModel(me, with);
            if (cm == null) {
                clearRinging(me);
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "Solo CLIENT↔MODEL").toString());
                return;
            }
            Long clientId = cm.getLeft();
            Long modelId = cm.getRight();

            StreamRecord startedSession;
            try {
                startedSession = streamService.startSession(clientId, modelId, com.sharemechat.constants.Constants.StreamTypes.CALLING);
                log.warn("call_started clientUserId={} modelUserId={} actorUserId={} peerUserId={} streamRecordId={}",
                        clientId,
                        modelId,
                        me,
                        with,
                        startedSession != null ? startedSession.getId() : null);

            } catch (Exception ex) {
                clearRinging(me);

                String msg = ex.getMessage() != null ? ex.getMessage() : "No se pudo iniciar la sesión";

                if (msg.contains("Saldo insuficiente")) {
                    broadcastToUser(clientId, new JSONObject().put("type", "call:no-balance").toString());
                    broadcastToUser(modelId, new JSONObject().put("type", "call:no-balance").toString());
                    broadcastToUser(clientId, new JSONObject().put("type", "call:ended").put("reason", "low-balance").toString());
                    broadcastToUser(modelId, new JSONObject().put("type", "call:ended").put("reason", "low-balance").toString());
                } else {
                    broadcastToUser(clientId, new JSONObject().put("type", "call:error").put("message", msg).toString());
                    broadcastToUser(modelId, new JSONObject().put("type", "call:error").put("message", msg).toString());
                }
                return;
            }

            setActiveCall(me, with);
            clearRinging(me);

            statusService.setBusy(modelId);

            JSONObject accepted = new JSONObject()
                    .put("type", "call:accepted")
                    .put("clientId", clientId)
                    .put("modelId", modelId)
                    .put("streamRecordId", (startedSession != null && startedSession.getId() != null) ? startedSession.getId() : JSONObject.NULL);

            if (startedSession != null && startedSession.getId() != null) {
                clearCallTechMediaReady(startedSession.getId());
            }

            log.warn("call_accept_legacy actorUserId={} peerUserId={} clientUserId={} modelUserId={} streamRecordId={} confirmAuthority=call:tech-media-ready",
                    me,
                    with,
                    clientId,
                    modelId,
                    startedSession != null ? startedSession.getId() : null);

            broadcastToUser(me, accepted.toString());
            broadcastToUser(with, accepted.toString());

            try {
                BigDecimal bal = getCurrentBalanceOrZero(clientId);

                JSONObject out = new JSONObject()
                        .put("type", "call:saldo")
                        .put("clientBalance", bal.toPlainString());

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
                        .put("type", "call:error")
                        .put("message", "Par inválido (connected)")
                        .toString());
                return;
            }
            log.info("[CALLING_CONNECTED_IN] me={} sid={} with={}", me, session.getId(), with);
            Long current = inCallWith(me);
            if (current == null || !current.equals(with)) {
                log.warn("[CALLING_CONNECTED_IGNORED] me={} sid={} with={} current={} reason={}",
                        me, session.getId(), with, current,
                        (current == null ? "no_activeCall" : "mismatch_with"));
                return;
            }
            return;
        }

        if ("call:tech-media-ready".equals(type)) {
            handleCallTechMediaReady(session, json, me);
            return;
        }

        if ("call:reject".equals(type)) {
            Long with = json.has("with") ? json.optLong("with", 0L) : null;
            String reason = json.has("reason") ? json.optString("reason", null) : null;

            log.info("[CALL_REJECT_IN] me={} sid={} with={} reason={} wasRinging={}", me, session.getId(), with, reason, state.getRinging().contains(me));

            if (with == null || with <= 0L) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "Par inválido").toString());
                return;
            }

            if (state.getRinging().remove(me)) {
                JSONObject rejected = new JSONObject()
                        .put("type", "call:rejected")
                        .put("by", me);

                if (reason != null && !reason.isBlank()) {
                    rejected.put("reason", reason);
                }

                String payload = rejected.toString();

                // Solo avisamos al emisor de la llamada
                broadcastToUser(with, payload);
            } else {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "No estabas en RINGING").toString());
            }
            return;
        }

        if ("call:cancel".equals(type)) {
            Long to = json.has("to") ? json.optLong("to", 0L) : null;
            log.info("[CALL_CANCEL_IN] me={} sid={} to={}", me, session.getId(), to);
            if (to == null || to <= 0L) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "Destinatario inválido").toString());
                return;
            }
            if (state.getRinging().remove(to)) {
                broadcastToUser(me, new JSONObject().put("type", "call:canceled").put("reason", "caller_cancel").toString());
                broadcastToUser(to, new JSONObject().put("type", "call:canceled").put("reason", "caller_cancel").toString());
            } else {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "El receptor no estaba en RINGING").toString());
            }
            return;
        }

        if ("call:signal".equals(type)) {
            Long to = json.has("to") ? json.optLong("to", 0L) : null;
            JSONObject signal = json.optJSONObject("signal");
            String sigType = (signal != null && signal.has("type")) ? String.valueOf(signal.opt("type"))
                    : (signal != null && signal.has("candidate")) ? "candidate"
                    : "unknown";
            log.info("[CALL_SIGNAL_IN] me={} sid={} to={} sigType={}", me, session.getId(), to, sigType);
            if (to == null || to <= 0L || signal == null) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "Signal inválido").toString());
                return;
            }
            Long peer = inCallWith(me);
            if (peer == null || !Objects.equals(peer, to)) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "No hay llamada activa con el destinatario").toString());
                return;
            }
            broadcastToUser(to, new JSONObject().put("type", "call:signal").put("from", me).put("signal", signal).toString());
            return;
        }

        if ("call:end".equals(type)) {
            log.info("[CALL_END_IN] me={} sid={} peerCurrent={}", me, session.getId(), inCallWith(me));
            Long peer = inCallWith(me);
            if (peer == null) {
                safeSend(session, new JSONObject().put("type", "call:error").put("message", "No estás en llamada").toString());
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
            log.info("[CALL_PING_IN] me={} sid={} peerCurrent={}", me, session.getId(), inCallWith(me));

            try {
                apiRateLimitService.checkWsPingUser(me);
            } catch (TooManyRequestsException e) {
                safeSend(session, new JSONObject()
                        .put("type", "rate-limit")
                        .put("scope", "ws:ping")
                        .put("message", "Rate limit: ping de llamada")
                        .put("retryAfterMs", e.getRetryAfterMs())
                        .toString());
                return;
            }

            Long peer = inCallWith(me);

            if (peer == null) {
                safeSend(session, new JSONObject()
                        .put("type", "call:ended")
                        .put("reason", "not-active")
                        .toString());
                return;
            }

            Pair<Long, Long> cm = resolveClientModel(me, peer);
            if (cm == null) {
                safeSend(session, new JSONObject()
                        .put("type", "call:ended")
                        .put("reason", "invalid-pair")
                        .toString());
                return;
            }

            Long clientId = cm.getLeft();
            Long modelId = cm.getRight();

            log.warn("call_ping_legacy actorUserId={} peerUserId={} clientUserId={} modelUserId={} confirmAuthority=call:tech-media-ready",
                    me,
                    peer,
                    clientId,
                    modelId);

            try {
                BigDecimal bal = getCurrentBalanceOrZero(clientId);

                JSONObject out = new JSONObject()
                        .put("type", "call:saldo")
                        .put("clientBalance", bal.toPlainString());

                broadcastToUser(modelId, out.toString());
            } catch (Exception ex) {
                log.warn("call:ping saldo error clientId={} modelId={} err={}", clientId, modelId, ex.getMessage());
            }

            try {
                boolean closed = streamService.endIfBelowThreshold(clientId, modelId);
                if (closed) {
                    Long activeStreamRecordId = resolveActiveCallingStreamId(clientId, modelId);
                    streamService.endSessionAsync(clientId, modelId, "low-balance");
                    broadcastToUser(me, new JSONObject().put("type", "call:ended").put("reason", "low-balance").toString());
                    broadcastToUser(peer, new JSONObject().put("type", "call:ended").put("reason", "low-balance").toString());
                    clearCallTechMediaReady(activeStreamRecordId);
                    clearActiveCall(me, peer);
                    clearRinging(me);
                    clearRinging(peer);
                    state.getActiveCallOwners().remove(me);
                    state.getActiveCallOwners().remove(peer);
                }
            } catch (Exception ex) {
                log.warn("call:ping cutoff error clientId={} modelId={} err={}", clientId, modelId, ex.getMessage());
            }

            return;
        }

        safeSend(session, new JSONObject().put("type", "call:error").put("message", "Tipo no soportado: " + type).toString());
    }

    private void handleMsgGift(WebSocketSession session, JSONObject json) {
        Long me = state.getSessionUserIds().get(session.getId());
        if (me == null) {
            safeSend(session, "{\"type\":\"msg:error\",\"message\":\"No autenticado\"}");
            return;
        }

        Object toObj = json.opt("to");
        String toRaw = (toObj != null) ? String.valueOf(toObj) : null;
        Long to = null;
        try {
            if (toRaw != null) to = Long.valueOf(toRaw);
        } catch (Exception ignore) {}
        long giftId = json.optLong("giftId", 0L);
        String actorRole = userRepository.findById(me).map(u -> u.getRole()).orElse(null);
        log.warn("gift_msg_in actorUserId={} peerUserId={} role={} localSid={} giftId={}",
                me,
                to,
                actorRole,
                session.getId(),
                giftId);

        if (to == null || to <= 0L) {
            safeSend(session, "{\"type\":\"msg:error\",\"message\":\"Destinatario inválido\"}");
            return;
        }
        if (Objects.equals(me, to)) {
            safeSend(session, "{\"type\":\"msg:error\",\"message\":\"No puedes enviarte regalos a ti mismo\"}");
            return;
        }
        if (giftId <= 0L) {
            safeSend(session, "{\"type\":\"msg:error\",\"message\":\"giftId inválido\"}");
            return;
        }

        try {
            if (userBlockService.isBlockedBetween(me, to)) {
                safeSend(session, new JSONObject().put("type", "msg:error").put("message", "Mensajería bloqueada: usuario bloqueado").toString());
                return;
            }
        } catch (Exception ex) {
            safeSend(session, new JSONObject().put("type", "msg:error").put("message", ex.getMessage()).toString());
            return;
        }

        com.sharemechat.entity.User sender = userRepository.findById(me).orElse(null);
        com.sharemechat.entity.User recipient = userRepository.findById(to).orElse(null);
        if (sender == null || recipient == null) {
            safeSend(session, "{\"type\":\"msg:error\",\"message\":\"Usuarios inválidos\"}");
            return;
        }
        if (!com.sharemechat.constants.Constants.Roles.CLIENT.equals(sender.getRole())) {
            safeSend(session, "{\"type\":\"msg:error\",\"message\":\"Solo un CLIENT puede enviar regalos\"}");
            return;
        }
        if (!com.sharemechat.constants.Constants.Roles.MODEL.equals(recipient.getRole())) {
            safeSend(session, "{\"type\":\"msg:error\",\"message\":\"El destinatario debe ser MODEL\"}");
            return;
        }

        try {
            if (!favoriteService.canUsersMessage(me, to)) {
                safeSend(session, "{\"type\":\"msg:error\",\"message\":\"Mensajería bloqueada entre estos usuarios\"}");
                return;
            }
        } catch (Exception ex) {
            safeSend(session, new JSONObject().put("type", "msg:error").put("message", ex.getMessage()).toString());
            return;
        }

        try {
            Pair<Long, Long> cm = resolveClientModel(me, to);
            boolean hasCallingContext = cm != null
                    && Objects.equals(inCallWith(me), to)
                    && Objects.equals(inCallWith(to), me);

            Long resolvedCallingStreamId = null;
            if (hasCallingContext) {
                resolvedCallingStreamId = resolveCallingGiftStreamId(cm.getLeft(), cm.getRight());
                log.info("handleMsgGift: calling context confirmed me={} to={} clientId={} modelId={} resolvedStreamId={}",
                        me, to, cm.getLeft(), cm.getRight(), resolvedCallingStreamId);
            } else {
                log.info("handleMsgGift: no calling context me={} to={} peerCurrent={} reverseCurrent={}",
                        me, to, inCallWith(me), inCallWith(to));
            }
            String peerRole = userRepository.findById(to).map(u -> u.getRole()).orElse(null);
            log.warn("gift_msg_validate_ok actorUserId={} peerUserId={} role={} peerRole={} giftId={} streamRecordId={} callContext={}",
                    me,
                    to,
                    actorRole,
                    peerRole,
                    giftId,
                    resolvedCallingStreamId,
                    hasCallingContext);

            Gift g = (resolvedCallingStreamId != null)
                    ? transactionService.processGift(me, to, giftId, resolvedCallingStreamId)
                    : transactionService.processGiftInChat(me, to, giftId);

            MessageDTO saved = messageService.sendGift(me, to, g);
            log.warn("gift_msg_emit actorUserId={} peerUserId={} giftId={} messageId={} streamRecordId={}",
                    me,
                    to,
                    g.getId(),
                    saved.id(),
                    resolvedCallingStreamId);

            JSONObject live = new JSONObject()
                    .put("type", "msg:gift")
                    .put("messageId", saved.id())
                    .put("from", me)
                    .put("to", to)
                    .put("gift", toGiftJson(saved.gift()));

            String payload = live.toString();
            broadcastToUser(me, payload);
            broadcastToUser(to, payload);

            broadcastNew(saved);

        } catch (Exception ex) {
            safeSend(session, new JSONObject().put("type", "msg:error").put("message", ex.getMessage()).toString());
        }
    }

    private Long resolveCallingGiftStreamId(Long clientId, Long modelId) {
        if (clientId == null || modelId == null) {
            return null;
        }

        try {
            Long hintedStreamId = statusService.getActiveSession(clientId, modelId).orElse(null);
            if (hintedStreamId != null) {
                StreamRecord hinted = streamRecordRepository.findById(hintedStreamId).orElse(null);
                if (isValidCallingGiftStream(hinted, clientId, modelId)) {
                    log.info("handleMsgGift: resolved CALLING stream via Redis clientId={} modelId={} streamId={}",
                            clientId, modelId, hintedStreamId);
                    return hintedStreamId;
                }
                log.info("handleMsgGift: Redis hint invalid for CALLING gift clientId={} modelId={} streamId={}",
                        clientId, modelId, hintedStreamId);
            }
        } catch (Exception ex) {
            log.warn("handleMsgGift: Redis CALLING stream resolution error clientId={} modelId={} err={}",
                    clientId, modelId, ex.getMessage());
        }

        try {
            StreamRecord dbStream = streamRecordRepository
                    .findTopByClient_IdAndModel_IdAndStreamTypeAndConfirmedAtIsNotNullAndEndTimeIsNullOrderByStartTimeDesc(
                            clientId,
                            modelId,
                            com.sharemechat.constants.Constants.StreamTypes.CALLING
                    )
                    .orElse(null);

            if (isValidCallingGiftStream(dbStream, clientId, modelId)) {
                log.info("handleMsgGift: resolved CALLING stream via DB clientId={} modelId={} streamId={}",
                        clientId, modelId, dbStream.getId());
                return dbStream.getId();
            }
        } catch (Exception ex) {
            log.warn("handleMsgGift: DB CALLING stream resolution error clientId={} modelId={} err={}",
                    clientId, modelId, ex.getMessage());
        }

        log.info("handleMsgGift: conservative null CALLING stream clientId={} modelId={}", clientId, modelId);
        return null;
    }

    private boolean isValidCallingGiftStream(StreamRecord stream, Long clientId, Long modelId) {
        if (stream == null || stream.getId() == null) {
            return false;
        }
        if (stream.getEndTime() != null || stream.getConfirmedAt() == null) {
            return false;
        }
        if (!com.sharemechat.constants.Constants.StreamTypes.CALLING.equals(stream.getStreamType())) {
            return false;
        }

        Long streamClientId = stream.getClient() != null ? stream.getClient().getId() : null;
        Long streamModelId = stream.getModel() != null ? stream.getModel().getId() : null;
        return Objects.equals(streamClientId, clientId) && Objects.equals(streamModelId, modelId);
    }

    private void broadcastToUser(Long userId, String json) {
        var set = state.getSessions().get(userId);
        if (set == null) return;
        for (var s : set) safeSend(s, json);
    }

    public void broadcastNew(MessageDTO saved) {
        String json = new JSONObject()
                .put("type", "msg:new")
                .put("message", toJson(saved))
                .toString();

        LoggerFactory.getLogger(MessagesWsHandler.class)
                .info("broadcastNew -> sender={}, recipient={}, sessions(sender)={}, sessions(recipient)={}",
                        saved.senderId(), saved.recipientId(),
                        Optional.ofNullable(state.getSessions().get(saved.senderId())).map(Set::size).orElse(0),
                        Optional.ofNullable(state.getSessions().get(saved.recipientId())).map(Set::size).orElse(0));

        broadcastToUser(saved.senderId(), json);
        broadcastToUser(saved.recipientId(), json);
    }

    private void safeSend(WebSocketSession s, String json) {
        if (s != null && s.isOpen()) {
            try {
                s.sendMessage(new TextMessage(json));
            } catch (Exception ignore) {}
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

    private void logConsentObservation(Long userId, String endpoint) {
        if (userId == null) return;

        var user = userRepository.findById(userId).orElse(null);
        if (user == null) return;

        ConsentState consentState = ageGatePolicyService.resolve(user);
        if (!consentState.compliant()) {
            log.info("[CONSENT][NON_COMPLIANT] userId={} endpoint={} reason={}",
                    userId,
                    endpoint,
                    consentState.reasonCode());
        }
    }

    private String extractToken(WebSocketSession session) {
        try {
            String cookieHeader = session.getHandshakeHeaders().getFirst("Cookie");
            String tokenFromCookie = readCookieFromHeader(cookieHeader, "access_token");
            if (tokenFromCookie != null) return tokenFromCookie;
        } catch (Exception ignore) {}

        try {
            URI uri = session.getUri();
            if (uri != null && uri.getQuery() != null) {
                Map<String, String> qs = parseQuery(uri.getQuery());
                String t = qs.get("token");
                if (t != null && !t.isBlank()) return t;
            }
        } catch (Exception ignore) {}

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

                try {
                    v = URLDecoder.decode(v, StandardCharsets.UTF_8);
                } catch (Exception ignore) {}

                return v.isBlank() ? null : v;
            }
        } catch (Exception ignore) {}

        return null;
    }

    private JSONObject toJson(MessageDTO m) {
        JSONObject json = new JSONObject()
                .put("id", m.id())
                .put("senderId", m.senderId())
                .put("recipientId", m.recipientId())
                .put("body", m.body())
                .put("createdAt", String.valueOf(m.createdAt()))
                .put("readAt", m.readAt() == null ? JSONObject.NULL : String.valueOf(m.readAt()));
        if (m.gift() != null) {
            json.put("gift", toGiftJson(m.gift()));
        }
        return json;
    }

    private Object toGiftJson(MessageDTO.GiftSnapshotDTO gift) {
        if (gift == null) return JSONObject.NULL;

        JSONObject json = new JSONObject();
        json.put("giftId", gift.giftId());
        json.put("code", gift.code());
        json.put("name", gift.name());
        json.put("icon", gift.icon());
        json.put("cost", gift.cost() != null ? gift.cost().toPlainString() : JSONObject.NULL);
        json.put("tier", gift.tier());
        json.put("featured", gift.featured() != null ? gift.featured() : JSONObject.NULL);

        return json;
    }


    public boolean isUserOnline(Long userId) {
        var set = state.getSessions().get(userId);
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
        state.getActiveCalls().put(a, b);
        state.getActiveCalls().put(b, a);
    }

    private void clearActiveCall(Long a, Long b) {
        if (a != null) state.getActiveCalls().remove(a);
        if (b != null) state.getActiveCalls().remove(b);
    }

    private Long inCallWith(Long userId) {
        return state.getActiveCalls().get(userId);
    }

    private void beginRinging(Long userId) {
        if (userId != null) state.getRinging().add(userId);
    }

    private void clearRinging(Long userId) {
        if (userId != null) state.getRinging().remove(userId);
    }

    private void markCallTechMediaReady(Long streamRecordId, Long userId) {
        if (streamRecordId == null || userId == null) return;
        state.getCallTechMediaReadyUsersByStreamId()
                .computeIfAbsent(streamRecordId, k -> java.util.concurrent.ConcurrentHashMap.newKeySet())
                .add(userId);
    }

    private void clearCallTechMediaReady(Long streamRecordId) {
        if (streamRecordId == null) return;
        state.getCallTechMediaReadyUsersByStreamId().remove(streamRecordId);
    }

    private Long resolveActiveCallingStreamId(Long clientId, Long modelId) {
        if (clientId == null || modelId == null) return null;

        try {
            Long hintedStreamId = statusService.getActiveSession(clientId, modelId).orElse(null);
            if (hintedStreamId != null) {
                StreamRecord hinted = streamRecordRepository.findById(hintedStreamId).orElse(null);
                if (hinted != null
                        && hinted.getEndTime() == null
                        && Objects.equals(hinted.getStreamType(), com.sharemechat.constants.Constants.StreamTypes.CALLING)
                        && hinted.getClient() != null
                        && hinted.getModel() != null
                        && Objects.equals(hinted.getClient().getId(), clientId)
                        && Objects.equals(hinted.getModel().getId(), modelId)) {
                    return hintedStreamId;
                }
            }
        } catch (Exception ignore) {}

        try {
            StreamRecord dbStream = streamRecordRepository
                    .findTopByClient_IdAndModel_IdAndStreamTypeAndEndTimeIsNullOrderByStartTimeDesc(
                            clientId,
                            modelId,
                            com.sharemechat.constants.Constants.StreamTypes.CALLING
                    )
                    .orElse(null);
            if (dbStream != null
                    && dbStream.getEndTime() == null
                    && Objects.equals(dbStream.getStreamType(), com.sharemechat.constants.Constants.StreamTypes.CALLING)
                    && dbStream.getClient() != null
                    && dbStream.getModel() != null
                    && Objects.equals(dbStream.getClient().getId(), clientId)
                    && Objects.equals(dbStream.getModel().getId(), modelId)) {
                return dbStream.getId();
            }
        } catch (Exception ignore) {}

        return null;
    }

    private boolean areBothCallSidesTechMediaReady(Long streamRecordId, Long a, Long b) {
        if (streamRecordId == null || a == null || b == null) return false;
        Set<Long> readyUsers = state.getCallTechMediaReadyUsersByStreamId().get(streamRecordId);
        return readyUsers != null && readyUsers.contains(a) && readyUsers.contains(b);
    }

    private void handleCallTechMediaReady(WebSocketSession session, JSONObject json, Long me) {
        Long with = json.has("with") ? json.optLong("with", 0L) : null;
        Long streamRecordId = json.has("streamRecordId") ? json.optLong("streamRecordId", 0L) : null;

        if (me == null || with == null || with <= 0L || streamRecordId == null || streamRecordId <= 0L) {
            log.warn("call_tech_media_ready_ignored actorUserId={} peerUserId={} streamRecordId={} reason=invalid_payload localSid={}",
                    me, with, streamRecordId, session != null ? session.getId() : null);
            return;
        }

        Long currentPeer = inCallWith(me);
        Long reversePeer = inCallWith(with);
        if (!Objects.equals(currentPeer, with) || !Objects.equals(reversePeer, me)) {
            log.warn("call_tech_media_ready_ignored actorUserId={} peerUserId={} streamRecordId={} reason=active_call_mismatch currentPeer={} reversePeer={} localSid={}",
                    me, with, streamRecordId, currentPeer, reversePeer, session != null ? session.getId() : null);
            return;
        }

        Pair<Long, Long> cm = resolveClientModel(me, with);
        if (cm == null) {
            log.warn("call_tech_media_ready_ignored actorUserId={} peerUserId={} streamRecordId={} reason=invalid_pair localSid={}",
                    me, with, streamRecordId, session != null ? session.getId() : null);
            return;
        }

        Long clientId = cm.getLeft();
        Long modelId = cm.getRight();
        Long activeStreamRecordId = resolveActiveCallingStreamId(clientId, modelId);
        if (!Objects.equals(activeStreamRecordId, streamRecordId)) {
            log.warn("call_tech_media_ready_ignored actorUserId={} peerUserId={} streamRecordId={} reason=active_stream_mismatch activeStreamRecordId={} localSid={}",
                    me, with, streamRecordId, activeStreamRecordId, session != null ? session.getId() : null);
            return;
        }

        StreamRecord activeStream = streamRecordRepository.findById(streamRecordId).orElse(null);
        if (activeStream == null
                || activeStream.getEndTime() != null
                || !Objects.equals(activeStream.getStreamType(), com.sharemechat.constants.Constants.StreamTypes.CALLING)
                || activeStream.getClient() == null
                || activeStream.getModel() == null
                || !Objects.equals(activeStream.getClient().getId(), clientId)
                || !Objects.equals(activeStream.getModel().getId(), modelId)) {
            log.warn("call_tech_media_ready_ignored actorUserId={} peerUserId={} streamRecordId={} reason=stream_record_mismatch localSid={}",
                    me, with, streamRecordId, session != null ? session.getId() : null);
            return;
        }

        if (activeStream.getConfirmedAt() != null) {
            log.warn("call_tech_media_ready_ignored actorUserId={} peerUserId={} clientUserId={} modelUserId={} streamRecordId={} reason=already_confirmed localSid={}",
                    me,
                    with,
                    clientId,
                    modelId,
                    streamRecordId,
                    session != null ? session.getId() : null);
            return;
        }

        markCallTechMediaReady(streamRecordId, me);
        boolean bothReady = areBothCallSidesTechMediaReady(streamRecordId, me, with);
        if (!bothReady) {
            log.warn("call_tech_media_ready_wait actorUserId={} peerUserId={} clientUserId={} modelUserId={} streamRecordId={} localSid={}",
                    me,
                    with,
                    clientId,
                    modelId,
                    streamRecordId,
                    session != null ? session.getId() : null);
            return;
        }

        log.warn("call_tech_media_ready actorUserId={} peerUserId={} clientUserId={} modelUserId={} streamRecordId={} bothReady={} localSid={}",
                me,
                with,
                clientId,
                modelId,
                streamRecordId,
                bothReady,
                session != null ? session.getId() : null);
        log.warn("call_tech_media_ready_confirm actorUserId={} peerUserId={} clientUserId={} modelUserId={} streamRecordId={} localSid={}",
                me,
                with,
                clientId,
                modelId,
                streamRecordId,
                session != null ? session.getId() : null);
        streamService.confirmActiveSession(clientId, modelId);
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
            Long modelId = cm.getRight();
            Long streamRecordId = resolveActiveCallingStreamId(clientId, modelId);
            log.warn("call_end_begin clientUserId={} modelUserId={} actorUserId={} peerUserId={} streamRecordId={} reason_raw={}",
                    clientId,
                    modelId,
                    a,
                    b,
                    streamRecordId,
                    reason);

            try {
                streamService.endSession(clientId, modelId, reason);
            } catch (Exception ex) {
                log.warn("endCallAndSession endSession error clientId={} modelId={} err={}",
                        clientId, modelId, ex.getMessage());
                return;
            }
            clearCallTechMediaReady(streamRecordId);

            boolean modelStillOnline = state.getSessions().getOrDefault(modelId, java.util.Set.of()).size() > 0;
            if (modelStillOnline) statusService.setAvailable(modelId);
            else statusService.setOffline(modelId);
        }

        broadcastToUser(a, new JSONObject().put("type", "call:ended").put("reason", reason).toString());
        broadcastToUser(b, new JSONObject().put("type", "call:ended").put("reason", reason).toString());

        clearActiveCall(a, b);
        clearRinging(a);
        clearRinging(b);

        state.getActiveCallOwners().remove(a);
        state.getActiveCallOwners().remove(b);
    }

    public void adminKillCallPair(Long clientId, Long modelId, String reason) {
        if (clientId == null || modelId == null) return;

        String safeReason = (reason == null || reason.isBlank()) ? "admin-kill" : reason;
        log.info("adminKillCallPair clientId={} modelId={} reason={}", clientId, modelId, safeReason);

        Long streamRecordId = null;
        try {
            streamRecordId = statusService.getActiveSession(clientId, modelId).orElse(null);
        } catch (Exception ignore) {}

        broadcastToUser(clientId, new JSONObject().put("type", "call:ended").put("reason", safeReason).toString());
        broadcastToUser(modelId, new JSONObject().put("type", "call:ended").put("reason", safeReason).toString());
        clearCallTechMediaReady(streamRecordId);

        clearActiveCall(clientId, modelId);
        clearRinging(clientId);
        clearRinging(modelId);
        state.getActiveCallOwners().remove(clientId);
        state.getActiveCallOwners().remove(modelId);
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

    public Map<String, Object> adminRuntimeSnapshot() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("onlineUsers", snapshotOnlineUsers());
        out.put("activeCalls", snapshotActiveCalls());
        out.put("ringingUsers", new ArrayList<>(state.getRinging()));
        return out;
    }

    private List<Map<String, Object>> snapshotOnlineUsers() {
        List<Map<String, Object>> out = new ArrayList<>();

        for (Map.Entry<Long, Set<WebSocketSession>> e : state.getSessions().entrySet()) {
            Long userId = e.getKey();
            Set<WebSocketSession> set = e.getValue();

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userId", userId);
            row.put("sessionCount", set != null ? set.size() : 0);

            List<String> sids = new ArrayList<>();
            if (set != null) {
                for (WebSocketSession s : set) {
                    if (s != null) sids.add(s.getId());
                }
            }
            row.put("sessionIds", sids);
            out.add(row);
        }

        return out;
    }

    private List<Map<String, Object>> snapshotActiveCalls() {
        List<Map<String, Object>> out = new ArrayList<>();
        Set<Long> seen = new HashSet<>();

        for (Map.Entry<Long, Long> e : state.getActiveCalls().entrySet()) {
            Long a = e.getKey();
            Long b = e.getValue();
            if (a == null || b == null) continue;
            if (seen.contains(a) || seen.contains(b)) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userA", a);
            row.put("userB", b);
            row.put("ownerA", state.getActiveCallOwners().get(a));
            row.put("ownerB", state.getActiveCallOwners().get(b));

            Pair<Long, Long> cm = resolveClientModel(a, b);
            if (cm != null) {
                row.put("clientId", cm.getLeft());
                row.put("modelId", cm.getRight());
            } else {
                row.put("clientId", null);
                row.put("modelId", null);
            }

            out.add(row);
            seen.add(a);
            seen.add(b);
        }

        return out;
    }
}
