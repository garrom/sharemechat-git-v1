package com.sharemechat.repository;

import com.sharemechat.entity.StreamStatusEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StreamStatusEventRepository extends JpaRepository<StreamStatusEvent, Long> {

    boolean existsByStreamRecordIdAndEventType(Long streamRecordId, String eventType);

    List<StreamStatusEvent> findByStreamRecordIdOrderByCreatedAtDesc(Long streamRecordId, Pageable pageable);
}
