package com.sharemechat.repository;

import com.sharemechat.dto.ModelTeaserDTO;
import com.sharemechat.entity.ModelDocument;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ModelDocumentRepository extends JpaRepository<ModelDocument, Long> {

    Optional<ModelDocument> findByUserId(Long userId);
    boolean existsByUserId(Long userId);

    // ============================================================
    // Queries de listado público de modelos al cliente
    // ============================================================
    // Migradas en Capa 2 (V5) desde leer model_documents.url_pic/url_video
    // + flags denormalizados, a JOIN con model_assets:
    //
    //   - El modelo aparece SOLO si tiene un asset PIC principal activo
    //     APPROVED y un asset VIDEO principal activo APPROVED.
    //   - El cliente ve esos dos URLs (los principales) en el teaser
    //     thumbnail/video. La galería expandida (otros assets aprobados)
    //     se carga vía endpoint aparte GET /api/models/{userId}/assets.
    //   - Las EXISTS evitan duplicados si en el futuro un asset tuviera
    //     múltiples reviews aprobadas asociadas. El invariante actual
    //     es 1 review por asset, pero la query queda defensiva.

    // Cantidad total de modelos visibles al cliente
    @Query("""
           select count(distinct u)
           from User u, ModelAsset pic, ModelAsset video
           where pic.userId = u.id
             and pic.assetType = 'PIC'
             and pic.isPrincipal = true
             and pic.isActive = true
             and exists (
                 select 1 from ModelAssetReview rPic
                 where rPic.assetId = pic.id and rPic.status = 'APPROVED'
             )
             and video.userId = u.id
             and video.assetType = 'VIDEO'
             and video.isPrincipal = true
             and video.isActive = true
             and exists (
                 select 1 from ModelAssetReview rVideo
                 where rVideo.assetId = video.id and rVideo.status = 'APPROVED'
             )
             and u.role = 'MODEL'
             and u.verificationStatus = 'APPROVED'
           """)
    long countEligibleModelsWithVideo();

    /**
     * Lookup individual del documento KYC del modelo aprobado. Capa 2:
     * la query NO comprueba url_video (la columna ya no existe). Sirve
     * como proxy "el usuario es modelo APPROVED y tiene fila en
     * model_documents". Quien autorice contra URLs concretas debe
     * iterar sobre model_assets aparte.
     */
    @Query("""
           select md
           from ModelDocument md, User u
           where u.id = md.userId
             and u.id = :userId
             and u.role = 'MODEL'
             and u.verificationStatus = 'APPROVED'
           """)
    Optional<ModelDocument> findApprovedModelProfileDocumentByUserId(Long userId);

    // Paginada genérica para teasers (orden técnico por id)
    @Query("""
           select new com.sharemechat.dto.ModelTeaserDTO(
               u.id,
               COALESCE(u.nickname, u.name, u.email),
               pic.url,
               video.url
           )
           from User u, ModelAsset pic, ModelAsset video
           where pic.userId = u.id
             and pic.assetType = 'PIC'
             and pic.isPrincipal = true
             and pic.isActive = true
             and exists (
                 select 1 from ModelAssetReview rPic
                 where rPic.assetId = pic.id and rPic.status = 'APPROVED'
             )
             and video.userId = u.id
             and video.assetType = 'VIDEO'
             and video.isPrincipal = true
             and video.isActive = true
             and exists (
                 select 1 from ModelAssetReview rVideo
                 where rVideo.assetId = video.id and rVideo.status = 'APPROVED'
             )
             and u.role = 'MODEL'
             and u.verificationStatus = 'APPROVED'
           order by u.id asc
           """)
    List<ModelTeaserDTO> findTeasersPage(Pageable pageable);

    // TOP: modelos ordenadas por total_ingresos (mayor facturación primero)
    @Query("""
           select new com.sharemechat.dto.ModelTeaserDTO(
               u.id,
               COALESCE(u.nickname, u.name, u.email),
               pic.url,
               video.url
           )
           from User u, Model m, ModelAsset pic, ModelAsset video
           where m.userId = u.id
             and pic.userId = u.id
             and pic.assetType = 'PIC'
             and pic.isPrincipal = true
             and pic.isActive = true
             and exists (
                 select 1 from ModelAssetReview rPic
                 where rPic.assetId = pic.id and rPic.status = 'APPROVED'
             )
             and video.userId = u.id
             and video.assetType = 'VIDEO'
             and video.isPrincipal = true
             and video.isActive = true
             and exists (
                 select 1 from ModelAssetReview rVideo
                 where rVideo.assetId = video.id and rVideo.status = 'APPROVED'
             )
             and u.role = 'MODEL'
             and u.verificationStatus = 'APPROVED'
           order by m.totalIngresos desc nulls last
           """)
    List<ModelTeaserDTO> findTopByEarnings(Pageable pageable);

    // NEW: modelos más recientes según users.created_at
    @Query("""
           select new com.sharemechat.dto.ModelTeaserDTO(
               u.id,
               COALESCE(u.nickname, u.name, u.email),
               pic.url,
               video.url
           )
           from User u, ModelAsset pic, ModelAsset video
           where pic.userId = u.id
             and pic.assetType = 'PIC'
             and pic.isPrincipal = true
             and pic.isActive = true
             and exists (
                 select 1 from ModelAssetReview rPic
                 where rPic.assetId = pic.id and rPic.status = 'APPROVED'
             )
             and video.userId = u.id
             and video.assetType = 'VIDEO'
             and video.isPrincipal = true
             and video.isActive = true
             and exists (
                 select 1 from ModelAssetReview rVideo
                 where rVideo.assetId = video.id and rVideo.status = 'APPROVED'
             )
             and u.role = 'MODEL'
             and u.verificationStatus = 'APPROVED'
           order by u.createdAt desc
           """)
    List<ModelTeaserDTO> findNewestModels(Pageable pageable);

    // RANDOM: selección aleatoria (para el job horario; no para cada request)
    @Query("""
           select new com.sharemechat.dto.ModelTeaserDTO(
               u.id,
               COALESCE(u.nickname, u.name, u.email),
               pic.url,
               video.url
           )
           from User u, ModelAsset pic, ModelAsset video
           where pic.userId = u.id
             and pic.assetType = 'PIC'
             and pic.isPrincipal = true
             and pic.isActive = true
             and exists (
                 select 1 from ModelAssetReview rPic
                 where rPic.assetId = pic.id and rPic.status = 'APPROVED'
             )
             and video.userId = u.id
             and video.assetType = 'VIDEO'
             and video.isPrincipal = true
             and video.isActive = true
             and exists (
                 select 1 from ModelAssetReview rVideo
                 where rVideo.assetId = video.id and rVideo.status = 'APPROVED'
             )
             and u.role = 'MODEL'
             and u.verificationStatus = 'APPROVED'
           order by function('RAND')
           """)
    List<ModelTeaserDTO> findRandomModels(Pageable pageable);

}
