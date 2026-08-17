package com.sharemechat.jobs;

import com.sharemechat.config.PresenceTelemetryProperties;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.service.PresenceTelemetryService;
import com.sharemechat.service.StatusService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Card 1 Fase 2: sampler de presencia de modelos.
 *
 * <p>Cada tick (cron {@code presence.telemetry.sample-cron}, default 10 min)
 * lee del set Redis {@code user:available} via
 * {@link StatusService#listAvailableModels()} (SMEMBERS, O(nº online), sin
 * escanear keyspace), filtra los que son modelo e inserta una muestra por
 * cada uno con el timestamp del tick en hora Europe/Madrid.
 *
 * <p>Read-only sobre Redis; solo INSERT/DELETE en {@code model_presence_samples}.
 * Cero impacto en el realtime. Kill-switch por
 * {@code presence.telemetry.enabled} (solo PROD): si {@code false}, no-op.
 * BUSY/facturacion no se muestrea aqui (se deriva de stream_records).
 */
@Component
public class PresenceSampleJob {

    private static final Logger log = LoggerFactory.getLogger(PresenceSampleJob.class);

    private final PresenceTelemetryProperties props;
    private final StatusService statusService;
    private final ModelRepository modelRepository;
    private final PresenceTelemetryService telemetryService;

    public PresenceSampleJob(PresenceTelemetryProperties props,
                             StatusService statusService,
                             ModelRepository modelRepository,
                             PresenceTelemetryService telemetryService) {
        this.props = props;
        this.statusService = statusService;
        this.modelRepository = modelRepository;
        this.telemetryService = telemetryService;
    }

    @Scheduled(cron = "${presence.telemetry.sample-cron:0 */10 * * * *}")
    public void sample() {
        if (!props.isEnabled()) return;
        try {
            Set<String> availableIds = statusService.listAvailableModels();
            if (availableIds == null || availableIds.isEmpty()) return;

            List<Long> parsed = availableIds.stream()
                    .map(PresenceSampleJob::parseLongOrNull)
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
            if (parsed.isEmpty()) return;

            List<Long> modelIds = modelRepository.filterModelUserIds(parsed);
            if (modelIds == null || modelIds.isEmpty()) return;

            int n = telemetryService.recordSamples(modelIds, telemetryService.nowInZone());
            log.debug("PresenceSampleJob: {} muestras de presencia insertadas", n);
        } catch (Exception e) {
            log.warn("PresenceSampleJob: error en el muestreo -> {}", e.getMessage());
        }
    }

    @Scheduled(cron = "${presence.telemetry.prune-cron:0 30 4 * * *}")
    public void prune() {
        if (!props.isEnabled()) return;
        try {
            int deleted = telemetryService.prune();
            if (deleted > 0) {
                log.info("PresenceSampleJob: prune retención, {} muestras borradas", deleted);
            }
        } catch (Exception e) {
            log.warn("PresenceSampleJob: error en el prune -> {}", e.getMessage());
        }
    }

    private static Long parseLongOrNull(String s) {
        if (s == null) return null;
        try {
            return Long.parseLong(s.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
