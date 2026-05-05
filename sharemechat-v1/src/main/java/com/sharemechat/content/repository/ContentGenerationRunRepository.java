package com.sharemechat.content.repository;

import com.sharemechat.content.entity.ContentGenerationRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContentGenerationRunRepository extends JpaRepository<ContentGenerationRun, Long> {

    List<ContentGenerationRun> findByArticleIdOrderByIdDesc(Long articleId);
}
