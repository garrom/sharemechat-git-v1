package com.sharemechat.service;

import com.sharemechat.dto.ModelAssetDTO;
import com.sharemechat.entity.ModelAsset;
import com.sharemechat.entity.ModelAssetReview;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelAssetRepository;
import com.sharemechat.repository.ModelAssetReviewRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Gestión del catálogo multi-asset del modelo (Capa 2): hasta 5 fotos y
 * 2 vídeos por modelo, con marca de principal por tipo y hard delete
 * (fila física borrada + objeto S3 eliminado).
 *
 * <p>Cada upload nuevo genera una fila en {@code model_assets} y dispara
 * {@code ModelAssetReviewService.createPendingReview(asset)} para que el
 * admin/support apruebe o rechace antes de que el cliente vea el asset.
 *
 * <p>El borrado es físico: la FK {@code model_asset_reviews.asset_id}
 * tiene {@code ON DELETE SET NULL} (V5), por lo que las reviews
 * históricas se conservan con {@code asset_id=NULL} preservando el
 * snapshot de {@code asset_url}, status, reviewer_id y timestamps como
 * traza auditable.
 *
 * <p>Invariantes mantenidas a nivel service:
 * <ul>
 *   <li>Solo un asset principal por (usuario, tipo).</li>
 *   <li>Máximo {@link #MAX_ACTIVE_PIC_PER_USER} fotos activas por usuario.</li>
 *   <li>Máximo {@link #MAX_ACTIVE_VIDEO_PER_USER} vídeos activos por usuario.</li>
 *   <li>El borrado del último asset aprobado de un tipo se bloquea si el
 *       modelo está activo (regla de visibilidad: si el modelo está
 *       publicado debe tener al menos 1 PIC y 1 VIDEO aprobados visibles).</li>
 * </ul>
 */
@Service
public class ModelAssetService {

    private static final Logger log = LoggerFactory.getLogger(ModelAssetService.class);

    /** Máximo de fotos activas por modelo (Capa 2). */
    public static final int MAX_ACTIVE_PIC_PER_USER = 5;

    /** Máximo de vídeos activos por modelo (Capa 2). */
    public static final int MAX_ACTIVE_VIDEO_PER_USER = 2;

    private final ModelAssetRepository modelAssetRepository;
    private final ModelAssetReviewRepository reviewRepository;
    private final ModelAssetReviewService reviewService;
    private final UserRepository userRepository;
    private final StorageService storageService;

    public ModelAssetService(ModelAssetRepository modelAssetRepository,
                             ModelAssetReviewRepository reviewRepository,
                             ModelAssetReviewService reviewService,
                             UserRepository userRepository,
                             StorageService storageService) {
        this.modelAssetRepository = modelAssetRepository;
        this.reviewRepository = reviewRepository;
        this.reviewService = reviewService;
        this.userRepository = userRepository;
        this.storageService = storageService;
    }

    // ============================================================
    // Lectura
    // ============================================================

    /**
     * Lista todos los assets del modelo (cualquier estado) enriquecidos
     * con el {@code reviewStatus} de su última review. Usado por
     * {@code GET /api/me/assets}.
     */
    @Transactional(readOnly = true)
    public List<ModelAssetDTO> listMyAssets(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("userId requerido");
        }
        List<ModelAsset> assets = modelAssetRepository.findByUserId(userId);
        List<ModelAssetReview> reviewsDesc = reviewRepository.findByUserIdOrderByIdDesc(userId);

        // Mapear cada asset a su review MAS RECIENTE (primera ocurrencia
        // por assetId en la lista desc).
        Map<Long, ModelAssetReview> latestByAsset = new HashMap<>();
        for (ModelAssetReview r : reviewsDesc) {
            if (r.getAssetId() != null) {
                latestByAsset.putIfAbsent(r.getAssetId(), r);
            }
        }

        return assets.stream()
                .map(a -> toDTOWithLatestReview(a, latestByAsset.get(a.getId())))
                .toList();
    }

    /**
     * Lista solo los assets aprobados activos del modelo, ordenados
     * (principal primero, luego por position asc). Usado por
     * {@code GET /api/models/{userId}/assets} (vista cliente).
     */
    @Transactional(readOnly = true)
    public List<ModelAssetDTO> listApprovedForClient(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("userId requerido");
        }
        return modelAssetRepository.findApprovedActiveForClient(userId).stream()
                .map(a -> toDTO(a, ModelAssetReviewService.STATUS_APPROVED, null, null))
                .toList();
    }

    // ============================================================
    // Upload
    // ============================================================

    /**
     * Sube un asset nuevo. Valida el límite operativo según tipo
     * ({@link #MAX_ACTIVE_PIC_PER_USER} / {@link #MAX_ACTIVE_VIDEO_PER_USER}).
     * Si es el primer asset activo de su tipo para este modelo, se
     * marca como principal automáticamente (de lo contrario el modelo
     * quedaría invisible al cliente hasta promover manualmente uno).
     * Tras persistir el asset, crea la review {@code PENDING_REVIEW}
     * vinculada por {@code asset_id}.
     */
    @Transactional
    public ModelAsset upload(Long userId, String assetType, MultipartFile file) throws IOException {
        if (userId == null) {
            throw new IllegalArgumentException("userId requerido");
        }
        requireValidAssetType(assetType);
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("file requerido");
        }

        long currentActive = modelAssetRepository.countByUserIdAndAssetType(userId, assetType);
        // El countByUserIdAndAssetType no filtra por isActive; necesito
        // contar solo activos. Lo derivo iterando o con query custom.
        long currentActiveTrue = modelAssetRepository.findByUserIdAndAssetType(userId, assetType).stream()
                .filter(ModelAsset::isActive)
                .count();

        int limit = ModelAsset.AssetType.PIC.equals(assetType)
                ? MAX_ACTIVE_PIC_PER_USER
                : MAX_ACTIVE_VIDEO_PER_USER;
        if (currentActiveTrue >= limit) {
            String label = ModelAsset.AssetType.PIC.equals(assetType) ? "fotos" : "vídeos";
            throw new IllegalStateException(
                    "Has alcanzado el límite de " + limit + " " + label + ". Elimina alguno primero.");
        }

        // Storage upload (mismo prefijo que ModelController de Capa 1).
        String storagePrefix = "models/" + userId + "/profile";
        String url = storageService.store(file, storagePrefix);

        // Si este es el primer asset activo de su tipo, será principal
        // (modelo no se queda invisible esperando a marcar principal).
        boolean isFirstOfType = currentActiveTrue == 0;

        ModelAsset asset = new ModelAsset();
        asset.setUserId(userId);
        asset.setAssetType(assetType);
        asset.setUrl(url);
        asset.setPrincipal(isFirstOfType);
        asset.setActive(true);
        asset.setPosition((int) currentActiveTrue); // 0 si es el primero, etc.
        asset.setUploadedAt(LocalDateTime.now());
        modelAssetRepository.save(asset);

        reviewService.createPendingReview(asset);

        log.info("[MODEL-ASSET] upload userId={} type={} assetId={} principal={} position={}",
                userId, assetType, asset.getId(), isFirstOfType, asset.getPosition());
        return asset;
    }

    // ============================================================
    // Marcar como principal
    // ============================================================

    /**
     * Marca un asset como principal de su tipo, desmarcando el principal
     * anterior si existía. Reglas:
     * <ul>
     *   <li>El asset debe pertenecer al usuario.</li>
     *   <li>El asset debe estar activo ({@code isActive=true}).</li>
     *   <li>La última review del asset debe estar en estado APPROVED
     *       (Fase 9). El modelo no puede promover PENDING_REVIEW,
     *       REJECTED ni CANCELLED a principal. Un asset PENDING que
     *       quedó marcado como principal por el flujo inicial del
     *       upload (primer asset activo del tipo) es la única excepción
     *       de origen automático; un cambio explícito del modelo
     *       siempre exige APPROVED.</li>
     * </ul>
     */
    @Transactional
    public ModelAsset markPrincipal(Long userId, Long assetId) {
        ModelAsset target = loadOwnedAssetOrThrow(userId, assetId);
        if (!target.isActive()) {
            throw new IllegalStateException(
                    "No se puede marcar como principal un asset eliminado.");
        }
        if (target.isPrincipal()) {
            return target; // ya es principal, nada que hacer
        }
        // Fase 9: la última review del asset debe estar APPROVED para
        // que el modelo lo promueva como principal.
        boolean isApproved = reviewRepository.findFirstByAssetIdOrderByIdDesc(assetId)
                .map(r -> ModelAssetReviewService.STATUS_APPROVED.equals(r.getStatus()))
                .orElse(false);
        if (!isApproved) {
            throw new IllegalStateException(
                    "Solo puedes marcar como principal un archivo aprobado.");
        }
        // Desmarcar el principal anterior del mismo tipo (si lo hay).
        modelAssetRepository.findByUserIdAndAssetTypeAndIsPrincipalTrue(userId, target.getAssetType())
                .ifPresent(prev -> {
                    prev.setPrincipal(false);
                    modelAssetRepository.save(prev);
                });
        target.setPrincipal(true);
        modelAssetRepository.save(target);

        log.info("[MODEL-ASSET] markPrincipal userId={} type={} assetId={}",
                userId, target.getAssetType(), assetId);
        return target;
    }

    // ============================================================
    // Borrar (hard)
    // ============================================================

    /**
     * Hard delete del asset: borra la fila física de {@code model_assets}
     * y el objeto físico de storage (S3/local). Las reviews históricas
     * vinculadas se preservan automáticamente con {@code asset_id=NULL}
     * por la FK {@code ON DELETE SET NULL} definida en V5; el snapshot
     * de {@code asset_url}, status, reviewer_id y timestamps se conserva
     * como traza auditable aunque la fila del asset ya no exista.
     *
     * <p>Reglas:
     * <ul>
     *   <li>El asset debe pertenecer al usuario.</li>
     *   <li>Si el modelo está activo en plataforma y este es el último
     *       asset APPROVED del tipo, se bloquea con 400 (el modelo
     *       quedaría invisible al cliente sin esta validación).</li>
     *   <li>Si el asset eliminado era el principal y aún hay otros
     *       activos del mismo tipo, se auto-promueve uno como principal
     *       (el primero por id asc) para mantener al modelo visible.</li>
     * </ul>
     *
     * <p>Orden de operaciones: (1) snapshot del next principal candidate
     * antes del delete, (2) hard delete de la fila DB (la FK SET NULL
     * actúa sobre reviews), (3) best-effort delete del objeto en
     * storage (si falla, log warning: la fila ya no existe y queda como
     * huérfano en S3 que recogerá un cleanup batch eventual), (4)
     * promoción del next principal si procedía.
     */
    @Transactional
    public void delete(Long userId, Long assetId) {
        ModelAsset asset = loadOwnedAssetOrThrow(userId, assetId);

        User user = userRepository.findById(userId).orElse(null);
        boolean userIsActive = user != null && Boolean.TRUE.equals(user.getIsActive());

        // ¿Este asset estaba aprobado? Se considera aprobado si tiene una
        // review con status=APPROVED (última review por id).
        boolean assetIsApproved = reviewRepository.findFirstByAssetIdOrderByIdDesc(assetId)
                .map(r -> ModelAssetReviewService.STATUS_APPROVED.equals(r.getStatus()))
                .orElse(false);

        if (userIsActive && assetIsApproved) {
            long approvedActiveOfType = modelAssetRepository.countApprovedActiveByUserAndType(
                    userId, asset.getAssetType());
            // Tras el borrado, este asset deja de contar. Si era el único,
            // el modelo quedaría sin asset aprobado de ese tipo.
            if (approvedActiveOfType <= 1) {
                String label = ModelAsset.AssetType.PIC.equals(asset.getAssetType())
                        ? "foto" : "vídeo";
                throw new IllegalStateException(
                        "No puedes eliminar tu última " + label + " aprobada. "
                                + "Sube una nueva primero y márcala como principal.");
            }
        }

        // Snapshot del candidato a próximo principal ANTES del delete, para
        // que la query no devuelva al propio asset que vamos a borrar.
        boolean wasPrincipal = asset.isPrincipal();
        String assetType = asset.getAssetType();
        String storageUrl = asset.getUrl();
        ModelAsset nextPrincipal = null;
        if (wasPrincipal) {
            nextPrincipal = modelAssetRepository.findByUserIdAndAssetType(userId, assetType).stream()
                    .filter(ModelAsset::isActive)
                    .filter(a -> !a.getId().equals(assetId))
                    .min((a, b) -> Long.compare(a.getId(), b.getId()))
                    .orElse(null);
        }

        // Capa 2 Fase 7 (D2): cancelar la review PENDING_REVIEW asociada
        // ANTES del hard-delete, para que no quede huérfana en cola. La
        // operación es idempotente: si la review ya está APPROVED o
        // REJECTED (decisión del admin), no hace nada.
        reviewService.cancelPendingByAssetId(assetId, userId);

        // Hard delete físico de la fila. La FK ON DELETE SET NULL en
        // model_asset_reviews.asset_id preserva las reviews históricas
        // (incluida la recién cancelada) con su asset_url snapshot intacto.
        modelAssetRepository.delete(asset);

        // Best-effort storage cleanup. La fila ya no existe en DB; si el
        // blob no puede borrarse, queda huérfano (aceptable, cleanup batch).
        try {
            storageService.deleteByPublicUrl(storageUrl);
        } catch (Exception ex) {
            log.warn("[MODEL-ASSET] storage delete fallo assetId={} url={}: {}",
                    assetId, storageUrl, ex.getMessage());
        }

        // Si era el principal y hay candidato, promoverlo.
        if (nextPrincipal != null) {
            nextPrincipal.setPrincipal(true);
            modelAssetRepository.save(nextPrincipal);
            log.info("[MODEL-ASSET] auto-promote principal userId={} type={} newPrincipalAssetId={}",
                    userId, assetType, nextPrincipal.getId());
        }

        log.info("[MODEL-ASSET] delete userId={} type={} assetId={} (hard)",
                userId, assetType, assetId);
    }

    // ============================================================
    // Internals
    // ============================================================

    private ModelAsset loadOwnedAssetOrThrow(Long userId, Long assetId) {
        if (assetId == null) {
            throw new IllegalArgumentException("assetId requerido");
        }
        ModelAsset asset = modelAssetRepository.findById(assetId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Asset no encontrado: " + assetId));
        if (!asset.getUserId().equals(userId)) {
            // No filtra "asset existe pero no es tuyo" vs "no existe": en
            // ambos casos 400 con mismo mensaje para no filtrar oraculo.
            throw new IllegalArgumentException("Asset no encontrado: " + assetId);
        }
        return asset;
    }

    private static void requireValidAssetType(String assetType) {
        if (!ModelAsset.AssetType.PIC.equals(assetType)
                && !ModelAsset.AssetType.VIDEO.equals(assetType)) {
            throw new IllegalArgumentException(
                    "assetType no válido: " + assetType + " (esperado PIC o VIDEO)");
        }
    }

    private ModelAssetDTO toDTOWithLatestReview(ModelAsset a, ModelAssetReview latestReview) {
        String status = latestReview != null ? latestReview.getStatus() : null;
        String reasonCode = latestReview != null ? latestReview.getRejectionReasonCode() : null;
        String reasonText = latestReview != null ? latestReview.getRejectionReasonText() : null;
        return toDTO(a, status, reasonCode, reasonText);
    }

    private ModelAssetDTO toDTO(ModelAsset a, String status, String reasonCode, String reasonText) {
        return new ModelAssetDTO(
                a.getId(),
                a.getUserId(),
                a.getAssetType(),
                a.getUrl(),
                a.isPrincipal(),
                a.isActive(),
                a.getPosition(),
                a.getUploadedAt(),
                status,
                reasonCode,
                reasonText
        );
    }
}
