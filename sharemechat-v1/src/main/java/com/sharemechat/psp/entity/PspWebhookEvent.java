package com.sharemechat.psp.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * ADR-051 D3: registro de webhook IPN recibido de un PSP. Idempotencia
 * por {@code UNIQUE(provider, provider_event_id)}. Se persiste SIEMPRE,
 * aceptado o rechazado por firma, para auditoría forense.
 *
 * <p>Calcado bit-a-bit de {@link com.sharemechat.entity.KycWebhookEvent}
 * (V1__baseline.sql:295). Diferencias:
 * <ul>
 *   <li>{@code provider_payment_id} en lugar de {@code provider_session_id}
 *       (mismo significado semántico; PSP habla de "payment", KYC habla
 *       de "session").</li>
 *   <li>Nueva columna {@code payment_status} snapshot del estado del
 *       pago al recibir el evento (waiting/confirming/finished/failed/
 *       expired/refunded/etc.). Facilita queries analíticas sin
 *       re-parsear {@code payload_json}.</li>
 * </ul>
 *
 * <p>Migración baseline: {@code V27__psp_webhook_events.sql}.
 */
@Entity
@Table(name = "psp_webhook_events",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_pwe_provider_event",
                        columnNames = {"provider", "provider_event_id"})
        },
        indexes = {
                @Index(name = "idx_pwe_provider_payment", columnList = "provider,provider_payment_id"),
                @Index(name = "idx_pwe_processed", columnList = "is_processed"),
                @Index(name = "idx_pwe_processed_received_at", columnList = "is_processed,received_at"),
                @Index(name = "idx_pwe_provider_received_at", columnList = "provider,received_at")
        }
)
public class PspWebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "provider", nullable = false, length = 30)
    private String provider;

    /**
     * ID de evento único emitido por el vendor. Si el vendor no envía uno
     * explícito, el orchestrator deriva SHA-256(rawBody) como sintético
     * (patrón {@code KycSessionService.processDiditWebhook:481-490}).
     */
    @Column(name = "provider_event_id", nullable = false, length = 150)
    private String providerEventId;

    @Column(name = "provider_payment_id", length = 100)
    private String providerPaymentId;

    @Column(name = "provider_event_type", length = 100)
    private String providerEventType;

    /** Snapshot del payment_status del vendor (waiting/confirming/finished/...). */
    @Column(name = "payment_status", length = 30)
    private String paymentStatus;

    @Column(name = "is_signature_valid", nullable = false)
    private boolean signatureValid = false;

    @Column(name = "is_processed", nullable = false)
    private boolean processed = false;

    @Column(name = "processing_error_message", length = 500)
    private String processingErrorMessage;

    @Column(name = "payload_json", nullable = false, columnDefinition = "LONGTEXT")
    private String payloadJson;

    @Column(name = "received_at", insertable = false, updatable = false)
    private LocalDateTime receivedAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    public Long getId() { return id; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getProviderEventId() { return providerEventId; }
    public void setProviderEventId(String providerEventId) { this.providerEventId = providerEventId; }

    public String getProviderPaymentId() { return providerPaymentId; }
    public void setProviderPaymentId(String providerPaymentId) { this.providerPaymentId = providerPaymentId; }

    public String getProviderEventType() { return providerEventType; }
    public void setProviderEventType(String providerEventType) { this.providerEventType = providerEventType; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public boolean isSignatureValid() { return signatureValid; }
    public void setSignatureValid(boolean signatureValid) { this.signatureValid = signatureValid; }

    public boolean isProcessed() { return processed; }
    public void setProcessed(boolean processed) { this.processed = processed; }

    public String getProcessingErrorMessage() { return processingErrorMessage; }
    public void setProcessingErrorMessage(String processingErrorMessage) { this.processingErrorMessage = processingErrorMessage; }

    public String getPayloadJson() { return payloadJson; }
    public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }

    public LocalDateTime getReceivedAt() { return receivedAt; }

    public LocalDateTime getProcessedAt() { return processedAt; }
    public void setProcessedAt(LocalDateTime processedAt) { this.processedAt = processedAt; }
}
