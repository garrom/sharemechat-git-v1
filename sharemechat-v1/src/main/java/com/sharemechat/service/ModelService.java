package com.sharemechat.service;

import com.sharemechat.dto.ModelDTO;
import com.sharemechat.dto.ModelTeaserDTO;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.ModelDocument;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.storage.StorageUrlCodec;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Service
public class ModelService {

    private final ModelRepository modelRepository;
    private final ModelDocumentRepository modelDocumentRepository;
    private final StorageUrlCodec storageUrlCodec;

    public ModelService(ModelRepository modelRepository,
                        ModelDocumentRepository modelDocumentRepository,
                        StorageUrlCodec storageUrlCodec) {
        this.modelRepository = modelRepository;
        this.modelDocumentRepository = modelDocumentRepository;
        this.storageUrlCodec = storageUrlCodec;
    }

    // ==========================================
    // NUEVO: listar teasers de modelos verificadas
    // ==========================================
    public List<ModelTeaserDTO> listTeasers(int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        return modelDocumentRepository.findTeasersPage(pageable);
    }

    public boolean isAuthorizedTeaserStorageKey(Long ownerUserId, String requestedStorageKey) {
        if (ownerUserId == null || !StringUtils.hasText(requestedStorageKey)) {
            return false;
        }

        return modelDocumentRepository.findApprovedModelProfileDocumentByUserId(ownerUserId)
                .map(doc -> matchesAuthorizedTeaserStorageKey(doc, requestedStorageKey))
                .orElse(false);
    }

    private boolean matchesAuthorizedTeaserStorageKey(ModelDocument doc, String requestedStorageKey) {
        String normalizedVideoKey = normalizeManagedStorageKey(doc.getUrlVideo());
        if (Objects.equals(requestedStorageKey, normalizedVideoKey)) {
            return true;
        }

        String normalizedPicKey = normalizeManagedStorageKey(doc.getUrlPic());
        return Objects.equals(requestedStorageKey, normalizedPicKey);
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
