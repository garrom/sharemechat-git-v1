package com.sharemechat.repository;

import com.sharemechat.entity.ModelContractAcceptance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ModelContractAcceptanceRepository extends JpaRepository<ModelContractAcceptance, Long> {

    boolean existsByUserId(Long userId);

    boolean existsByUserIdAndContractVersion(Long userId, String contractVersion);

    Optional<ModelContractAcceptance> findByUserIdAndContractVersion(Long userId, String contractVersion);
}
