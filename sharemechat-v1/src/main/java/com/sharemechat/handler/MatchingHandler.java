package com.sharemechat.handler;

import org.json.JSONObject;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;

public class MatchingHandler extends TextWebSocketHandler {

    private final Queue<WebSocketSession> waitingModels = new ConcurrentLinkedQueue<>();
    private final Queue<WebSocketSession> waitingClients = new ConcurrentLinkedQueue<>();
    private final Map<String, WebSocketSession> pairs = new HashMap<>();
    private final Map<String, String> roles = new HashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        System.out.println("Nueva conexión establecida: sessionId=" + session.getId());
        //No añadir a ninguna cola hasta que se defina el rol
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {

        System.out.println("Conexión cerrada: sessionId=" + session.getId() + ", status=" + status);
        String role = roles.remove(session.getId());
        if ("model".equals(role)) {
            waitingModels.remove(session);
            System.out.println("Modelo eliminado de waitingModels: sessionId=" + session.getId());
        } else if ("client".equals(role)) {
            waitingClients.remove(session);
            System.out.println("Cliente eliminado de waitingClients: sessionId=" + session.getId());
        }
        WebSocketSession peer = pairs.remove(session.getId());
        if (peer != null) {
            System.out.println("Peer encontrado para sessionId=" + session.getId() + ", peerId=" + peer.getId());
            pairs.remove(peer.getId());
            System.out.println("Par eliminado del mapa: peerId=" + peer.getId());
            if (peer.isOpen()) {
                try {
                    peer.sendMessage(new TextMessage("{\"type\":\"peer-disconnected\"}"));
                    System.out.println("Notificado peer-disconnected a peerId=" + peer.getId());
                } catch (Exception e) {
                    System.out.println("Error al enviar peer-disconnected a peerId=" + peer.getId() + ": " + e.getMessage());
                }
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
        System.out.println("Mensaje recibido de sessionId=" + session.getId() + ": " + payload);

        try {
            JSONObject json = new JSONObject(payload);
            String type = json.getString("type");

            if ("set-role".equals(type)) {
                String role = json.getString("role");
                roles.put(session.getId(), role);
                if ("model".equals(role)) {
                    waitingModels.add(session);
                    System.out.println("Modelo añadido a waitingModels: sessionId=" + session.getId());
                } else if ("client".equals(role)) {
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

    private void matchClient(WebSocketSession client) throws Exception {
        waitingClients.remove(client);
        WebSocketSession model = waitingModels.poll();
        if (model != null && model.isOpen()) {
            pairs.put(client.getId(), model);
            pairs.put(model.getId(), client);
            sendMatchMessage(client, model.getId());
            sendMatchMessage(model, client.getId());
        } else {
            client.sendMessage(new TextMessage("{\"type\":\"no-model-available\"}"));
            waitingClients.add(client); // Volver a la cola si no hay modelo
        }
    }

    private void matchModel(WebSocketSession model) throws Exception {
        waitingModels.remove(model);
        WebSocketSession client = waitingClients.poll();
        if (client != null && client.isOpen()) {
            pairs.put(model.getId(), client);
            pairs.put(client.getId(), model);
            sendMatchMessage(model, client.getId());
            sendMatchMessage(client, model.getId());
        } else {
            model.sendMessage(new TextMessage("{\"type\":\"no-client-available\"}"));
            waitingModels.add(model); // Volver a la cola si no hay cliente
        }
    }
    private void handleNext(WebSocketSession session) throws Exception {
        WebSocketSession peer = pairs.remove(session.getId());
        if (peer != null) {
            pairs.remove(peer.getId());
            System.out.println("Peer encontrado para sessionId=" + session.getId() + ", peerId=" + peer.getId());
            if (peer.isOpen()) {
                peer.sendMessage(new TextMessage("{\"type\":\"peer-disconnected\"}"));
                System.out.println("Enviado 'peer-disconnected' a peerId=" + peer.getId());
            }else{
                System.out.println("Peer no está abierto: peerId=" + peer.getId());
            }
        }else{
            System.out.println("No se encontró peer para sessionId=" + session.getId());
        }
        String role = roles.get(session.getId());
        if ("client".equals(role)) {
            matchClient(session);
        } else if ("model".equals(role)) {
            matchModel(session);
        }
    }

    private void sendMatchMessage(WebSocketSession session, String peerId) {
        try {
            // Enviar mensaje de emparejamiento
            System.out.println("Enviando mensaje de emparejamiento a sessionId=" + session.getId() + ": {\"type\":\"match\",\"peerId\":\"" + peerId + "\"}");
            session.sendMessage(new TextMessage("{\"type\":\"match\",\"peerId\":\"" + peerId + "\"}"));
        } catch (Exception e) {
            System.out.println("Error enviando mensaje de emparejamiento a sessionId=" + session.getId() + ": " + e.getMessage());
        }
    }
}