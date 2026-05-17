package com.sharemechat.content.repository;

import com.sharemechat.content.entity.ContentArticleTranslation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio de la cara per-idioma del articulo (ADR-025).
 */
@Repository
public interface ContentArticleTranslationRepository
        extends JpaRepository<ContentArticleTranslation, Long> {

    List<ContentArticleTranslation> findByArticleId(Long articleId);

    /** Bulk load para listados paginados de articulos. */
    List<ContentArticleTranslation> findByArticleIdIn(Collection<Long> articleIds);

    Optional<ContentArticleTranslation> findByArticleIdAndLocale(Long articleId, String locale);

    Optional<ContentArticleTranslation> findBySlugAndLocale(String slug, String locale);

    boolean existsBySlugAndLocale(String slug, String locale);

    boolean existsByArticleIdAndLocale(Long articleId, String locale);
}
