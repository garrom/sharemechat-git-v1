package com.sharemechat.content.publishing;

/**
 * Referencia a una version alternativa de un articulo en otro locale.
 *
 * Paquete 5 (ADR-025): el detalle publico expone un array `alternates`
 * para que el frontend emita `<link rel="alternate" hreflang="...">`,
 * para que el switcher manual del navbar sepa a que slug navegar al
 * cambiar de locale, y para que el sitemap.xml emita `<xhtml:link>` por
 * locale alternativo.
 *
 * Convencion de URL (paquete 5, locale siempre en path):
 *   {baseUrl}/blog/{locale}/{slug}
 *
 * url es absoluta y se construye en el controller con PublicSiteProperties
 * (ADR-015). No incluye id ni title: los tres consumidores (hreflang, switcher,
 * sitemap) solo necesitan locale + slug + url.
 */
public record ArticleAlternateDTO(
        String locale,
        String slug,
        String url
) {}
