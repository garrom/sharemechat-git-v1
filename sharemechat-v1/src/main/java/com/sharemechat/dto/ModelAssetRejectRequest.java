package com.sharemechat.dto;

/**
 * Body del endpoint {@code POST /api/admin/model-assets/{reviewId}/reject}.
 *
 * <p>Validación: si {@code reasonCode == "OTHER"} entonces {@code reasonText}
 * es obligatorio. Se valida en el service-layer ({@code ModelAssetReviewService})
 * para devolver 400 con mensaje claro.
 */
public record ModelAssetRejectRequest(
        String reasonCode,
        String reasonText
) {
}
