package com.sharemechat.content.publishing;

import java.time.Instant;

/**
 * Vista publica del detalle de un articulo (/api/public/content/articles/{slug}).
 * htmlBody ya viene renderizado y sanitizado por MarkdownRendererService.
 * El frontend lo inyecta con dangerouslySetInnerHTML; backend garantiza
 * que no contiene scripts ni HTML peligroso.
 */
public record ArticlePublicDetailDTO(
        Long id,
        String slug,
        String locale,
        String title,
        String brief,
        String category,
        String keywords,
        Instant publishedAt,
        String htmlBody,
        boolean aiAssisted,
        boolean disclosureRequired
) {}
