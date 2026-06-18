package com.sharemechat.streammoderation.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Sesion de muestreo de moderacion sobre un stream activo (frente
 * moderacion IA; ver ADR-030, ADR-036, ADR-037).
 *
 * <p>1 fila por stream sometido a muestreo. La UK simple sobre
 * {@code stream_record_id} impone la regla 1:1 stream<->sesion para
 * P1.1. Si en P1.2 se descubre necesidad de multi-fila (re-arranque
 * de muestreo tras DEGRADED), se levanta con V11.
 *
 * <p>Estados (canonicos en
 * {@link com.sharemechat.constants.Constants.StreamModerationSessionStatus}):
 * ACTIVE, STOPPED, ERROR, DEGRADED. La transicion a DEGRADED implica
 * fijar {@code degradedSince} para el fail-closed-soft de ADR-036
 * bloque 3 (corte tras X minutos sostenidos).
 *
 * <p>Patron vendor-agnostic: la FK opaca a {@code stream_records}
 * (Long, no @ManyToOne) calca {@code KycSession}.
 */
@Entity
@Table(
        name = "stream_moderation_sessions",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_stream_moderation_sessions_stream",
                        columnNames = {"stream_record_id"}
                )
        }
)
public class StreamModerationSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "stream_record_id", nullable = false)
    private Long streamRecordId;

    @Column(name = "provider", nullable = false, length = 20)
    private String provider;

    @Column(name = "provider_session_id", length = 100)
    private String providerSessionId;

    @Column(name = "sampling_cadence_seconds", nullable = false)
    private int samplingCadenceSeconds = 15;

    @Column(name = "sampling_strategy", nullable = false, length = 20)
    private String samplingStrategy = "INTERVAL";

    @Column(name = "status", nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "started_at", insertable = false, updatable = false)
    private LocalDateTime startedAt;

    @Column(name = "stopped_at")
    private LocalDateTime stoppedAt;

    @Column(name = "frames_submitted", nullable = false)
    private int framesSubmitted = 0;

    @Column(name = "verdicts_received", nullable = false)
    private int verdictsReceived = 0;

    @Column(name = "degraded_since")
    private LocalDateTime degradedSince;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public Long getStreamRecordId() {
        return streamRecordId;
    }

    public void setStreamRecordId(Long streamRecordId) {
        this.streamRecordId = streamRecordId;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getProviderSessionId() {
        return providerSessionId;
    }

    public void setProviderSessionId(String providerSessionId) {
        this.providerSessionId = providerSessionId;
    }

    public int getSamplingCadenceSeconds() {
        return samplingCadenceSeconds;
    }

    public void setSamplingCadenceSeconds(int samplingCadenceSeconds) {
        this.samplingCadenceSeconds = samplingCadenceSeconds;
    }

    public String getSamplingStrategy() {
        return samplingStrategy;
    }

    public void setSamplingStrategy(String samplingStrategy) {
        this.samplingStrategy = samplingStrategy;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public LocalDateTime getStoppedAt() {
        return stoppedAt;
    }

    public void setStoppedAt(LocalDateTime stoppedAt) {
        this.stoppedAt = stoppedAt;
    }

    public int getFramesSubmitted() {
        return framesSubmitted;
    }

    public void setFramesSubmitted(int framesSubmitted) {
        this.framesSubmitted = framesSubmitted;
    }

    public int getVerdictsReceived() {
        return verdictsReceived;
    }

    public void setVerdictsReceived(int verdictsReceived) {
        this.verdictsReceived = verdictsReceived;
    }

    public LocalDateTime getDegradedSince() {
        return degradedSince;
    }

    public void setDegradedSince(LocalDateTime degradedSince) {
        this.degradedSince = degradedSince;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
