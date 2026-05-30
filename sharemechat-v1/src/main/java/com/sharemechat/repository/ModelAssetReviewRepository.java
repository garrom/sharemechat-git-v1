package com.sharemechat.repository;

import com.sharemechat.dto.ModelAssetReviewDTO;
import com.sharemechat.entity.ModelAssetReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ModelAssetReviewRepository extends JpaRepository<ModelAssetReview, Long> {

    /**
     * Cola de moderación: todas las reviews en un estado dado, ordenadas
     * por fecha de subida ascendente (FIFO). El uso típico es
     * {@code findByStatusOrderByUploadedAtAsc("PENDING_REVIEW")}.
     * El índice compuesto {@code (status, uploaded_at)} de
     * {@code model_asset_reviews} soporta directamente esta query.
     */
    List<ModelAssetReview> findByStatusOrderByUploadedAtAsc(String status);

    /** Conteo por estado, usado por el endpoint de stats del panel admin. */
    long countByStatus(String status);

    /**
     * Última review de un asset concreto de un modelo (la más reciente por
     * id desc). Usado por el service para chequeos puntuales.
     */
    Optional<ModelAssetReview> findFirstByUserIdAndAssetTypeOrderByIdDesc(Long userId, String assetType);

    /**
     * Modelos cuyo último PIC y último VIDEO están APPROVED. Defensa
     * adicional para {@code ModelAssetReviewService.isModelFullyApproved}
     * cuando se quiera double-check contra los flags denormalizados de
     * {@code model_documents}.
     */
    @Query("""
            select count(r) > 0
            from ModelAssetReview r
            where r.userId = :userId
              and r.assetType = :assetType
              and r.status = 'APPROVED'
              and r.id = (
                  select max(r2.id) from ModelAssetReview r2
                  where r2.userId = :userId and r2.assetType = :assetType
              )
           """)
    boolean hasLatestApproved(Long userId, String assetType);

    /**
     * Proyección DTO de reviews por estado con email + nickname del
     * modelo. Ordenada por {@code uploaded_at} ascendente (FIFO). Único
     * roundtrip a BD para alimentar la tabla del panel admin.
     */
    @Query("""
            select new com.sharemechat.dto.ModelAssetReviewDTO(
                r.id, r.userId,
                u.email,
                COALESCE(u.nickname, u.name, u.email),
                r.assetType, r.assetUrl, r.status,
                r.rejectionReasonCode, r.rejectionReasonText,
                r.uploadedAt, r.reviewedAt, r.reviewerId
            )
            from ModelAssetReview r, User u
            where u.id = r.userId
              and r.status = :status
            order by r.uploadedAt asc
           """)
    List<ModelAssetReviewDTO> findDTOsByStatusOrderByUploadedAtAsc(String status);
}
