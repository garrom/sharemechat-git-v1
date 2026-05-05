package com.sharemechat.content.dto;

import java.time.Instant;

public record RunSummaryDTO(
        Long id,
        Long articleId,
        String runType,
        String modelProvider,
        String modelId,
        String modelVersion,
        String mode,
        String status,
        boolean outputValidated,
        Long triggeredByUserId,
        Instant createdAt
) {}
