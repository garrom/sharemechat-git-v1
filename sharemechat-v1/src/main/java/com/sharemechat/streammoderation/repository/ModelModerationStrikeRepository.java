package com.sharemechat.streammoderation.repository;

import com.sharemechat.streammoderation.entity.ModelModerationStrike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface ModelModerationStrikeRepository
        extends JpaRepository<ModelModerationStrike, Long> {

    /**
     * Idempotencia: UK (stream_moderation_session_id) impide duplicados
     * pero exponemos existsBy para short-circuit sin lanzar excepcion.
     */
    boolean existsByStreamModerationSessionId(Long streamModerationSessionId);

    /**
     * Contador de strikes activos (dentro de la ventana rodante de 30
     * dias por defecto) para calcular la escalada. Los strikes previos
     * al {@code since} siguen en la tabla pero no cuentan.
     */
    long countByModelUserIdAndCreatedAtGreaterThanEqual(Long modelUserId, LocalDateTime since);
}
