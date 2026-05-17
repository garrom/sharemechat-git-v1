package com.sharemechat.content.dto;

/**
 * Resultado del endpoint POST .../runs/{runId}/apply-bilingual (ADR-025).
 *
 *  - runDetail: estado del run tras la validacion + aplicacion. Status
 *    VALIDATED si todo paso; REJECTED si el JSON no paso validacion
 *    (en ese caso article es null y el operador puede inspeccionar
 *    validationErrors en runDetail).
 *  - article: detalle del articulo con sus dos translations completas
 *    tras el apply. Null si el run fue REJECTED.
 */
public record ApplyBilingualResultDTO(
        RunDetailDTO runDetail,
        ArticleDetailDTO article
) {}
