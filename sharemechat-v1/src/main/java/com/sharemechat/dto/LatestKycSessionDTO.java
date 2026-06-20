package com.sharemechat.dto;

import java.time.LocalDateTime;

/**
 * DTO devuelto por GET /api/kyc/sessions/me/latest (sub-frente A, 2026-06-20).
 * Solo campos no-sensibles necesarios para el gate del botón "Iniciar
 * verificación" en DashboardUserModel. NO exponer providerVendorRef,
 * providerDecisionReason raw ni datos biométricos (ageEstimationDecimal etc).
 */
public record LatestKycSessionDTO(
        Long id,
        String sessionType,
        String kycStatus,
        String providerStatus,
        String providerSessionId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
