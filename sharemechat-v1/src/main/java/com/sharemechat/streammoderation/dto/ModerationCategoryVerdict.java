package com.sharemechat.streammoderation.dto;

import java.math.BigDecimal;

/**
 * Verdict normalizado de UNA categoria visual (NUDITY, WEAPONS, etc.)
 * sobre un frame. Forma parte de {@link ModerationVerdictResult}.
 *
 * <p>DTO interno del control plane, NO de transporte REST: sin
 * anotaciones Jackson ni validacion de entrada. Categorias canonicas
 * en {@link com.sharemechat.constants.Constants.StreamModerationCategory};
 * severidades canonicas en
 * {@link com.sharemechat.constants.Constants.StreamModerationSeverity}.
 *
 * <p>Ver ADR-036, ADR-037.
 */
public class ModerationCategoryVerdict {

    private String category;
    private BigDecimal score;
    private String severity;

    public ModerationCategoryVerdict() {
    }

    public ModerationCategoryVerdict(String category, BigDecimal score, String severity) {
        this.category = category;
        this.score = score;
        this.severity = severity;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public BigDecimal getScore() {
        return score;
    }

    public void setScore(BigDecimal score) {
        this.score = score;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }
}
