package com.sharemechat.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.dto.ConsentAcceptRequest;
import com.sharemechat.entity.User;
import com.sharemechat.exception.GlobalExceptionHandler;
import com.sharemechat.exception.TooManyRequestsException;
import com.sharemechat.service.ApiRateLimitService;
import com.sharemechat.service.ConsentService;
import com.sharemechat.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ConsentControllerMockMvcTest {

    private MockMvc build(ConsentService consentService, UserService userService, ApiRateLimitService rateLimit) {
        ConsentController controller = new ConsentController(consentService, userService, rateLimit);
        // findAndRegisterModules() registra JavaTimeModule para serializar el LocalDateTime
        // del cuerpo de error (p.ej. el 429 de TooManyRequestsException).
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        return MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper))
                .build();
    }

    @Test
    void acceptConsentUpdatesAccountAndReturnsOk() throws Exception {
        ConsentService consentService = mock(ConsentService.class);
        UserService userService = mock(UserService.class);
        ApiRateLimitService rateLimit = mock(ApiRateLimitService.class);

        User user = new User();
        user.setId(22L);
        user.setEmail("bob@example.com");
        when(userService.findByEmail("bob@example.com")).thenReturn(user);

        MockMvc mockMvc = build(consentService, userService, rateLimit);

        ConsentAcceptRequest request = new ConsentAcceptRequest();
        request.setConfirmAdult(true);
        request.setAcceptTerms(true);
        request.setTermsVersion("v1");

        mockMvc.perform(post("/api/consent/accept")
                        .principal(new TestingAuthenticationToken("bob@example.com", null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper().writeValueAsBytes(request)))
                .andExpect(status().isOk());

        verify(consentService).acceptAccountConsent(any(), eq(22L), any(ConsentAcceptRequest.class));
    }

    @Test
    void ageGatePasaRateLimitYRegistra() throws Exception {
        ConsentService consentService = mock(ConsentService.class);
        ApiRateLimitService rateLimit = mock(ApiRateLimitService.class);
        MockMvc mockMvc = build(consentService, mock(UserService.class), rateLimit);

        mockMvc.perform(post("/api/consent/age-gate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNoContent());

        verify(rateLimit).checkConsentIp(any());
        verify(consentService).recordAgeGate(any(), any(), any());
    }

    @Test
    void ageGateRateLimitadoDevuelve429YNoRegistra() throws Exception {
        ConsentService consentService = mock(ConsentService.class);
        ApiRateLimitService rateLimit = mock(ApiRateLimitService.class);
        doThrow(new TooManyRequestsException("Demasiadas solicitudes de consentimiento desde esta IP", 1000L))
                .when(rateLimit).checkConsentIp(any());
        MockMvc mockMvc = build(consentService, mock(UserService.class), rateLimit);

        mockMvc.perform(post("/api/consent/age-gate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isTooManyRequests());

        verify(consentService, never()).recordAgeGate(any(), any(), any());
    }
}
