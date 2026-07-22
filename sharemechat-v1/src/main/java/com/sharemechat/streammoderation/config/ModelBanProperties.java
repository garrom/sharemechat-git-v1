package com.sharemechat.streammoderation.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * ADR-037 frente trial-sfw Bloque 3: escalada del ban automatico y
 * ventana de reset del contador de strikes.
 *
 * <p>Duraciones en minutos por indice de strike (0-based). El indice
 * >= duracionesMinutos.length aplica la ultima duracion. Los defaults
 * son los aprobados: 15 / 30 / 60 / 360 / 1440 (min) = 15 min / 30 min
 * / 1 h / 6 h / 24 h. El 5o strike o superior tambien marca el ban
 * con {@code requires_manual_review=true}.
 *
 * <p>La ventana de reset ({@code strike-window-days}) define cuantos
 * dias hacia atras se cuenta el numero de strikes. Un strike mas viejo
 * que la ventana ya no cuenta para escalar el proximo ban.
 */
@Component
@ConfigurationProperties(prefix = "moderation.model-ban")
public class ModelBanProperties {

    /** Ventana rodante de conteo de strikes en dias (default 30). */
    private int strikeWindowDays = 30;

    /** Duraciones de ban en minutos por strike ordinal (1-based). */
    private long[] durationsMinutes = {15L, 30L, 60L, 360L, 1440L};

    /** A partir de que strike ordinal (1-based) marcar requires_manual_review. */
    private int manualReviewFromStrike = 5;

    public int getStrikeWindowDays() { return strikeWindowDays; }
    public void setStrikeWindowDays(int strikeWindowDays) { this.strikeWindowDays = strikeWindowDays; }

    public long[] getDurationsMinutes() { return durationsMinutes; }
    public void setDurationsMinutes(long[] durationsMinutes) { this.durationsMinutes = durationsMinutes; }

    public int getManualReviewFromStrike() { return manualReviewFromStrike; }
    public void setManualReviewFromStrike(int manualReviewFromStrike) { this.manualReviewFromStrike = manualReviewFromStrike; }
}
