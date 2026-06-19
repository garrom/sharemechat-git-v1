package com.sharemechat.streammoderation.dto;

import java.util.List;

/**
 * Vista detalle de una sesion de moderacion con sus eventos recientes
 * (frente Moderacion IA).
 */
public record StreamModerationSessionDetailDTO(
        StreamModerationSessionListItemDTO session,
        List<StreamModerationEventDTO> recentEvents
) {
}
