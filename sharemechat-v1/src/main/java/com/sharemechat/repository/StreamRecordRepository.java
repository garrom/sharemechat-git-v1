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
}
