package com.sharemechat.service;

import com.sharemechat.dto.ConversationSummaryDTO;
import com.sharemechat.dto.MessageDTO;
import com.sharemechat.entity.Message;
import com.sharemechat.entity.User;
import com.sharemechat.repository.MessageRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final FavoriteService favoriteService; // ya lo tienes
    private static final int HISTORY_PAGE = 30;

    public MessageService(MessageRepository messageRepository, UserRepository userRepository, FavoriteService favoriteService) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.favoriteService = favoriteService;
    }

    public static String convKey(Long a, Long b) {
        return (a < b ? a + ":" + b : b + ":" + a);
    }

    public boolean canMessage(Long senderId, Long recipientId) {
        // Solo si el destinatario está en favoritos del remitente.
        // Cliente -> Modelo  ||  Modelo -> Cliente (simétrico)
        User sender = userRepository.findById(senderId).orElse(null);
        User recipient = userRepository.findById(recipientId).orElse(null);
        if (sender == null || recipient == null) return false;

        boolean senderIsClient = "CLIENT".equalsIgnoreCase(sender.getRole());
        boolean recipientIsModel = "MODEL".equalsIgnoreCase(recipient.getRole());

        boolean senderIsModel = "MODEL".equalsIgnoreCase(sender.getRole());
        boolean recipientIsClient = "CLIENT".equalsIgnoreCase(recipient.getRole());

        if (senderIsClient && recipientIsModel) {
            return favoriteService.isModelInClientFavorites(senderId, recipientId);
        } else if (senderIsModel && recipientIsClient) {
            return favoriteService.isClientInModelFavorites(senderId, recipientId);
        }
        return false;
    }

    @Transactional
    public MessageDTO send(Long senderId, Long recipientId, String body) {
        if (body == null) body = "";
        body = body.strip();
        if (body.isEmpty()) throw new IllegalArgumentException("Mensaje vacío");
        if (body.length() > 1000) body = body.substring(0, 1000);

        if (!canMessage(senderId, recipientId)) {
            throw new IllegalStateException("No autorizado para enviar mensajes a este usuario");
        }

        Message m = new Message();
        m.setSenderId(senderId);
        m.setRecipientId(recipientId);
        m.setConversationKey(convKey(senderId, recipientId));
        m.setBody(body);
        m.setCreatedAt(LocalDateTime.now());
        messageRepository.save(m);

        return new MessageDTO(m.getId(), m.getSenderId(), m.getRecipientId(), m.getBody(), m.getCreatedAt(), m.getReadAt());
    }

    @Transactional(readOnly = true)
    public List<MessageDTO> history(Long me, Long withUser, Long beforeId) {
        var page = PageRequest.of(0, HISTORY_PAGE);
        // Simple: paginar por createdAt desc (para MVP)
        List<Message> list = messageRepository.findBetween(me, withUser, page);
        return list.stream()
                .map(m -> new MessageDTO(m.getId(), m.getSenderId(), m.getRecipientId(), m.getBody(), m.getCreatedAt(), m.getReadAt()))
                .toList();
    }

    @Transactional
    public int markRead(Long me, Long withUser) {
        return messageRepository.markRead(me, withUser);
    }

    // Listado de conversaciones (último + no leídos). MVP: lo resolvemos por agregación in-memory.
    @Transactional(readOnly = true)
    public List<ConversationSummaryDTO> conversations(Long me) {
        // Cargar últimas N páginas con heurística simple (para MVP).
        var page = PageRequest.of(0, 200);
        List<Message> recent = messageRepository.findAll(page).getContent();

        Map<String, List<Message>> byConv = new HashMap<>();
        for (Message m : recent) {
            if (!Objects.equals(m.getSenderId(), me) && !Objects.equals(m.getRecipientId(), me)) continue;
            byConv.computeIfAbsent(m.getConversationKey(), k -> new ArrayList<>()).add(m);
        }

        List<ConversationSummaryDTO> out = new ArrayList<>();
        for (var e : byConv.entrySet()) {
            String key = e.getKey();
            List<Message> msgs = e.getValue();
            msgs.sort(Comparator.comparing(Message::getCreatedAt).reversed());

            Message last = msgs.get(0);
            Long peer = Objects.equals(last.getSenderId(), me) ? last.getRecipientId() : last.getSenderId();
            int unread = (int) msgs.stream()
                    .filter(m -> Objects.equals(m.getRecipientId(), me) && m.getReadAt() == null)
                    .count();

            out.add(new ConversationSummaryDTO(key, me, peer, last.getBody(), last.getCreatedAt(), unread));
        }
        out.sort(Comparator.comparing(ConversationSummaryDTO::lastAt).reversed());
        return out;
    }
}
