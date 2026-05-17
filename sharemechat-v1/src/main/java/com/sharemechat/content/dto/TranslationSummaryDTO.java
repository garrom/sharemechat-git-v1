package com.sharemechat.content.dto;

/**
 * Resumen per-locale de una traduccion del articulo (ADR-025).
 * Subobjeto dentro de ArticleSummaryDTO.translations.
 *
 *  - locale: codigo del idioma ("es", "en", ...).
 *  - slug: slug actual de la traduccion (puede diferir entre locales).
 *  - title: titulo de la traduccion para mostrar en listados.
 *  - hasBody: true si body_s3_key esta poblado; util para indicador visual
 *    "ES llena / EN pendiente" en el listado admin sin descargar el body.
 */
public record TranslationSummaryDTO(
        String locale,
        String slug,
        String title,
        boolean hasBody
) {}
