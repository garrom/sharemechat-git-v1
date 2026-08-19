package com.sharemechat.repository;

import com.sharemechat.entity.ModelPresenceSample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Acceso a las muestras de presencia (Card 1, Fase 2).
 *
 * <p>La agregacion por (dia de la semana, hora) se hace en Java dentro de
 * {@code PresenceTelemetryService} sobre las muestras crudas de la ventana,
 * no en SQL: {@code sampled_at} ya se escribe en hora local Europe/Madrid
 * (ver {@code PresenceSampleJob}), asi que basta con leer {@code getHour()} /
 * {@code getDayOfWeek()} del propio timestamp. Mantener la agregacion en Java
 * la hace testeable con muestras sinteticas sin BD. El volumen en PRELAUNCH
 * es minimo; si crece, migrar a un GROUP BY nativo (safe: HOUR/WEEKDAY sobre
 * sampled_at dan directamente buckets Madrid).
 */
public interface ModelPresenceSampleRepository extends JpaRepository<ModelPresenceSample, Long> {

    /** Muestras de una modelo desde {@code from} (inclusive). Para el histograma de la card. */
    List<ModelPresenceSample> findByModelUserIdAndSampledAtGreaterThanEqual(Long modelUserId, LocalDateTime from);

    /** Todas las muestras desde {@code from} (inclusive). Para el heatmap agregado admin. */
    List<ModelPresenceSample> findBySampledAtGreaterThanEqual(LocalDateTime from);

    /** Prune de retencion: borra en bloque las muestras anteriores a {@code cutoff}. */
    @Modifying
    @Query("DELETE FROM ModelPresenceSample s WHERE s.sampledAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
