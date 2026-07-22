package com.sharemechat.streammoderation.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * ADR-037 frente trial-sfw Bloque 2 (Via 1): umbrales locales estrictos
 * que el {@code ModerationCategoryMapper} aplica sobre los scores crudos
 * de Sightengine cuando la sesion de moderacion es de tipo trial
 * ({@code stream_moderation_sessions.is_trial=true}).
 *
 * <p>Semantica de la Via 1: para trials NO delegamos a
 * {@code summary.action} del workflow del panel Sightengine (que esta
 * configurado permisivo para paid), sino que evaluamos localmente los
 * sub-scores mas relevantes de {@code nudity} y disparamos verdicts
 * mucho antes que el propio vendor. El objetivo es cortar automaticamente
 * y encolar review humana en la franja trial ante cualquier senyal de
 * contenido explicito, incluso si Sightengine no lo hubiese rechazado.
 *
 * <p>El bypass CRITICAL para MINORS/GORE del mapper es innegociable y
 * se aplica ANTES de esta logica trial (safety belt de ADR-037).
 *
 * <p>Mapea {@code moderation.thresholds.trial.*}. Valores por defecto
 * conservadores; ajustables sin redeploy via env vars con Spring relaxed
 * binding. Un umbral con valor 0 desactiva esa regla concreta.
 */
@Component
@ConfigurationProperties(prefix = "moderation.thresholds.trial")
public class ModerationTrialThresholdsProperties {

    /**
     * Score {@code nudity.sexual_activity} a partir del cual el mapper
     * marca la categoria NUDITY como CRITICAL y suggestedAction=CUT en
     * trials. Valor por defecto 0.30 (muy conservador; permite cortar
     * ante contenido claramente explicito).
     */
    private BigDecimal sexualActivityCritical = new BigDecimal("0.30");

    /**
     * Score {@code nudity.erotica} a partir del cual el mapper marca la
     * categoria NUDITY como RED y suggestedAction=ENQUEUE en trials
     * (revision humana urgente). Valor por defecto 0.40.
     */
    private BigDecimal eroticaRed = new BigDecimal("0.40");

    /**
     * Score {@code nudity.sexual_display} a partir del cual el mapper
     * marca la categoria NUDITY como AMBER y suggestedAction=ENQUEUE en
     * trials (revision humana en cola normal). Valor por defecto 0.50.
     */
    private BigDecimal sexualDisplayAmber = new BigDecimal("0.50");

    public BigDecimal getSexualActivityCritical() { return sexualActivityCritical; }
    public void setSexualActivityCritical(BigDecimal v) { this.sexualActivityCritical = v; }

    public BigDecimal getEroticaRed() { return eroticaRed; }
    public void setEroticaRed(BigDecimal v) { this.eroticaRed = v; }

    public BigDecimal getSexualDisplayAmber() { return sexualDisplayAmber; }
    public void setSexualDisplayAmber(BigDecimal v) { this.sexualDisplayAmber = v; }
}
