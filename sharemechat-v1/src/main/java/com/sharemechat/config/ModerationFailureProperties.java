package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuracion del modo de fallo fail-closed-soft del pipeline de
 * moderacion visual del streaming (ADR-036 bloque 3).
 *
 * <p>Mapea {@code moderation.failure.*} declarado en
 * {@code application.properties}. Spring relaxed binding mapea
 * {@code MODERATION_FAILURE_DEGRADED_THRESHOLD_MINUTES} y
 * {@code MODERATION_FAILURE_CUT_THRESHOLD_MINUTES} a los campos
 * correspondientes.
 *
 * <p>Semantica:
 * <ul>
 *   <li>{@link #degradedThresholdMinutes}: minutos de fallo continuado
 *       del vendor sobre una sesion para considerarla DEGRADED. Lo usara
 *       el adapter real (Sightengine en P2) cuando registre timeouts /
 *       errores repetidos.</li>
 *   <li>{@link #cutThresholdMinutes}: minutos en DEGRADED tras los que
 *       el {@code StreamModerationDegradationJob} corta la sesion via
 *       {@code streamService.killStreamAsAdmin}.</li>
 * </ul>
 */
@Component
@ConfigurationProperties(prefix = "moderation.failure")
public class ModerationFailureProperties {

    private int degradedThresholdMinutes = 2;
    private int cutThresholdMinutes = 5;

    public int getDegradedThresholdMinutes() {
        return degradedThresholdMinutes;
    }

    public void setDegradedThresholdMinutes(int degradedThresholdMinutes) {
        this.degradedThresholdMinutes = degradedThresholdMinutes;
    }

    public int getCutThresholdMinutes() {
        return cutThresholdMinutes;
    }

    public void setCutThresholdMinutes(int cutThresholdMinutes) {
        this.cutThresholdMinutes = cutThresholdMinutes;
    }
}
