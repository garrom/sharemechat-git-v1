package com.sharemechat.streammoderation.repository;

import com.sharemechat.streammoderation.entity.StreamModerationSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface StreamModerationSessionRepository
        extends JpaRepository<StreamModerationSession, Long> {

    Optional<StreamModerationSession> findByStreamRecordId(Long streamRecordId);

    List<StreamModerationSession> findByStatus(String status);

    /**
     * Sesiones que entraron en estado DEGRADED antes de un instante de
     * corte. Usado por el job de fail-closed-soft (ADR-036 bloque 3)
     * para identificar sesiones que han superado el threshold X de
     * minutos en degradacion continua y deben cortarse.
     */
    List<StreamModerationSession> findByStatusAndDegradedSinceBefore(
            String status, LocalDateTime cutoff);

    /**
     * ADR-037 Fase 5 Bloque 5: incremento atomico del contador de
     * operations Sightengine consumidas por esta sesion. Se usa desde
     * {@code StreamFrameIngestionService.processFrameSync} tras cada
     * llamada al vendor. UPDATE en vez de save() para no pisar writes
     * concurrentes que otros checks (frozen, no-face) hacen sobre la
     * misma sesion en el mismo metodo.
     */
    @Modifying
    @Transactional
    @Query("UPDATE StreamModerationSession s SET s.operationsConsumed = s.operationsConsumed + :delta WHERE s.id = :id")
    int incrementOperationsConsumed(@Param("id") Long id, @Param("delta") long delta);

    /**
     * ADR-037 Fase 5 Bloque 5 - Paso 2: suma agregada de operations
     * Sightengine consumidas desde un instante. Se usa desde
     * {@code ModerationUsageService} para calcular consumo mensual y
     * diario contra el cupo del plan del vendor.
     */
    @Query("SELECT COALESCE(SUM(s.operationsConsumed), 0) FROM StreamModerationSession s WHERE s.createdAt >= :since")
    long sumOperationsConsumedSince(@Param("since") LocalDateTime since);
}
