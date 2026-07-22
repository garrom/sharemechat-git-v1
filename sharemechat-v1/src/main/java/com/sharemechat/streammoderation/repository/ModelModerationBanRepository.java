package com.sharemechat.streammoderation.repository;

import com.sharemechat.streammoderation.entity.ModelModerationBan;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ModelModerationBanRepository
        extends JpaRepository<ModelModerationBan, Long> {

    /**
     * ADR-037 frente trial-sfw Bloque 4: bans pendientes de revision
     * manual (5o+ strike marcado con requires_manual_review=true y sin
     * accion admin todavia). Es el filtro default del panel: son los
     * casos que exigen accion del equipo.
     */
    List<ModelModerationBan> findByRequiresManualReviewTrueAndReviewedFalseOrderByBanStartedAtDesc(Pageable pageable);

    /**
     * Bans actualmente activos (ban_ends_at > NOW), sin filtro de review.
     */
    @Query("SELECT b FROM ModelModerationBan b WHERE b.banEndsAt > :now ORDER BY b.banStartedAt DESC")
    List<ModelModerationBan> findActive(@Param("now") LocalDateTime now, Pageable pageable);

    /**
     * Bans historicos completos ordenados por mas reciente primero.
     */
    List<ModelModerationBan> findAllByOrderByBanStartedAtDesc(Pageable pageable);

    /**
     * Bans por modelo, mas reciente primero. Para el detalle del modelo
     * si se quiere navegar por su historial.
     */
    List<ModelModerationBan> findByModelUserIdOrderByBanStartedAtDesc(Long modelUserId, Pageable pageable);
}
