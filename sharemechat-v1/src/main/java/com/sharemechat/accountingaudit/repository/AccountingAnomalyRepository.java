package com.sharemechat.accountingaudit.repository;

import com.sharemechat.accountingaudit.entity.AccountingAnomaly;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountingAnomalyRepository extends JpaRepository<AccountingAnomaly, Long> {
}
