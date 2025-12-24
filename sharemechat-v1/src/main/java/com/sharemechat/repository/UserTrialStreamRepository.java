package com.sharemechat.repository;

import com.sharemechat.entity.UserTrialStream;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserTrialStreamRepository extends JpaRepository<UserTrialStream, Long> {

    // Sesión trial activa (sin end_time) para un viewer (USER) y una modelo concretos
    Optional<UserTrialStream> findTopByViewer_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(
            Long viewerId, Long modelId
    );

    // Cualquier sesión trial activa de ese viewer (da igual la modelo)
    Optional<UserTrialStream> findTopByViewer_IdAndEndTimeIsNullOrderByStartTimeDesc(Long viewerId);

    // Última sesión trial YA CERRADA de ese viewer (por end_time más reciente)
    Optional<UserTrialStream> findTopByViewer_IdAndEndTimeIsNotNullOrderByEndTimeDesc(Long viewerId);


    // Número de sesiones trial YA CERRADAS de ese viewer (para limitar a 3 slots)
    long countByViewer_IdAndEndTimeIsNotNull(Long viewerId);

    // Sesiones trial YA CERRADAS de una modelo en un rango de tiempo (para cómputo de minutos facturados)
    java.util.List<UserTrialStream> findByModel_IdAndEndTimeIsNotNullAndEndTimeAfter(Long modelId, java.time.LocalDateTime since);

    @org.springframework.data.jpa.repository.Query("""
       SELECT COALESCE(SUM(
         CASE
           WHEN uts.seconds IS NOT NULL THEN uts.seconds
           WHEN uts.endTime IS NOT NULL THEN FUNCTION('TIMESTAMPDIFF', SECOND, uts.startTime, uts.endTime)
           ELSE 0
         END
       ), 0)
       FROM UserTrialStream uts
       WHERE uts.model.id = :modelId
         AND uts.endTime IS NOT NULL
         AND uts.endTime >= :since
         AND uts.endTime < :until
    """)
    Long sumTrialSecondsBetween(@org.springframework.data.repository.query.Param("modelId") Long modelId,
                                @org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since,
                                @org.springframework.data.repository.query.Param("until") java.time.LocalDateTime until);


}
