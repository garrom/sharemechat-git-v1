package com.sharemechat.service;

import com.sharemechat.dto.MessageTranslationDTO;
import com.sharemechat.entity.Message;
import com.sharemechat.entity.MessageTranslation;
import com.sharemechat.repository.MessageRepository;
import com.sharemechat.repository.MessageTranslationRepository;
import com.sharemechat.service.translation.TranslatedResult;
import com.sharemechat.service.translation.TranslationProvider;
import com.sharemechat.service.translation.TranslationUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * pending-hardening §5.3: orquesta traduccion on-demand y batch de mensajes
 * P2P con cache en tabla {@code message_translations}.
 *
 * Flujo estandar:
 *  1. Cache lookup por (messageId, targetLang).
 *  2. Miss: cargar mensaje, validar que requester es sender o recipient.
 *  3. Llamar al {@link TranslationProvider} (Google por defecto).
 *  4. Persist resultado en cache; si UNIQUE viola por carrera, releer cache
 *     y devolver ese.
 *
 * Reglas:
 *  - No se traduce si sender.uiLocale == targetLang (mismo idioma, no cuesta
 *    API pero devolveriamos texto identico → mejor 400).
 *  - Solo el sender o recipient pueden pedir la traduccion de su mensaje
 *    (evita leak de texto de otras conversaciones si un id filtra).
 */
@Service
public class MessageTranslationService {

    private static final Logger log = LoggerFactory.getLogger(MessageTranslationService.class);

    private final MessageRepository messageRepository;
    private final MessageTranslationRepository translationRepository;
    private final TranslationProvider translationProvider;

    public MessageTranslationService(MessageRepository messageRepository,
                                     MessageTranslationRepository translationRepository,
                                     TranslationProvider translationProvider) {
        this.messageRepository = messageRepository;
        this.translationRepository = translationRepository;
        this.translationProvider = translationProvider;
    }

    /**
     * Traduce un unico mensaje al idioma indicado. Cache-first.
     *
     * @throws IllegalArgumentException si el mensaje no existe.
     * @throws SecurityException si el requester no es sender ni recipient.
     * @throws TranslationUnavailableException si el proveedor no responde.
     */
    @Transactional
    public MessageTranslationDTO translateOnDemand(Long messageId, String targetLang, Long requesterId) {
        if (messageId == null) throw new IllegalArgumentException("messageId required");
        if (targetLang == null || targetLang.isBlank()) throw new IllegalArgumentException("targetLang required");
        if (requesterId == null) throw new IllegalArgumentException("requesterId required");

        String lang = normalizeLang(targetLang);

        // Cache-first (no requiere cargar el mensaje).
        var cached = translationRepository.findByMessageIdAndTargetLang(messageId, lang);
        if (cached.isPresent()) {
            // Aun con hit hay que validar autorizacion: el requester debe ser
            // sender o recipient del mensaje original, no un tercero con id.
            Message m = messageRepository.findById(messageId)
                    .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));
            requireParticipant(m, requesterId);
            MessageTranslation t = cached.get();
            return new MessageTranslationDTO(messageId, lang, t.getTranslatedText(),
                    t.getProvider(), null, true);
        }

        // Miss: cargar mensaje, autorizar, traducir, persistir.
        Message m = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));
        requireParticipant(m, requesterId);

        TranslatedResult r = translationProvider.translate(m.getBody(), lang);

        MessageTranslation entity = new MessageTranslation(messageId, lang, r.translatedText(), r.provider());
        try {
            translationRepository.save(entity);
        } catch (DataIntegrityViolationException e) {
            // Carrera: dos requests concurrentes tradujeron a la vez. Releer.
            log.debug("Race saving translation for msg={} lang={}, re-reading cache", messageId, lang);
            var again = translationRepository.findByMessageIdAndTargetLang(messageId, lang);
            if (again.isPresent()) {
                MessageTranslation t = again.get();
                return new MessageTranslationDTO(messageId, lang, t.getTranslatedText(),
                        t.getProvider(), r.detectedSourceLang(), true);
            }
            throw e;
        }

        return new MessageTranslationDTO(messageId, lang, r.translatedText(),
                r.provider(), r.detectedSourceLang(), false);
    }

    /**
     * Traduce N mensajes en batch. Cache lookup primero para cada id;
     * los misses van a una unica llamada API al proveedor. Preserva orden
     * de los ids en la respuesta.
     */
    @Transactional
    public List<MessageTranslationDTO> translateBatch(List<Long> messageIds, String targetLang, Long requesterId) {
        if (messageIds == null || messageIds.isEmpty()) return List.of();
        if (targetLang == null || targetLang.isBlank()) throw new IllegalArgumentException("targetLang required");
        if (requesterId == null) throw new IllegalArgumentException("requesterId required");

        String lang = normalizeLang(targetLang);

        // Cargar todos los mensajes de golpe (evita N queries) y validar
        // autorizacion global: TODOS deben tener al requester como sender
        // o recipient. Un solo id ajeno rechaza el batch entero.
        List<Message> msgs = messageRepository.findAllById(messageIds);
        if (msgs.size() != messageIds.size()) {
            throw new IllegalArgumentException("Some messages not found");
        }
        Map<Long, Message> byId = new HashMap<>();
        for (Message m : msgs) {
            requireParticipant(m, requesterId);
            byId.put(m.getId(), m);
        }

        // Cache lookup masivo.
        List<MessageTranslation> cachedList = translationRepository.findByMessageIdIn(messageIds);
        Map<Long, MessageTranslation> cacheByMsg = new HashMap<>();
        for (MessageTranslation t : cachedList) {
            if (lang.equals(t.getTargetLang())) {
                cacheByMsg.put(t.getMessageId(), t);
            }
        }

        // Detectar los misses en el orden pedido.
        List<Long> missIds = new ArrayList<>();
        List<String> missTexts = new ArrayList<>();
        for (Long id : messageIds) {
            if (!cacheByMsg.containsKey(id)) {
                missIds.add(id);
                missTexts.add(byId.get(id).getBody());
            }
        }

        // Una sola llamada batch al proveedor para todos los misses.
        Map<Long, TranslatedResult> freshByMsg = new HashMap<>();
        if (!missTexts.isEmpty()) {
            List<TranslatedResult> results = translationProvider.translateBatch(missTexts, lang);
            for (int i = 0; i < missIds.size(); i++) {
                TranslatedResult r = results.get(i);
                freshByMsg.put(missIds.get(i), r);
                try {
                    translationRepository.save(new MessageTranslation(
                            missIds.get(i), lang, r.translatedText(), r.provider()));
                } catch (DataIntegrityViolationException e) {
                    // Carrera: otro request ya persistio. No es fatal, seguimos.
                    log.debug("Race saving batch translation for msg={} lang={}", missIds.get(i), lang);
                }
            }
        }

        // Ensamblar respuesta en el orden de messageIds.
        List<MessageTranslationDTO> out = new ArrayList<>(messageIds.size());
        for (Long id : messageIds) {
            MessageTranslation hit = cacheByMsg.get(id);
            if (hit != null) {
                out.add(new MessageTranslationDTO(id, lang, hit.getTranslatedText(),
                        hit.getProvider(), null, true));
            } else {
                TranslatedResult fresh = freshByMsg.get(id);
                out.add(new MessageTranslationDTO(id, lang, fresh.translatedText(),
                        fresh.provider(), fresh.detectedSourceLang(), false));
            }
        }
        return out;
    }

    private static void requireParticipant(Message m, Long requesterId) {
        if (!requesterId.equals(m.getSenderId()) && !requesterId.equals(m.getRecipientId())) {
            throw new SecurityException("Requester is not participant of the conversation");
        }
    }

    /**
     * Normaliza codigo de idioma a lowercase de 2 chars (BCP-47 basico).
     * Google Translate acepta tanto "es" como "es-ES"; para maximizar cache
     * hits colapsamos a 2 chars.
     */
    private static String normalizeLang(String lang) {
        String s = lang.trim().toLowerCase();
        int dash = s.indexOf('-');
        return dash > 0 ? s.substring(0, dash) : s;
    }
}
