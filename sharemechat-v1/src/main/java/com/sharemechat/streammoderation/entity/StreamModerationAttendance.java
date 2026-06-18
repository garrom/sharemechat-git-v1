package com.sharemechat.streammoderation.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Skeleton del attendance log de presencia de la modelo en camara
 * durante un stream activo. Pieza especifica del producto adult/
 * streaming (ADR-030): defensa anti-chargeback y trazabilidad
 * operativa de presencia real durante la sesion facturable.
 *
 * <p>En P1.1 se crea solo el schema; el muestreo real (cliente-side
 * o piggyback sobre el frame de moderacion visual segun decision
 * residual) se construye en Paquete 2 o 3 del frente.
 *
 * <p>{@code presenceScore} es nullable porque no todos los vendors
 * devuelven score de confianza de deteccion facial.
 *
 * <p>Ver ADR-030, ADR-036, ADR-037.
 */
@Entity
@Table(
        name = "stream_moderation_attendance",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_stream_moderation_attendance_provider_event",
                        columnNames = {"provider", "provider_event_id"}
                )
        }
)
public class StreamModerationAttendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "stream_record_id", nullable = false)
    private Long streamRecordId;

    @Column(name = "model_user_id", nullable = false)
    private Long modelUserId;

    @Column(name = "present", nullable = false)
    private boolean present;

    @Column(name = "presence_score", precision = 5, scale = 2)
    private BigDecimal presenceScore;

    @Column(name = "sampled_at", insertable = false, updatable = false)
    private LocalDateTime sampledAt;

    @Column(name = "provider", nullable = false, length = 20)
    private String provider;

    @Column(name = "provider_event_id", length = 150)
    private String providerEventId;

    public Long getId() {
        return id;
    }

    public Long getStreamRecordId() {
        return streamRecordId;
    }

    public void setStreamRecordId(Long streamRecordId) {
        this.streamRecordId = streamRecordId;
    }

    public Long getModelUserId() {
        return modelUserId;
    }

    public void setModelUserId(Long modelUserId) {
        this.modelUserId = modelUserId;
    }

    public boolean isPresent() {
        return present;
    }

    public void setPresent(boolean present) {
        this.present = present;
    }

    public BigDecimal getPresenceScore() {
        return presenceScore;
    }

    public void setPresenceScore(BigDecimal presenceScore) {
        this.presenceScore = presenceScore;
    }

    public LocalDateTime getSampledAt() {
        return sampledAt;
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
}
