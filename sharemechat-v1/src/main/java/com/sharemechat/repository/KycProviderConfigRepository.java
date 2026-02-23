package com.sharemechat.repository;

import com.sharemechat.entity.KycProviderConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KycProviderConfigRepository extends JpaRepository<KycProviderConfig, Long> {
    Optional<KycProviderConfig> findByProviderKey(String providerKey);
}