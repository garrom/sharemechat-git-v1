package com.sharemechat.content.dto;

/**
 * Resultado del endpoint POST .../runs/{runId}/output-bilingual (ADR-024).
 *
 *  - runDetail: estado del run actual (mismo formato que el flujo monolingue).
 *  - childArticle: detalle del articulo hijo EN creado, o null si el run fue
 *    monolingue (textarea EN vacio).
 *  - bilingual: true si se creo articulo hijo; false si se delego al flujo
 *    monolingue.
 */
public record BilingualSubmitResultDTO(
        RunDetailDTO runDetail,
        ArticleDetailDTO childArticle,
        boolean bilingual
) {}
