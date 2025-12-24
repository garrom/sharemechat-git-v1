package com.sharemechat.repository;

import com.sharemechat.entity.StreamRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StreamRecordRepository extends JpaRepository<StreamRecord, Long> {

    // Sesión activa (sin end_time) por par cliente-modelo, la más reciente
    Optional<StreamRecord> findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(Long clientId, Long modelId);

    // (opcionales, útiles para diagnósticos)
    List<StreamRecord> findByClient_IdAndEndTimeIsNull(Long clientId);
    List<StreamRecord> findByModel_IdAndEndTimeIsNull(Long modelId);

    // Sesiones ya finalizadas de una modelo desde un instante concreto en adelante
    java.util.List<StreamRecord> findByModel_IdAndEndTimeIsNotNullAndEndTimeAfter(Long modelId, java.time.LocalDateTime since);

    @org.springframework.data.jpa.repository.Query("""
       SELECT COALESCE(SUM(FUNCTION('TIMESTAMPDIFF', SECOND, sr.startTime, sr.endTime)), 0)
       FROM StreamRecord sr
       WHERE sr.model.id = :modelId
         AND sr.endTime IS NOT NULL
         AND sr.endTime >= :since
         AND sr.endTime < :until
    """)
    Long sumPaidSecondsBetween(@org.springframework.data.repository.query.Param("modelId") Long modelId,
                               @org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since,
                               @org.springframework.data.repository.query.Param("until") java.time.LocalDateTime until);


}
