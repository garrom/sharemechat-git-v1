package com.sharemechat.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.dto.ConsentAcceptRequest;
import com.sharemechat.entity.User;
import com.sharemechat.exception.GlobalExceptionHandler;
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

    @Test
    void acceptConsentUpdatesAccountAndReturnsOk() throws Exception {
        ConsentService consentService = mock(ConsentService.class);
        UserService userService = mock(UserService.class);

        User user = new User();
        user.setId(22L);
        user.setEmail("bob@example.com");

        when(userService.findByEmail("bob@example.com")).thenReturn(user);

        ConsentController controller = new ConsentController(consentService, userService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new ObjectMapper()))
                .build();

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
}
