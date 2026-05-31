package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelDTO;
import com.sharemechat.dto.ModelPublicProfileDTO;
import com.sharemechat.dto.ModelTeaserDTO;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.ModelAsset;
import com.sharemechat.entity.User;
import com.sharemechat.entity.UserLanguage;
import com.sharemechat.exception.UserNotFoundException;
import com.sharemechat.repository.ModelAssetRepository;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.UserLanguageRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.storage.StorageUrlCodec;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Service
public class ModelService {

    private final ModelRepository modelRepository;
    private final ModelDocumentRepository modelDocumentRepository;
    private final ModelAssetRepository modelAssetRepository;
    private final UserRepository userRepository;
    private final UserLanguageRepository userLanguageRepository;
    private final StorageUrlCodec storageUrlCodec;

    public ModelService(ModelRepository modelRepository,
                        ModelDocumentRepository modelDocumentRepository,
                        ModelAssetRepository modelAssetRepository,
                        UserRepository userRepository,
                        UserLanguageRepository userLanguageRepository,
                        StorageUrlCodec storageUrlCodec) {
        this.modelRepository = modelRepository;
        this.modelDocumentRepository = modelDocumentRepository;
        this.modelAssetRepository = modelAssetRepository;
        this.userRepository = userRepository;
        this.userLanguageRepository = userLanguageRepository;
        this.storageUrlCodec = storageUrlCodec;
    }

    // ==========================================
    // Capa 2 Fase 4: perfil público del modelo (modal "Ver perfil completo")
    // ==========================================

    /**
     * Carga el perfil público del modelo para el modal "Ver perfil completo"
     * accesible desde el menú de favoritos del cliente.
     *
     * <p>Valida que el usuario solicitado es un modelo activo y disponible.
     * Si no lo es (no existe, baja, suspendido, banneado, todavía es
     * onboarding USER+FORM_MODEL, no aprobado, ...), lanza
     * {@link UserNotFoundException} para que el frontend muestre el
     * mensaje "Esta modelo ya no está disponible" (404).
     *
     * <p>El payload NO incluye {@code name} / {@code surname} / {@code email}
     * / {@code country} ni ningún otro dato sensible. Ver
     * {@link ModelPublicProfileDTO} para el detalle de campos expuestos.
     */
    @Transactional(readOnly = true)
    public ModelPublicProfileDTO getPublicProfile(Long userId) {
        if (userId == null) {
            throw new UserNotFoundException("Modelo no disponible");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("Modelo no disponible"));

        if (!isModelPubliclyAvailable(user)) {
            // No filtramos la causa concreta (rol, status, baja, ...) para
            // no dar señales sobre la cuenta a terceros.
            throw new UserNotFoundException("Modelo no disponible");
        }

        List<UserLanguage> langs = userLanguageRepository.findByUserId(userId);
        List<ModelPublicProfileDTO.LanguageEntry> languageEntries = langs.stream()
                .map(l -> new ModelPublicProfileDTO.LanguageEntry(
                        l.getLangCode(),
                        l.getLevel(),
                        l.isPrimary()))
                .toList();

        return new ModelPublicProfileDTO(
                user.getId(),
                user.getNickname(),
                user.getBiography(),
                user.getInterests(),
                languageEntries
        );
    }

    private boolean isModelPubliclyAvailable(User user) {
        if (user == null) return false;
        if (!Constants.Roles.MODEL.equals(user.getRole())) return false;
        if (!Boolean.TRUE.equals(user.getIsActive())) return false;
        if (Boolean.TRUE.equals(user.getUnsubscribe())) return false;
        // El estado disponible al público equivale a ACTIVE; SUSPENDED y
        // BANNED quedan fuera (consistente con la regla de exclusión del
        // matching pool).
        if (!Constants.AccountStatuses.ACTIVE.equals(user.getAccountStatus())) {
            return false;
        }
        // Verificación KYC aprobada (sin esto el modelo no puede aparecer
        // ante el cliente).
        if (!Constants.VerificationStatuses.APPROVED.equals(user.getVerificationStatus())) {
            return false;
        }
        return true;
    }

    // ==========================================
    // NUEVO: listar teasers de modelos verificadas
    // ==========================================
    public List<ModelTeaserDTO> listTeasers(int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        return modelDocumentRepository.findTeasersPage(pageable);
    }

    /**
     * Capa 2: el cliente verá la galería expandida del modelo con varios
     * assets aprobados. La autorización debe cubrir todos los assets
     * APPROVED activos del modelo (no solo el principal), porque
     * cualquiera de ellos es legítimo de servir vía
     * {@code /api/storage/content?ref=...}.
     *
     * <p>Flujo:
     * <ol>
     *   <li>Verifica que el usuario es modelo aprobado (proxy:
     *       {@code findApprovedModelProfileDocumentByUserId} sigue siendo
     *       válido; devuelve presente solo si user.role=MODEL y
     *       verificationStatus=APPROVED).</li>
     *   <li>Itera sobre los assets APPROVED activos del modelo y compara
     *       la storage key normalizada con la solicitada.</li>
     * </ol>
     */
    public boolean isAuthorizedTeaserStorageKey(Long ownerUserId, String requestedStorageKey) {
        if (ownerUserId == null || !StringUtils.hasText(requestedStorageKey)) {
            return false;
        }
        if (modelDocumentRepository.findApprovedModelProfileDocumentByUserId(ownerUserId).isEmpty()) {
            return false;
        }
        List<ModelAsset> approvedAssets = modelAssetRepository.findApprovedActiveByUser(ownerUserId);
        for (ModelAsset asset : approvedAssets) {
            String normalizedKey = normalizeManagedStorageKey(asset.getUrl());
            if (Objects.equals(requestedStorageKey, normalizedKey)) {
                return true;
            }
        }
        return false;
    }

    private String normalizeManagedStorageKey(String publicUrl) {
        if (!StringUtils.hasText(publicUrl)) {
            return null;
        }
        return storageUrlCodec.extractKeyFromManagedUrl(publicUrl);
    }

    // ==========================================
    // Métodos existentes (sin cambios)
    // ==========================================
    public ModelDTO getModelDTO(User user) {
        Model model = modelRepository.findByUser(user).orElse(null);
        if (model == null) {
            ModelDTO dto = new ModelDTO();
            dto.setUserId(user.getId());
            dto.setStreamingHours(BigDecimal.ZERO);
            dto.setSaldoActual(BigDecimal.ZERO);
            dto.setTotalIngresos(BigDecimal.ZERO);
            return dto;
        }
        return mapToDTO(model);
    }

    public ModelDTO mapToDTO(Model m) {
        ModelDTO dto = new ModelDTO();
        dto.setUserId(m.getUserId());
        dto.setStreamingHours(m.getStreamingHours() != null ? m.getStreamingHours() : BigDecimal.ZERO);
        dto.setSaldoActual(m.getSaldoActual() != null ? m.getSaldoActual() : BigDecimal.ZERO);
        dto.setTotalIngresos(m.getTotalIngresos() != null ? m.getTotalIngresos() : BigDecimal.ZERO);
        return dto;
    }
}
