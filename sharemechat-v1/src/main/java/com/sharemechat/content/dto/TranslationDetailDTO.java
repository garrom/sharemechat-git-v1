package com.sharemechat.content.dto;

import java.time.Instant;

/**
 * Detalle per-locale de una traduccion del articulo (ADR-025, brief incorporado por ADR-027).
 * Subobjeto dentro de ArticleDetailDTO.translations.
 */
public record TranslationDetailDTO(
        Long id,
        String locale,
        String slug,
        String title,
        String seoTitle,
        String metaDescription,
        String brief,
        String bodyS3Key,
        String bodyContentHash,
        String targetKeywords,
        Instant createdAt,
        Instant updatedAt
) {}
