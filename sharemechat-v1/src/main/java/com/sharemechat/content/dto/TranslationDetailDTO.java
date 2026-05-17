package com.sharemechat.content.dto;

import java.time.Instant;

/**
 * Detalle per-locale de una traduccion del articulo (ADR-025).
 * Subobjeto dentro de ArticleDetailDTO.translations.
 */
public record TranslationDetailDTO(
        Long id,
        String locale,
        String slug,
        String title,
        String seoTitle,
        String metaDescription,
        String bodyS3Key,
        String bodyContentHash,
        String targetKeywords,
        Instant createdAt,
        Instant updatedAt
) {}
