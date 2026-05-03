package com.sharemechat.content.dto;

import java.time.Instant;

public record ArticleSummaryDTO(
        Long id,
        String slug,
        String locale,
        String state,
        String title,
        String category,
        Long responsibleEditorUserId,
        boolean aiAssisted,
        Instant createdAt,
        Instant updatedAt
) {}
