package com.sharemechat.content.publishing;

/**
 * Referencia a una version alternativa de un articulo en otro locale.
 * Fase 4A multilingue: el detalle publico expone un array de alternates
 * para que el frontend emita <link rel="alternate" hreflang="..."> y para
 * que el switcher manual del blog (4F) sepa a que slug navegar al cambiar
 * de locale.
 *
 * url es absoluta y se construye en el controller con PublicSiteProperties
 * (ADR-015). Convencion de prefijo URL ([ADR-022](../06-decisions/adr-022-blog-cms-multilingual-es-en.md)):
 *  - locale = "es" -> {baseUrl}/blog/{slug}
 *  - otros locales -> {baseUrl}/{locale}/blog/{slug}
 *
 * No incluye id ni title: el frontend solo necesita locale + slug + url
 * para los tres consumidores (hreflang, switcher, banner sugerente).
 */
public record ArticleAlternateDTO(
        String locale,
        String slug,
        String url
) {}
