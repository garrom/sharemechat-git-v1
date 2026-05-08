package com.sharemechat.content.publishing;

import java.time.Instant;

/**
 * Vista publica del detalle de un articulo (/api/public/content/articles/{slug}).
 * htmlBody ya viene renderizado y sanitizado por MarkdownRendererService.
 * El frontend lo inyecta con dangerouslySetInnerHTML; backend garantiza
 * que no contiene scripts ni HTML peligroso.
 *
 * Campos SEO (Frente 2):
 *  - updatedAt sirve como dateModified en JSON-LD Article y como lastmod
 *    en sitemap.xml. Si fuera null, el frontend cae en publishedAt.
 *  - seoTitle / metaDescription dedicados aun no existen como columnas en
 *    content_articles; el frontend deriva seoTitle de title y
 *    metaDescription de brief mientras no se modele el dominio SEO.
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
        Instant updatedAt,
        String htmlBody,
        boolean aiAssisted,
        boolean disclosureRequired
) {}
