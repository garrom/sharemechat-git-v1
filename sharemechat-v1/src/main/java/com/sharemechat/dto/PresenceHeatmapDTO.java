package com.sharemechat.dto;

import java.util.List;

/**
 * Heatmap de presencia para el panel admin (Card 1 Fase 2). Devuelto por
 * {@code GET /api/admin/stats/presence/heatmap} (por modelo) y
 * {@code /heatmap/platform} (agregado de toda la plataforma).
 *
 * <p>{@code scope} = {@code "MODEL"} | {@code "PLATFORM"}. {@code modelUserId}
 * solo se rellena en scope MODEL. {@code weeks} = ventana agregada.
 * {@code buckets} = casillas día×hora (zona Europe/Madrid) con el nº de
 * muestras online ({@code onlineCount}) y la intensidad normalizada 0-100.
 */
public record PresenceHeatmapDTO(
        String scope,
        Long modelUserId,
        int weeks,
        List<HeatBucket> buckets
) {

    /**
     * {@code dayOfWeek} 1=Lunes .. 7=Domingo; {@code hour} 0-23 (hora
     * peninsular). {@code onlineCount} muestras observadas online en esa
     * franja; {@code intensity} 0-100 normalizada al máximo de la rejilla.
     */
    public record HeatBucket(
            int dayOfWeek,
            int hour,
            int onlineCount,
            int intensity
    ) {}
}
