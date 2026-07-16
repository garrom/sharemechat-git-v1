package com.sharemechat.psp.repository;

import com.sharemechat.psp.entity.PspWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PspWebhookEventRepository extends JpaRepository<PspWebhookEvent, Long> {

    /**
     * ADR-051 D3: dedup del IPN. Bloquea la 2ª entrega del mismo
     * {@code (provider, provider_event_id)} a nivel de índice UNIQUE.
     */
    Optional<PspWebhookEvent> findByProviderAndProviderEventId(String provider, String providerEventId);

    /** Reconciliación por payment: listar todos los eventos recibidos de un pago. */
    List<PspWebhookEvent> findByProviderAndProviderPaymentIdOrderByReceivedAtDesc(
            String provider, String providerPaymentId);
}
