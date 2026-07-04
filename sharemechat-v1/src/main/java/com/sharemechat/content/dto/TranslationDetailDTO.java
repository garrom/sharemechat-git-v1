package com.sharemechat.content.dto;

import java.time.Instant;
import java.util.List;

/**
 * Detalle per-locale de una traduccion del articulo (ADR-025, brief incorporado
 * por ADR-027, keywords SEO derivadas por ADR-045).
 * Subobjeto dentro de ArticleDetailDTO.translations.
 *
 * ADR-045: {@code primaryKeyword} y {@code secondaryKeywords} son derivados
 * defensivos del array JSON {@code targetKeywords}. Extraccion tolerante ante
 * JSON null / vacio / malformado: en cualquier problema devuelve
 * {@code primaryKeyword=null} y {@code secondaryKeywords=List.of()}.
 * {@code targetKeywords} se mantiene como JSON crudo para clientes que quieran
 * el shape completo (incluyendo {@code search_intent_match}).
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
        String primaryKeyword,
        List<String> secondaryKeywords,
        Instant createdAt,
        Instant updatedAt
) {}
