package com.sharemechat.content.publishing;

import java.time.Instant;

/**
 * Vista publica resumida para listados del blog (/api/public/content/articles).
 * NO incluye campos internos: state, hashes, S3 keys, autor, version_id.
 */
public record ArticlePublicSummaryDTO(
        Long id,
        String slug,
        String locale,
        String title,
        String brief,
        String category,
        String keywords,
        Instant publishedAt
) {}
