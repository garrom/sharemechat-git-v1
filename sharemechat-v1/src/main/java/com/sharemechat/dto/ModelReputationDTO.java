package com.sharemechat.dto;

/**
 * Card 1 Fase C: reputación propia de la modelo (widget "Tu reputación").
 *
 * <p>{@code count} = sus likes; {@code badgeCode} = insignia vigente (o null
 * por debajo de 10). {@code nextBadgeCode}/{@code nextThreshold}/{@code likesToNext}
 * describen el siguiente escalón (null si ya está en el máximo, Imperial).
 */
public record ModelReputationDTO(
        long count,
        String badgeCode,
        String nextBadgeCode,
        Long nextThreshold,
        Long likesToNext
) {
}
