package com.sharemechat.streammoderation.dto;

import java.time.LocalDateTime;

/**
 * ADR-037 frente trial-sfw Bloque 4: fila de la tabla del panel admin
 * de bans. Incluye datos del modelo (nickname + email) para no forzar
 * al frontend a hacer un lookup extra.
 */
public record ModelBanListItemDTO(
        Long id,
        Long modelUserId,
        String modelNickname,
        String modelEmail,
        int strikeCountAtBan,
        LocalDateTime banStartedAt,
        LocalDateTime banEndsAt,
        String reason,
        boolean requiresManualReview,
        boolean reviewed,
        boolean active
) {}
