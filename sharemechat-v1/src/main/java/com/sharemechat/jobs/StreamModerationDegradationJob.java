package com.sharemechat.jobs;

import com.sharemechat.config.ModerationFailureProperties;
import com.sharemechat.streammoderation.service.StreamModerationSessionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job periodico que materializa el fail-closed-soft del frente
 * Moderacion IA (ADR-036 bloque 3): cada minuto identifica sesiones
 * de moderacion en estado DEGRADED cuyo {@code degraded_since}
 * supera {@code moderation.failure.cut-threshold-minutes} y las
 * corta via {@code streamService.killStreamAsAdmin}.
 *
 * <p>Cadencia 1 minuto (cron "0 * * * * *"). Granularidad esperada
 * del corte real: entre {@code cutThresholdMinutes} y
 * {@code cutThresholdMinutes+1} minutos tras la degradacion.
 *
 * <p>Log informativo solo si se corto alguna sesion: evita ruido cada
 * minuto en el log cuando no hay nada que cortar.
 */
@Component
public class StreamModerationDegradationJob {

    private static final Logger log = LoggerFactory.getLogger(StreamModerationDegradationJob.class);

    private final StreamModerationSessionService sessionService;
    private final ModerationFailureProperties failureProperties;

    public StreamModerationDegradationJob(StreamModerationSessionService sessionService,
                                          ModerationFailureProperties failureProperties) {
        this.sessionService = sessionService;
        this.failureProperties = failureProperties;
    }

    @Scheduled(cron = "0 * * * * *")
    public void cutDegradedSessions() {
        int cut = sessionService.cutDegradedSessions(failureProperties.getCutThresholdMinutes());
        if (cut > 0) {
            log.info("StreamModerationDegradationJob: cortadas {} sesiones degradadas", cut);
        }
    }
}
