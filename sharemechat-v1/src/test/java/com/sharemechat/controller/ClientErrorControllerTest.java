package com.sharemechat.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Observabilidad #4: {@code POST /api/observability/client-error} (MockMvc
 * standalone). Acepta el error del navegador y responde 204 (fire-and-forget).
 * El permitAll es config de SecurityConfig.
 */
class ClientErrorControllerTest {

    private final MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new ClientErrorController())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(new ObjectMapper()))
            .build();

    @Test
    void aceptaUnErrorYDevuelve204() throws Exception {
        mvc.perform(post("/api/observability/client-error")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"boom\",\"source\":\"App.jsx:10:5\","
                                + "\"stack\":\"Error: boom\\n at x\",\"url\":\"https://x/y\"}"))
                .andExpect(status().isNoContent());
    }

    @Test
    void bodyVacioDevuelve204() throws Exception {
        mvc.perform(post("/api/observability/client-error")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNoContent());
    }
}
