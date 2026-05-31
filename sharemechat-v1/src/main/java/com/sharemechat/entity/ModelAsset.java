package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Asset de perfil público de modelo: foto o vídeo que se muestra al
 * cliente cuando la modelo aparece en los listings (teasers, top,
 * newest, random) o en su perfil expandido.
 *
 * <p>Sustituye a las columnas {@code url_pic} / {@code url_video} de
 * {@code model_documents} de Capa 1. Permite varios assets por modelo
 * con marca {@link #isPrincipal} (la principal aparece primero) e
 * {@link #isActive} (soft delete operativo). El asset se considera
 * "visible al cliente" si existe al menos una {@code ModelAssetReview}
 * con {@code status='APPROVED'} apuntando a su {@code id}.
 *
 * <p>Límites operativos (vigilados a nivel service en Fase 2): 5 fotos
 * y 2 vídeos por modelo. La unicidad del principal por tipo también
 * se valida en service (no hay constraint UNIQUE parcial en MySQL).
 */
@Entity
@Table(name = "model_assets")
public class ModelAsset {

    /** Constantes públicas para el tipo de asset. */
    public static final class AssetType {
        public static final String PIC = "PIC";
        public static final String VIDEO = "VIDEO";

        private AssetType() {
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** {@code PIC} | {@code VIDEO}. Validado por CHECK constraint en BD. */
    @Column(name = "asset_type", nullable = false, length = 20)
    private String assetType;

    @Column(name = "url", nullable = false, length = 500)
    private String url;

    /**
     * Marca de "principal": la primera que el cliente ve cuando la
     * modelo aparece en el listing (teaser thumbnail/video). El service
     * garantiza unicidad por (user_id, asset_type) — solo una principal
     * por tipo por modelo.
     */
    @Column(name = "is_principal", nullable = false)
    private boolean isPrincipal = false;

    /**
     * Soft delete: cuando un asset se "elimina" desde el panel del
     * modelo, se marca {@code is_active=false} en vez de borrar la
     * fila. Las reviews historicas siguen apuntando al asset.
     */
    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    /** Orden en la galería del cliente (0 = primero). */
    @Column(name = "position", nullable = false)
    private Integer position = 0;

    /** Momento del upload por parte del modelo. */
    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;

    /** Sello de inserción gestionado por la BD (DEFAULT CURRENT_TIMESTAMP). */
    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    // ----- getters & setters -----

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getAssetType() { return assetType; }
    public void setAssetType(String assetType) { this.assetType = assetType; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public boolean isPrincipal() { return isPrincipal; }
    public void setPrincipal(boolean principal) { this.isPrincipal = principal; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { this.isActive = active; }

    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }

    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
