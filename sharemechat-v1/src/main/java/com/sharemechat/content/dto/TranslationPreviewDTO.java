package com.sharemechat.content.dto;

/**
 * Preview privado per-locale renderizado para admin (ADR-025).
 *
 * Devuelto por GET /api/admin/content/articles/{id}/translations/{locale}/preview.
 * htmlBody ya viene renderizado y sanitizado por MarkdownRendererService.
 * El frontend admin lo inyecta con dangerouslySetInnerHTML reusando los
 * estilos del blog publico; backend garantiza que no contiene scripts ni
 * HTML peligroso.
 *
 * Subset minimo: solo lo que el frontend admin necesita para mostrar el
 * preview de una traduccion concreta. NO incluye campos del blog publico
 * (alternates, publishedAt, etc.) que no aplican a una vista admin.
 */
public record TranslationPreviewDTO(
        Long articleId,
        String locale,
        String slug,
        String title,
        String brief,
        String category,
        String heroImageUrl,
        String htmlBody
) {}
