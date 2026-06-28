package com.sharemechat.repository;

import com.sharemechat.entity.ComplaintAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ComplaintAuditLogRepository extends JpaRepository<ComplaintAuditLog, Long> {

    List<ComplaintAuditLog> findAllByComplaintIdOrderByCreatedAtAsc(Long complaintId);
}
