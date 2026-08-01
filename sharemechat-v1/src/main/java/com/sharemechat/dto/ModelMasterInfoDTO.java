package com.sharemechat.dto;

import java.math.BigDecimal;

/**
 * ADR-056 Opcion D (2026-08-01): info que la MODELO puede consultar
 * sobre su relacion con el Master. Expuesto por
 * {@code GET /api/models/me/master-info}. Sirve para renderizar el
 * banner de transparencia en su tab Facturacion + calcular la columna
 * "tu neto pactado" aplicando {@code internalSharePct} a cada
 * transaccion generada.
 *
 * <p>Si {@code hasMaster=false}, el resto de campos son null: la modelo
 * es individual y opera con el motor de tramos INDIVIDUAL directamente.
 *
 * <p>No expone datos personales del Master (email, docs KYC, etc), solo
 * el nombre visible (companyName || nickname) coherente con el
 * MasterInvitationInfoDTO que ve la modelo al activar la cuenta.
 */
public class ModelMasterInfoDTO {

    private boolean hasMaster;
    private String masterDisplayName;
    private BigDecimal internalSharePct;
    // Saldo INFORMATIVO acumulado a favor de la modelo bajo Master.
    // Se calcula sobre la vida completa: SUM(t.amount * internalSharePct/100)
    // para transactions con attributedModelUserId=modelo y operationType
    // en (STREAM_EARNING, GIFT_EARNING). NO es exigible a la plataforma
    // (el Master paga fuera), pero la modelo necesita verlo para saber
    // cuánto le debe su Master.
    private BigDecimal accumulatedNetPactado;

    public ModelMasterInfoDTO() {}

    public static ModelMasterInfoDTO empty() {
        ModelMasterInfoDTO d = new ModelMasterInfoDTO();
        d.hasMaster = false;
        return d;
    }

    public static ModelMasterInfoDTO of(String masterDisplayName,
                                        BigDecimal internalSharePct,
                                        BigDecimal accumulatedNetPactado) {
        ModelMasterInfoDTO d = new ModelMasterInfoDTO();
        d.hasMaster = true;
        d.masterDisplayName = masterDisplayName;
        d.internalSharePct = internalSharePct;
        d.accumulatedNetPactado = accumulatedNetPactado;
        return d;
    }

    public boolean isHasMaster() { return hasMaster; }
    public void setHasMaster(boolean hasMaster) { this.hasMaster = hasMaster; }

    public String getMasterDisplayName() { return masterDisplayName; }
    public void setMasterDisplayName(String masterDisplayName) { this.masterDisplayName = masterDisplayName; }

    public BigDecimal getInternalSharePct() { return internalSharePct; }
    public void setInternalSharePct(BigDecimal internalSharePct) { this.internalSharePct = internalSharePct; }

    public BigDecimal getAccumulatedNetPactado() { return accumulatedNetPactado; }
    public void setAccumulatedNetPactado(BigDecimal accumulatedNetPactado) { this.accumulatedNetPactado = accumulatedNetPactado; }
}
