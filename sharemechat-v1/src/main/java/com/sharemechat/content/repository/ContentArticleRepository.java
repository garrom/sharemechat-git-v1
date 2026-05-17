package com.sharemechat.content.repository;

import com.sharemechat.content.entity.ContentArticle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio del articulo logico (ADR-025).
 *
 * Los campos linguisticos (slug, locale, title) viven en
 * {@link com.sharemechat.content.entity.ContentArticleTranslation} y
 * se consultan desde {@link ContentArticleTranslationRepository}.
 *
 * Aqui solo quedan queries sobre campos compartidos del articulo
 * (state, category, fechas, autoria).
 */
@Repository
public interface ContentArticleRepository extends JpaRepository<ContentArticle, Long> {

    /** Lectura simple usada por sitemap publico (paquete 5). */
    List<ContentArticle> findByStateOrderByPublishedAtDesc(String state);

    /** Listado admin filtrado por estado (paginado, sort externo). */
    Page<ContentArticle> findByState(String state, Pageable pageable);

    /** Listado admin filtrado por categoria (paginado). */
    Page<ContentArticle> findByCategory(String category, Pageable pageable);

    /** Listado admin filtrado por estado + categoria (paginado). */
    Page<ContentArticle> findByStateAndCategory(String state, String category, Pageable pageable);
}
