package com.sharemechat.controller;

import com.sharemechat.consent.ConsentState;
import com.sharemechat.entity.User;
import com.sharemechat.exception.ConsentRequiredException;
import com.sharemechat.exception.GlobalExceptionHandler;
import com.sharemechat.handler.MessagesWsHandler;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.ConsentEnforcementService;
import com.sharemechat.service.FavoriteService;
import com.sharemechat.service.StatusService;
import com.sharemechat.service.StreamService;
import com.sharemechat.service.UserBlockService;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class FavoritesControllerConsentEnforcementMockMvcTest {

    @Test
    void addModelAllowsCompliantUser() throws Exception {
        FavoriteService favoriteService = mock(FavoriteService.class);
        UserRepository userRepository = mock(UserRepository.class);
        MessagesWsHandler messagesWsHandler = mock(MessagesWsHandler.class);
        StatusService statusService = mock(StatusService.class);
        StreamService streamService = mock(StreamService.class);
        UserBlockService userBlockService = mock(UserBlockService.class);
        ConsentEnforcementService consentEnforcementService = mock(ConsentEnforcementService.class);

        User user = new User();
        user.setId(15L);
        user.setEmail("carol@example.com");

        when(userRepository.findByEmail("carol@example.com")).thenReturn(Optional.of(user));

        FavoritesController controller = new FavoritesController(
                favoriteService,
                userRepository,
                messagesWsHandler,
                statusService,
                streamService,
                userBlockService,
                consentEnforcementService
        );

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mockMvc.perform(post("/api/favorites/models/44")
                        .principal(new TestingAuthenticationToken("carol@example.com", null)))
                .andExpect(status().isNoContent());

        verify(consentEnforcementService).assertAuthenticatedUserCompliant(any(), eq("POST /api/favorites/models/{modelId}"));
        verify(favoriteService).addModelToClientFavorites(15L, 44L);
    }

    @Test
    void addModelRejectsNonCompliantUser() throws Exception {
        FavoriteService favoriteService = mock(FavoriteService.class);
        UserRepository userRepository = mock(UserRepository.class);
        MessagesWsHandler messagesWsHandler = mock(MessagesWsHandler.class);
        StatusService statusService = mock(StatusService.class);
        StreamService streamService = mock(StreamService.class);
        UserBlockService userBlockService = mock(UserBlockService.class);
        ConsentEnforcementService consentEnforcementService = mock(ConsentEnforcementService.class);

        doThrow(new ConsentRequiredException(
                15L,
                "POST /api/favorites/models/{modelId}",
                new ConsentState(false, true, false, false, "v1")
        )).when(consentEnforcementService).assertAuthenticatedUserCompliant(any(), eq("POST /api/favorites/models/{modelId}"));

        FavoritesController controller = new FavoritesController(
                favoriteService,
                userRepository,
                messagesWsHandler,
                statusService,
                streamService,
                userBlockService,
                consentEnforcementService
        );

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mockMvc.perform(post("/api/favorites/models/44")
                        .principal(new TestingAuthenticationToken("carol@example.com", null)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AGE_GATE_REQUIRED"))
                .andExpect(jsonPath("$.requiredTermsVersion").value("v1"))
                .andExpect(jsonPath("$.reasonCode").value("missing_adult"));

        verify(favoriteService, never()).addModelToClientFavorites(any(), any());
    }

    @Test
    void listModelsMetaRejectsNonCompliantUser() throws Exception {
        FavoriteService favoriteService = mock(FavoriteService.class);
        UserRepository userRepository = mock(UserRepository.class);
        MessagesWsHandler messagesWsHandler = mock(MessagesWsHandler.class);
        StatusService statusService = mock(StatusService.class);
        StreamService streamService = mock(StreamService.class);
        UserBlockService userBlockService = mock(UserBlockService.class);
        ConsentEnforcementService consentEnforcementService = mock(ConsentEnforcementService.class);

        doThrow(new ConsentRequiredException(
                15L,
                "GET /api/favorites/models/meta",
                new ConsentState(false, true, false, false, "v1")
        )).when(consentEnforcementService).assertAuthenticatedUserCompliant(any(), eq("GET /api/favorites/models/meta"));

        FavoritesController controller = new FavoritesController(
                favoriteService,
                userRepository,
                messagesWsHandler,
                statusService,
                streamService,
                userBlockService,
                consentEnforcementService
        );

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mockMvc.perform(get("/api/favorites/models/meta")
                        .principal(new TestingAuthenticationToken("carol@example.com", null)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AGE_GATE_REQUIRED"))
                .andExpect(jsonPath("$.requiredTermsVersion").value("v1"))
                .andExpect(jsonPath("$.reasonCode").value("missing_adult"));

        verify(favoriteService, never()).listClientFavoritesMeta(any());
    }

    @Test
    void listClientsMetaAllowsCompliantUser() throws Exception {
        FavoriteService favoriteService = mock(FavoriteService.class);
        UserRepository userRepository = mock(UserRepository.class);
        MessagesWsHandler messagesWsHandler = mock(MessagesWsHandler.class);
        StatusService statusService = mock(StatusService.class);
        StreamService streamService = mock(StreamService.class);
        UserBlockService userBlockService = mock(UserBlockService.class);
        ConsentEnforcementService consentEnforcementService = mock(ConsentEnforcementService.class);

        User user = new User();
        user.setId(15L);
        user.setEmail("carol@example.com");

        when(userRepository.findByEmail("carol@example.com")).thenReturn(Optional.of(user));
        when(favoriteService.listModelFavoritesMeta(15L)).thenReturn(List.of());

        FavoritesController controller = new FavoritesController(
                favoriteService,
                userRepository,
                messagesWsHandler,
                statusService,
                streamService,
                userBlockService,
                consentEnforcementService
        );

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mockMvc.perform(get("/api/favorites/clients/meta")
                        .principal(new TestingAuthenticationToken("carol@example.com", null)))
                .andExpect(status().isOk());

        verify(consentEnforcementService).assertAuthenticatedUserCompliant(any(), eq("GET /api/favorites/clients/meta"));
        verify(favoriteService).listModelFavoritesMeta(15L);
    }
}
