package com.sharemechat.streammoderation.dto;

/**
 * Conteo de filas en {@code stream_moderation_reviews} por status, sin
 * filtro temporal (decision K7 de Fase A: conteo total). Alimenta las
 * stat cards del panel admin (frente Moderacion IA).
 */
public record StreamModerationStatsDTO(
        long pending,
        long inReview,
        long approved,
        long rejected,
        long cancelled
) {
}
