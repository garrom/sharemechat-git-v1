package com.sharemechat.accountingaudit.repository;

import com.sharemechat.accountingaudit.entity.AuditRun;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditRunRepository extends JpaRepository<AuditRun, Long> {
}
