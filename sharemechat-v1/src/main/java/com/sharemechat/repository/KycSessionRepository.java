package com.sharemechat.repository;

import com.sharemechat.entity.KycSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KycSessionRepository extends JpaRepository<KycSession, Long> {

    Optional<KycSession> findByProviderAndProviderSessionId(String provider, String providerSessionId);

    Optional<KycSession> findTopByUserIdAndProviderOrderByIdDesc(Long userId, String provider);
}
