package com.sharemechat.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.config.ProductOperationalProperties;
import com.sharemechat.service.ProductOperationalModeService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.GitProperties;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Properties;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Observabilidad: {@code GET /api/health/version} (MockMvc standalone, corre en
 * local). Verifica la forma del JSON con y sin git.properties. El permitAll de la
 * ruta es config de SecurityConfig (no cubierto aquí, el standalone no aplica
 * seguridad).
 */
class HealthVersionControllerTest {

    @SuppressWarnings("unchecked")
    private MockMvc build(GitProperties git, ProductOperationalProperties.Mode mode) {
        ObjectProvider<GitProperties> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(git);
        ProductOperationalModeService modeService = mock(ProductOperationalModeService.class);
        when(modeService.currentMode()).thenReturn(mode);
        return MockMvcBuilders
                .standaloneSetup(new HealthVersionController(provider, modeService))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new ObjectMapper()))
                .build();
    }

    @Test
    void versionSinGitProperties() throws Exception {
        build(null, ProductOperationalProperties.Mode.OPEN)
                .perform(get("/api/health/version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.commit").value("unknown"))
                .andExpect(jsonPath("$.branch").value("unknown"))
                .andExpect(jsonPath("$.productAccessMode").value("OPEN"))
                .andExpect(jsonPath("$.serverTime").exists());
    }

    @Test
    void versionConGitProperties() throws Exception {
        Properties p = new Properties();
        p.setProperty("commit.id.abbrev", "abc1234");
        p.setProperty("commit.id.full", "abc1234def5678");
        p.setProperty("branch", "main");
        p.setProperty("commit.time", "1690000000");
        GitProperties git = new GitProperties(p);

        build(git, ProductOperationalProperties.Mode.PRELAUNCH)
                .perform(get("/api/health/version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commit").value("abc1234"))
                .andExpect(jsonPath("$.branch").value("main"))
                .andExpect(jsonPath("$.productAccessMode").value("PRELAUNCH"));
    }
}
