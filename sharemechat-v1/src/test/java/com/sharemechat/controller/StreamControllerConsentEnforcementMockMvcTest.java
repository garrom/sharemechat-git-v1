package com.sharemechat.controller;

import com.sharemechat.consent.ConsentState;
import com.sharemechat.exception.ConsentRequiredException;
import com.sharemechat.exception.GlobalExceptionHandler;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.ConsentEnforcementService;
import com.sharemechat.service.StreamService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StreamControllerConsentEnforcementMockMvcTest {

    @Test
    void ackMediaRejectsNonCompliantUserWithValidToken() throws Exception {
        StreamService streamService = mock(StreamService.class);
        JwtUtil jwtUtil = mock(JwtUtil.class);
        ConsentEnforcementService consentEnforcementService = mock(ConsentEnforcementService.class);

        when(jwtUtil.isTokenValid("valid-token")).thenReturn(true);
        when(jwtUtil.extractUserId("valid-token")).thenReturn(33L);

        doThrow(new ConsentRequiredException(
                33L,
                "POST /api/streams/{streamRecordId}/ack-media",
                new ConsentState(false, false, false, true, "v1")
        )).when(consentEnforcementService).assertUserCompliant(33L, "POST /api/streams/{streamRecordId}/ack-media");

        StreamController controller = new StreamController(streamService, jwtUtil, consentEnforcementService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mockMvc.perform(post("/api/streams/91/ack-media")
                        .header("Authorization", "Bearer valid-token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AGE_GATE_REQUIRED"))
                .andExpect(jsonPath("$.requiredTermsVersion").value("v1"))
                .andExpect(jsonPath("$.reasonCode").value("outdated_terms"));

        verify(streamService, never()).ackMedia(any(), any());
    }
}
