package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.handler.MatchingHandler;
import com.sharemechat.handler.MessagesWsHandler;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ADR-050 #D-34 (2026-07-16): avisos WS previos al auto-cut de moderacion.
 *
 * <p>Motivo: los auto-cuts NO_FACE_SUSTAINED / FROZEN_STREAM son
 * legitimos pero llegan sin previo aviso a la modelo. Con umbral 2 ticks
 * a cadencia 60s, un descuido (ir al lavabo, ajustar iluminacion) se
 * convierte en corte a los 2 min sin oportunidad de reaccion.
 *
 * <p>Este servicio dispara un mensaje WS a la modelo cuando el contador
 * alcanza {@code threshold - 1} (es decir, un tick antes del corte, ~60s
 * de margen). Si la modelo vuelve al encuadre / desbloquea la camara en
 * el siguiente tick, el contador se resetea y se envia un mensaje
 * "cleared" para cerrar el banner en frontend.
 *
 * <p>El cliente NUNCA recibe este aviso (protege reputacion del modelo
 * frente a descuidos menores).
 *
 * <p>Estado en memoria: {@code activeWarnings} guarda los pares
 * {@code sessionId + ":" + reason} para los que ya se emitio warning y
 * sigue vigente. Se limpia al enviar "cleared" o al auto-cut. Si el
 * backend se reinicia, el estado se pierde pero solo implica que un
 * warning se re-emitiria por el siguiente tick borderline; sin fatal
 * consequence porque el frontend gestiona idempotencia visual.
 */
@Service
public class ModerationWarningService {

    private static final Logger log = LoggerFactory.getLogger(ModerationWarningService.class);

    /** Reason enviado en el payload WS. Frontend lo usa para el copy. */
    public static final String REASON_NO_FACE = "no-face";
    public static final String REASON_FROZEN = "frozen";

    private final StreamRecordRepository streamRecordRepository;
    private final MatchingHandler matchingHandler;
    private final MessagesWsHandler messagesWsHandler;

    /** Warnings activos: keys "sessionId:reason". Thread-safe. */
    private final Set<String> activeWarnings = ConcurrentHashMap.newKeySet();

    public ModerationWarningService(StreamRecordRepository streamRecordRepository,
                                    @Lazy MatchingHandler matchingHandler,
                                    @Lazy MessagesWsHandler messagesWsHandler) {
        this.streamRecordRepository = streamRecordRepository;
        this.matchingHandler = matchingHandler;
        this.messagesWsHandler = messagesWsHandler;
    }

    /**
     * Emite warning al modelo si aun no hay warning activo para este par
     * (sessionId, reason). Idempotente: llamadas repetidas con el mismo
     * par no generan mas de un mensaje.
     */
    public void notifyImminentCut(StreamModerationSession session, String reason, int secondsUntilCut) {
        if (session == null || reason == null) return;
        String key = session.getId() + ":" + reason;
        if (!activeWarnings.add(key)) return; // ya activo

        Long streamRecordId = session.getStreamRecordId();
        Optional<StreamRecord> srOpt = streamRecordRepository.findById(streamRecordId);
        if (srOpt.isEmpty()) {
            log.warn("[STREAM-MOD-WARN] streamRecord not found streamRecordId={} sessionId={}",
                    streamRecordId, session.getId());
            activeWarnings.remove(key);
            return;
        }
        StreamRecord sr = srOpt.get();
        if (sr.getModel() == null || sr.getStreamType() == null) {
            activeWarnings.remove(key);
            return;
        }
        Long modelId = sr.getModel().getId();
        String streamType = sr.getStreamType();

        String payload = "{\"type\":\"moderation-warning\","
                + "\"reason\":\"" + reason + "\","
                + "\"secondsUntilCut\":" + secondsUntilCut + "}";

        dispatchToModel(streamType, modelId, payload);
        log.info("[STREAM-MOD-WARN] warning emitido streamRecordId={} sessionId={} reason={} modelId={} streamType={}",
                streamRecordId, session.getId(), reason, modelId, streamType);
    }

    /**
     * Emite "cleared" solo si habia warning activo. Si nunca hubo, no-op.
     */
    public void notifyWarningCleared(StreamModerationSession session, String reason) {
        if (session == null || reason == null) return;
        String key = session.getId() + ":" + reason;
        if (!activeWarnings.remove(key)) return; // no habia warning

        Long streamRecordId = session.getStreamRecordId();
        Optional<StreamRecord> srOpt = streamRecordRepository.findById(streamRecordId);
        if (srOpt.isEmpty() || srOpt.get().getModel() == null || srOpt.get().getStreamType() == null) return;
        StreamRecord sr = srOpt.get();

        String payload = "{\"type\":\"moderation-warning-cleared\",\"reason\":\"" + reason + "\"}";
        dispatchToModel(sr.getStreamType(), sr.getModel().getId(), payload);
        log.info("[STREAM-MOD-WARN] warning cleared streamRecordId={} sessionId={} reason={} modelId={}",
                streamRecordId, session.getId(), reason, sr.getModel().getId());
    }

    /**
     * Limpia estado interno cuando se dispara el auto-cut real (evita
     * fugas de memoria por sessions cortadas que nunca reciben "cleared").
     * Invocado desde {@code StreamModerationActionService.triggerAutoCut}.
     */
    public void clearWarningsForSession(Long sessionId) {
        if (sessionId == null) return;
        activeWarnings.remove(sessionId + ":" + REASON_NO_FACE);
        activeWarnings.remove(sessionId + ":" + REASON_FROZEN);
    }

    private void dispatchToModel(String streamType, Long modelId, String payload) {
        try {
            if (Constants.StreamTypes.RANDOM.equalsIgnoreCase(streamType)) {
                matchingHandler.notifyUserById(modelId, payload);
            } else if (Constants.StreamTypes.CALLING.equalsIgnoreCase(streamType)) {
                messagesWsHandler.notifyUserById(modelId, payload);
            }
        } catch (Exception ex) {
            log.warn("[STREAM-MOD-WARN] dispatch fail modelId={} streamType={}: {}",
                    modelId, streamType, ex.getMessage());
        }
    }
}
