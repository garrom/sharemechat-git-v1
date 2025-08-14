package com.sharemechat.repository;

import com.sharemechat.entity.Balance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BalanceRepository extends JpaRepository<Balance, Long> {

    Optional<Balance> findTopByUserIdOrderByTimestampDesc(Long userId);
}
