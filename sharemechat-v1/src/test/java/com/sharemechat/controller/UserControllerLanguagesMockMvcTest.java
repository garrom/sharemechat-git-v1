package com.sharemechat.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.dto.UserDTO;
import com.sharemechat.repository.ClientDocumentRepository;
import com.sharemechat.repository.ModelAssetRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.AgeGatePolicyService;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.ConsentService;
import com.sharemechat.service.CountryAccessService;
import com.sharemechat.service.ProductOperationalModeService;
import com.sharemechat.service.UserAcquisitionService;
import com.sharemechat.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fase 2 i18n: endpoint {@code PUT /api/users/me/languages}. MockMvc standalone
 * (sin contexto Spring ni seguridad): verifica el cableado 401/400/200 del
 * controller. La validación real de idiomas vive en el servicio y se cubre en
 * {@link com.sharemechat.service.UserServiceI18nTest}.
 */
class UserControllerLanguagesMockMvcTest {

    private UserService userService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        UserController controller = new UserController(
                userService,
                mock(UserRepository.class),
                mock(ModelAssetRepository.class),
                mock(ClientDocumentRepository.class),
                mock(CountryAccessService.class),
                mock(ConsentService.class),
                new AgeGatePolicyService("v1"),
                mock(BackofficeAccessService.class),
                mock(ProductOperationalModeService.class),
                mock(UserAcquisitionService.class)
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new ObjectMapper()))
                .build();
    }

    @Test
    void unauthenticatedReturns401AndDoesNotTouchService() throws Exception {
        mockMvc.perform(put("/api/users/me/languages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"langCode\":\"en\",\"primary\":true}]"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(userService);
    }

    @Test
    void unsupportedCodeMapsToBadRequest() throws Exception {
        when(userService.updateUserLanguages(eq("bob@example.com"), any()))
                .thenThrow(new IllegalArgumentException("Idioma no soportado: xx"));

        mockMvc.perform(put("/api/users/me/languages")
                        .principal(new TestingAuthenticationToken("bob@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"langCode\":\"xx\",\"primary\":true}]"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validPayloadReturns200WithUpdatedUser() throws Exception {
        UserDTO dto = new UserDTO();
        dto.setId(3L);
        dto.setEmail("bob@example.com");
        dto.setPrimaryLanguage("en");

        when(userService.updateUserLanguages(eq("bob@example.com"), any())).thenReturn(dto);

        mockMvc.perform(put("/api/users/me/languages")
                        .principal(new TestingAuthenticationToken("bob@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"langCode\":\"en\",\"primary\":true},{\"langCode\":\"es\",\"primary\":false}]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.primaryLanguage").value("en"));

        verify(userService).updateUserLanguages(eq("bob@example.com"), any(List.class));
    }
}
