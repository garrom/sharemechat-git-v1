package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * ADR-050 Fase C: configuracion del check de presencia continua durante
 * streaming (face-analysis + face-presence de SightEngine).
 *
 * <p>Mapea {@code moderation.presence.*} declarado en
 * {@code application.properties}. Reutiliza credenciales SightEngine de
 * {@link SightengineProperties} (mismo apiUser + apiSecret, endpoint
 * distinto {@code /1.0/check.json?models=face-analysis,face-presence}).
 *
 * <p>Kill-switch por {@link #enabled}: cuando {@code false} el ingestor
 * salta silencioso el check de presencia (solo moderacion de contenido
 * sigue activa). En TEST arranca {@code false} para permitir despliegue
 * sin gastar ops del vendor; el operador activa via env var
 * {@code MODERATION_PRESENCE_ENABLED=true} tras verificar impacto.
 */
@Component
@ConfigurationProperties(prefix = "moderation.presence")
public class PresenceCheckProperties {

    private boolean enabled = false;

    /**
     * ADR-050 Fase C D3: umbral por encima del cual out-of-scene se
     * considera CRITICAL y dispara auto-cut. Rango [0, 1]. Default 0.5
     * (calibrable via env var
     * {@code MODERATION_PRESENCE_OUT_OF_SCENE_CRITICAL}).
     */
    private double outOfSceneCritical = 0.5;

    /**
     * ADR-050 Fase D: numero maximo de frames identicos consecutivos
     * tolerados antes de considerar el stream congelado. Default 2:
     * con cadencia 60s, tolera 1 frame identico normal (ligeras
     * variaciones de compresion JPEG del video real) y dispara al 2do
     * repetido consecutivo (~2 min de congelacion real).
     */
    private int frozenMaxConsecutive = 2;

    /**
     * ADR-050 Fase E (deuda #D-33): numero maximo de ticks consecutivos
     * SIN cara detectada por el vendor antes de auto-cortar la sesion.
     * Default 2: con cadencia 60s = ~2 min sin cara. Bajado de 3 a 2 el
     * 2026-07-15 tras feedback del operador (~3 min es UX inaceptable
     * para cliente pagando pay-per-second; a los 2 min ya llevaba 2
     * ciclos de facturacion sin persona real en la camara).
     * Calibrable via env MODERATION_PRESENCE_NO_FACE_MAX_CONSECUTIVE.
     */
    private int noFaceMaxConsecutive = 2;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public double getOutOfSceneCritical() { return outOfSceneCritical; }
    public void setOutOfSceneCritical(double outOfSceneCritical) {
        this.outOfSceneCritical = outOfSceneCritical;
    }

    public int getFrozenMaxConsecutive() { return frozenMaxConsecutive; }
    public void setFrozenMaxConsecutive(int frozenMaxConsecutive) {
        this.frozenMaxConsecutive = frozenMaxConsecutive;
    }

    public int getNoFaceMaxConsecutive() { return noFaceMaxConsecutive; }
    public void setNoFaceMaxConsecutive(int noFaceMaxConsecutive) {
        this.noFaceMaxConsecutive = noFaceMaxConsecutive;
    }
}
