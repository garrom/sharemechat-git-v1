package com.sharemechat.handler;

import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.ModelStatusService;
import com.sharemechat.service.StreamService;
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

    private final Queue<WebSocketSession> waitingModels = new ConcurrentLinkedQueue<>();
    private final Queue<WebSocketSession> waitingClients = new ConcurrentLinkedQueue<>();
    private final Map<String, WebSocketSession> pairs = new HashMap<>();
    private final Map<String, String> roles = new HashMap<>();
    private final Map<String, Long> sessionUserIds = new HashMap<>();
    private final Set<String> switching = Collections.newSetFromMap(new ConcurrentHashMap<>());


    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final StreamService streamService;
    private final ModelStatusService modelStatusService;

    public MatchingHandler(JwtUtil jwtUtil,
                           UserRepository userRepository,
                           StreamService streamService,
                           ModelStatusService modelStatusService) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.streamService = streamService;
        this.modelStatusService = modelStatusService;
    }

    //EL METODO SE EJECUTA CUANDO SE ABRE UNA NUEVA CONEXION WEBSOCKET Y RESUELVE EL USERID A PARTIR DEL TOKEN
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        System.out.println("Nueva conexión establecida: sessionId=" + session.getId());
        System.out.println("WS URI recibida: " + session.getUri()); // <-- debería mostrar ?token=
        // 1) Resolver userId desde token (?token=... o Authorization: Bearer ...)
        Long userId = resolveUserId(session);
        if (userId == null) {
            System.out.println("Sin token válido, cerrando sesión: " + session.getId());
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        sessionUserIds.put(session.getId(), userId);
        // No añadimos a colas hasta que nos digan el rol (set-role)
    }

    //EL METODO SE EJECUTA CUANDO SE CIERRA UNA CONEXION WEBSOCKET Y ELIMINA AL USUARIO DE COLAS Y PARES, FINALIZANDO STREAM SI ES NECESARIO
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        System.out.println("Conexión cerrada: sessionId=" + session.getId() + ", status=" + status);
        String role = roles.remove(session.getId());
        Long userId = sessionUserIds.remove(session.getId());

        if ("model".equals(role)) {
            waitingModels.remove(session);
            System.out.println("Modelo eliminado de waitingModels: sessionId=" + session.getId());
            if (userId != null) modelStatusService.setOffline(userId);
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

            endStreamIfPairKnown(myId, myRole, peerId, peerRole);

            if (peer.isOpen()) {
                safeSend(peer, "{\"type\":\"peer-disconnected\",\"reason\":\"peer-closed\"}");
                // El peer sigue conectado → reencolarlo para que no se quede “zombie”
                safeRequeue(peer, peerRole); // <-- NUEVO
            } else {
                System.out.println("Peer no está abierto: peerId=" + peer.getId());
            }
        } else {
            System.out.println("No se encontró peer para sessionId=" + session.getId());
        }
    }


    //EL METODO PARA CHAT EN VIVO POR WEBSOCKET SEGUN SU TIPO COMO SIGNAL CHAT SET-ROLE START-MATCH NEXT O STATS
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        // Deja comentado el log crudo para evitar volcar SDP/candidates gigantes
        // System.out.println("Mensaje recibido de sessionId=" + session.getId() + ": " + payload);

        try {
            JSONObject json = new JSONObject(payload);
            String type = json.getString("type");

            // ===== LOGS SANITIZADOS (no imprimen SDP/candidates) =====
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
            // ===== FIN LOGS SANITIZADOS =====

            if ("ping".equals(type)) {
                // keepalive desde el cliente; no hacer nada
                checkCutoffAndMaybeEnd(session);
                return;
            }

            if ("set-role".equals(type)) {
                String role = json.getString("role");
                roles.put(session.getId(), role);
                Long userId = sessionUserIds.get(session.getId());

                if ("model".equals(role)) {
                    // Evitar duplicados en la cola
                    waitingModels.remove(session);
                    waitingModels.add(session);
                    System.out.println("Modelo añadido a waitingModels: sessionId=" + session.getId());
                    if (userId != null) {
                        modelStatusService.setAvailable(userId);
                    }
                } else if ("client".equals(role)) {
                    // Evitar duplicados en la cola
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
                    peer.sendMessage(new TextMessage(payload));
                }
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

    //EL METODO REALIZA UN EMPAREJAMIENTO ENTRE UN CLIENTE Y UN MODELO DISPONIBLE Y ARRANCA LA SESION DE STREAM
    private void matchClient(WebSocketSession client) throws Exception {
        waitingClients.remove(client);
        WebSocketSession model = waitingModels.poll();
        if (model != null && model.isOpen()) {
            pairs.put(client.getId(), model);
            pairs.put(model.getId(), client);

            // === INICIO STREAM EN MATCH ===
            Long clientId = sessionUserIds.get(client.getId());
            Long modelId = sessionUserIds.get(model.getId());
            if (clientId != null && modelId != null) {
                try {
                    // El servicio verifica roles reales contra DB y setea BUSY
                    streamService.startSession(clientId, modelId, false);
                } catch (Exception ex) {
                    System.out.println("startSession falló: " + ex.getMessage());
                    // si falla el inicio, devolvemos el modelo a la cola y avisamos al cliente
                    safeRequeue(model, "model");
                    // Si es saldo insuficiente -> avisamos correctamente al cliente
                    if (isLowBalance(ex)) {
                        safeSend(client, "{\"type\":\"no-balance\"}");
                    } else {
                        safeSend(client, "{\"type\":\"no-model-available\"}");
                    }

                    return;
                }
            }

            sendMatchMessage(client, model.getId());
            sendMatchMessage(model, client.getId());
        } else {
            client.sendMessage(new TextMessage("{\"type\":\"no-model-available\"}"));
            waitingClients.add(client); // Volver a la cola si no hay modelo
        }
    }

    //EL METODO REALIZA UN EMPAREJAMIENTO ENTRE UN MODELO Y UN CLIENTE DISPONIBLE Y ARRANCA LA SESION DE STREAM
    private void matchModel(WebSocketSession model) throws Exception {
        waitingModels.remove(model);
        WebSocketSession client = waitingClients.poll();
        if (client != null && client.isOpen()) {
            pairs.put(model.getId(), client);
            pairs.put(client.getId(), model);

            // === INICIO STREAM EN MATCH ===
            Long clientId = sessionUserIds.get(client.getId());
            Long modelId = sessionUserIds.get(model.getId());
            if (clientId != null && modelId != null) {
                try {
                    streamService.startSession(clientId, modelId, false);
                } catch (Exception ex) {
                    System.out.println("startSession falló: " + ex.getMessage());

                    if (isLowBalance(ex)) {
                        // Cliente sin saldo: infórmale y no lo re-encoles hasta que recargue
                        safeSend(client, "{\"type\":\"no-balance\"}");
                        // El modelo sí vuelve a la cola (está disponible)
                        safeRequeue(model, "model");
                    } else {
                        // Caso original: no hay cliente válido; re-encola cliente y notifica a modelo
                        safeRequeue(client, "client");
                        safeSend(model, "{\"type\":\"no-client-available\"}");
                    }
                    return;
                }
            }

            sendMatchMessage(model, client.getId());
            sendMatchMessage(client, model.getId());
        } else {
            model.sendMessage(new TextMessage("{\"type\":\"no-client-available\"}"));
            waitingModels.add(model); // Volver a la cola si no hay cliente
        }
    }

    //EL METODO GESTIONA EL CAMBIO DE PAREJA CUANDO UN USUARIO PULSA NEXT FINALIZANDO LA SESION ACTUAL Y BUSCANDO UN NUEVO EMPAREJAMIENTO
    private void handleNext(WebSocketSession session) throws Exception {
        // --- FUSIBLE anti-reentradas ---
        if (!switching.add(session.getId())) {
            // Ya hay un NEXT en curso para esta sesión
            return;
        }
        try {
            WebSocketSession peer = pairs.remove(session.getId());
            if (peer != null) {
                pairs.remove(peer.getId());
                System.out.println("Peer encontrado para sessionId=" + session.getId() + ", peerId=" + peer.getId());

                // FIN STREAM por NEXT
                Long myId   = sessionUserIds.get(session.getId());
                Long peerId = sessionUserIds.get(peer.getId());
                String myRole   = roles.get(session.getId());
                String peerRole = roles.get(peer.getId());
                endStreamIfPairKnown(myId, myRole, peerId, peerRole);

                if (peer.isOpen()) {
                    // Notifica y REENCOLA automáticamente al peer (muy importante)
                    safeSend(peer, "{\"type\":\"peer-disconnected\",\"reason\":\"next\"}");
                    safeRequeue(peer, peerRole);  // <-- NUEVO
                } else {
                    System.out.println("Peer no está abierto: peerId=" + peer.getId());
                }
            } else {
                System.out.println("No se encontró peer para sessionId=" + session.getId());
            }

            // Reemparejar al que pulsó 'next'
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


    //EL METODO GESTIONA EL CAMBIO DE PAREJA CUANDO UN USUARIO PULSA NEXT FINALIZANDO LA SESION ACTUAL Y BUSCANDO UN NUEVO EMPAREJAMIENTO
    private void endStreamIfPairKnown(Long idA, String roleA, Long idB, String roleB) {
        if (idA == null || idB == null || roleA == null || roleB == null) return;

        Long clientId;
        Long modelId;

        if ("client".equals(roleA) && "model".equals(roleB)) {
            clientId = idA;
            modelId = idB;
        } else if ("model".equals(roleA) && "client".equals(roleB)) {
            clientId = idB;
            modelId = idA;
        } else {
            // roles inconsistentes, no finalizamos
            return;
        }

        try {
            streamService.endSession(clientId, modelId);
        } catch (Exception ex) {
            System.out.println("endSession falló: " + ex.getMessage());
        }
    }

    //EL METODO ENVIA AL USUARIO UN MENSAJE INDICANDO QUE SE HA PRODUCIDO UN EMPAREJAMIENTO CON SU PEER
    private void sendMatchMessage(WebSocketSession session, String peerId) {
        try {
            String msg = "{\"type\":\"match\",\"peerId\":\"" + peerId + "\"}";
            System.out.println("Enviando mensaje de emparejamiento a sessionId=" + session.getId() + ": " + msg);
            session.sendMessage(new TextMessage(msg));
        } catch (Exception e) {
            System.out.println("Error enviando mensaje de emparejamiento a sessionId=" + session.getId() + ": " + e.getMessage());
        }
    }

    //EL METODO VUELVE A COLOCAR DE FORMA SEGURA UN USUARIO EN LA COLA SEGUN SU ROL SI EL SOCKET SIGUE ABIERTO
    private void safeRequeue(WebSocketSession session, String role) {
        if (session != null && session.isOpen()) {
            if ("model".equals(role)) {
                waitingModels.add(session);
            } else if ("client".equals(role)) {
                waitingClients.add(session);
            }
        }
    }

    //EL METODO OBTIENE EL USERID A PARTIR DEL TOKEN INCLUIDO EN LA CONEXION WEBSOCKET
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

    //EL METODO EXTRA EL TOKEN JWT DESDE LOS PARAMETROS DE LA URL O DESDE EL HEADER AUTHORIZATION
    private String extractToken(WebSocketSession session) {
        // 1) Query param ?token=...
        try {
            URI uri = session.getUri();
            if (uri != null && uri.getQuery() != null) {
                Map<String, String> qs = parseQuery(uri.getQuery());
                if (qs.containsKey("token")) {
                    return qs.get("token");
                }
            }
        } catch (Exception ignored) {}

        // 2) Header Authorization: Bearer ...
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

    //EL METODO PARSEA UNA QUERYSTRING Y DEVUELVE UN MAPA CON SUS CLAVES Y VALORES
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

    //EL METODO ENVIA UN MENSAJE JSON DE FORMA SEGURA A UN SOCKET VERIFICANDO QUE SIGA ABIERTO
    private void safeSend(WebSocketSession s, String json) {
        if (s != null && s.isOpen()) {
            try { s.sendMessage(new TextMessage(json)); }
            catch (Exception ignore) {}
        }
    }

    //EL METODO VERIFICA SI EL CLIENTE TIENE SALDO POR DEBAJO DEL UMBRAL Y FINALIZA LA SESION SI ES NECESARIO
    private boolean checkCutoffAndMaybeEnd(WebSocketSession session) {
        // Localiza al peer
        WebSocketSession peer = pairs.get(session.getId());
        if (peer == null) return false;

        // Roles de cada lado
        String myRole   = roles.get(session.getId());
        String peerRole = roles.get(peer.getId());
        if (myRole == null || peerRole == null) return false;

        Long myUserId   = sessionUserIds.get(session.getId());
        Long peerUserId = sessionUserIds.get(peer.getId());
        if (myUserId == null || peerUserId == null) return false;

        // Determina quién es cliente y quién modelo
        Long clientId;
        Long modelId;
        if ("client".equals(myRole) && "model".equals(peerRole)) {
            clientId = myUserId;  modelId = peerUserId;
        } else if ("model".equals(myRole) && "client".equals(peerRole)) {
            clientId = peerUserId; modelId = myUserId;
        } else {
            return false; // combinación inválida
        }

        // Llama al servicio: si devuelve true, se cerró por saldo bajo
        boolean closed = false;
        try {
            closed = streamService.endIfBelowThreshold(clientId, modelId);
        } catch (Exception ex) {
            System.out.println("endIfBelowThreshold error: " + ex.getMessage());
            return false;
        }

        if (closed) {
            // Notifica y limpia pares
            safeSend(session, "{\"type\":\"peer-disconnected\",\"reason\":\"low-balance\"}");
            safeSend(peer,    "{\"type\":\"peer-disconnected\",\"reason\":\"low-balance\"}");

            // Saca el par del mapa (el StreamService ya cerró y limpió estado/redis)
            pairs.remove(session.getId());
            pairs.remove(peer.getId());
        }
        return closed;
    }

    //EL METODO DETERMINA SI UNA EXCEPCION ESTA RELACIONADA CON SALDO INSUFICIENTE
    private boolean isLowBalance(Exception ex) {
        String m = ex != null ? ex.getMessage() : null;
        return m != null && m.contains("Saldo insuficiente");
    }

    //EL METODO CALCULA LA POSICION DE UN USUARIO EN LA COLA DEVOLVIENDO SU INDICE O -1 SI NO ESTA
    private int positionInQueue(Queue<WebSocketSession> q, WebSocketSession s) {
        int i = 0;
        for (WebSocketSession x : q) {
            if (x == s) return i; // 0 = primera en la cola
            i++;
        }
        return -1; // no está en la cola (por ejemplo, ya emparejada)
    }

    //EL METODO ENVIA AL USUARIO ESTADISTICAS DE COLA COMO NUMERO DE MODELOS CLIENTES POSICION Y SESIONES ACTIVAS
    private void sendQueueStats(WebSocketSession s) {
        try {
            int waitingModelsCount  = waitingModels.size();
            int waitingClientsCount = waitingClients.size();

            String role = roles.get(s.getId());
            int myPosition = -1;
            if ("model".equals(role)) {
                myPosition = positionInQueue(waitingModels, s); // 0 = primera
            }

            int activePairs = computeActivePairs();
            int modelsStreaming  = activePairs; // 1:1 ⇒ mismos pares
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

    //EL METODO CALCULA EL NUMERO DE PARES ACTIVOS CLIENTE MODELO EVITANDO CONTAR DUPLICADOS
    private int computeActivePairs() {
        // Contar pares únicos model↔client evitando doble conteo (pairs tiene ida y vuelta)
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


}
