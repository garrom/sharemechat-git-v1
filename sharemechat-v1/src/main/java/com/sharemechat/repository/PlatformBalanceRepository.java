package com.sharemechat.repository;

import com.sharemechat.entity.PlatformBalance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlatformBalanceRepository extends JpaRepository<PlatformBalance, Long> {
    Optional<PlatformBalance> findTopByOrderByTimestampDesc();
}
