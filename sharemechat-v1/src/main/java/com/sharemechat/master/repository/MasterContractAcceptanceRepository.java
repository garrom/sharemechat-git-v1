package com.sharemechat.master.repository;

import com.sharemechat.master.entity.MasterContractAcceptance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * ADR-056 D6: repositorio del contrato Master. Simetrico a
 * ModelContractAcceptanceRepository. Unique constraint DB
 * uq_master_contract_user_version garantiza 1 aceptacion por
 * (user, version) — sirve para el check idempotente
 * MasterContractService.isAcceptedCurrent.
 */
public interface MasterContractAcceptanceRepository extends JpaRepository<MasterContractAcceptance, Long> {

    Optional<MasterContractAcceptance> findFirstByUserIdAndContractVersion(
            Long userId, String contractVersion);

    boolean existsByUserIdAndContractVersion(Long userId, String contractVersion);
}
