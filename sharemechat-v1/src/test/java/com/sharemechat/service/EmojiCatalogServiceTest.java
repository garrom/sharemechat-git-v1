package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.EmojiPublicDTO;
import com.sharemechat.entity.Gift;
import com.sharemechat.repository.GiftRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitarios de EmojiCatalogService (Fase 2 chat P2P).
 *
 * Cubren:
 * - MODEL solo ve tier=QUICK (FREE_EMOJI).
 * - CLIENT ve todo el catalogo activo (FREE_EMOJI + PAID_GIFT).
 * - Mapping tier -> category correcto.
 * - Ordenacion respeta el order del repository (displayOrder + id).
 * - Rol nulo/desconocido -> tratado como MODEL (defensa).
 */
class EmojiCatalogServiceTest {

    private GiftRepository giftRepository;
    private EmojiCatalogService svc;

    @BeforeEach
    void setUp() {
        giftRepository = mock(GiftRepository.class);
        svc = new EmojiCatalogService(giftRepository);
    }

    private Gift makeGift(long id, String code, String name, String tier, String cost) {
        Gift g = new Gift();
        try {
            java.lang.reflect.Field f = Gift.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(g, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        g.setCode(code);
        g.setName(name);
        g.setTier(tier);
        g.setCost(new BigDecimal(cost));
        g.setIcon("/img/gift-" + code + ".png");
        g.setFeatured(Boolean.FALSE);
        return g;
    }

    @Test
    @DisplayName("MODEL: solo devuelve gifts con tier=QUICK (FREE_EMOJI)")
    void modelReturnsOnlyFree() {
        Gift q1 = makeGift(1L, "KISS", "Kiss", "QUICK", "0.00");
        Gift q2 = makeGift(2L, "LOVE", "Love", "QUICK", "0.00");
        Gift p1 = makeGift(3L, "ROSE", "Rose", "PREMIUM", "5.00");
        Gift p2 = makeGift(4L, "DIAMOND", "Diamond", "PREMIUM", "20.00");
        when(giftRepository.findByActiveTrueOrderByDisplayOrderAscIdAsc())
                .thenReturn(List.of(q1, p1, q2, p2));

        List<EmojiPublicDTO> result = svc.getAvailableForRole(Constants.Roles.MODEL);

        assertEquals(2, result.size(), "MODEL solo ve 2 FREE_EMOJI");
        assertTrue(result.stream().allMatch(e -> EmojiPublicDTO.CATEGORY_FREE_EMOJI.equals(e.getCategory())));
        assertTrue(result.stream().allMatch(e -> "QUICK".equals(e.getTier())));
        assertEquals(List.of("KISS", "LOVE"), result.stream().map(EmojiPublicDTO::getCode).toList());
    }

    @Test
    @DisplayName("CLIENT: devuelve el catalogo completo activo (FREE + PAID)")
    void clientReturnsAll() {
        Gift q1 = makeGift(1L, "KISS", "Kiss", "QUICK", "0.00");
        Gift p1 = makeGift(2L, "ROSE", "Rose", "PREMIUM", "5.00");
        Gift p2 = makeGift(3L, "DIAMOND", "Diamond", "PREMIUM", "20.00");
        when(giftRepository.findByActiveTrueOrderByDisplayOrderAscIdAsc())
                .thenReturn(List.of(q1, p1, p2));

        List<EmojiPublicDTO> result = svc.getAvailableForRole(Constants.Roles.CLIENT);

        assertEquals(3, result.size(), "CLIENT ve todo el catalogo");
        assertEquals(EmojiPublicDTO.CATEGORY_FREE_EMOJI, result.get(0).getCategory());
        assertEquals(EmojiPublicDTO.CATEGORY_PAID_GIFT, result.get(1).getCategory());
        assertEquals(EmojiPublicDTO.CATEGORY_PAID_GIFT, result.get(2).getCategory());
    }

    @Test
    @DisplayName("Mapping tier -> category: QUICK -> FREE_EMOJI, PREMIUM -> PAID_GIFT")
    void tierMappingIsCorrect() {
        Gift q = makeGift(1L, "KISS", "Kiss", "QUICK", "0.00");
        Gift p = makeGift(2L, "ROSE", "Rose", "PREMIUM", "5.00");
        when(giftRepository.findByActiveTrueOrderByDisplayOrderAscIdAsc())
                .thenReturn(List.of(q, p));

        List<EmojiPublicDTO> result = svc.getAvailableForRole(Constants.Roles.CLIENT);

        EmojiPublicDTO free = result.stream().filter(e -> "KISS".equals(e.getCode())).findFirst().orElseThrow();
        EmojiPublicDTO paid = result.stream().filter(e -> "ROSE".equals(e.getCode())).findFirst().orElseThrow();
        assertEquals(EmojiPublicDTO.CATEGORY_FREE_EMOJI, free.getCategory());
        assertEquals(EmojiPublicDTO.CATEGORY_PAID_GIFT, paid.getCategory());
        assertEquals("QUICK", free.getTier());
        assertEquals("PREMIUM", paid.getTier());
    }

    @Test
    @DisplayName("Rol nulo se trata como MODEL (defensa): solo FREE")
    void nullRoleTreatedAsModel() {
        Gift q1 = makeGift(1L, "KISS", "Kiss", "QUICK", "0.00");
        Gift p1 = makeGift(2L, "ROSE", "Rose", "PREMIUM", "5.00");
        when(giftRepository.findByActiveTrueOrderByDisplayOrderAscIdAsc())
                .thenReturn(List.of(q1, p1));

        List<EmojiPublicDTO> result = svc.getAvailableForRole(null);

        assertEquals(1, result.size());
        assertEquals(EmojiPublicDTO.CATEGORY_FREE_EMOJI, result.get(0).getCategory());
    }

    @Test
    @DisplayName("Rol desconocido se trata como MODEL (defensa): solo FREE")
    void unknownRoleTreatedAsModel() {
        Gift q1 = makeGift(1L, "KISS", "Kiss", "QUICK", "0.00");
        Gift p1 = makeGift(2L, "ROSE", "Rose", "PREMIUM", "5.00");
        when(giftRepository.findByActiveTrueOrderByDisplayOrderAscIdAsc())
                .thenReturn(List.of(q1, p1));

        List<EmojiPublicDTO> result = svc.getAvailableForRole("ADMIN");

        assertEquals(1, result.size());
        assertEquals(EmojiPublicDTO.CATEGORY_FREE_EMOJI, result.get(0).getCategory());
    }

    @Test
    @DisplayName("Catalogo vacio: devuelve lista vacia sin fallar")
    void emptyCatalogOk() {
        when(giftRepository.findByActiveTrueOrderByDisplayOrderAscIdAsc()).thenReturn(List.of());

        assertTrue(svc.getAvailableForRole(Constants.Roles.CLIENT).isEmpty());
        assertTrue(svc.getAvailableForRole(Constants.Roles.MODEL).isEmpty());
    }
}
