package com.sharemechat.streammoderation.dto;

/**
 * Body del endpoint {@code POST /api/admin/stream-moderation/queue/{reviewId}/approve}.
 *
 * <p>Validacion en service-layer: {@code note} opcional, max 255 chars
 * (alineado con {@code stream_moderation_reviews.decision_note}).
 */
public record StreamModerationApproveRequest(
        String note
) {
}
