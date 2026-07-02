package com.sharemechat.support.repository;

import com.sharemechat.support.entity.SupportRateLimitDaily;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface SupportRateLimitDailyRepository
        extends JpaRepository<SupportRateLimitDaily, SupportRateLimitDaily.PK> {

    Optional<SupportRateLimitDaily> findByUserIdAndUsageDate(Long userId, LocalDate usageDate);
}
