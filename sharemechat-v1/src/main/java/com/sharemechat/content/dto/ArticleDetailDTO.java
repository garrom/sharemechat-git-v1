package com.sharemechat.content.dto;

import java.time.Instant;
import java.util.List;

/**
 * Detalle completo de un articulo logico (ADR-025, brief reubicado por ADR-027).
 *
 * Campos compartidos (locale-invariante) en la raiz.
 * Campos linguisticos (slug, title, body, brief, etc.) en {@link #translations},
 * una entrada por locale presente en BD. Tras ADR-027 brief ya no esta en la
 * raiz; vive dentro de cada TranslationDetailDTO.
 *
 * Garantia: translations nunca es null; si el articulo solo tiene ES,
 * translations tendra un elemento. Tras un apply-bilingual exitoso,
 * tendra dos.
 */
public record ArticleDetailDTO(
        Long id,
        String state,
        String category,
        String keywords,
        String heroImageUrl,
        boolean aiAssisted,
        boolean disclosureRequired,
        Instant publishedAt,
        Instant scheduledFor,
        Instant retractedAt,
        Long currentVersionId,
        Long responsibleEditorUserId,
        Long createdByUserId,
        Long updatedByUserId,
        Instant createdAt,
        Instant updatedAt,
        List<TranslationDetailDTO> translations
) {}
