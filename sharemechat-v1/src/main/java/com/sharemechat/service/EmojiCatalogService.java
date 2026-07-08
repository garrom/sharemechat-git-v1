package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.EmojiPublicDTO;
import com.sharemechat.entity.Gift;
import com.sharemechat.repository.GiftRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Catalogo publico de emojis del chat (Fase 2). Filtra por rol del user
 * autenticado:
 *   - MODEL -> solo FREE_EMOJI (tier=QUICK en BD).
 *   - CLIENT -> todo el catalogo activo (FREE_EMOJI + PAID_GIFT).
 *
 * La entidad Gift no se modifica. El discriminador sigue siendo la columna
 * `tier` con valores 'QUICK' (free) y 'PREMIUM' (pago). El mapping a la
 * categoria publica (FREE_EMOJI / PAID_GIFT) vive aqui.
 *
 * Complementa a GiftService.getPublicGifts() sin sustituirlo: el endpoint
 * legacy GET /api/gifts permanece intacto para no romper consumidores que
 * hoy dependen de el (retrocompat).
 */
@Service
public class EmojiCatalogService {

    static final String TIER_FREE = "QUICK";
    static final String TIER_PAID = "PREMIUM";

    private final GiftRepository giftRepository;

    public EmojiCatalogService(GiftRepository giftRepository) {
        this.giftRepository = giftRepository;
    }

    /**
     * Devuelve el catalogo disponible para el rol dado.
     *
     * @param role rol del user autenticado (Constants.Roles.CLIENT | MODEL).
     *             Cualquier otro valor se trata como MODEL por defensa (solo free).
     */
    public List<EmojiPublicDTO> getAvailableForRole(String role) {
        boolean isClient = Constants.Roles.CLIENT.equals(role);
        return giftRepository.findByActiveTrueOrderByDisplayOrderAscIdAsc()
                .stream()
                .filter(g -> isClient || isFreeTier(g.getTier()))
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private boolean isFreeTier(String tier) {
        return TIER_FREE.equalsIgnoreCase(tier == null ? "" : tier.trim());
    }

    private String mapCategory(String tier) {
        return isFreeTier(tier)
                ? EmojiPublicDTO.CATEGORY_FREE_EMOJI
                : EmojiPublicDTO.CATEGORY_PAID_GIFT;
    }

    private EmojiPublicDTO toDTO(Gift g) {
        return new EmojiPublicDTO(
                g.getId(),
                g.getCode(),
                g.getName(),
                g.getDescription(),
                g.getIcon(),
                g.getCost(),
                mapCategory(g.getTier()),
                g.getTier(),
                g.getFeatured(),
                g.getAnimationKey(),
                g.getLocaleKey()
        );
    }
}
