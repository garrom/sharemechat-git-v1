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

    /**
     * Conteo de assets cuya ÚLTIMA review está en el estado pedido.
     * Usado por el endpoint de stats del panel admin.
     *
     * <p>Capa 2 Fase 9 bugfix 2: alineado con
     * {@link #findDTOsByStatusOrderByUploadedAtAsc(String)} — cuenta
     * el estado actual de cada asset, no las decisiones históricas.
     * Tras un rechazo retroactivo, el asset cuenta solo en "Rechazado"
     * (su última review), no en "Aprobado" (su histórica). Reviews
     * huérfanas ({@code asset_id IS NULL}) se excluyen.
     */
    @Query("""
            select count(r)
            from ModelAssetReview r
            where r.status = :status
              and r.assetId is not null
              and r.id = (
                  select max(r2.id) from ModelAssetReview r2
                  where r2.assetId = r.assetId
              )
           """)
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
    /**
     * Última review (la más reciente por id) para un asset concreto.
     * Usado por ModelAssetService para chequear si el asset está
     * actualmente aprobado al decidir si se permite borrarlo.
     */
    Optional<ModelAssetReview> findFirstByAssetIdOrderByIdDesc(Long assetId);

    /**
     * Todas las reviews del modelo ordenadas por id desc. Usado por
     * ModelAssetService para componer la lista de DTOs (asset + status)
     * en un único viaje a BD: en código se mapea el primero por
     * assetId encontrado, que es el más reciente.
     */
    List<ModelAssetReview> findByUserIdOrderByIdDesc(Long userId);

    /**
     * Proyección DTO de reviews por estado con email + nickname del
     * modelo. Ordenada por {@code uploaded_at} ascendente (FIFO).
     *
     * <p>Capa 2 Fase 7 (D1+D2): se excluyen las reviews con
     * {@code asset_id IS NULL} — son huérfanas legacy (V5 grandfather
     * donde la URL ya no matcheaba), o reviews PENDING/APPROVED de
     * assets que el modelo eliminó tras la migración. El admin no
     * debería ver ese ruido en ninguno de los filtros.
     *
     * <p>Capa 2 Fase 9 bugfix 2: se devuelve SOLO la última review por
     * asset (criterio {@code max(r2.id)}). El rechazo retroactivo crea
     * una fila REJECTED nueva conservando la APPROVED histórica; sin
     * este filtro, el mismo asset aparecía en los filtros "Aprobado" Y
     * "Rechazado" simultáneamente. Con el subquery, la cola refleja el
     * estado actual del asset, no el histórico de decisiones. Las filas
     * históricas siguen en BD para auditoría externa.
     *
     * <p>Se usa {@code max(id)} en vez de {@code max(uploaded_at)}: el
     * rechazo retroactivo preserva el {@code uploaded_at} original
     * (timeline coherente con el asset, no con la nueva decisión), por
     * lo que ordenar por uploaded_at daría empates entre original y
     * retroactivo. El {@code id} es estrictamente monotónico y desempata
     * por orden de inserción.
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
              and r.assetId is not null
              and r.id = (
                  select max(r2.id) from ModelAssetReview r2
                  where r2.assetId = r.assetId
              )
            order by r.uploadedAt asc
           """)
    List<ModelAssetReviewDTO> findDTOsByStatusOrderByUploadedAtAsc(String status);

    /**
     * Localiza la review PENDING_REVIEW asociada a un asset concreto.
     * Usado por {@code ModelAssetService.delete} para cancelar la review
     * pendiente antes del hard-delete del asset (de lo contrario, la
     * FK ON DELETE SET NULL dejaría {@code asset_id=NULL} con la review
     * todavía en estado PENDING_REVIEW: huérfana en cola admin).
     */
    @Query("""
            select r from ModelAssetReview r
            where r.assetId = :assetId
              and r.status = 'PENDING_REVIEW'
           """)
    Optional<ModelAssetReview> findPendingByAssetId(Long assetId);
}
