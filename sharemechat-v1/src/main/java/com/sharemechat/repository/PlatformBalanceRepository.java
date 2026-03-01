package com.sharemechat.repository;

import com.sharemechat.entity.PlatformBalance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlatformBalanceRepository extends JpaRepository<PlatformBalance, Long> {

    Optional<PlatformBalance> findTopByOrderByTimestampDesc();
    Optional<PlatformBalance> findTopByOrderByTimestampDescIdDesc();
    // AÑADIR este metodo extra para lock de plataforma:
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query(
            value = "SELECT * FROM platform_balances WHERE id = (SELECT MAX(id) FROM platform_balances) FOR UPDATE",
            nativeQuery = true
    )
    Optional<PlatformBalance> findTopForUpdate();


}
