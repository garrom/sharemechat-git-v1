package com.sharemechat.dto;

import java.math.BigDecimal;

public class ModelTeaserDTO {

    private Long modelId;
    private String modelName;
    private String avatarUrl;
    private String videoUrl;
    // ADR-052 Superficie 2 (2026-07-25): precio autoservicio elegido por
    // la modelo (users.chosen_rate_eur_per_min). Visible en la tarjeta
    // del cliente para que sepa el ritmo de consumo antes de iniciar
    // sesión. Rango de valores posibles: 1-9 EUR/min según tramo.
    private BigDecimal chosenRateEurPerMin;

    public ModelTeaserDTO(Long modelId, String modelName, String avatarUrl, String videoUrl,
                           BigDecimal chosenRateEurPerMin) {
        this.modelId = modelId;
        this.modelName = modelName;
        this.avatarUrl = avatarUrl;
        this.videoUrl = videoUrl;
        this.chosenRateEurPerMin = chosenRateEurPerMin;
    }

    public Long getModelId() {
        return modelId;
    }

    public String getModelName() {
        return modelName;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public String getVideoUrl() {
        return videoUrl;
    }

    public BigDecimal getChosenRateEurPerMin() {
        return chosenRateEurPerMin;
    }
}
