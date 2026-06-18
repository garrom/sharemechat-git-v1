package com.sharemechat.streammoderation.repository;

import com.sharemechat.streammoderation.entity.StreamModerationProviderConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StreamModerationProviderConfigRepository
        extends JpaRepository<StreamModerationProviderConfig, Long> {

    Optional<StreamModerationProviderConfig> findByProviderKey(String providerKey);
}
