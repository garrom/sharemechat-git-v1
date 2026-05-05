package com.sharemechat.content.repository;

import com.sharemechat.content.entity.ContentArticleVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContentArticleVersionRepository extends JpaRepository<ContentArticleVersion, Long> {

    List<ContentArticleVersion> findByArticleIdOrderByVersionNumberDesc(Long articleId);

    Optional<ContentArticleVersion> findByArticleIdAndVersionNumber(Long articleId, Integer versionNumber);

    @Query("select coalesce(max(v.versionNumber), 0) from ContentArticleVersion v where v.articleId = :articleId")
    Integer findMaxVersionNumber(@Param("articleId") Long articleId);
}
