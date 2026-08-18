package com.sharemechat.repository;

import com.sharemechat.entity.ModelLike;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Acceso a los likes cliente→modelo (Card 1 Fase 3/C).
 */
public interface ModelLikeRepository extends JpaRepository<ModelLike, Long> {

    long countByModelUserId(Long modelUserId);

    boolean existsByClientUserIdAndModelUserId(Long clientUserId, Long modelUserId);

    Optional<ModelLike> findByClientUserIdAndModelUserId(Long clientUserId, Long modelUserId);

    void deleteByClientUserIdAndModelUserId(Long clientUserId, Long modelUserId);

    /**
     * Card 1 Fase C: top de modelos por likes (desc). Cada fila = [modelUserId, count].
     * Solo aparecen modelos con al menos 1 like. Se limita con Pageable.
     */
    @Query("SELECT l.modelUserId, COUNT(l) FROM ModelLike l GROUP BY l.modelUserId ORDER BY COUNT(l) DESC")
    List<Object[]> topByLikes(Pageable pageable);

    /**
     * Card 1 Fase C: nº de modelos con estrictamente MÁS likes que {@code c}
     * (para calcular la posición de una modelo en el ranking = above + 1).
     */
    @Query(value = "SELECT COUNT(*) FROM (SELECT model_user_id FROM model_likes GROUP BY model_user_id HAVING COUNT(*) > :c) t",
            nativeQuery = true)
    long countModelsAboveLikes(@Param("c") long c);
}
