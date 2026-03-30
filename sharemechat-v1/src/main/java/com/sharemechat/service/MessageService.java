package com.sharemechat.service;

import com.sharemechat.dto.ConversationSummaryDTO;
import com.sharemechat.dto.MessageDTO;
import com.sharemechat.entity.Gift;
import com.sharemechat.entity.Message;
import com.sharemechat.entity.User;
import com.sharemechat.repository.MessageRepository;
import com.sharemechat.repository.UserRepository;
import org.json.JSONObject;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final FavoriteService favoriteService;
    private final StreamService streamService;
    private static final int HISTORY_PAGE = 30;

    public MessageService(MessageRepository messageRepository,
                          UserRepository userRepository,
                          StreamService streamService,
                          FavoriteService favoriteService) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.favoriteService = favoriteService;
        this.streamService = streamService;
    }

    public static String convKey(Long a, Long b) {
        return (a < b ? a + ":" + b : b + ":" + a);
    }

    public boolean canMessage(Long senderId, Long recipientId) {
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
        return sendInternal(senderId, recipientId, body, null);
    }

    @Transactional
    public MessageDTO sendGift(Long senderId, Long recipientId, Gift gift) {
        if (gift == null || gift.getId() == null) {
            throw new IllegalArgumentException("Gift inválido para persistir mensaje");
        }
        String marker = "[[GIFT:" + gift.getId() + ":" + gift.getName() + "]]";
        return sendInternal(senderId, recipientId, marker, toGiftSnapshot(gift));
    }

    private MessageDTO sendInternal(Long senderId, Long recipientId, String body, MessageDTO.GiftSnapshotDTO giftSnapshot) {
        if (body == null) body = "";
        body = body.strip();
        if (body.isEmpty()) throw new IllegalArgumentException("Mensaje vacío");
        if (body.length() > 1000) body = body.substring(0, 1000);

        boolean allowed = canMessage(senderId, recipientId);

        if (!allowed) {
            var sender = userRepository.findById(senderId).orElseThrow();
            var recipient = userRepository.findById(recipientId).orElseThrow();

            boolean inActiveStream = false;
            if ("CLIENT".equals(sender.getRole()) && "MODEL".equals(recipient.getRole())) {
                inActiveStream = streamService.isPairActive(senderId, recipientId);
            } else if ("MODEL".equals(sender.getRole()) && "CLIENT".equals(recipient.getRole())) {
                inActiveStream = streamService.isPairActive(recipientId, senderId);
            }

            allowed = inActiveStream;
        }

        if (!allowed) {
            throw new IllegalStateException("No autorizado para enviar mensajes a este usuario");
        }

        Message m = new Message();
        m.setSenderId(senderId);
        m.setRecipientId(recipientId);
        m.setConversationKey(convKey(senderId, recipientId));
        m.setBody(body);
        m.setCreatedAt(LocalDateTime.now());
        m.setMeta(giftSnapshot != null ? buildGiftMetaJson(giftSnapshot) : null);
        messageRepository.save(m);

        return toDto(m);
    }

    @Transactional(readOnly = true)
    public List<MessageDTO> history(Long me, Long withUser, Long beforeId) {
        var page = PageRequest.of(0, HISTORY_PAGE);
        List<Message> list = messageRepository.findBetween(me, withUser, page);
        return list.stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public int markRead(Long me, Long withUser) {
        return messageRepository.markRead(me, withUser);
    }

    @Transactional(readOnly = true)
    public List<ConversationSummaryDTO> conversations(Long me) {
        var page = PageRequest.of(0, 200, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
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

            out.add(new ConversationSummaryDTO(key, me, peer, buildConversationLastBody(last), last.getCreatedAt(), unread));
        }
        out.sort(Comparator.comparing(ConversationSummaryDTO::lastAt).reversed());
        return out;
    }

    private String buildConversationLastBody(Message message) {
        MessageDTO.GiftSnapshotDTO gift = parseGiftMeta(message.getMeta());
        if (gift != null) {
            String giftName = gift.name() != null ? gift.name().strip() : "";
            return giftName.isEmpty() ? "Gift" : "Gift: " + giftName;
        }
        return message.getBody();
    }

    private MessageDTO toDto(Message m) {
        return new MessageDTO(
                m.getId(),
                m.getSenderId(),
                m.getRecipientId(),
                m.getBody(),
                m.getCreatedAt(),
                m.getReadAt(),
                parseGiftMeta(m.getMeta())
        );
    }

    private MessageDTO.GiftSnapshotDTO toGiftSnapshot(Gift gift) {
        BigDecimal cost = gift.getCost() != null
                ? gift.getCost().setScale(2, RoundingMode.HALF_UP)
                : null;
        return new MessageDTO.GiftSnapshotDTO(
                gift.getId(),
                gift.getCode(),
                gift.getName(),
                gift.getIcon(),
                cost,
                gift.getTier(),
                gift.getFeatured()
        );
    }

    private String buildGiftMetaJson(MessageDTO.GiftSnapshotDTO giftSnapshot) {
        return new JSONObject()
                .put("type", "gift")
                .put("giftId", giftSnapshot.giftId())
                .put("code", nullable(giftSnapshot.code()))
                .put("name", nullable(giftSnapshot.name()))
                .put("icon", nullable(giftSnapshot.icon()))
                .put("cost", giftSnapshot.cost() != null ? giftSnapshot.cost().toPlainString() : JSONObject.NULL)
                .put("tier", nullable(giftSnapshot.tier()))
                .put("featured", giftSnapshot.featured() != null ? giftSnapshot.featured() : JSONObject.NULL)
                .toString();
    }

    private MessageDTO.GiftSnapshotDTO parseGiftMeta(String metaJson) {
        if (metaJson == null || metaJson.isBlank()) return null;
        try {
            JSONObject meta = new JSONObject(metaJson);
            if (!"gift".equalsIgnoreCase(meta.optString("type", ""))) return null;

            Long giftId = meta.has("giftId") && !meta.isNull("giftId") ? meta.getLong("giftId") : null;
            String code = meta.isNull("code") ? null : meta.optString("code", null);
            String name = meta.isNull("name") ? null : meta.optString("name", null);
            String icon = meta.isNull("icon") ? null : meta.optString("icon", null);
            String tier = meta.isNull("tier") ? null : meta.optString("tier", null);
            Boolean featured = meta.isNull("featured") ? null : meta.getBoolean("featured");
            String costRaw = meta.isNull("cost") ? null : meta.optString("cost", null);
            BigDecimal cost = (costRaw == null || costRaw.isBlank()) ? null : new BigDecimal(costRaw);

            if (giftId == null || name == null || icon == null || tier == null || cost == null) {
                return null;
            }

            return new MessageDTO.GiftSnapshotDTO(
                    giftId,
                    code,
                    name,
                    icon,
                    cost,
                    tier,
                    featured
            );
        } catch (Exception ignore) {
            return null;
        }
    }

    private Object nullable(String value) {
        return value != null ? value : JSONObject.NULL;
    }
}
