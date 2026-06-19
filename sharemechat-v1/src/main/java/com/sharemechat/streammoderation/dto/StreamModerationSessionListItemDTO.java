package com.sharemechat.streammoderation.dto;

import java.time.LocalDateTime;

/**
 * Vista lite de una fila de {@code stream_moderation_sessions}
 * (frente Moderacion IA).
 */
public record StreamModerationSessionListItemDTO(
        Long id,
        Long streamRecordId,
        String provider,
        String status,
        int samplingCadenceSeconds,
        String samplingStrategy,
        LocalDateTime startedAt,
        LocalDateTime stoppedAt,
        int framesSubmitted,
        int verdictsReceived,
        LocalDateTime degradedSince
) {
}
