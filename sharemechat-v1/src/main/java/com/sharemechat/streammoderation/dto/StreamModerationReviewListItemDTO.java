package com.sharemechat.streammoderation.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Vista lite de una fila de {@code stream_moderation_reviews} para la
 * cola humana (frente Moderacion IA; ADR-030 / ADR-036 / ADR-037).
 *
 * <p>NO incluye {@code evidenceRef}, {@code decisionCode} ni
 * {@code decisionNote}: para esos campos hay {@link StreamModerationReviewDetailDTO}.
 */
public record StreamModerationReviewListItemDTO(
        Long id,
        Long streamRecordId,
        Long streamModerationSessionId,
        String provider,
        String category,
        String severity,
        BigDecimal score,
        String providerEventId,
        String status,
        int priority,
        Long reviewerId,
        LocalDateTime reviewedAt,
        LocalDateTime frameTimestamp,
        LocalDateTime createdAt
) {
}
