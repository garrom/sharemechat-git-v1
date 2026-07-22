package com.sharemechat.streammoderation.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * ADR-037 frente trial-sfw Bloque 4: detalle completo de un ban para
 * el drill-down del panel admin. Incluye historial de strikes recientes
 * del modelo (ventana rodante 30d), datos del ban actual, quien lo
 * reviso si aplica, y la URL firmada del frame S3 que disparo el ban
 * (best-effort: null si aun no hay evidencia S3 subida o si expiro).
 */
public record ModelBanDetailDTO(
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
        LocalDateTime reviewedAt,
        Long reviewedBy,
        boolean active,
        String evidenceUrl,
        LocalDateTime evidenceExpiresAt,
        List<StrikeSummary> strikesInWindow
) {

    public record StrikeSummary(
            Long id,
            Long streamModerationSessionId,
            String severity,
            String category,
            LocalDateTime createdAt
    ) {}
}
