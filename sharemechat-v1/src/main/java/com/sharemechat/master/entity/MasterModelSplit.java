package com.sharemechat.master.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ADR-056 D10: acuerdo interno Master ↔ modelo. Registra el % que el
 * Master pacta con cada modelo (opaco al motor de reparto plataforma).
 * Versionado por effective_from/effective_to para auditoria historica.
 *
 * <p>Uso:
 * <ul>
 *   <li>Dashboard reducido modelo: consulta el % vigente para saber cuanto
 *       le va a pagar el Master.</li>
 *   <li>Auditoria admin: reconstruccion de que % estaba pactado en fecha X
 *       si aparece reclamacion futura.</li>
 * </ul>
 *
 * <p><b>NO participa en el calculo del STREAM_EARNING</b> — el reparto
 * plataforma <-> Master usa el %model_share_pct de model_pricing_tiers
 * (regimen MASTER). El Master paga a la modelo off-platform segun este %
 * interno; SharemeChat no interviene.
 */
@Entity
@Table(name = "master_model_splits")
public class MasterModelSplit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "master_user_id", nullable = false)
    private Long masterUserId;

    @Column(name = "model_user_id", nullable = false)
    private Long modelUserId;

    @Column(name = "internal_share_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal internalSharePct;

    @Column(name = "effective_from", nullable = false)
    private LocalDateTime effectiveFrom;

    @Column(name = "effective_to")
    private LocalDateTime effectiveTo;

    @Column(name = "set_by_master_at", nullable = false)
    private LocalDateTime setByMasterAt;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    public MasterModelSplit() {}

    public Long getId() { return id; }

    public Long getMasterUserId() { return masterUserId; }
    public void setMasterUserId(Long masterUserId) { this.masterUserId = masterUserId; }

    public Long getModelUserId() { return modelUserId; }
    public void setModelUserId(Long modelUserId) { this.modelUserId = modelUserId; }

    public BigDecimal getInternalSharePct() { return internalSharePct; }
    public void setInternalSharePct(BigDecimal internalSharePct) { this.internalSharePct = internalSharePct; }

    public LocalDateTime getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(LocalDateTime effectiveFrom) { this.effectiveFrom = effectiveFrom; }

    public LocalDateTime getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(LocalDateTime effectiveTo) { this.effectiveTo = effectiveTo; }

    public LocalDateTime getSetByMasterAt() { return setByMasterAt; }
    public void setSetByMasterAt(LocalDateTime setByMasterAt) { this.setByMasterAt = setByMasterAt; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
