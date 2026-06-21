package com.sharemechat.streammoderation.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.config.SightengineProperties;
import com.sharemechat.controller.StreamModerationWebhookController;
import com.sharemechat.security.HmacSha256;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests del webhook stub generico de moderacion (P1.3).
 *
 * Politica de respuestas zanjada en P1.3 (decisiones K3 y K4 de Fase A):
 *  - 400 si vendor no esta en el set permitido.
 *  - 401 si el webhook_secret esta vacio en config.
 *  - 401 si la firma HMAC es invalida o ausente.
 *  - 200 con cuerpo {status:"received","stub":"P1.3"} si todo OK.
 */
class StreamModerationWebhookControllerTest {

    private MockMvc mockMvc;
    private SightengineProperties props;

    @BeforeEach
    void setUp() {
        props = new SightengineProperties();
        StreamModerationWebhookController controller = new StreamModerationWebhookController(props);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    @DisplayName("vendor no soportado (UNKNOWN) -> 400 unsupported_vendor")
    void unsupportedVendor_400() throws Exception {
        mockMvc.perform(post("/api/webhooks/moderation/UNKNOWN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("unsupported_vendor"));
    }

    @Test
    @DisplayName("SIGHTENGINE con secret vacio en config -> 401 webhook_secret_not_configured")
    void sightengine_secretEmpty_401() throws Exception {
        props.setWebhookSecret(""); // explicit empty

        mockMvc.perform(post("/api/webhooks/moderation/SIGHTENGINE")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("webhook_secret_not_configured"));
    }

    @Test
    @DisplayName("SIGHTENGINE con secret null -> 401 webhook_secret_not_configured")
    void sightengine_secretNull_401() throws Exception {
        props.setWebhookSecret(null);

        mockMvc.perform(post("/api/webhooks/moderation/SIGHTENGINE")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("webhook_secret_not_configured"));
    }

    @Test
    @DisplayName("SIGHTENGINE con secret poblado + firma invalida -> 401 sin body")
    void sightengine_invalidSignature_401() throws Exception {
        props.setWebhookSecret("mi-secret");

        mockMvc.perform(post("/api/webhooks/moderation/SIGHTENGINE")
                        .header("X-Signature", "deadbeef")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"any\":\"payload\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));
    }

    @Test
    @DisplayName("SIGHTENGINE con secret poblado + firma valida -> 200 stub body P1.3")
    void sightengine_validSignature_200_stub() throws Exception {
        String secret = "mi-secret";
        String body = "{\"event\":\"sample\"}";
        String signature = HmacSha256.hexHmacSha256(secret, body.getBytes("UTF-8"));
        props.setWebhookSecret(secret);

        mockMvc.perform(post("/api/webhooks/moderation/SIGHTENGINE")
                        .header("X-Signature", signature)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("received"))
                .andExpect(jsonPath("$.stub").value("P1.3"));
    }

    @Test
    @DisplayName("HIVE -> 401 webhook_secret_not_configured (sin Properties propias en P1.3)")
    void hive_noProps_401() throws Exception {
        mockMvc.perform(post("/api/webhooks/moderation/HIVE")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("webhook_secret_not_configured"));
    }

    @Test
    @DisplayName("REKOGNITION -> 401 webhook_secret_not_configured")
    void rekognition_noProps_401() throws Exception {
        mockMvc.perform(post("/api/webhooks/moderation/REKOGNITION")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("webhook_secret_not_configured"));
    }

    @Test
    @DisplayName("vendor en minusculas (sightengine) -> se normaliza a uppercase y procesa")
    void vendor_lowercaseNormalized() throws Exception {
        props.setWebhookSecret("");

        mockMvc.perform(post("/api/webhooks/moderation/sightengine")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("webhook_secret_not_configured"));
    }
}
