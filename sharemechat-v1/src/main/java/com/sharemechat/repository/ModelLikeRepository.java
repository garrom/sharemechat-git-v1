package com.sharemechat.repository;

import com.sharemechat.entity.ModelLike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Acceso a los likes cliente→modelo (Card 1 Fase 3).
 */
public interface ModelLikeRepository extends JpaRepository<ModelLike, Long> {

    long countByModelUserId(Long modelUserId);

    boolean existsByClientUserIdAndModelUserId(Long clientUserId, Long modelUserId);

    Optional<ModelLike> findByClientUserIdAndModelUserId(Long clientUserId, Long modelUserId);

    void deleteByClientUserIdAndModelUserId(Long clientUserId, Long modelUserId);
}
