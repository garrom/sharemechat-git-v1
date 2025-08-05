package com.sharemechat.handler;

import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;

public class MatchingHandler extends TextWebSocketHandler {

    // Cola para almacenar modelos en espera
    private final Queue<WebSocketSession> waitingModels = new ConcurrentLinkedQueue<>();
    // Mapa para almacenar los pares emparejados
    private final Map<String, WebSocketSession> pairs = new HashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // Log de nueva conexión
        System.out.println("Nueva conexión establecida: sessionId=" + session.getId());
        // Añadir modelos a la cola al conectarse (asumimos que todos los que no envían 'start-match' son modelos)
        waitingModels.add(session);
        System.out.println("Usuario añadido a waitingModels: sessionId=" + session.getId() + ", waitingModels.size=" + waitingModels.size());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        // Log de cierre de conexión
        System.out.println("Conexión cerrada: sessionId=" + session.getId() + ", status=" + status);
        // Eliminar de la cola y del mapa de pares
        waitingModels.remove(session);
        System.out.println("Usuario eliminado de waitingModels: sessionId=" + session.getId() + ", waitingModels.size=" + waitingModels.size());
        WebSocketSession peer = pairs.remove(session.getId());
        if (peer != null) {
            System.out.println("Peer encontrado para sessionId=" + session.getId() + ", peerId=" + peer.getId());
            pairs.remove(peer.getId());
            System.out.println("Par eliminado del mapa: peerId=" + peer.getId());
            if (peer.isOpen()) {
                System.out.println("Enviando mensaje 'peer-disconnected' a peerId=" + peer.getId());
                peer.sendMessage(new TextMessage("{\"type\":\"peer-disconnected\"}"));
            } else {
                System.out.println("Peer no está abierto: peerId=" + peer.getId());
            }
        } else {
            System.out.println("No se encontró peer para sessionId=" + session.getId());
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // Log del mensaje recibido
        String payload = message.getPayload();
        System.out.println("Mensaje recibido de sessionId=" + session.getId() + ": " + payload);
        if (payload.contains("start-match")) {
            // Cliente envía 'start-match', intentar emparejar con un modelo
            System.out.println("Procesando 'start-match' para sessionId=" + session.getId());
            waitingModels.remove(session); // Remover al cliente de la cola de modelos
            System.out.println("Cliente eliminado de waitingModels: sessionId=" + session.getId() + ", waitingModels.size=" + waitingModels.size());
            WebSocketSession model = waitingModels.poll();
            if (model != null && model.isOpen()) {
                // Emparejar cliente con modelo
                System.out.println("Emparejando cliente sessionId=" + session.getId() + " con modelo sessionId=" + model.getId());
                pairs.put(session.getId(), model);
                pairs.put(model.getId(), session);
                System.out.println("Pares registrados: cliente=" + session.getId() + ", modelo=" + model.getId());
                sendMatchMessage(session, model.getId());
                sendMatchMessage(model, session.getId());
            } else {
                // No hay modelos disponibles, notificar al cliente
                System.out.println("No hay modelos disponibles para sessionId=" + session.getId());
                session.sendMessage(new TextMessage("{\"type\":\"no-model-available\"}"));
            }
        } else if (pairs.containsKey(session.getId())) {
            // Reenviar mensajes (señales WebRTC) al peer emparejado
            WebSocketSession peer = pairs.get(session.getId());
            if (peer != null && peer.isOpen()) {
                System.out.println("Reenviando mensaje de sessionId=" + session.getId() + " a peerId=" + peer.getId() + ": " + payload);
                peer.sendMessage(message);
            } else {
                System.out.println("Peer no disponible para sessionId=" + session.getId() + ": peer=" + (peer == null ? "null" : peer.getId()));
            }
        } else {
            System.out.println("Mensaje ignorado, no hay par para sessionId=" + session.getId() + ": " + payload);
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