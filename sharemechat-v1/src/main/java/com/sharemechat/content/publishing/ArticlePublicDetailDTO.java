package com.sharemechat.content.publishing;

import java.time.Instant;
import java.util.List;

/**
 * Vista publica del detalle de un articulo (/api/public/content/articles/{slug}).
 *
 * Una respuesta = un (articulo logico, locale). El campo `locale` indica que
 * locale del articulo se sirve. Los campos linguisticos (slug, title, brief,
 * seoTitle, metaDescription, htmlBody) son los de ESE locale; los compartidos
 * (heroImageUrl, category, keywords, fechas, aiAssisted, disclosureRequired,
 * id) son del articulo logico.
 *
 * htmlBody ya viene renderizado y sanitizado por MarkdownRendererService.
 * El frontend lo inyecta con dangerouslySetInnerHTML; backend garantiza
 * que no contiene scripts ni HTML peligroso.
 *
 * Campos SEO:
 *  - seoTitle y metaDescription son los del locale solicitado (provienen
 *    de content_article_translations.seo_title y meta_description).
 *  - updatedAt sirve como dateModified en JSON-LD Article y como lastmod
 *    en sitemap.xml. Si fuera null, el frontend cae en publishedAt.
 *
 * alternates: versiones del mismo articulo logico en otros locales que
 * tambien estan PUBLISHED. Garantia: el campo nunca es null; si no hay
 * alternates, lista vacia. Convencion de URL (paquete 5): SIEMPRE con
 * locale en path -> `{baseUrl}/blog/{locale}/{slug}` para todos los locales.
 */
public record ArticlePublicDetailDTO(
        Long id,
        String slug,
        String locale,
        String title,
        String brief,
        String seoTitle,
        String metaDescription,
        String category,
        String keywords,
        Instant publishedAt,
        Instant updatedAt,
        String htmlBody,
        boolean aiAssisted,
        boolean disclosureRequired,
        String heroImageUrl,
        List<ArticleAlternateDTO> alternates
) {}
