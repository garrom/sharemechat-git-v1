package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.EmojiPublicDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.EmojiCatalogService;
import com.sharemechat.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * MockMvc test de GET /api/products/emojis/available (Fase 2 chat P2P).
 *
 * Cubre:
 * - 200 con array filtrado a FREE_EMOJI cuando el user autenticado es MODEL.
 * - 200 con catalogo completo (FREE + PAID) cuando el user autenticado es
 *   CLIENT.
 */
class ProductEmojiControllerMockMvcTest {

    private EmojiCatalogService emojiCatalogService;
    private UserService userService;
    private ProductEmojiController controller;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        emojiCatalogService = mock(EmojiCatalogService.class);
        userService = mock(UserService.class);
        controller = new ProductEmojiController(emojiCatalogService, userService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    private User makeUser(long id, String email, String role) {
        User u = new User();
        u.setEmail(email);
        u.setRole(role);
        try {
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return u;
    }

    private EmojiPublicDTO makeDto(long id, String code, String category, String tier) {
        return new EmojiPublicDTO(
                id, code, code, null, "/img/" + code + ".png",
                new BigDecimal("0.00"), category, tier, Boolean.FALSE, null, null);
    }

    @Test
    @DisplayName("MODEL autenticado: devuelve array de FREE_EMOJI unicamente")
    void modelSeesOnlyFree() throws Exception {
        User model = makeUser(20L, "model@example.com", Constants.Roles.MODEL);
        when(userService.findByEmail("model@example.com")).thenReturn(model);

        EmojiPublicDTO kiss = makeDto(1L, "KISS", EmojiPublicDTO.CATEGORY_FREE_EMOJI, "QUICK");
        EmojiPublicDTO love = makeDto(2L, "LOVE", EmojiPublicDTO.CATEGORY_FREE_EMOJI, "QUICK");
        when(emojiCatalogService.getAvailableForRole(Constants.Roles.MODEL))
                .thenReturn(List.of(kiss, love));

        mockMvc.perform(get("/api/products/emojis/available")
                        .principal(new TestingAuthenticationToken("model@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].code").value("KISS"))
                .andExpect(jsonPath("$[0].category").value("FREE_EMOJI"))
                .andExpect(jsonPath("$[0].tier").value("QUICK"))
                .andExpect(jsonPath("$[1].code").value("LOVE"));
    }

    @Test
    @DisplayName("CLIENT autenticado: devuelve catalogo completo (FREE + PAID)")
    void clientSeesAll() throws Exception {
        User client = makeUser(30L, "client@example.com", Constants.Roles.CLIENT);
        when(userService.findByEmail("client@example.com")).thenReturn(client);

        EmojiPublicDTO kiss = makeDto(1L, "KISS", EmojiPublicDTO.CATEGORY_FREE_EMOJI, "QUICK");
        EmojiPublicDTO rose = makeDto(2L, "ROSE", EmojiPublicDTO.CATEGORY_PAID_GIFT, "PREMIUM");
        when(emojiCatalogService.getAvailableForRole(Constants.Roles.CLIENT))
                .thenReturn(List.of(kiss, rose));

        mockMvc.perform(get("/api/products/emojis/available")
                        .principal(new TestingAuthenticationToken("client@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].category").value("FREE_EMOJI"))
                .andExpect(jsonPath("$[1].category").value("PAID_GIFT"));
    }

    @Test
    @DisplayName("User no resuelto (email desconocido): fallback a MODEL")
    void unknownUserFallbackToModel() throws Exception {
        when(userService.findByEmail("ghost@example.com")).thenReturn(null);
        when(emojiCatalogService.getAvailableForRole("MODEL")).thenReturn(List.of());

        mockMvc.perform(get("/api/products/emojis/available")
                        .principal(new TestingAuthenticationToken("ghost@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
