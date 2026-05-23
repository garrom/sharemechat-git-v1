package com.sharemechat.content.publishing;

import java.time.Instant;

/**
 * Vista publica resumida para listados del blog (/api/public/content/articles).
 * NO incluye campos internos: state, hashes, S3 keys, autor, version_id.
 *
 * Post-ADR-025 (paquete 5): incluye aiAssisted y disclosureRequired para que
 * el frontend pueda mostrar el indicador AI en los cards del listado sin
 * tener que descargar el detalle de cada articulo.
 *
 * Post-ADR-027: `brief` es el del locale solicitado (proviene de
 * content_article_translations.brief), no un campo compartido del articulo.
 */
public record ArticlePublicSummaryDTO(
        Long id,
        String slug,
        String locale,
        String title,
        String brief,
        String category,
        String keywords,
        Instant publishedAt,
        String heroImageUrl,
        boolean aiAssisted,
        boolean disclosureRequired
) {}
