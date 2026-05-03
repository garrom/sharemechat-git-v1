package com.sharemechat.content.dto;

import java.time.Instant;

public record ArticleDetailDTO(
        Long id,
        String slug,
        String locale,
        Long parentArticleId,
        String state,
        String title,
        String brief,
        String category,
        String keywords,
        Long responsibleEditorUserId,
        Long currentVersionId,
        String bodyS3Key,
        String bodyContentHash,
        Instant publishedAt,
        Instant scheduledFor,
        Instant retractedAt,
        boolean aiAssisted,
        boolean disclosureRequired,
        Long createdByUserId,
        Long updatedByUserId,
        Instant createdAt,
        Instant updatedAt
) {}
