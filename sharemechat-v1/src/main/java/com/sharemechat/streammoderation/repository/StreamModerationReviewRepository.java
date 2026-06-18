package com.sharemechat.streammoderation.repository;

import com.sharemechat.streammoderation.entity.StreamModerationReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StreamModerationReviewRepository
        extends JpaRepository<StreamModerationReview, Long> {

    /**
     * Query principal de la cola humana: PENDING ordenadas por priority
     * ascendente (1 = mas urgente) y, en empate, por created_at
     * ascendente (FIFO). El indice compuesto
     * idx_stream_moderation_reviews_status_priority soporta esta query
     * directamente.
     */
    List<StreamModerationReview> findByStatusOrderByPriorityAscCreatedAtAsc(String status);

    Optional<StreamModerationReview> findByProviderAndProviderEventId(
            String provider, String providerEventId);
}
