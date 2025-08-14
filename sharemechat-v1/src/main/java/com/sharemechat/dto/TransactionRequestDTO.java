package com.sharemechat.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class TransactionRequestDTO {

    @NotNull
    @DecimalMin(value = "0.01", message = "El monto debe ser mayor a 0")
    private BigDecimal amount;

    // Ej: "INGRESO" (primer pago). Más adelante podremos usar "GASTO" para consumos.
    @NotNull
    private String operationType;

    private String description;

    // Campos opcionales para cuando integremos stream/gifts
    private Long streamRecordId; // opcional
    private Long giftId;         // opcional

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getOperationType() { return operationType; }
    public void setOperationType(String operationType) { this.operationType = operationType; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Long getStreamRecordId() { return streamRecordId; }
    public void setStreamRecordId(Long streamRecordId) { this.streamRecordId = streamRecordId; }

    public Long getGiftId() { return giftId; }
    public void setGiftId(Long giftId) { this.giftId = giftId; }
}
