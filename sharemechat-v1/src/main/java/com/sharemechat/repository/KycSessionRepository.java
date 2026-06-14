package com.sharemechat.repository;

import com.sharemechat.entity.KycSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KycSessionRepository extends JpaRepository<KycSession, Long> {

    Optional<KycSession> findByProviderAndProviderSessionId(String provider, String providerSessionId);

    Optional<KycSession> findTopByUserIdAndProviderOrderByIdDesc(Long userId, String provider);

    // V9 (frente Didit cliente): consultas que filtran por session_type para
    // distinguir sesiones MODEL vs CLIENT del mismo user.
    Optional<KycSession> findTopByUserIdAndSessionTypeAndKycStatusOrderByIdDesc(
            Long userId, String sessionType, String kycStatus);

    Optional<KycSession> findTopByUserIdAndSessionTypeOrderByIdDesc(
            Long userId, String sessionType);
}
