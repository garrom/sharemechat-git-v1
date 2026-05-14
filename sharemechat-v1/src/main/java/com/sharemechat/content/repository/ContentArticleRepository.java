package com.sharemechat.content.repository;

import com.sharemechat.content.entity.ContentArticle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ContentArticleRepository extends JpaRepository<ContentArticle, Long> {

    Optional<ContentArticle> findBySlugAndLocale(String slug, String locale);

    boolean existsBySlugAndLocale(String slug, String locale);

    @Query("""
            select a from ContentArticle a
            where (:state is null or a.state = :state)
              and (:locale is null or a.locale = :locale)
              and (:category is null or a.category = :category)
            """)
    Page<ContentArticle> findFiltered(@Param("state") String state,
                                      @Param("locale") String locale,
                                      @Param("category") String category,
                                      Pageable pageable);

    // Fase 4A — vista publica
    @Query("""
            select a from ContentArticle a
            where a.state = 'PUBLISHED'
              and (:locale is null or a.locale = :locale)
              and (:category is null or a.category = :category)
            order by a.publishedAt desc
            """)
    Page<ContentArticle> findPublished(@Param("locale") String locale,
                                       @Param("category") String category,
                                       Pageable pageable);

    Optional<ContentArticle> findBySlugAndState(String slug, String state);

    // SEO layer — listado completo de PUBLISHED para sitemap.xml.
    // No paginado deliberadamente: el sitemap simple emite una entrada por
    // articulo. Cuando se acerquen 50.000 URLs, partir en sitemapindex.
    java.util.List<ContentArticle> findByStateOrderByPublishedAtDesc(String state);

    // ADR-016: el endpoint publico necesita distinguir 200 / 410 / 404.
    // Devuelve cualquier articulo cuyo slug coincida (cualquier locale, cualquier
    // estado). El controller decide la respuesta segun el state.
    java.util.List<ContentArticle> findBySlugOrderByIdAsc(String slug);

    // Fase 4A multilingue (ADR-022): dado un articulo (su id y su
    // parent_article_id) devuelve los demas articulos PUBLISHED del mismo
    // grupo. La vinculacion se hace via parent_article_id en lugar de un
    // group_id dedicado (decision operativa post-ADR-022 al verificar que
    // la columna parent_article_id ya existia sin uso).
    //
    // Logica de la consulta:
    //  - Si el articulo actual es RAIZ (parentArticleId IS NULL): devuelve
    //    los hijos cuyo parent_article_id sea su propio id.
    //  - Si el articulo actual es HIJO (parentArticleId != NULL): devuelve
    //    sus hermanos (mismo parent_article_id) y al padre (id =
    //    parentArticleId).
    // En ambos casos excluye el propio articulo y filtra por PUBLISHED.
    @Query("""
            select a from ContentArticle a
            where a.id <> :currentId
              and a.state = 'PUBLISHED'
              and (
                a.parentArticleId = coalesce(:parentId, :currentId)
                or a.id = :parentId
              )
            """)
    java.util.List<ContentArticle> findAlternates(@Param("currentId") Long currentId,
                                                  @Param("parentId") Long parentId);
}
