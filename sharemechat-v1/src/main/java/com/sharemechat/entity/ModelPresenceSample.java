package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Muestra puntual de presencia de una modelo online (Card 1, Fase 2 —
 * telemetria observada). La escribe {@code PresenceSampleJob} en cada tick
 * leyendo el set Redis {@code user:available} via {@link
 * com.sharemechat.service.StatusService}: una fila por modelo AVAILABLE en
 * el instante del tick.
 *
 * <p>Alimenta el histograma "suele estar en linea" de la card y el heatmap
 * admin, agregando por (dia de la semana, hora) en zona Europe/Madrid. El
 * estado BUSY/facturacion NO se muestrea aqui (se deriva de
 * {@code stream_records}); {@code status} queda como AVAILABLE por ahora,
 * la columna se mantiene por si en el futuro se muestrea BUSY.
 *
 * <p>Tabla write-heavy pero de volumen bajo; retencion por prune diario
 * ({@code presence.telemetry.retention-days}).
 */
@Entity
@Table(name = "model_presence_samples")
public class ModelPresenceSample {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "model_user_id", nullable = false)
    private Long modelUserId;

    @Column(name = "status", nullable = false, length = 10)
    private String status;

    @Column(name = "sampled_at", nullable = false)
    private LocalDateTime sampledAt;

    public ModelPresenceSample() {
    }

    public ModelPresenceSample(Long modelUserId, String status, LocalDateTime sampledAt) {
        this.modelUserId = modelUserId;
        this.status = status;
        this.sampledAt = sampledAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getModelUserId() { return modelUserId; }
    public void setModelUserId(Long modelUserId) { this.modelUserId = modelUserId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getSampledAt() { return sampledAt; }
    public void setSampledAt(LocalDateTime sampledAt) { this.sampledAt = sampledAt; }
}
