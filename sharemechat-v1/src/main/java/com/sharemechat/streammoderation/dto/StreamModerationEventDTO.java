package com.sharemechat.streammoderation.dto;

import java.time.LocalDateTime;

/**
 * Vista lite de una fila de {@code stream_moderation_events}.
 *
 * <p>NO incluye {@code payload_json}: el payload bruto del vendor
 * puede contener metadata sensible y no debe viajar a la UI.
 */
public record StreamModerationEventDTO(
        Long id,
        String provider,
        String providerEventId,
        String eventType,
        Boolean isSignatureValid,
        boolean isProcessed,
        LocalDateTime receivedAt,
        LocalDateTime processedAt
) {
}
