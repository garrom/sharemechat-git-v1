package com.sharemechat.payout.repository;

import com.sharemechat.payout.entity.PayoutMethod;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * ADR-056 S1: repositorio de metodos de payout. Consultas base para S6
 * (controller + servicio se añaden en esa fase).
 */
public interface PayoutMethodRepository extends JpaRepository<PayoutMethod, Long> {

    List<PayoutMethod> findAllByUserIdOrderByIdDesc(Long userId);

    /** Default vigente del user (solo uno esperado). */
    Optional<PayoutMethod> findFirstByUserIdAndIsDefaultTrue(Long userId);

    Optional<PayoutMethod> findByIdAndUserId(Long id, Long userId);
}
