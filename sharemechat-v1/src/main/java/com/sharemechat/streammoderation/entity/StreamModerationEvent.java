package com.sharemechat.streammoderation.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Evento crudo del proveedor de moderacion (verdict sincrono o webhook
 * asincrono) sobre una {@link StreamModerationSession}. Calca el
 * patron {@code KycWebhookEvent} para reutilizar el patron de
 * idempotencia (provider, provider_event_id) y la persistencia de
 * payloads brutos para auditoria.
 *
 * <p>{@code isSignatureValid} es {@link Boolean} (no boolean) porque
 * solo aplica a eventos {@code WEBHOOK_RECEIVED}; para verdicts sync
 * queda NULL.
 *
 * <p>El nombre de la UK en {@code @UniqueConstraint} coincide
 * exactamente con el del DDL ({@code uk_stream_moderation_events_provider_event}),
 * evitando la divergencia observada en {@code KycWebhookEvent} entre
 * anotacion y schema real.
 *
 * <p>Ver ADR-030, ADR-036, ADR-037.
 */
@Entity
@Table(
        name = "stream_moderation_events",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_stream_moderation_events_provider_event",
                        columnNames = {"provider", "provider_event_id"}
                )
        }
)
public class StreamModerationEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "stream_moderation_session_id", nullable = false)
    private Long streamModerationSessionId;

    @Column(name = "provider", nullable = false, length = 20)
    private String provider;

    @Column(name = "provider_event_id", length = 150)
    private String providerEventId;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    @Column(name = "is_signature_valid")
    private Boolean signatureValid;

    @Column(name = "is_processed", nullable = false)
    private boolean processed = false;

    @Column(name = "processing_error_message", length = 500)
    private String processingError;

    @Lob
    @Column(name = "payload_json", nullable = false, columnDefinition = "LONGTEXT")
    private String payloadJson;

    @Column(name = "received_at", insertable = false, updatable = false)
    private LocalDateTime receivedAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    public Long getId() {
        return id;
    }

    public Long getStreamModerationSessionId() {
        return streamModerationSessionId;
    }

    public void setStreamModerationSessionId(Long streamModerationSessionId) {
        this.streamModerationSessionId = streamModerationSessionId;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getProviderEventId() {
        return providerEventId;
    }

    public void setProviderEventId(String providerEventId) {
        this.providerEventId = providerEventId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public Boolean getSignatureValid() {
        return signatureValid;
    }

    public void setSignatureValid(Boolean signatureValid) {
        this.signatureValid = signatureValid;
    }

    public boolean isProcessed() {
        return processed;
    }

    public void setProcessed(boolean processed) {
        this.processed = processed;
    }

    public String getProcessingError() {
        return processingError;
    }

    public void setProcessingError(String processingError) {
        this.processingError = processingError;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public void setPayloadJson(String payloadJson) {
        this.payloadJson = payloadJson;
    }

    public LocalDateTime getReceivedAt() {
        return receivedAt;
    }

    public LocalDateTime getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(LocalDateTime processedAt) {
        this.processedAt = processedAt;
    }
}
