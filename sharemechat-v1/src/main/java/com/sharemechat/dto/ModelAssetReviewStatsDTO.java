package com.sharemechat.dto;

/**
 * Conteo por estado para las stat cards del panel admin
 * (pestaña "Moderación assets").
 */
public record ModelAssetReviewStatsDTO(
        long pendingReview,
        long approved,
        long rejected
) {
}
