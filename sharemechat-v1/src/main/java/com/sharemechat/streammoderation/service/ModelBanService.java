package com.sharemechat.streammoderation.service;

import com.sharemechat.entity.Model;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.streammoderation.config.ModelBanProperties;
import com.sharemechat.streammoderation.entity.ModelModerationBan;
import com.sharemechat.streammoderation.entity.ModelModerationStrike;
import com.sharemechat.streammoderation.repository.ModelModerationBanRepository;
import com.sharemechat.streammoderation.repository.ModelModerationStrikeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * ADR-037 frente trial-sfw Bloque 3: motor de bans automaticos
 * progresivos sobre modelos que muestran contenido explicito durante
 * streams trial.
 *
 * <p>Solo severity=CRITICAL en sesiones {@code is_trial=true} genera
 * strike. Ver {@link ModelBanProperties} para escalada y ventana de
 * reset (defaults 15/30/60/360/1440 min con reset 30 dias).
 *
 * <p>Idempotencia: la UK {@code (stream_moderation_session_id)} de
 * {@code model_moderation_strikes} garantiza max 1 strike por sesion,
 * aunque el pipeline dispare varios verdicts CRITICAL en el mismo
 * trial. Si la insercion colisiona, {@link #recordStrike} salta el
 * emitBan (ya se hizo antes). Sin retry ni error hacia arriba.
 */
@Service
public class ModelBanService {

    private static final Logger log = LoggerFactory.getLogger(ModelBanService.class);

    private final ModelModerationStrikeRepository strikeRepository;
    private final ModelModerationBanRepository banRepository;
    private final ModelRepository modelRepository;
    private final ModelBanProperties props;

    public ModelBanService(ModelModerationStrikeRepository strikeRepository,
                           ModelModerationBanRepository banRepository,
                           ModelRepository modelRepository,
                           ModelBanProperties props) {
        this.strikeRepository = strikeRepository;
        this.banRepository = banRepository;
        this.modelRepository = modelRepository;
        this.props = props;
    }

    /**
     * Registra un strike (si no existe ya para esa sesion) y, si el
     * conteo dentro de la ventana rodante lo justifica, emite un ban.
     * Best-effort: cualquier excepcion se traga y loguea, no propaga
     * hacia arriba (llamado desde {@code StreamModerationActionService}
     * como side-effect del auto-cut).
     */
    @Transactional
    public void recordStrike(Long modelUserId,
                             Long streamModerationSessionId,
                             String severity,
                             String category) {
        if (modelUserId == null || streamModerationSessionId == null) {
            log.warn("[MODEL-BAN] recordStrike ignorado: modelUserId={} sessionId={}",
                    modelUserId, streamModerationSessionId);
            return;
        }
        try {
            if (strikeRepository.existsByStreamModerationSessionId(streamModerationSessionId)) {
                log.info("[MODEL-BAN] strike ya existente para sessionId={}, no-op",
                        streamModerationSessionId);
                return;
            }
            ModelModerationStrike strike = new ModelModerationStrike();
            strike.setModelUserId(modelUserId);
            strike.setStreamModerationSessionId(streamModerationSessionId);
            strike.setSeverity(severity);
            strike.setCategory(category);
            strike.setTrial(true);
            ModelModerationStrike saved;
            try {
                saved = strikeRepository.saveAndFlush(strike);
            } catch (DataIntegrityViolationException dup) {
                // Otra ejecucion concurrente insertó primero: correcto, ya se emitio el ban.
                log.info("[MODEL-BAN] dup strike sessionId={} (concurrencia), no-op",
                        streamModerationSessionId);
                return;
            }

            LocalDateTime windowStart = LocalDateTime.now()
                    .minusDays(props.getStrikeWindowDays());
            long strikeCount = strikeRepository
                    .countByModelUserIdAndCreatedAtGreaterThanEqual(modelUserId, windowStart);

            emitBan(modelUserId, (int) strikeCount, saved.getId(), category);
        } catch (Exception ex) {
            log.warn("[MODEL-BAN] recordStrike FAIL modelUserId={} sessionId={}: {}",
                    modelUserId, streamModerationSessionId, ex.getMessage(), ex);
        }
    }

    /**
     * Calcula duracion segun escalada y persiste ban + actualiza
     * {@code models.streaming_banned_until}. Package-private para tests.
     */
    void emitBan(Long modelUserId, int strikeCount, Long sourceStrikeId, String category) {
        long minutes = computeBanDurationMinutes(strikeCount);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endsAt = now.plusMinutes(minutes);

        boolean manualReview = strikeCount >= props.getManualReviewFromStrike();

        ModelModerationBan ban = new ModelModerationBan();
        ban.setModelUserId(modelUserId);
        ban.setStrikeCountAtBan(strikeCount);
        ban.setBanEndsAt(endsAt);
        ban.setReason("TRIAL_MODERATION_STRIKE:" + category + ":" + strikeCount);
        ban.setSourceStrikeId(sourceStrikeId);
        ban.setRequiresManualReview(manualReview);
        banRepository.save(ban);

        // Actualiza el flag caliente del perfil del modelo. Si ya habia un ban
        // vigente futuro, lo sobreescribe (el nuevo strike siempre gana).
        modelRepository.findById(modelUserId).ifPresentOrElse(m -> {
            m.setStreamingBannedUntil(endsAt);
            modelRepository.save(m);
        }, () -> log.warn("[MODEL-BAN] emitBan: no existe fila models para userId={}", modelUserId));

        log.warn("[MODEL-BAN] BAN emitido modelUserId={} strikeCount={} minutes={} endsAt={} manualReview={} category={}",
                modelUserId, strikeCount, minutes, endsAt, manualReview, category);
    }

    /**
     * Devuelve la duracion en minutos correspondiente al strike ordinal
     * (1-based). Ordinales por encima del tamaño del array usan la
     * ultima duracion (24h por default).
     */
    long computeBanDurationMinutes(int strikeCount) {
        long[] arr = props.getDurationsMinutes();
        if (arr == null || arr.length == 0) return 15L;
        int idx = Math.max(0, Math.min(strikeCount - 1, arr.length - 1));
        return arr[idx];
    }
}
