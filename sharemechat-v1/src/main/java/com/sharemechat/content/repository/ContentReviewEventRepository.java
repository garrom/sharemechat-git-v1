package com.sharemechat.content.repository;

import com.sharemechat.content.entity.ContentReviewEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ContentReviewEventRepository extends JpaRepository<ContentReviewEvent, Long> {

    Page<ContentReviewEvent> findByArticleIdOrderByIdDesc(Long articleId, Pageable pageable);
}
