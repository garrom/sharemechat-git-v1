package com.sharemechat.master.repository;

import com.sharemechat.master.entity.MasterModelSplit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * ADR-056 D10: repositorio del acuerdo interno Master ↔ modelo. Filas
 * vigentes = {@code effective_to IS NULL}.
 */
public interface MasterModelSplitRepository extends JpaRepository<MasterModelSplit, Long> {

    /** Split vigente del par (master, modelo). Solo debería haber uno. */
    Optional<MasterModelSplit> findFirstByMasterUserIdAndModelUserIdAndEffectiveToIsNullOrderByIdDesc(
            Long masterUserId, Long modelUserId);

    /** Todos los splits vigentes de un Master (para dashboard consolidado S3/S5). */
    List<MasterModelSplit> findAllByMasterUserIdAndEffectiveToIsNullOrderByIdDesc(Long masterUserId);

    /** Historia completa del par (audit trail). */
    List<MasterModelSplit> findAllByMasterUserIdAndModelUserIdOrderByIdDesc(
            Long masterUserId, Long modelUserId);
}
