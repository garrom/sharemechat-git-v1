package com.sharemechat.service;

import com.sharemechat.dto.GiftPublicDTO;
import com.sharemechat.entity.Gift;
import com.sharemechat.repository.GiftRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class GiftService {

    private final GiftRepository giftRepository;

    public GiftService(GiftRepository giftRepository) {
        this.giftRepository = giftRepository;
    }

    public List<GiftPublicDTO> getPublicGifts() {
        return giftRepository.findByActiveTrueOrderByDisplayOrderAscIdAsc()
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private GiftPublicDTO toDTO(Gift g) {
        return new GiftPublicDTO(
                g.getId(),
                g.getCode(),
                g.getName(),
                g.getDescription(),
                g.getIcon(),
                g.getCost(),
                g.getTier(),
                g.getFeatured(),
                g.getAnimationKey(),
                g.getLocaleKey()
        );
    }
}
