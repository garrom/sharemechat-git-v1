package com.sharemechat.support.repository;

import com.sharemechat.support.entity.BackofficeAgentProfileGrant;
import com.sharemechat.support.entity.BackofficeAgentProfileGrantId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BackofficeAgentProfileGrantRepository
        extends JpaRepository<BackofficeAgentProfileGrant, BackofficeAgentProfileGrantId> {

    Optional<BackofficeAgentProfileGrant> findByUserIdAndProfileId(Long userId, Long profileId);

    List<BackofficeAgentProfileGrant> findAllByUserIdAndActiveTrue(Long userId);

    List<BackofficeAgentProfileGrant> findAllByProfileIdAndActiveTrue(Long profileId);

    // Frente B.3.2 (ADR-046): listado admin de todos los grants (activos e
    // inactivos) de una profile para poder auditar quién estuvo con acceso y
    // cuándo se revoco. Ordenados por granted_at DESC para que los mas recientes
    // aparezcan primero.
    List<BackofficeAgentProfileGrant> findAllByProfileIdOrderByGrantedAtDesc(Long profileId);
}
