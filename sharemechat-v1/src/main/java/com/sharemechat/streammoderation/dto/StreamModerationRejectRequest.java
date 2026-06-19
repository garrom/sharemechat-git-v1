package com.sharemechat.streammoderation.dto;

/**
 * Body del endpoint {@code POST /api/admin/stream-moderation/queue/{reviewId}/reject}.
 *
 * <p>Validacion en service-layer:
 * <ul>
 *   <li>{@code decisionCode} requerido (no blank), max 50 chars.</li>
 *   <li>{@code note} opcional, max 255 chars.</li>
 *   <li>{@code killStreamIfActive} opcional; si true y el stream sigue
 *       activo (endTime null), se invoca {@code streamService.killStreamAsAdmin}.</li>
 * </ul>
 */
public record StreamModerationRejectRequest(
        String decisionCode,
        String note,
        Boolean killStreamIfActive
) {
}
