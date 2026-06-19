package com.sharemechat.streammoderation.dto;

import java.util.List;

/**
 * Vista detalle de una review (frente Moderacion IA).
 * Incluye los ultimos eventos de la sesion asociados.
 */
public record StreamModerationReviewDetailDTO(
        StreamModerationReviewListItemDTO review,
        String evidenceRef,
        String decisionCode,
        String decisionNote,
        List<StreamModerationEventDTO> events
) {
}
