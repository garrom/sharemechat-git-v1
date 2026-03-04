package com.sharemechat.repository;

import com.sharemechat.entity.StreamRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query("""
       SELECT sr
       FROM StreamRecord sr
       JOIN FETCH sr.client c
       JOIN FETCH sr.model m
       WHERE sr.endTime IS NULL
         AND (:streamType IS NULL OR sr.streamType = :streamType)
         AND (:status IS NULL
              OR (:status = 'connecting' AND sr.confirmedAt IS NULL)
              OR (:status = 'active' AND sr.confirmedAt IS NOT NULL))
         AND (:minDurationSec IS NULL
              OR FUNCTION('TIMESTAMPDIFF', SECOND, sr.startTime, CURRENT_TIMESTAMP) >= :minDurationSec)
         AND (
              :q IS NULL
              OR (:qNumeric = true AND (:qId = c.id OR :qId = m.id))
              OR (:qNumeric = false AND (
                  LOWER(COALESCE(c.email, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(c.nickname, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(m.email, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(m.nickname, '')) LIKE LOWER(CONCAT('%', :q, '%'))
              ))
         )
       ORDER BY sr.startTime DESC
    """)
    List<StreamRecord> findActiveForAdmin(@Param("q") String q,
                                          @Param("qId") Long qId,
                                          @Param("qNumeric") boolean qNumeric,
                                          @Param("minDurationSec") Long minDurationSec,
                                          @Param("streamType") String streamType,
                                          @Param("status") String status,
                                          Pageable pageable);

    @Query("""
       SELECT sr
       FROM StreamRecord sr
       JOIN FETCH sr.client c
       JOIN FETCH sr.model m
       WHERE sr.id = :id
    """)
    Optional<StreamRecord> findAdminDetailById(@Param("id") Long id);

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
