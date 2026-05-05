package com.sharemechat.content.dto;

import java.time.Instant;

public record VersionDTO(
        Long id,
        Long articleId,
        Integer versionNumber,
        String bodyS3Key,
        String bodyContentHash,
        Long sourceRunId,
        Long createdByUserId,
        Instant createdAt
) {}
