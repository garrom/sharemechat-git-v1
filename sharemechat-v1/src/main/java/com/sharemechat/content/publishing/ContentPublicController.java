package com.sharemechat.content.publishing;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Endpoints publicos del CMS para el blog.
 *
 * --------------------------------------------------------------------
 * PAQUETE 1 (ADR-025): NEUTRALIZADO.
 *
 * El listado y el detalle publico requeriran consultas sobre la nueva
 * tabla content_article_translations y resolver alternates por
 * article_id (no por parent_article_id, que desaparece del modelo).
 * Reescritura en paquete 5 (capa publica + SEO multilingue).
 *
 * Mientras dure la ventana paquete 1 → paquete 5, el frontend publico
 * recibira 500 en ambos endpoints. El blog publico queda offline
 * funcionalmente. Asumido en TEST; en PRO se aplica este paquete
 * cuando los siguientes esten listos para mergear en cadena.
 * --------------------------------------------------------------------
 */
@RestController
@RequestMapping("/api/public/content")
public class ContentPublicController {

    private static final String MSG =
            "Pendiente paquete 5 — rediseño CMS bilingüe (ADR-025)";

    @GetMapping("/articles")
    public Map<String, Object> listArticles(
            @RequestParam(defaultValue = "es") String locale,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @GetMapping("/articles/{slug}")
    public ResponseEntity<?> getArticleBySlug(
            @PathVariable("slug") String slugRaw,
            @RequestParam(defaultValue = "es") String localeRaw
    ) {
        throw new UnsupportedOperationException(MSG);
    }
}
