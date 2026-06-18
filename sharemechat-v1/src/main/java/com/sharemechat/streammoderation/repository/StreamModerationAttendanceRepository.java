package com.sharemechat.streammoderation.repository;

import com.sharemechat.streammoderation.entity.StreamModerationAttendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StreamModerationAttendanceRepository
        extends JpaRepository<StreamModerationAttendance, Long> {

    List<StreamModerationAttendance> findByStreamRecordIdOrderBySampledAtAsc(Long streamRecordId);
}
