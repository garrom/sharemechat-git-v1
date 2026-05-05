package com.sharemechat.content.dto;

import java.time.Instant;

public record ReviewEventDTO(
        Long id,
        Long articleId,
        Long versionId,
        String eventType,
        Long actorUserId,
        String payloadJson,
        Instant createdAt
) {}
