package com.sharemechat.content.dto;

/**
 * Snapshot per-locale dentro de una version del articulo (ADR-025).
 * Subobjeto dentro de VersionDTO.translations. Captura la cara per-idioma
 * del articulo en el momento de DRAFT -> IN_REVIEW.
 */
public record TranslationVersionSummaryDTO(
        String locale,
        String slug,
        String title,
        String seoTitle,
        String metaDescription,
        String bodyS3Key,
        String bodyContentHash
) {}
