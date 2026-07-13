package com.sharemechat.service;

import com.sharemechat.config.LivenessProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.FaceAttributesResult;
import com.sharemechat.entity.LivenessAttempt;
import com.sharemechat.repository.LivenessAttemptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

/**
 * ADR-050 Fase B: orquestador del liveness challenge.
 *
 * <p>Responsabilidades:
 * <ul>
 *   <li>{@link #hasCurrentPass(Long)}: query hot del guard
 *       {@code MatchingHandler}. ?"este user tiene pass vigente?".</li>
 *   <li>{@link #startChallenge(Long)}: si no hay pass y no esta en
 *       cooldown, crea fila PENDING con challenge type random y devuelve
 *       {@code {challengeId, type, promptLc}}.</li>
 *   <li>{@link #verify(Long, Long, java.util.List)}: delega al provider,
 *       aplica reglas D4, transita a PASSED/FAILED, calcula
 *       {@code passed_until}.</li>
 * </ul>
 *
 * <p>Politica de errores fail-closed-soft (ADR-050 D5): si el provider
 * lanza excepcion (credenciales blank, HTTP error, timeout), el service
 * marca la fila PASSED con verdict {@code {"vendor_unavailable":true}}
 * y {@code passed_until = now + ttlVendorUnavailableSeconds} (5 min).
 * El operador ve el numero de PASSED-por-vendor-caido en el panel admin
 * (deuda #D-27 del ADR).
 *
 * <p>Modo MOCK ({@code enabled=false}): PASSED inmediato con verdict
 * {@code {"mock":true}} y TTL completo. Sirve para dev local y AUDIT sin
 * credenciales reales.
 */
@Service
public class LivenessChallengeService {

    private static final Logger log = LoggerFactory.getLogger(LivenessChallengeService.class);

    /**
     * ADR-050 D4 revisado 2026-07-13: catalogo activo. Se emite solo
     * {@code PRESENCE} tras el refactor de gesture challenge a presence
     * check simple (testing empirico con Logitech C270 mostro tasa de
     * falso negativo alta con los gestures).
     */
    private static final String[] CHALLENGE_TYPES = {
            Constants.LivenessChallengeType.PRESENCE
    };

    private final LivenessAttemptRepository repository;
    private final LivenessFaceAttributesProvider provider;
    private final LivenessProperties props;

    public LivenessChallengeService(LivenessAttemptRepository repository,
                                     LivenessFaceAttributesProvider provider,
                                     LivenessProperties props) {
        this.repository = repository;
        this.provider = provider;
        this.props = props;
    }

    /**
     * Query hot del guard {@code MatchingHandler.set-role}: devuelve el
     * pass vigente en UTC ahora, o vacio si el user debe pasar nuevo
     * challenge.
     */
    public Optional<LivenessAttempt> hasCurrentPass(Long userId) {
        if (userId == null) return Optional.empty();
        LocalDateTime nowUtc = LocalDateTime.now(ZoneOffset.UTC);
        return repository.findValidPassedByUserId(userId, nowUtc);
    }

    /**
     * Inicia un challenge. Contrato:
     * <ul>
     *   <li>Si ya hay pass vigente → devuelve la fila existente sin
     *       crear una nueva (idempotente).</li>
     *   <li>Si el user esta en cooldown D6 → lanza
     *       {@link IllegalStateException} con codigo
     *       {@code cooldown_active}. El caller devuelve HTTP 429.</li>
     *   <li>Cualquier PENDING previo del user pasa a EXPIRED.</li>
     *   <li>Se selecciona challenge type random y se crea fila PENDING.</li>
     * </ul>
     */
    @Transactional
    public LivenessAttempt startChallenge(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("userId required");
        }

        LocalDateTime nowUtc = LocalDateTime.now(ZoneOffset.UTC);
        Optional<LivenessAttempt> current = repository.findValidPassedByUserId(userId, nowUtc);
        if (current.isPresent()) {
            return current.get();
        }

        // ADR-050 D6 rate limit
        LocalDateTime windowStart = nowUtc.minusHours(24);
        long recentFails = repository.countFailedByUserSince(userId, windowStart);
        if (recentFails >= props.getMaxFailedAttemptsPerDay()) {
            log.info("[LIVENESS] cooldown user={} fails24h={}", userId, recentFails);
            throw new IllegalStateException("cooldown_active");
        }

        // Marcar PENDINGs viejos como EXPIRED para evitar ambiguedad.
        List<LivenessAttempt> stalePending =
                repository.findByUserIdAndStatus(userId, Constants.LivenessChallengeStatus.PENDING);
        for (LivenessAttempt stale : stalePending) {
            stale.setStatus(Constants.LivenessChallengeStatus.EXPIRED);
            stale.setResolvedAt(nowUtc);
            repository.save(stale);
        }

        String type = CHALLENGE_TYPES[ThreadLocalRandom.current().nextInt(CHALLENGE_TYPES.length)];
        String promptLc = type + "_PROMPT";

        LivenessAttempt row = new LivenessAttempt();
        row.setUserId(userId);
        row.setChallengeType(type);
        row.setPromptLc(promptLc);
        row.setStatus(Constants.LivenessChallengeStatus.PENDING);
        row.setFramesCount(0);
        row.setCreatedAt(nowUtc);
        LivenessAttempt saved = repository.save(row);

        log.info("[LIVENESS] start user={} attempt={} type={}", userId, saved.getId(), type);
        return saved;
    }

    /**
     * Verifica los frames contra el vendor y aplica la regla del
     * challenge type. Transita la fila PENDING → PASSED / FAILED.
     *
     * <p>Fail-closed-soft (D5): si el provider lanza excepcion, la fila
     * pasa a PASSED con verdict {@code {"vendor_unavailable":true}} y
     * TTL corto.
     *
     * @param userId       user que autentica la peticion
     * @param challengeId  id de la fila creada por
     *                     {@link #startChallenge(Long)}
     * @param frames       frames JPEG en orden temporal (primero → ultimo)
     * @return la fila resultado con status ya terminal
     */
    @Transactional
    public LivenessAttempt verify(Long userId, Long challengeId, List<byte[]> frames) {
        if (userId == null || challengeId == null) {
            throw new IllegalArgumentException("userId and challengeId required");
        }
        LivenessAttempt row = repository.findById(challengeId)
                .orElseThrow(() -> new IllegalStateException("challenge_not_found"));
        if (!row.getUserId().equals(userId)) {
            throw new IllegalStateException("challenge_owner_mismatch");
        }
        if (!Constants.LivenessChallengeStatus.PENDING.equals(row.getStatus())) {
            throw new IllegalStateException("challenge_not_pending");
        }

        LocalDateTime nowUtc = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime deadline = row.getCreatedAt().plusSeconds(props.getPendingTtlSeconds());
        if (nowUtc.isAfter(deadline)) {
            row.setStatus(Constants.LivenessChallengeStatus.EXPIRED);
            row.setResolvedAt(nowUtc);
            return repository.save(row);
        }

        int required = props.getFramesRequired();
        if (frames == null || frames.size() < required) {
            row.setStatus(Constants.LivenessChallengeStatus.FAILED);
            row.setResolvedAt(nowUtc);
            row.setSightengineVerdict("{\"reason\":\"frames_insufficient\"}");
            row.setFramesCount(frames == null ? 0 : frames.size());
            log.info("[LIVENESS] fail user={} attempt={} reason=frames_insufficient count={}",
                    userId, challengeId, row.getFramesCount());
            return repository.save(row);
        }

        row.setFramesCount(frames.size());

        // Modo MOCK: kill-switch enabled=false → PASSED inmediato.
        if (!props.isEnabled()) {
            return closePass(row, nowUtc, "{\"mock\":true}", props.getTtlSeconds());
        }

        // Modo real: analizar cada frame con el provider. Si el provider
        // lanza excepcion → fail-closed-soft (D5).
        FaceAttributesResult[] results = new FaceAttributesResult[frames.size()];
        try {
            for (int i = 0; i < frames.size(); i++) {
                results[i] = provider.analyze(frames.get(i));
            }
        } catch (RuntimeException ex) {
            log.warn("[LIVENESS] vendor unavailable user={} attempt={}: {}",
                    userId, challengeId, ex.getMessage());
            return closePass(row, nowUtc,
                    "{\"vendor_unavailable\":true,\"error\":\"" + escape(ex.getMessage()) + "\"}",
                    props.getTtlVendorUnavailableSeconds());
        }

        int facesDetected = 0;
        StringBuilder rawJoined = new StringBuilder("[");
        for (int i = 0; i < results.length; i++) {
            if (results[i].isFaceDetected()) facesDetected++;
            if (i > 0) rawJoined.append(',');
            rawJoined.append(results[i].getRawJson());
        }
        rawJoined.append(']');

        // Umbral de deteccion de cara: PRESENCE requiere N-1; legacy
        // requeria N. Usamos la config de PRESENCE cuando aplique.
        int minFacesRequired = Constants.LivenessChallengeType.PRESENCE.equals(row.getChallengeType())
                ? props.getThresholds().getPresence().getMinFacesDetected()
                : results.length;
        if (facesDetected < minFacesRequired) {
            row.setStatus(Constants.LivenessChallengeStatus.FAILED);
            row.setResolvedAt(nowUtc);
            row.setSightengineVerdict("{\"reason\":\"face_detected_below_threshold\","
                    + "\"faces_detected\":" + facesDetected
                    + ",\"min_required\":" + minFacesRequired
                    + ",\"vendor_raw\":" + rawJoined + "}");
            log.info("[LIVENESS] fail user={} attempt={} reason=face_below_threshold faces={} required={}",
                    userId, challengeId, facesDetected, minFacesRequired);
            return repository.save(row);
        }

        boolean rulePassed = evaluate(row.getChallengeType(), results);
        String verdictJson = "{\"rule_passed\":" + rulePassed + ",\"vendor_raw\":" + rawJoined + "}";

        if (rulePassed) {
            return closePass(row, nowUtc, verdictJson, props.getTtlSeconds());
        }
        row.setStatus(Constants.LivenessChallengeStatus.FAILED);
        row.setResolvedAt(nowUtc);
        row.setSightengineVerdict(verdictJson);
        log.info("[LIVENESS] fail user={} attempt={} type={} rule_not_matched",
                userId, challengeId, row.getChallengeType());
        return repository.save(row);
    }

    private LivenessAttempt closePass(LivenessAttempt row, LocalDateTime nowUtc,
                                       String verdictJson, long ttlSeconds) {
        row.setStatus(Constants.LivenessChallengeStatus.PASSED);
        row.setResolvedAt(nowUtc);
        row.setPassedUntil(nowUtc.plusSeconds(ttlSeconds));
        row.setSightengineVerdict(verdictJson);
        LivenessAttempt saved = repository.save(row);
        log.info("[LIVENESS] pass user={} attempt={} type={} passedUntil={} ttl_s={}",
                row.getUserId(), row.getId(), row.getChallengeType(),
                row.getPassedUntil(), ttlSeconds);
        return saved;
    }

    /**
     * ADR-050 D4: reglas de verify por challenge type. Umbrales
     * inyectados desde {@link LivenessProperties.Thresholds}. Tras el
     * refactor 2026-07-13, el service emite solo {@code PRESENCE}; las
     * reglas legacy se conservan por si aparece una fila con tipo
     * antiguo (retrocompat).
     */
    private boolean evaluate(String challengeType, FaceAttributesResult[] frames) {
        LivenessProperties.Thresholds th = props.getThresholds();
        switch (challengeType) {
            case Constants.LivenessChallengeType.PRESENCE: {
                // ADR-050 D4 revisado + fix 2026-07-13: presence check via
                // landmarks. SightEngine face-attributes NO devuelve
                // smile/eyes_open/pose en el plan actual, pero SI devuelve
                // features (landmarks). Sumamos distancia euclidea entre
                // frames consecutivos de left_eye, right_eye y nose_tip.
                // Foto fija: todos los landmarks identicos → delta 0.
                // User real: micro-movement natural del orden 0.01-0.05
                // por landmark → supera el umbral 0.02 comodo.
                if (frames == null || frames.length < 2) return false;
                double totalDelta = 0.0;
                for (int i = 1; i < frames.length; i++) {
                    totalDelta += euclidean(
                            frames[i].getLeftEyeX() - frames[i - 1].getLeftEyeX(),
                            frames[i].getLeftEyeY() - frames[i - 1].getLeftEyeY());
                    totalDelta += euclidean(
                            frames[i].getRightEyeX() - frames[i - 1].getRightEyeX(),
                            frames[i].getRightEyeY() - frames[i - 1].getRightEyeY());
                    totalDelta += euclidean(
                            frames[i].getNoseTipX() - frames[i - 1].getNoseTipX(),
                            frames[i].getNoseTipY() - frames[i - 1].getNoseTipY());
                }
                return totalDelta >= th.getPresence().getMinLandmarkDelta();
            }
            case Constants.LivenessChallengeType.BLINK: {
                double maxClosed = 0.0;
                double minClosed = 1.0;
                for (FaceAttributesResult f : frames) {
                    if (f.getEyesClosed() > maxClosed) maxClosed = f.getEyesClosed();
                    if (f.getEyesClosed() < minClosed) minClosed = f.getEyesClosed();
                }
                return maxClosed >= th.getBlink().getMinEyesClosed()
                        && minClosed <= th.getBlink().getMaxEyesOpen();
            }
            case Constants.LivenessChallengeType.TURN_LEFT: {
                // Yaw negativo = giro a la izquierda (convencion SightEngine).
                double maxDiff = frames[frames.length - 1].getYaw() - frames[0].getYaw();
                return maxDiff <= -th.getTurn().getMinYawDiffDegrees();
            }
            case Constants.LivenessChallengeType.TURN_RIGHT: {
                double maxDiff = frames[frames.length - 1].getYaw() - frames[0].getYaw();
                return maxDiff >= th.getTurn().getMinYawDiffDegrees();
            }
            case Constants.LivenessChallengeType.SMILE: {
                double maxSmile = 0.0;
                double minSmile = 1.0;
                for (FaceAttributesResult f : frames) {
                    if (f.getSmile() > maxSmile) maxSmile = f.getSmile();
                    if (f.getSmile() < minSmile) minSmile = f.getSmile();
                }
                return maxSmile >= th.getSmile().getMinScore()
                        && minSmile <= th.getSmile().getMaxScoreNeutral();
            }
            default:
                return false;
        }
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static double euclidean(double dx, double dy) {
        return Math.sqrt(dx * dx + dy * dy);
    }
}
