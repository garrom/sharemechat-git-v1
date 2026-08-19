package com.sharemechat.service;

import com.sharemechat.config.PresenceTelemetryProperties;
import com.sharemechat.dto.ModelPublicProfileDTO.AvailabilityBucket;
import com.sharemechat.dto.PresenceHeatmapDTO;
import com.sharemechat.dto.PresenceHeatmapDTO.HeatBucket;
import com.sharemechat.entity.ModelPresenceSample;
import com.sharemechat.repository.ModelPresenceSampleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Card 1 Fase 2: agregacion de la telemetria de presencia.
 *
 * <p>Las muestras se sellan en hora local {@code Europe/Madrid} (ver
 * {@code PresenceSampleJob}), asi que el bucketing por (dia de la semana,
 * hora) es directo sobre {@code sampled_at} sin conversion de zona. La
 * agregacion vive en Java (no en SQL) para ser testeable con muestras
 * sinteticas; el volumen en PRELAUNCH es minimo.
 *
 * <p>Intensidad: normalizada 0-100 respecto a la casilla mas alta de la
 * rejilla (la franja mas frecuentada = 100, el resto en proporcion). Da el
 * contraste del histograma sin exponer conteos crudos en la card.
 */
@Service
public class PresenceTelemetryService {

    private final ModelPresenceSampleRepository repository;
    private final PresenceTelemetryProperties props;

    public PresenceTelemetryService(ModelPresenceSampleRepository repository,
                                    PresenceTelemetryProperties props) {
        this.repository = repository;
        this.props = props;
    }

    private ZoneId zone() {
        return ZoneId.of(props.getZone());
    }

    private LocalDateTime windowStart() {
        return LocalDateTime.now(zone()).minusWeeks(Math.max(1, props.getAggregationWeeks()));
    }

    // =====================================================================
    // Escritura (usado por PresenceSampleJob)
    // =====================================================================

    /** Inserta una muestra por modelo online, todas con el mismo timestamp del tick. */
    @Transactional
    public int recordSamples(List<Long> modelUserIds, LocalDateTime sampledAt) {
        if (modelUserIds == null || modelUserIds.isEmpty()) return 0;
        List<ModelPresenceSample> batch = new ArrayList<>(modelUserIds.size());
        for (Long id : modelUserIds) {
            if (id == null) continue;
            batch.add(new ModelPresenceSample(id, "AVAILABLE", sampledAt));
        }
        repository.saveAll(batch);
        return batch.size();
    }

    /** Prune de retencion: borra muestras anteriores a hoy - retentionDays. */
    @Transactional
    public int prune() {
        LocalDateTime cutoff = LocalDateTime.now(zone()).minusDays(Math.max(1, props.getRetentionDays()));
        return repository.deleteOlderThan(cutoff);
    }

    /** Instante actual en la zona de la telemetria (para sellar el tick). */
    public LocalDateTime nowInZone() {
        return LocalDateTime.now(zone());
    }

    // =====================================================================
    // Lectura: histograma de la card (por modelo)
    // =====================================================================

    /**
     * Buckets de disponibilidad de una modelo para la card. Lista vacia si
     * aun no hay muestras (PRELAUNCH) -> el frontend oculta la seccion.
     */
    @Transactional(readOnly = true)
    public List<AvailabilityBucket> availabilityForModel(Long modelUserId) {
        List<ModelPresenceSample> samples =
                repository.findByModelUserIdAndSampledAtGreaterThanEqual(modelUserId, windowStart());
        Map<DayHour, Integer> counts = countByDayHour(samples);
        if (counts.isEmpty()) return List.of();
        int max = counts.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        List<AvailabilityBucket> out = new ArrayList<>(counts.size());
        for (Map.Entry<DayHour, Integer> e : counts.entrySet()) {
            out.add(new AvailabilityBucket(e.getKey().dayOfWeek(), e.getKey().hour(),
                    intensity(e.getValue(), max)));
        }
        out.sort(Comparator.comparingInt(AvailabilityBucket::dayOfWeek)
                .thenComparingInt(AvailabilityBucket::hour));
        return out;
    }

    // =====================================================================
    // Lectura: heatmap admin
    // =====================================================================

    @Transactional(readOnly = true)
    public PresenceHeatmapDTO modelHeatmap(Long modelUserId) {
        List<ModelPresenceSample> samples =
                repository.findByModelUserIdAndSampledAtGreaterThanEqual(modelUserId, windowStart());
        return new PresenceHeatmapDTO("MODEL", modelUserId, props.getAggregationWeeks(),
                toHeatBuckets(countByDayHour(samples)));
    }

    @Transactional(readOnly = true)
    public PresenceHeatmapDTO platformHeatmap() {
        List<ModelPresenceSample> samples = repository.findBySampledAtGreaterThanEqual(windowStart());
        return new PresenceHeatmapDTO("PLATFORM", null, props.getAggregationWeeks(),
                toHeatBuckets(countByDayHour(samples)));
    }

    // =====================================================================
    // Nucleo de agregacion (package-private para tests unitarios)
    // =====================================================================

    /**
     * Cuenta muestras por (dia de la semana 1-7, hora 0-23) tomando
     * directamente {@code getDayOfWeek()}/{@code getHour()} del timestamp
     * (ya en hora local Europe/Madrid). Es el corazon testeable.
     */
    static Map<DayHour, Integer> countByDayHour(List<ModelPresenceSample> samples) {
        Map<DayHour, Integer> counts = new LinkedHashMap<>();
        if (samples == null) return counts;
        for (ModelPresenceSample s : samples) {
            LocalDateTime t = s.getSampledAt();
            if (t == null) continue;
            DayHour key = new DayHour(t.getDayOfWeek().getValue(), t.getHour());
            counts.merge(key, 1, Integer::sum);
        }
        return counts;
    }

    /** Normaliza a 0-100 respecto al maximo; nunca 0 para un bucket con muestras. */
    static int intensity(int count, int max) {
        if (max <= 0 || count <= 0) return 0;
        int v = (int) Math.round(100.0 * count / max);
        return Math.max(1, Math.min(100, v));
    }

    private static List<HeatBucket> toHeatBuckets(Map<DayHour, Integer> counts) {
        if (counts.isEmpty()) return List.of();
        int max = counts.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        List<HeatBucket> out = new ArrayList<>(counts.size());
        for (Map.Entry<DayHour, Integer> e : counts.entrySet()) {
            out.add(new HeatBucket(e.getKey().dayOfWeek(), e.getKey().hour(),
                    e.getValue(), intensity(e.getValue(), max)));
        }
        out.sort(Comparator.comparingInt(HeatBucket::dayOfWeek).thenComparingInt(HeatBucket::hour));
        return out;
    }

    /** Clave de bucket dia-de-semana (1=Lunes..7=Domingo) + hora (0-23). */
    record DayHour(int dayOfWeek, int hour) {}
}
