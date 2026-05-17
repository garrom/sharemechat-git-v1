package com.sharemechat.content.dto;

import java.time.Instant;
import java.util.List;

/**
 * Resumen de un articulo logico para listados admin (ADR-025).
 *
 * Campos compartidos del articulo + lista compacta de traducciones
 * (locale, slug, title, hasBody) para que el admin pueda mostrar el
 * estado de cada locale sin descargar bodies.
 */
public record ArticleSummaryDTO(
        Long id,
        String state,
        String category,
        boolean aiAssisted,
        Instant createdAt,
        Instant updatedAt,
        List<TranslationSummaryDTO> translations
) {}
