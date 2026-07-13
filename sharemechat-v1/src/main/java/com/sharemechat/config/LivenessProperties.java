package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * ADR-050 Fase B: configuracion del liveness challenge (anti-fraude
 * camara Nivel 2).
 *
 * <p>Mapea {@code moderation.liveness.*} declarado en
 * {@code application.properties}. Reutiliza credenciales del vendor via
 * {@link SightengineProperties}; aqui solo van los parametros de la
 * politica de liveness (TTL del pass, rate limit, umbrales por challenge
 * type).
 *
 * <p>Kill-switch por {@link #enabled}: cuando {@code false} el service
 * degenera a modo MOCK (PASSED inmediato con verdict {@code {"mock":true}}),
 * util para dev local y AUDIT sin credenciales reales. En TEST arranca
 * {@code false} para iteracion; en PROD se activa cuando el operador cierre
 * calibracion D4.
 */
@Component
@ConfigurationProperties(prefix = "moderation.liveness")
public class LivenessProperties {

    private boolean enabled = false;
    /** ADR-050 D3: TTL del pass en segundos. 86400 = 24h. */
    private long ttlSeconds = 86_400L;
    /** ADR-050 D5 fail-closed-soft: TTL corto cuando SightEngine cae. */
    private long ttlVendorUnavailableSeconds = 300L;
    /** ADR-050 D6: max FAILED en 24h antes de cooldown. */
    private int maxFailedAttemptsPerDay = 3;
    /** ADR-050 D6: cooldown en segundos tras alcanzar max fails. */
    private long cooldownSeconds = 300L;
    /** Numero de frames enviados por verify. */
    private int framesRequired = 3;
    /** Deadline para completar verify tras startChallenge (segundos). */
    private long pendingTtlSeconds = 120L;
    /** ADR-050 D10: dias antes de purga. */
    private int retentionDays = 90;

    private final Thresholds thresholds = new Thresholds();

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public long getTtlSeconds() { return ttlSeconds; }
    public void setTtlSeconds(long ttlSeconds) { this.ttlSeconds = ttlSeconds; }

    public long getTtlVendorUnavailableSeconds() { return ttlVendorUnavailableSeconds; }
    public void setTtlVendorUnavailableSeconds(long ttlVendorUnavailableSeconds) {
        this.ttlVendorUnavailableSeconds = ttlVendorUnavailableSeconds;
    }

    public int getMaxFailedAttemptsPerDay() { return maxFailedAttemptsPerDay; }
    public void setMaxFailedAttemptsPerDay(int maxFailedAttemptsPerDay) {
        this.maxFailedAttemptsPerDay = maxFailedAttemptsPerDay;
    }

    public long getCooldownSeconds() { return cooldownSeconds; }
    public void setCooldownSeconds(long cooldownSeconds) { this.cooldownSeconds = cooldownSeconds; }

    public int getFramesRequired() { return framesRequired; }
    public void setFramesRequired(int framesRequired) { this.framesRequired = framesRequired; }

    public long getPendingTtlSeconds() { return pendingTtlSeconds; }
    public void setPendingTtlSeconds(long pendingTtlSeconds) {
        this.pendingTtlSeconds = pendingTtlSeconds;
    }

    public int getRetentionDays() { return retentionDays; }
    public void setRetentionDays(int retentionDays) { this.retentionDays = retentionDays; }

    public Thresholds getThresholds() { return thresholds; }

    /**
     * ADR-050 D4: umbrales para las reglas de verify de cada challenge
     * type. Ajustables via env var {@code MODERATION_LIVENESS_THRESHOLDS_*}
     * (Spring relaxed binding).
     */
    public static class Thresholds {
        private final Blink blink = new Blink();
        private final Turn turn = new Turn();
        private final Smile smile = new Smile();
        private final Presence presence = new Presence();

        public Blink getBlink() { return blink; }
        public Turn getTurn() { return turn; }
        public Smile getSmile() { return smile; }
        public Presence getPresence() { return presence; }

        /**
         * ADR-050 D4 revisado 2026-07-13: umbrales del presence check
         * simple. Reemplaza los umbrales gesture-specific en el flujo
         * activo del service (los otros quedan por compat/futuro).
         */
        public static class Presence {
            /**
             * Suma minima de distancias euclideas entre landmarks
             * consecutivos (left_eye, right_eye, nose_tip) para
             * considerar que hay micro-movement humano.
             *
             * <p>SightEngine devuelve las coordenadas en [0, 1]
             * normalizadas por frame; para user real sentado ante la
             * webcam los deltas naturales entre frames espaciados 1.5s
             * son del orden 0.01-0.05 por landmark. Un umbral acumulado
             * de 0.02 sobre 3 landmarks × 2 pares de frames pasa
             * facilmente con user real y falla con foto fija (delta 0).
             *
             * <p>Calibrable via env var
             * MODERATION_LIVENESS_THRESHOLDS_PRESENCE_MIN_LANDMARK_DELTA.
             */
            private double minLandmarkDelta = 0.02;
            /**
             * Legacy: umbral de deltas de scores (smile+eyesClosed+yaw).
             * No usado por PRESENCE tras el fix 2026-07-13 (SightEngine
             * face-attributes NO devuelve smile/eyes_open/pose). Se
             * conserva por retrocompat de tests y config.
             */
            private double minDelta = 0.05;
            /**
             * Numero minimo de frames en los que debe detectarse cara.
             * Con framesRequired=3 → minFacesDetected=2 (permite que uno
             * falle sin bloquear).
             */
            private int minFacesDetected = 2;

            public double getMinLandmarkDelta() { return minLandmarkDelta; }
            public void setMinLandmarkDelta(double minLandmarkDelta) {
                this.minLandmarkDelta = minLandmarkDelta;
            }
            public double getMinDelta() { return minDelta; }
            public void setMinDelta(double minDelta) { this.minDelta = minDelta; }
            public int getMinFacesDetected() { return minFacesDetected; }
            public void setMinFacesDetected(int minFacesDetected) {
                this.minFacesDetected = minFacesDetected;
            }
        }

        public static class Blink {
            /** Score minimo de eyes_closed para considerar ojos cerrados. */
            private double minEyesClosed = 0.5;
            /** Score maximo de eyes_closed para considerar ojos abiertos. */
            private double maxEyesOpen = 0.3;

            public double getMinEyesClosed() { return minEyesClosed; }
            public void setMinEyesClosed(double minEyesClosed) { this.minEyesClosed = minEyesClosed; }
            public double getMaxEyesOpen() { return maxEyesOpen; }
            public void setMaxEyesOpen(double maxEyesOpen) { this.maxEyesOpen = maxEyesOpen; }
        }

        public static class Turn {
            /** Diferencia minima de yaw entre frames para validar giro. */
            private double minYawDiffDegrees = 15.0;

            public double getMinYawDiffDegrees() { return minYawDiffDegrees; }
            public void setMinYawDiffDegrees(double minYawDiffDegrees) {
                this.minYawDiffDegrees = minYawDiffDegrees;
            }
        }

        public static class Smile {
            /** Score minimo de sonrisa en algun frame. */
            private double minScore = 0.6;
            /** Score maximo en otro frame (transicion neutra->sonrisa). */
            private double maxScoreNeutral = 0.3;

            public double getMinScore() { return minScore; }
            public void setMinScore(double minScore) { this.minScore = minScore; }
            public double getMaxScoreNeutral() { return maxScoreNeutral; }
            public void setMaxScoreNeutral(double maxScoreNeutral) {
                this.maxScoreNeutral = maxScoreNeutral;
            }
        }
    }
}
