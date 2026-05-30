package com.sharemechat.dto;

import java.time.LocalDateTime;

/**
 * Vista de una row de {@code model_asset_reviews} enriquecida con datos
 * básicos de la modelo (email + nickname) para el panel admin.
 *
 * <p>Se construye mediante proyección JPQL (constructor expression) en
 * {@code ModelAssetReviewRepository} para evitar N+1 lookups de usuario.
 */
public record ModelAssetReviewDTO(
        Long id,
        Long userId,
        String email,
        String nickname,
        String assetType,
        String assetUrl,
        String status,
        String rejectionReasonCode,
        String rejectionReasonText,
        LocalDateTime uploadedAt,
        LocalDateTime reviewedAt,
        Long reviewerId
) {
}
