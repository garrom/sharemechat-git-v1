package com.sharemechat.streammoderation.repository;

import com.sharemechat.streammoderation.entity.StreamModerationSession;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
