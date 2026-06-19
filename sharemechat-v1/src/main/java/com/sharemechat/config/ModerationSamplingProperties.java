package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuracion de la cadencia de muestreo del pipeline de moderacion
 * visual del streaming (ADR-036 bloque 2: 1 frame cada 10-15 segundos
 * configurable por entorno).
 *
 * <p>Mapea {@code moderation.sampling.*} declarado en
 * {@code application.properties}. Spring relaxed binding mapea
 * {@code MODERATION_SAMPLING_CADENCE_SECONDS} a
 * {@link #cadenceSeconds}.
 *
 * <p>El default 15 s alinea con la postura de ADR-036 para volumen
 * pre-launch. Entornos no productivos pueden subir el valor para
 * reducir coste durante validacion.
 */
@Component
@ConfigurationProperties(prefix = "moderation.sampling")
public class ModerationSamplingProperties {

    private int cadenceSeconds = 15;

    public int getCadenceSeconds() {
        return cadenceSeconds;
    }

    public void setCadenceSeconds(int cadenceSeconds) {
        this.cadenceSeconds = cadenceSeconds;
    }
}
