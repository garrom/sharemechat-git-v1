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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private final Map<String, Queue<WebSocketSession>> waitingModelsByBucket  = new ConcurrentHashMap<>();
    private final Map<String, Queue<WebSocketSession>> waitingClientsByBucket = new ConcurrentHashMap<>();

    private final Map<String, WebSocketSession> pairs = new ConcurrentHashMap<>();
    private final Map<String, String> roles = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionUserIds = new ConcurrentHashMap<>();
    private final Map<String, Long> lastMatchAt = new ConcurrentHashMap<>();
    private final Set<String> switching = Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final Map<String, String> pairLockOwnerBySessionId = new ConcurrentHashMap<>();
    private final Map<String, String> sessionLang = new ConcurrentHashMap<>();
    private final Map<String, String> sessionCountry = new ConcurrentHashMap<>();
    private final Map<String, String> sessionBucketKey = new ConcurrentHashMap<>();

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
    private static final Logger log = LoggerFactory.getLogger(MatchingHandler.class);
    private final NextRateLimitService nextRateLimitService;
    private final UserLanguageService userLanguageService;


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
                           NextRateLimitService nextRateLimitService,
                           UserLanguageService userLanguageService,
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
        this.nextRateLimitService = nextRateLimitService;
        this.userLanguageService = userLanguageService;
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

        final String sid = session != null ? session.getId() : null;

        // Snapshot ANTES de mutar mapas
        final String roleSnap = (sid != null) ? roles.get(sid) : null;
        final Long uidSnap = (sid != null) ? sessionUserIds.get(sid) : null;
        final WebSocketSession peerSnap = (sid != null) ? pairs.get(sid) : null;

        log.debug(
                "[WS][match][CLOSE] sid={} code={} reason='{}' open={} role={} uid={} peerSid={}",
                sid,
                status != null ? status.getCode() : null,
                status != null ? status.getReason() : null,
                (session != null && session.isOpen()),
                roleSnap,
                uidSnap,
                peerSnap != null ? peerSnap.getId() : null
        );

        String role = roles.remove(sid);
        Long userId = sessionUserIds.remove(sid);
        lastMatchAt.remove(sid);
        sessionLang.remove(sid);
        sessionCountry.remove(sid);
        sessionBucketKey.remove(sid);

        if ("model".equals(role)) {
            removeFromAllBuckets(session, "model");
            if (userId != null) statusService.setOffline(userId);
        } else if ("client".equals(role)) {
            removeFromAllBuckets(session, "client");
        }

        WebSocketSession peer = pairs.remove(sid);
        if (peer != null) {
            pairs.remove(peer.getId());

            Long myId = userId;
            Long peerId = sessionUserIds.get(peer.getId());
            String myRole = role;
            String peerRole = roles.get(peer.getId());

            log.debug(
                    "[WS][match][CLOSE][PAIR] sid={} myId={} myRole={} peerSid={} peerId={} peerRole={} peerOpen={}",
                    sid,
                    myId,
                    myRole,
                    peer.getId(),
                    peerId,
                    peerRole,
                    peer.isOpen()
            );

            endStreamIfPairKnown(
                    sid, myId, myRole,
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
                String lang = normLang(json.optString("lang", "*"));
                String country = normCountry(json.optString("country", "*"));
                sessionLang.put(session.getId(), lang);
                sessionCountry.put(session.getId(), country);
                sessionBucketKey.put(session.getId(), bucketKey(lang, country));

                Long userId = sessionUserIds.get(session.getId());

                if ("model".equals(role)) {
                    moveToBucket(session, "model", sessionBucketKey.get(session.getId()));

                    if (userId != null) statusService.setAvailable(userId);
                } else if ("client".equals(role)) {
                    moveToBucket(session, "client", sessionBucketKey.get(session.getId()));
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
   BUCKETS (lang:country con fallback)
   ========================================================= */

    private String normLang(String lang) {
        if (lang == null) return "*";
        String x = lang.trim().toLowerCase(Locale.ROOT);
        return x.isEmpty() ? "*" : x;
    }

    private String normCountry(String c) {
        if (c == null) return "*";
        String x = c.trim().toUpperCase(Locale.ROOT);
        return x.isEmpty() ? "*" : x;
    }

    private String bucketKey(String lang, String country) {
        lang = normLang(lang);
        country = normCountry(country);
        if ("*".equals(lang)) return "*";
        if ("*".equals(country)) return lang + ":*";
        return lang + ":" + country;
    }

    private Queue<WebSocketSession> modelsBucket(String key) {
        return waitingModelsByBucket.computeIfAbsent(key, k -> new ConcurrentLinkedQueue<>());
    }

    private Queue<WebSocketSession> clientsBucket(String key) {
        return waitingClientsByBucket.computeIfAbsent(key, k -> new ConcurrentLinkedQueue<>());
    }

    private String getSessionBucketKey(WebSocketSession session) {
        String sid = session.getId();
        String lang = sessionLang.get(sid);
        String ctry = sessionCountry.get(sid);
        return bucketKey(lang, ctry);
    }

    private void removeFromAllBuckets(WebSocketSession session, String role) {
        if (session == null) return;
        if ("model".equals(role)) {
            for (Queue<WebSocketSession> q : waitingModelsByBucket.values()) q.remove(session);
        } else if ("client".equals(role)) {
            for (Queue<WebSocketSession> q : waitingClientsByBucket.values()) q.remove(session);
        }
    }

    private void moveToBucket(WebSocketSession session, String role, String key) {
        if (key == null) key = "*";
        if (session == null || role == null) return;
        removeFromAllBuckets(session, role);
        if ("model".equals(role)) modelsBucket(key).add(session);
        else if ("client".equals(role)) clientsBucket(key).add(session);

        sessionBucketKey.put(session.getId(), key);
    }

    private int totalWaitingModels() {
        int n = 0;
        for (Queue<WebSocketSession> q : waitingModelsByBucket.values()) n += q.size();
        return n;
    }

    private int totalWaitingClients() {
        int n = 0;
        for (Queue<WebSocketSession> q : waitingClientsByBucket.values()) n += q.size();
        return n;
    }

    private List<String> preferredBucketsForSession(WebSocketSession session) {
        String sid = session.getId();
        String lang = normLang(sessionLang.get(sid));
        String ctry = normCountry(sessionCountry.get(sid));

        List<String> keys = new ArrayList<>();
        // 1) lang+country
        if (!"*".equals(lang) && !"*".equals(ctry)) keys.add(lang + ":" + ctry);
        // 2) lang:*
        if (!"*".equals(lang)) keys.add(lang + ":*");
        // 3) global
        keys.add("*");

        return keys;
    }


    /* =========================================================
       MATCHING (con Seen TTL robusto)
       ========================================================= */


    private void matchClient(WebSocketSession client) throws Exception {

        // quitar de buckets antes de intentar match
        removeFromAllBuckets(client, "client");

        Long clientId = sessionUserIds.get(client.getId());
        if (clientId == null) {
            moveToBucket(client, "client", getSessionBucketKey(client));
            return;
        }

        List<String> buckets = preferredBucketsForSession(client);

        // Pass 1: UNSEEN + idioma compatible (tu lógica actual)
        for (String b : buckets) {
            MatchAttemptResult r1 = tryMatchClientAgainstModels(client, clientId, true, modelsBucket(b));
            if (r1.handled) return;
        }

        // Pass 2: fallback permitir repetidos / idioma no compatible
        for (String b : buckets) {
            MatchAttemptResult r2 = tryMatchClientAgainstModels(client, clientId, false, modelsBucket(b));
            if (r2.handled) return;
        }

        boolean anySupply = totalWaitingModels() > 0;

        String reasonCode = anySupply ? "NO_MATCH_FOUND" : "NO_SUPPLY_MODELS";
        String payload = new JSONObject()
                .put("type", "no-model-available")
                .put("reasonCode", reasonCode)
                .toString();

        safeSend(client, payload);

        // reencolar al final en su bucket (para fairness)
        moveToBucket(client, "client", getSessionBucketKey(client));
    }


    private void matchModel(WebSocketSession model) throws Exception {

        removeFromAllBuckets(model, "model");

        Long modelId = sessionUserIds.get(model.getId());
        if (modelId == null) {
            moveToBucket(model, "model", getSessionBucketKey(model));
            return;
        }

        List<String> buckets = preferredBucketsForSession(model);

        // Pass 1: UNSEEN + idioma compatible
        for (String b : buckets) {
            MatchAttemptResult r1 = tryMatchModelAgainstClients(model, modelId, true, clientsBucket(b));
            if (r1.handled) return;
        }

        // Pass 2: fallback
        for (String b : buckets) {
            MatchAttemptResult r2 = tryMatchModelAgainstClients(model, modelId, false, clientsBucket(b));
            if (r2.handled) return;
        }

        boolean anySupply = totalWaitingClients() > 0;

        String reasonCode = anySupply ? "NO_MATCH_FOUND" : "NO_SUPPLY_CLIENTS";
        String payload = new JSONObject()
                .put("type", "no-client-available")
                .put("reasonCode", reasonCode)
                .toString();

        safeSend(model, payload);

        moveToBucket(model, "model", getSessionBucketKey(model));
    }


    private static class MatchAttemptResult {
        final boolean handled; // true si ya enviamos algo / hicimos match / ya reencolamos y no hay que seguir
        MatchAttemptResult(boolean handled) { this.handled = handled; }
        static MatchAttemptResult HANDLED() { return new MatchAttemptResult(true); }
        static MatchAttemptResult NOT_HANDLED() { return new MatchAttemptResult(false); }
    }


    private MatchAttemptResult tryMatchClientAgainstModels(WebSocketSession client, Long clientId, boolean enforceUnseen, Queue<WebSocketSession> pool) throws Exception {

        List<WebSocketSession> scannedList = new ArrayList<>();
        int scanned = 0;

        WebSocketSession best = null;
        Long bestModelId = null;
        String bestOwner = null;

        int bestRank = Integer.MAX_VALUE;

        while (scanned++ < seenMaxScan) {
            WebSocketSession model = pool.poll();
            if (model == null) break;

            if (!model.isOpen()) continue;

            Long modelId = sessionUserIds.get(model.getId());
            if (modelId == null) continue;

            if (!canMatch(clientId, modelId)) {
                scannedList.add(model);
                continue;
            }

            boolean seen = false;
            if (enforceUnseen) {
                seen = seenService.hasSeen(clientId, modelId);
            }

            int languageScore = 0;
            try { languageScore = userLanguageService.languageMatchScore(clientId, modelId); } catch (Exception ignore) {}

            boolean sameLanguage = languageScore >= 100;
            int rank = (sameLanguage ? 0 : 1) + (seen ? 2 : 0);

            if (enforceUnseen && seen) {
                scannedList.add(model);
                continue;
            }

            if (rank < bestRank) {
                String owner = streamLockService.newOwnerToken();
                if (!tryAcquirePairLocks(clientId, modelId, owner)) {
                    scannedList.add(model);
                    continue;
                }

                if (best != null && bestModelId != null && bestOwner != null) {
                    try { releasePairLocks(clientId, bestModelId, bestOwner); } catch (Exception ignore) {}
                    scannedList.add(best);
                }

                best = model;
                bestModelId = modelId;
                bestOwner = owner;
                bestRank = rank;

                if (bestRank == 0) break;
            } else {
                scannedList.add(model);
            }
        }

        // reencolar lo escaneado en el mismo bucket
        for (WebSocketSession s : scannedList) {
            if (s != null && s.isOpen()) pool.add(s);
        }

        if (best == null || bestModelId == null || bestOwner == null) {
            return MatchAttemptResult.NOT_HANDLED();
        }

        boolean matched = false;

        try {
            User viewer = userRepository.findById(clientId).orElse(null);
            String realRole = viewer != null ? viewer.getRole() : null;

            if (Constants.Roles.USER.equals(realRole)) {
                if (!userTrialService.canStartTrial(clientId)) {
                    safeSend(client, "{\"type\":\"trial-unavailable\"}");
                    moveToBucket(client, "client", getSessionBucketKey(client));
                    return MatchAttemptResult.HANDLED();
                }
                userTrialService.startTrialStream(clientId, bestModelId);
            } else {
                streamService.startSession(clientId, bestModelId);
            }

            seenService.markSeen(clientId, bestModelId);

            pairs.put(client.getId(), best);
            pairs.put(best.getId(), client);

            long now = System.currentTimeMillis();
            lastMatchAt.put(client.getId(), now);
            lastMatchAt.put(best.getId(), now);

            pairLockOwnerBySessionId.put(client.getId(), bestOwner);
            pairLockOwnerBySessionId.put(best.getId(), bestOwner);

            sendMatchMessage(client, best.getId());
            sendMatchMessage(best, client.getId());

            matched = true;
            return MatchAttemptResult.HANDLED();

        } catch (Exception ex) {

            pairs.remove(client.getId());
            pairs.remove(best.getId());

            if (isLowBalance(ex)) safeSend(client, "{\"type\":\"no-balance\"}");
            else safeSend(client, "{\"type\":\"no-model-available\"}");

            moveToBucket(client, "client", getSessionBucketKey(client));
            return MatchAttemptResult.HANDLED();

        } finally {
            if (!matched) {
                try { releasePairLocks(clientId, bestModelId, bestOwner); } catch (Exception ignore) {}
                // si no hubo match, reencolar la modelo elegida en el mismo bucket pool
                if (best != null && best.isOpen()) pool.add(best);
            }
        }
    }



    private MatchAttemptResult tryMatchModelAgainstClients(
            WebSocketSession model,
            Long modelId,
            boolean enforceUnseen,
            Queue<WebSocketSession> pool
    ) throws Exception {

        List<WebSocketSession> skipped = new ArrayList<>();
        int scanned = 0;

        WebSocketSession client;
        while (scanned++ < seenMaxScan && (client = pool.poll()) != null) {

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

            int languageScore = userLanguageService.languageMatchScore(clientId, modelId);
            if (languageScore == 0 && enforceUnseen) {
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
                        // reencolar skipped en el mismo pool
                        for (WebSocketSession s : skipped) if (s != null && s.isOpen()) pool.add(s);
                        moveToBucket(model, "model", getSessionBucketKey(model));
                        return MatchAttemptResult.HANDLED();
                    }
                    userTrialService.startTrialStream(clientId, modelId);
                } else {
                    streamService.startSession(clientId, modelId);
                }

                seenService.markSeen(clientId, modelId);

                pairs.put(model.getId(), client);
                pairs.put(client.getId(), model);

                long now = System.currentTimeMillis();
                lastMatchAt.put(model.getId(), now);
                lastMatchAt.put(client.getId(), now);

                pairLockOwnerBySessionId.put(model.getId(), owner);
                pairLockOwnerBySessionId.put(client.getId(), owner);

                sendMatchMessage(model, client.getId());
                sendMatchMessage(client, model.getId());

                for (WebSocketSession s : skipped) if (s != null && s.isOpen()) pool.add(s);

                matched = true;
                return MatchAttemptResult.HANDLED();

            } catch (Exception ex) {

                pairs.remove(model.getId());
                pairs.remove(client.getId());

                if (isLowBalance(ex)) safeSend(client, "{\"type\":\"no-balance\"}");

                skipped.add(client);
                for (WebSocketSession s : skipped) if (s != null && s.isOpen()) pool.add(s);

                moveToBucket(model, "model", getSessionBucketKey(model));
                return MatchAttemptResult.HANDLED();

            } finally {
                if (!matched) {
                    releasePairLocks(clientId, modelId, owner);
                }
            }
        }

        for (WebSocketSession s : skipped) if (s != null && s.isOpen()) pool.add(s);
        return MatchAttemptResult.NOT_HANDLED();
    }


    /* =========================================================
       NEXT / STREAM END / OTHER EVENTS
       ========================================================= */

    private void handleNext(WebSocketSession session) throws Exception {
        if (!switching.add(session.getId())) return;
        try {

            log.info("[NEXT_IN] sid={} uid={} role={}",
                    session.getId(),
                    sessionUserIds.get(session.getId()),
                    roles.get(session.getId())
            );

            Long t = lastMatchAt.get(session.getId());
            if (t != null && (System.currentTimeMillis() - t) < 1500L) {
                log.info("[NEXT_IGNORED] sid={} reason=grace ageMs={}",
                        session.getId(),
                        System.currentTimeMillis() - t
                );
                safeSend(session, "{\"type\":\"next-ignored\",\"reason\":\"grace\"}");
                return;
            }

            Long uid = sessionUserIds.get(session.getId());
            Optional<Long> retryAfterMsOpt = nextRateLimitService.checkAndConsume(uid);
            if (retryAfterMsOpt.isPresent()) {
                long retryAfterMs = retryAfterMsOpt.get();
                log.info("[NEXT_IGNORED] sid={} reason=rate-limit retryAfterMs={}",
                        session.getId(),
                        retryAfterMs
                );
                safeSend(session, "{\"type\":\"next-ignored\",\"reason\":\"rate-limit\",\"retryAfterMs\":" + retryAfterMs + "}");
                return;
            }

            WebSocketSession peer = pairs.remove(session.getId());
            if (peer != null) {
                pairs.remove(peer.getId());

                Long myId = sessionUserIds.get(session.getId());
                Long peerId = sessionUserIds.get(peer.getId());
                String myRole = roles.get(session.getId());
                String peerRole = roles.get(peer.getId());

                log.info("[NEXT_END_STREAM] sid={} myId={} myRole={} peerSid={} peerId={} peerRole={}",
                        session.getId(),
                        myId,
                        myRole,
                        peer.getId(),
                        peerId,
                        peerRole
                );

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

            log.info("[NEXT_REMATCH] sid={} uid={} role={}",
                    session.getId(),
                    sessionUserIds.get(session.getId()),
                    roles.get(session.getId())
            );

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
            log.debug("endStreamIfPairKnown: reason={} viewerId={} modelId={}", closeReason, viewerId, modelId);

            User viewer = userRepository.findById(viewerId).orElse(null);
            String realRole = viewer != null ? viewer.getRole() : null;

            // IMPORTANTE:
            // - Aquí NO usamos endSessionAsync: necesitamos cierre determinista antes de liberar locks / reencolar.
            if (Constants.Roles.CLIENT.equals(realRole)) {
                streamService.endSession(viewerId, modelId);
            } else if (Constants.Roles.USER.equals(realRole)) {
                userTrialService.endTrialStream(viewerId, modelId, closeReason);
            }

        } catch (Exception ex) {
            log.warn("endSession/endTrialStream falló: reason={} viewerId={} modelId={} msg={}",
                    closeReason, viewerId, modelId, ex.getMessage(), ex);

        } finally {
            // liberar locks de forma segura e idempotente
            String ownerA = null;
            String ownerB = null;

            if (sessionIdA != null) {
                ownerA = pairLockOwnerBySessionId.remove(sessionIdA);
            }
            if (sessionIdB != null) {
                ownerB = pairLockOwnerBySessionId.remove(sessionIdB);
            }

            // Fallback por userId si no estaba por sessionId (sin NPE)
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
                    log.warn("Error liberando locks: viewerId={} modelId={} owner={} msg={}",
                            viewerId, modelId, owner, ex.getMessage(), ex);
                }
            } else {
                log.debug("Locks owner no encontrado (posible TTL expirado): viewerId={} modelId={} reason={}",
                        viewerId, modelId, closeReason);
            }
        }
    }


    private void sendMatchMessage(WebSocketSession session, String peerSessionId) {
        try {
            Long myUserId   = sessionUserIds.get(session.getId());
            Long peerUserId = sessionUserIds.get(peerSessionId);
            String peerRole = roles.get(peerSessionId);

            BigDecimal clientBalance = null;
            Long streamRecordId = null;

            String languageReasonCode = "LANGUAGE_MATCH_FALLBACK";
            try {
                if (myUserId != null && peerUserId != null) {
                    int score = userLanguageService.languageMatchScore(myUserId, peerUserId);
                    if (score >= 100) languageReasonCode = "LANGUAGE_MATCH_PRIMARY";
                    else if (score >= 50) languageReasonCode = "LANGUAGE_MATCH_SHARED";
                    else languageReasonCode = "LANGUAGE_MATCH_FALLBACK";
                }
            } catch (Exception ignore) {}

            // Solo tiene sentido resolver stream para pares CLIENT–MODEL
            if (myUserId != null && peerUserId != null) {

                String myRole = roles.get(session.getId());

                Long clientId = null;
                Long modelId  = null;

                if ("client".equals(myRole) && "model".equals(peerRole)) {
                    clientId = myUserId;
                    modelId  = peerUserId;
                } else if ("model".equals(myRole) && "client".equals(peerRole)) {
                    clientId = peerUserId;
                    modelId  = myUserId;
                }

                if (clientId != null && modelId != null) {
                    try {
                        // 🔑 FUENTE DE VERDAD DEL STREAM
                        streamRecordId = statusService
                                .getActiveSession(clientId, modelId)
                                .orElse(null);
                    } catch (Exception ignore) {}
                }
            }

            // Balance solo se envía al CLIENT
            if ("client".equals(peerRole)) {
                clientBalance = getCurrentBalanceOrZero(peerUserId);
            }

            String msg = String.format(
                    Locale.US,
                    "{"
                            + "\"type\":\"match\","
                            + "\"peerId\":\"%s\","
                            + "\"peerUserId\":%s,"
                            + "\"peerRole\":\"%s\","
                            + "\"clientBalance\":%s,"
                            + "\"streamRecordId\":%s,"
                            + "\"reasonCode\":\"%s\""
                            + "}",
                    peerSessionId,
                    peerUserId != null ? peerUserId.toString() : "null",
                    peerRole != null ? peerRole : "",
                    clientBalance != null ? ("\"" + clientBalance.toPlainString() + "\"") : "null",
                    streamRecordId != null ? streamRecordId.toString() : "null",
                    languageReasonCode
            );

            session.sendMessage(new TextMessage(msg));

        } catch (Exception e) {
            System.out.println(
                    "Error enviando match a sessionId=" + session.getId() + ": " + e.getMessage()
            );
        }
    }



    private void safeRequeue(WebSocketSession session, String role) {
        if (session == null || !session.isOpen() || role == null) return;

        String key = sessionBucketKey.get(session.getId());
        if (key == null) key = getSessionBucketKey(session);

        moveToBucket(session, role, key);
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
        if (s == null) return;

        if (!s.isOpen()) {
            log.debug("[WS][match][SEND_SKIP] sid={} reason=not-open payloadType={}", s.getId(), safeType(json));
            return;
        }

        try {
            s.sendMessage(new TextMessage(json));
        } catch (Exception ex) {
            log.error(
                    "[WS][match][SEND_FAIL] sid={} payloadType={} exClass={} exMsg={}",
                    s.getId(),
                    safeType(json),
                    ex.getClass().getName(),
                    ex.getMessage(),
                    ex
            );
        }
    }

    private String safeType(String json) {
        if (json == null) return "null";
        try {
            return new org.json.JSONObject(json).optString("type", "unknown");
        } catch (Exception ignore) {
            return "non-json";
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
            modelId  = peerUserId;
        } else if ("model".equals(myRole) && "client".equals(peerRole)) {
            clientId = peerUserId;
            modelId  = myUserId;
        } else {
            return false;
        }

        // Solo aplicamos cutoff a CLIENT real (no a USER trial)
        try {
            User clientUser = userRepository.findById(clientId).orElse(null);
            if (clientUser == null || !Constants.Roles.CLIENT.equals(clientUser.getRole())) {
                return false;
            }
        } catch (Exception ex) {
            return false;
        }

        final boolean shouldEnd;
        try {
            shouldEnd = streamService.endIfBelowThreshold(clientId, modelId);
        } catch (Exception ex) {
            log.warn("endIfBelowThreshold error: clientId={} modelId={} msg={}",
                    clientId, modelId, ex.getMessage(), ex);
            return false;
        }

        if (!shouldEnd) return false;

        // Importante: feedback inmediato al frontend
        safeSend(session, "{\"type\":\"peer-disconnected\",\"reason\":\"low-balance\"}");
        safeSend(peer,    "{\"type\":\"peer-disconnected\",\"reason\":\"low-balance\"}");

        // Desparejar ya (UX inmediata). Los locks pueden quedar vivos hasta:
        // - cierre real en endSessionAsync, o
        // - TTL de locks (15s) si tu unlock depende del cierre.
        pairs.remove(session.getId());
        pairs.remove(peer.getId());

        // ✅ Aquí SÍ usamos ASYNC para no bloquear el hilo WS en un cierre “pesado”
        try {
            streamService.endSessionAsync(clientId, modelId);
        } catch (Exception ex) {
            log.warn("endSessionAsync launch failed: clientId={} modelId={} msg={}",
                    clientId, modelId, ex.getMessage(), ex);
        }

        return true;
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
            int waitingModelsCount = totalWaitingModels();
            int waitingClientsCount = totalWaitingClients();

            String role = roles.get(s.getId());
            int myPosition = -1;

            if ("model".equals(role)) {
                String key = sessionBucketKey.get(s.getId());
                if (key == null) key = getSessionBucketKey(s);
                myPosition = positionInQueue(modelsBucket(key), s);
            } else if ("client".equals(role)) {
                String key = sessionBucketKey.get(s.getId());
                if (key == null) key = getSessionBucketKey(s);
                myPosition = positionInQueue(clientsBucket(key), s);
            }

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

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        final String sid = session != null ? session.getId() : null;

        Long uid = null;
        String role = null;
        String peerSid = null;

        try { uid = (sid != null) ? sessionUserIds.get(sid) : null; } catch (Exception ignore) {}
        try { role = (sid != null) ? roles.get(sid) : null; } catch (Exception ignore) {}
        try {
            WebSocketSession peer = (sid != null) ? pairs.get(sid) : null;
            peerSid = peer != null ? peer.getId() : null;
        } catch (Exception ignore) {}

        log.error(
                "[WS][match][TRANSPORT_ERROR] sid={} uid={} role={} open={} peerSid={} exClass={} exMsg={}",
                sid,
                uid,
                role,
                (session != null && session.isOpen()),
                peerSid,
                exception != null ? exception.getClass().getName() : null,
                exception != null ? exception.getMessage() : null,
                exception
        );

        // deja que el ciclo de vida cierre como corresponda
        super.handleTransportError(session, exception);
    }



}
