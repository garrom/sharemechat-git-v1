package com.sharemechat.repository;

import com.sharemechat.entity.KycWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KycWebhookEventRepository extends JpaRepository<KycWebhookEvent, Long> {

    Optional<KycWebhookEvent> findByProviderAndProviderEventId(String provider, String providerEventId);
}
