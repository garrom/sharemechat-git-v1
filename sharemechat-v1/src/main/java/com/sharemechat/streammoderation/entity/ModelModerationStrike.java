package com.sharemechat.streammoderation.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Strike acumulado por una modelo tras infraccion CRITICAL confirmada
 * por el pipeline de moderacion IA durante un stream trial (ADR-037
 * frente trial-sfw Bloque 3).
 *
 * <p>UK sobre {@code stream_moderation_session_id}: maximo 1 strike
 * por sesion, aunque aparezcan varios frames CRITICAL dentro del
 * mismo trial.
 *
 * <p>El contador de strikes activos por modelo se calcula desde este
 * historial con ventana rodante de 30 dias. Los strikes historicos
 * NO se borran nunca (auditoria + panel Bloque 4).
 */
@Entity
@Table(name = "model_moderation_strikes",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_model_moderation_strikes_session",
                columnNames = {"stream_moderation_session_id"}))
public class ModelModerationStrike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "model_user_id", nullable = false)
    private Long modelUserId;

    @Column(name = "stream_moderation_session_id", nullable = false)
    private Long streamModerationSessionId;

    @Column(name = "severity", nullable = false, length = 20)
    private String severity;

    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "is_trial", nullable = false)
    private boolean isTrial = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }

    public Long getModelUserId() { return modelUserId; }
    public void setModelUserId(Long modelUserId) { this.modelUserId = modelUserId; }

    public Long getStreamModerationSessionId() { return streamModerationSessionId; }
    public void setStreamModerationSessionId(Long streamModerationSessionId) { this.streamModerationSessionId = streamModerationSessionId; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public boolean isTrial() { return isTrial; }
    public void setTrial(boolean trial) { this.isTrial = trial; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
