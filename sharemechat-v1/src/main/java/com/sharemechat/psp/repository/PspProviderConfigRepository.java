package com.sharemechat.psp.repository;

import com.sharemechat.psp.entity.PspProviderConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PspProviderConfigRepository extends JpaRepository<PspProviderConfig, Long> {

    Optional<PspProviderConfig> findByProviderKey(String providerKey);
}
