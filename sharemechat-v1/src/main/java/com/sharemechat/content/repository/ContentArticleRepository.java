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
}
