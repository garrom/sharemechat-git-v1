package com.sharemechat.repository;

import com.sharemechat.entity.ModelKycSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ModelKycSessionRepository extends JpaRepository<ModelKycSession, Long> {

    Optional<ModelKycSession> findByProviderAndProviderSessionId(String provider, String providerSessionId);

    Optional<ModelKycSession> findTopByUserIdAndProviderOrderByIdDesc(Long userId, String provider);
}