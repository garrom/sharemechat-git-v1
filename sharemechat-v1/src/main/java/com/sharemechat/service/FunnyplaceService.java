package com.sharemechat.service;

import com.sharemechat.dto.FunnyplaceItemDTO;
import com.sharemechat.repository.ModelDocumentRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.List;
import java.util.Random;

@Service
public class FunnyplaceService {

    private final ModelDocumentRepository modelDocumentRepository;
    private final Random rng = new SecureRandom();

    public FunnyplaceService(ModelDocumentRepository modelDocumentRepository) {
        this.modelDocumentRepository = modelDocumentRepository;
    }

    /**
     * Devuelve un vídeo elegible (modelo verificada con urlVideo) aleatorio o null si no hay.
     */
    public FunnyplaceItemDTO pickRandom() {
        long count = modelDocumentRepository.countEligibleModelsWithVideo();
        if (count <= 0) return null;

        int index;
        if (count > Integer.MAX_VALUE) {
            // Cap a INT y luego modular para evitar overflow
            index = rng.nextInt(Integer.MAX_VALUE);
            index = (int) (index % count);
        } else {
            index = rng.nextInt((int) count); // [0, count)
        }

        // PageRequest.of(page, size) -> con size=1, page actúa como offset
        List<FunnyplaceItemDTO> page = modelDocumentRepository.findEligiblePage(PageRequest.of(index, 1));
        return page.isEmpty() ? null : page.get(0);
    }
}
