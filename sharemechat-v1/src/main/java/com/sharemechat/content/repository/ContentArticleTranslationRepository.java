package com.sharemechat.content.repository;

import com.sharemechat.content.entity.ContentArticleTranslation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repositorio de la cara per-idioma del articulo (ADR-025).
 *
 * Paquete 1 minimo: derivaciones basicas para resolver (article_id),
 * (article_id, locale) y (slug, locale). Filtros adicionales por
 * categoria, listados publicos paginados, etc. se anaden en paquete 2-3
 * junto con los servicios y controllers.
 */
@Repository
public interface ContentArticleTranslationRepository
        extends JpaRepository<ContentArticleTranslation, Long> {

    List<ContentArticleTranslation> findByArticleId(Long articleId);

    Optional<ContentArticleTranslation> findByArticleIdAndLocale(Long articleId, String locale);

    Optional<ContentArticleTranslation> findBySlugAndLocale(String slug, String locale);

    boolean existsBySlugAndLocale(String slug, String locale);

    boolean existsByArticleIdAndLocale(Long articleId, String locale);
}
