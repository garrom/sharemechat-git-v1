// src/main/java/com/sharemechat/service/HomeFeaturedService.java
package com.sharemechat.service;

import com.sharemechat.dto.HomeFeaturedDTO;
import com.sharemechat.dto.ModelTeaserDTO;
import com.sharemechat.entity.HomeFeaturedModel;
import com.sharemechat.exception.HomeFeaturedEmptyException;
import com.sharemechat.repository.HomeFeaturedModelRepository;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class HomeFeaturedService {

    private final HomeFeaturedModelRepository homeRepo;
    private final ModelRepository modelRepository;
    private final ModelDocumentRepository modelDocumentRepository;
    private final UserRepository userRepository;

    // Total de modelos a mostrar en la home
    private static final int TOTAL_HOME_MODELS = 20;

    public HomeFeaturedService(HomeFeaturedModelRepository homeRepo,
                               ModelRepository modelRepository,
                               ModelDocumentRepository modelDocumentRepository,
                               UserRepository userRepository) {
        this.homeRepo = homeRepo;
        this.modelRepository = modelRepository;
        this.modelDocumentRepository = modelDocumentRepository;
        this.userRepository = userRepository;
    }

    // ======================================================
    // REFRESH: job horario que reconstruye el escaparate HOME
    // ======================================================
    @Transactional
    public void rebuildHomeFeatured() {

        // 1) Borramos todo el snapshot anterior
        homeRepo.deleteAllInBatch();

        int topCount = (int) (TOTAL_HOME_MODELS * 0.5);  // ~50%
        int newCount = (int) (TOTAL_HOME_MODELS * 0.3);  // ~30%
        int randomCount = TOTAL_HOME_MODELS - topCount - newCount;
        if (randomCount < 0) randomCount = 0;

        // --- TOP FACTURACIÓN ---
        List<ModelTeaserDTO> topModels = topCount > 0
                ? modelDocumentRepository.findTopByEarnings(PageRequest.of(0, topCount))
                : Collections.emptyList();

        // --- NUEVAS MODELOS ---
        List<ModelTeaserDTO> newModels = newCount > 0
                ? modelDocumentRepository.findNewestModels(PageRequest.of(0, newCount))
                : Collections.emptyList();

        // Set para evitar duplicados entre bloques
        Set<Long> usedIds = new HashSet<>();

        List<ModelTeaserDTO> finalTop = new ArrayList<>();
        for (ModelTeaserDTO dto : topModels) {
            if (dto.getModelId() != null && usedIds.add(dto.getModelId())) {
                finalTop.add(dto);
            }
        }

        List<ModelTeaserDTO> finalNew = new ArrayList<>();
        for (ModelTeaserDTO dto : newModels) {
            if (dto.getModelId() != null && usedIds.add(dto.getModelId())) {
                finalNew.add(dto);
            }
        }

        int remainingRandom = TOTAL_HOME_MODELS - finalTop.size() - finalNew.size();
        if (remainingRandom < 0) remainingRandom = 0;

        List<ModelTeaserDTO> finalRandom = new ArrayList<>();
        if (remainingRandom > 0) {
            // Pedimos más de los necesarios para compensar posibles duplicados
            int pageSize = remainingRandom * 3;
            List<ModelTeaserDTO> randomCandidates =
                    modelDocumentRepository.findRandomModels(PageRequest.of(0, pageSize));

            for (ModelTeaserDTO dto : randomCandidates) {
                if (finalRandom.size() >= remainingRandom) break;
                if (dto.getModelId() == null) continue;
                if (usedIds.add(dto.getModelId())) {
                    finalRandom.add(dto);
                }
            }
        }

        // Construimos la lista final en orden: TOP -> NEW -> RANDOM
        List<ModelTeaserDTO> finalList = new ArrayList<>();
        finalList.addAll(finalTop);
        finalList.addAll(finalNew);
        finalList.addAll(finalRandom);

        int pos = 1;
        for (ModelTeaserDTO dto : finalList) {

            // BLINDAJE: si no hay avatar, no intentamos insertar (la columna es NOT NULL)
            if (dto.getAvatarUrl() == null || dto.getAvatarUrl().trim().isEmpty()) {
                continue;
            }

            HomeFeaturedModel h = new HomeFeaturedModel();
            h.setModelId(dto.getModelId());
            h.setAvatarUrl(dto.getAvatarUrl());
            h.setVideoUrl(dto.getVideoUrl());
            h.setSourceType(resolveSource(dto, finalTop, finalNew));
            h.setPosition(pos++);
            homeRepo.save(h);
        }
    }

    private String resolveSource(ModelTeaserDTO dto,
                                 List<ModelTeaserDTO> topList,
                                 List<ModelTeaserDTO> newList) {

        Long id = dto.getModelId();
        if (id == null) return "RANDOM";

        boolean isTop = topList.stream().anyMatch(t -> id.equals(t.getModelId()));
        if (isTop) return "TOP";

        boolean isNew = newList.stream().anyMatch(t -> id.equals(t.getModelId()));
        if (isNew) return "NEW";

        return "RANDOM";
    }

    // ===========================
    // CONSUMO DESDE LA HOME (API)
    // ===========================
    public List<HomeFeaturedDTO> getHomeFeatured() {
        var list = homeRepo.findAllOrdered();
        if (list.isEmpty()) {
            throw new HomeFeaturedEmptyException();
        }
        return list.stream()
                .map(h -> new HomeFeaturedDTO(
                        h.getModelId(),
                        h.getAvatarUrl(),
                        h.getVideoUrl(),
                        h.getSourceType()
                ))
                .toList();
    }
}
