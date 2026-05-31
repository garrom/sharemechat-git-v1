package com.sharemechat.dto;

import java.time.LocalDateTime;

/**
 * Vista de un asset de perfil de modelo para los endpoints del modelo
 * (GET /api/me/assets) y del cliente (GET /api/models/{userId}/assets).
 *
 * <p>{@code reviewStatus} refleja el estado de la review más reciente
 * asociada al asset: {@code PENDING_REVIEW}, {@code APPROVED} o
 * {@code REJECTED} (o {@code null} si el asset no tiene review).
 * {@code rejectionReasonCode} y {@code rejectionReasonText} solo se
 * rellenan cuando {@code reviewStatus == REJECTED}.
 *
 * <p>El endpoint del cliente filtra al backend solo assets con
 * {@code status=APPROVED} y {@code isActive=TRUE}, así que en su
 * respuesta {@code reviewStatus} siempre será {@code APPROVED} y
 * los campos de motivo siempre {@code null}.
 */
public record ModelAssetDTO(
        Long id,
        Long userId,
        String assetType,
        String url,
        boolean isPrincipal,
        boolean isActive,
        Integer position,
        LocalDateTime uploadedAt,
        String reviewStatus,
        String rejectionReasonCode,
        String rejectionReasonText
) {
}
