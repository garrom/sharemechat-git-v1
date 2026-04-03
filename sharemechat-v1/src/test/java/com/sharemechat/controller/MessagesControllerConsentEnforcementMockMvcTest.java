package com.sharemechat.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.consent.ConsentState;
import com.sharemechat.dto.MessageDTO;
import com.sharemechat.entity.User;
import com.sharemechat.exception.ConsentRequiredException;
import com.sharemechat.exception.GlobalExceptionHandler;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.ConsentEnforcementService;
import com.sharemechat.service.MessageService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MessagesControllerConsentEnforcementMockMvcTest {

    private MappingJackson2HttpMessageConverter jsonConverter() {
        return new MappingJackson2HttpMessageConverter(new ObjectMapper().findAndRegisterModules());
    }

    @Test
    void sendMessageAllowsCompliantUser() throws Exception {
        MessageService messageService = mock(MessageService.class);
        UserRepository userRepository = mock(UserRepository.class);
        ConsentEnforcementService consentEnforcementService = mock(ConsentEnforcementService.class);

        User user = new User();
        user.setId(11L);
        user.setEmail("alice@example.com");

        MessageDTO dto = new MessageDTO(77L, 11L, 22L, "hola", LocalDateTime.now(), null, null);

        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(messageService.send(11L, 22L, "hola")).thenReturn(dto);

        MessagesController controller = new MessagesController(messageService, userRepository, consentEnforcementService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(jsonConverter())
                .build();

        mockMvc.perform(post("/api/messages/to/22")
                        .principal(new TestingAuthenticationToken("alice@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"hola\"}"))
                .andExpect(status().isOk());

        verify(consentEnforcementService).assertAuthenticatedUserCompliant(any(), eq("POST /api/messages/to/{userId}"));
        verify(messageService).send(11L, 22L, "hola");
    }

    @Test
    void sendMessageRejectsNonCompliantUser() throws Exception {
        MessageService messageService = mock(MessageService.class);
        UserRepository userRepository = mock(UserRepository.class);
        ConsentEnforcementService consentEnforcementService = mock(ConsentEnforcementService.class);

        doThrow(new ConsentRequiredException(
                11L,
                "POST /api/messages/to/{userId}",
                new ConsentState(false, false, true, false, "v1")
        )).when(consentEnforcementService).assertAuthenticatedUserCompliant(any(), eq("POST /api/messages/to/{userId}"));

        MessagesController controller = new MessagesController(messageService, userRepository, consentEnforcementService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(jsonConverter())
                .build();

        mockMvc.perform(post("/api/messages/to/22")
                        .principal(new TestingAuthenticationToken("alice@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"hola\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AGE_GATE_REQUIRED"))
                .andExpect(jsonPath("$.requiredTermsVersion").value("v1"))
                .andExpect(jsonPath("$.reasonCode").value("missing_terms"));

        verify(messageService, never()).send(any(), any(), any());
    }

    @Test
    void conversationsRejectNonCompliantUser() throws Exception {
        MessageService messageService = mock(MessageService.class);
        UserRepository userRepository = mock(UserRepository.class);
        ConsentEnforcementService consentEnforcementService = mock(ConsentEnforcementService.class);

        doThrow(new ConsentRequiredException(
                11L,
                "GET /api/messages/conversations",
                new ConsentState(false, false, true, false, "v1")
        )).when(consentEnforcementService).assertAuthenticatedUserCompliant(any(), eq("GET /api/messages/conversations"));

        MessagesController controller = new MessagesController(messageService, userRepository, consentEnforcementService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(jsonConverter())
                .build();

        mockMvc.perform(get("/api/messages/conversations")
                        .principal(new TestingAuthenticationToken("alice@example.com", null)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AGE_GATE_REQUIRED"))
                .andExpect(jsonPath("$.requiredTermsVersion").value("v1"))
                .andExpect(jsonPath("$.reasonCode").value("missing_terms"));

        verify(messageService, never()).conversations(any());
    }

    @Test
    void historyAllowsCompliantUser() throws Exception {
        MessageService messageService = mock(MessageService.class);
        UserRepository userRepository = mock(UserRepository.class);
        ConsentEnforcementService consentEnforcementService = mock(ConsentEnforcementService.class);

        User user = new User();
        user.setId(11L);
        user.setEmail("alice@example.com");

        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(messageService.history(11L, 22L, null)).thenReturn(List.of());

        MessagesController controller = new MessagesController(messageService, userRepository, consentEnforcementService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(jsonConverter())
                .build();

        mockMvc.perform(get("/api/messages/with/22")
                        .principal(new TestingAuthenticationToken("alice@example.com", null)))
                .andExpect(status().isOk());

        verify(consentEnforcementService).assertAuthenticatedUserCompliant(any(), eq("GET /api/messages/with/{userId}"));
        verify(messageService).history(11L, 22L, null);
    }
}
