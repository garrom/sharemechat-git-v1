package com.sharemechat.repository;

import com.sharemechat.entity.ModelAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ModelAssetRepository extends JpaRepository<ModelAsset, Long> {

    /** Todos los assets del modelo, sin filtros. */
    List<ModelAsset> findByUserId(Long userId);

    /** Assets del modelo restringidos por tipo {@code PIC} | {@code VIDEO}. */
    List<ModelAsset> findByUserIdAndAssetType(Long userId, String assetType);

    /**
     * Asset marcado como principal por tipo. El service garantiza
     * unicidad por (user, type) — solo una principal por tipo por
     * modelo — por lo que devuelve {@link Optional} aunque el tipo
     * de retorno podría confundirse con "puede haber varias".
     */
    Optional<ModelAsset> findByUserIdAndAssetTypeAndIsPrincipalTrue(Long userId, String assetType);

    /**
     * Conteo de assets por (usuario, tipo). Usado por el service para
     * validar los límites operativos: 5 fotos y 2 vídeos por modelo
     * (Capa 2). Devuelve {@code long} (no Long) para evitar autoboxing
     * en validaciones frecuentes.
     */
    long countByUserIdAndAssetType(Long userId, String assetType);

    /**
     * True si el modelo tiene AL MENOS UN asset activo del tipo pedido
     * cuya última review esté en estado APPROVED. Defensa adicional
     * para superficies que solo necesitan saber si el modelo tiene
     * algún asset aprobado del tipo, sin requerir que sea el principal.
     *
     * <p>Para alinear con la regla de visibilidad real del pool (que
     * exige principal+activo+APPROVED de PIC y VIDEO), usar
     * {@link #existsApprovedPrincipalActiveByUserAndType(Long, String)}.
     */
    @Query("""
            select count(ma) > 0
            from ModelAsset ma, ModelAssetReview mar
            where mar.assetId = ma.id
              and ma.userId = :userId
              and ma.assetType = :assetType
              and ma.isActive = true
              and mar.status = 'APPROVED'
           """)
    boolean existsApprovedAssetForUserAndType(Long userId, String assetType);

    /**
     * True si el modelo tiene un asset PRINCIPAL activo del tipo pedido
     * con review APPROVED. Esta es la condición exacta que usan las 5
     * queries del listado público al cliente
     * ({@code countEligibleModelsWithVideo}, {@code findTeasersPage},
     * {@code findTopByEarnings}, {@code findNewestModels},
     * {@code findRandomModels}); cualquier check de "modelo visible"
     * debe usar esta variante para no quedar desalineado.
     *
     * <pre>
     *   visibleAlCliente(user) =
     *     user.verification_status = 'APPROVED'
     *     AND existsApprovedPrincipalActiveByUserAndType(user.id, 'PIC')
     *     AND existsApprovedPrincipalActiveByUserAndType(user.id, 'VIDEO')
     * </pre>
     */
    @Query("""
            select count(ma) > 0
            from ModelAsset ma, ModelAssetReview mar
            where mar.assetId = ma.id
              and ma.userId = :userId
              and ma.assetType = :assetType
              and ma.isPrincipal = true
              and ma.isActive = true
              and mar.status = 'APPROVED'
           """)
    boolean existsApprovedPrincipalActiveByUserAndType(Long userId, String assetType);

    /**
     * Cuenta de assets activos y aprobados del modelo por tipo. Usado para
     * la validación de borrado: si tras eliminar quedaría 0 aprobados del
     * mismo tipo y el modelo está activo, el borrado se bloquea.
     */
    @Query("""
            select count(ma)
            from ModelAsset ma, ModelAssetReview mar
            where mar.assetId = ma.id
              and ma.userId = :userId
              and ma.assetType = :assetType
              and ma.isActive = true
              and mar.status = 'APPROVED'
           """)
    long countApprovedActiveByUserAndType(Long userId, String assetType);

    /**
     * Todos los assets aprobados activos del modelo (cualquier tipo).
     * Usado por {@code ModelService.isAuthorizedTeaserStorageKey} para
     * validar el storageKey que solicita un cliente al endpoint
     * {@code /api/storage/content} contra TODAS las URLs aprobadas
     * (no solo las principales) — el cliente puede pedir cualquier
     * asset de la galería expandida.
     */
    @Query("""
            select ma
            from ModelAsset ma, ModelAssetReview mar
            where mar.assetId = ma.id
              and ma.userId = :userId
              and ma.isActive = true
              and mar.status = 'APPROVED'
           """)
    List<ModelAsset> findApprovedActiveByUser(Long userId);

    /**
     * URL del asset principal aprobado del tipo pedido. Usado por
     * {@code UserController} para los endpoints de avatar (batch e
     * individual) — el avatar del modelo es la foto principal aprobada.
     * Vacío si no tiene principal aprobada (modelo sin foto visible).
     */
    @Query("""
            select ma.url
            from ModelAsset ma, ModelAssetReview mar
            where mar.assetId = ma.id
              and ma.userId = :userId
              and ma.assetType = :assetType
              and ma.isPrincipal = true
              and ma.isActive = true
              and mar.status = 'APPROVED'
           """)
    Optional<String> findApprovedPrincipalUrl(Long userId, String assetType);

    /**
     * Variante batch del anterior para el endpoint de listado de avatares
     * de UserController. Devuelve pares {@code (userId, url)} en una sola
     * query, evitando el N+1.
     */
    @Query("""
            select ma.userId, ma.url
            from ModelAsset ma, ModelAssetReview mar
            where mar.assetId = ma.id
              and ma.userId in :userIds
              and ma.assetType = :assetType
              and ma.isPrincipal = true
              and ma.isActive = true
              and mar.status = 'APPROVED'
           """)
    List<Object[]> findApprovedPrincipalUrlsForUsers(List<Long> userIds, String assetType);

    /**
     * Lista de assets aprobados activos del modelo ordenada para la
     * galería pública del cliente (principal primero, luego por
     * {@code position} asc). Usado por
     * {@code GET /api/models/{userId}/assets}.
     */
    @Query("""
            select ma
            from ModelAsset ma, ModelAssetReview mar
            where mar.assetId = ma.id
              and ma.userId = :userId
              and ma.isActive = true
              and mar.status = 'APPROVED'
            order by ma.isPrincipal desc, ma.position asc, ma.id asc
           """)
    List<ModelAsset> findApprovedActiveForClient(Long userId);
}
