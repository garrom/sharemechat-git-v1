package com.sharemechat.streammoderation.dto;

import java.time.LocalDateTime;

/**
 * Vista de {@code stream_moderation_provider_config} para la pestania
 * Configuracion del panel admin (frente Moderacion IA).
 */
public record StreamModerationConfigDTO(
        String providerKey,
        String activeMode,
        boolean enabled,
        String note,
        Long updatedByUserId,
        LocalDateTime updatedAt
) {
}
