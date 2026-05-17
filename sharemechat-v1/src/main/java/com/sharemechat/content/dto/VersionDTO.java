package com.sharemechat.content.dto;

import java.time.Instant;
import java.util.List;

/**
 * Resumen de una version inmutable del articulo logico (ADR-025).
 *
 * Una fila representa la version N del articulo completo (snapshot tras
 * DRAFT -> IN_REVIEW). El contenido per-idioma vive en
 * {@link #translations} (una entrada por locale).
 */
public record VersionDTO(
        Long id,
        Long articleId,
        Integer versionNumber,
        Long sourceRunId,
        Long createdByUserId,
        Instant createdAt,
        List<TranslationVersionSummaryDTO> translations
) {}
