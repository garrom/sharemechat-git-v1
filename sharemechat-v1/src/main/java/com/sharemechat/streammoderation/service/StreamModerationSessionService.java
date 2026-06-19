package com.sharemechat.streammoderation.service;

import com.sharemechat.config.ModerationFailureProperties;
import com.sharemechat.config.ModerationSamplingProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.service.StreamService;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Orquestador de sesiones de moderacion visual sobre streams activos
 * (frente Moderacion IA; ADR-030 / ADR-036 / ADR-037).
 *
 * <p>Responsable de:
 * <ul>
 *   <li>{@link #startForStream(Long)} — invocado por el hook de
 *       {@code StreamService.ackMedia} cuando el stream queda
 *       confirmado por doble ACK. Idempotente sobre la UK
 *       {@code (stream_record_id)}.</li>
 *   <li>{@link #stopForStream(Long, String)} — invocado por el hook de
 *       {@code StreamService.endSession}. Idempotente.</li>
 *   <li>{@link #markDegraded(Long)} — sera invocado por el adapter
 *       real (Sightengine, P2) cuando registre fallo continuado del
 *       vendor. Sin caller en P1.2: la API queda lista.</li>
 *   <li>{@link #cutDegradedSessions(int)} — invocado por
 *       {@code StreamModerationDegradationJob} cada minuto, materializa
 *       fail-closed-soft de ADR-036 bloque 3.</li>
 *   <li>{@link #resolveActiveClient()} — selecciona el adapter activo
 *       segun {@code active_mode} persistido.</li>
 * </ul>
 *
 * <p>Inyeccion del adapter MOCK directa: en P1.2 es el unico
 * implementador de {@link ModerationProviderClient} y resuelve sin
 * ambiguedad de tipo. En P2 cuando se sume el SightengineModerationClient
 * (segundo bean del mismo tipo), la inyeccion pasara a hacerse por
 * {@code @Qualifier} (el MOCK ya tiene su {@code @Qualifier("MOCK")}
 * declarado) y el switch de {@link #resolveActiveClient()} se ampliara
 * con el case SIGHTENGINE.
 *
 * <p>Ciclo Spring: {@code StreamService} depende de este servicio
 * (hooks de ackMedia/endSession) y este servicio depende de
 * {@code StreamService} ({@link #cutDegradedSessions(int)}). El ciclo
 * se rompe con {@code @Lazy} en el parametro {@code streamService}
 * del constructor; el otro lado (campo de StreamService) NO se anota
 * {@code @Lazy} para no propagar el lazy a otros consumidores de
 * StreamService.
 */
@Service
public class StreamModerationSessionService {

    private static final Logger log = LoggerFactory.getLogger(StreamModerationSessionService.class);

    private final StreamModerationSessionRepository sessionRepository;
    private final StreamModerationProviderConfigService providerConfigService;
    private final ModerationSamplingProperties samplingProperties;
    private final ModerationFailureProperties failureProperties;
    private final MockModerationClient mockClient;
    private final StreamService streamService;

    public StreamModerationSessionService(
            StreamModerationSessionRepository sessionRepository,
            StreamModerationProviderConfigService providerConfigService,
            ModerationSamplingProperties samplingProperties,
            ModerationFailureProperties failureProperties,
            MockModerationClient mockClient,
            @Lazy StreamService streamService) {
        this.sessionRepository = sessionRepository;
        this.providerConfigService = providerConfigService;
        this.samplingProperties = samplingProperties;
        this.failureProperties = failureProperties;
        this.mockClient = mockClient;
        this.streamService = streamService;
    }

    /**
     * Idempotente sobre UK {@code (stream_record_id)}: si ya existe
     * sesion para ese stream, devuelve la existente sin crear
     * duplicado. Si no existe, crea ACTIVE con
     * {@code provider=activeMode}, cadencia de
     * {@code samplingProperties.cadenceSeconds} y estrategia INTERVAL.
     */
    @Transactional
    public StreamModerationSession startForStream(Long streamRecordId) {
        Optional<StreamModerationSession> existing = sessionRepository.findByStreamRecordId(streamRecordId);
        if (existing.isPresent()) {
            log.info("[STREAM-MOD] session reuse streamRecordId={} sessionId={} status={}",
                    streamRecordId, existing.get().getId(), existing.get().getStatus());
            return existing.get();
        }
        StreamModerationSession s = new StreamModerationSession();
        s.setStreamRecordId(streamRecordId);
        s.setProvider(providerConfigService.getActiveMode());
        s.setStatus(Constants.StreamModerationSessionStatus.ACTIVE);
        s.setSamplingCadenceSeconds(samplingProperties.getCadenceSeconds());
        s.setSamplingStrategy(Constants.StreamModerationSamplingStrategy.INTERVAL);
        StreamModerationSession saved = sessionRepository.save(s);
        log.info("[STREAM-MOD] session started streamRecordId={} provider={} cadence={}s sessionId={}",
                streamRecordId, saved.getProvider(), saved.getSamplingCadenceSeconds(), saved.getId());
        return saved;
    }

    /**
     * Marca la sesion existente como STOPPED. Idempotente: si ya esta
     * STOPPED, no-op. Si no existe sesion (stream sin moderacion
     * activa por cualquier razon), no-op.
     */
    @Transactional
    public void stopForStream(Long streamRecordId, String reason) {
        Optional<StreamModerationSession> opt = sessionRepository.findByStreamRecordId(streamRecordId);
        if (opt.isEmpty()) {
            return;
        }
        StreamModerationSession s = opt.get();
        if (Constants.StreamModerationSessionStatus.STOPPED.equals(s.getStatus())) {
            return;
        }
        s.setStatus(Constants.StreamModerationSessionStatus.STOPPED);
        s.setStoppedAt(LocalDateTime.now());
        sessionRepository.save(s);
        log.info("[STREAM-MOD] session stopped streamRecordId={} sessionId={} reason={}",
                streamRecordId, s.getId(), reason);
    }

    /**
     * Marca la sesion como DEGRADED y fija {@code degraded_since=now()}
     * si no estaba ya. Sera invocado por el adapter real (Sightengine,
     * P2) cuando registre fallo continuado del vendor. Sin caller en
     * P1.2.
     */
    @Transactional
    public void markDegraded(Long streamModerationSessionId) {
        Optional<StreamModerationSession> opt = sessionRepository.findById(streamModerationSessionId);
        if (opt.isEmpty()) {
            return;
        }
        StreamModerationSession s = opt.get();
        if (Constants.StreamModerationSessionStatus.DEGRADED.equals(s.getStatus())) {
            return;
        }
        s.setStatus(Constants.StreamModerationSessionStatus.DEGRADED);
        if (s.getDegradedSince() == null) {
            s.setDegradedSince(LocalDateTime.now());
        }
        sessionRepository.save(s);
        log.warn("[STREAM-MOD] session degraded sessionId={} provider={}", s.getId(), s.getProvider());
    }

    /**
     * Fail-closed-soft de ADR-036 bloque 3: para cada sesion DEGRADED
     * con {@code degraded_since} anterior al cutoff, invoca
     * {@code streamService.killStreamAsAdmin}, que internamente llama
     * a {@code endSession}, que dispara el hook
     * {@link #stopForStream(Long, String)} y marca la sesion como
     * STOPPED. Try/catch por sesion para no detener el bucle si una
     * falla.
     *
     * <p>Granularidad: el job dispara cada minuto, asi que el corte
     * real ocurre entre cutThresholdMinutes y cutThresholdMinutes+1
     * tras la degradacion. Aceptable para fail-closed-soft.
     *
     * @return numero de sesiones efectivamente cortadas en esta
     *         pasada (sin contar las que fallaron).
     */
    @Transactional
    public int cutDegradedSessions(int cutThresholdMinutes) {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(cutThresholdMinutes);
        List<StreamModerationSession> stale = sessionRepository
                .findByStatusAndDegradedSinceBefore(
                        Constants.StreamModerationSessionStatus.DEGRADED, cutoff);
        int cut = 0;
        for (StreamModerationSession s : stale) {
            try {
                streamService.killStreamAsAdmin(
                        s.getStreamRecordId(),
                        "MODERATION_DEGRADED_CUT:" + s.getProvider());
                cut++;
            } catch (Exception ex) {
                log.warn("[STREAM-MOD] no se pudo cortar sesion degradada streamRecordId={} sessionId={}: {}",
                        s.getStreamRecordId(), s.getId(), ex.getMessage());
            }
        }
        if (cut > 0) {
            log.info("[STREAM-MOD] cortadas {} sesiones degradadas (cutThreshold={} min)",
                    cut, cutThresholdMinutes);
        }
        return cut;
    }

    /**
     * Devuelve la sesion en estado ACTIVE o DEGRADED para el stream.
     * Filtra STOPPED/ERROR como ausencia de sesion utilizable.
     */
    @Transactional(readOnly = true)
    public Optional<StreamModerationSession> getActiveSession(Long streamRecordId) {
        return sessionRepository.findByStreamRecordId(streamRecordId)
                .filter(s -> Constants.StreamModerationSessionStatus.ACTIVE.equals(s.getStatus())
                        || Constants.StreamModerationSessionStatus.DEGRADED.equals(s.getStatus()));
    }

    /**
     * Resuelve el adapter activo segun {@code active_mode} persistido
     * en {@code stream_moderation_provider_config}.
     *
     * <p>El switch refleja la seleccion del unico vendor activo segun
     * {@code active_mode}. NO hay convivencia productiva entre
     * vendors (ADR-035 / ADR-037: Plan A + contingencias documentadas).
     * Para anyadir un nuevo adapter en el futuro, se anyade un
     * {@code case} que reemplaza al anterior cuando {@code active_mode}
     * cambia. El {@code default} cae a MOCK como fail-safe para
     * proteger la operativa si la fila de config queda con un valor
     * desconocido.
     */
    ModerationProviderClient resolveActiveClient() {
        String mode = providerConfigService.getActiveMode();
        switch (mode) {
            case Constants.StreamModerationProvider.MOCK:
                return mockClient;
            // case Constants.StreamModerationProvider.SIGHTENGINE:
            //     return sightengineClient;  // P2
            default:
                log.warn("[STREAM-MOD] active_mode='{}' no soportado todavia; fallback a MOCK", mode);
                return mockClient;
        }
    }
}
