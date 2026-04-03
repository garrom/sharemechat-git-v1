package com.sharemechat.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.dto.UserDTO;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ClientDocumentRepository;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.AgeGatePolicyService;
import com.sharemechat.service.ConsentService;
import com.sharemechat.service.CountryAccessService;
import com.sharemechat.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserControllerConsentMockMvcTest {

    @Test
    void getCurrentUserExposesConsentState() throws Exception {
        UserService userService = mock(UserService.class);
        UserRepository userRepository = mock(UserRepository.class);
        ModelDocumentRepository modelDocumentRepository = mock(ModelDocumentRepository.class);
        ClientDocumentRepository clientDocumentRepository = mock(ClientDocumentRepository.class);
        CountryAccessService countryAccessService = mock(CountryAccessService.class);
        ConsentService consentService = mock(ConsentService.class);
        AgeGatePolicyService ageGatePolicyService = new AgeGatePolicyService("v1");

        User user = new User();
        user.setId(10L);
        user.setEmail("alice@example.com");
        user.setConfirAdult(false);

        UserDTO dto = new UserDTO();
        dto.setId(10L);
        dto.setEmail("alice@example.com");
        dto.setConsentCompliant(false);
        dto.setConsentRequired(true);
        dto.setMissingAdultConfirmation(true);
        dto.setMissingTermsAcceptance(true);
        dto.setRequiredTermsVersion("v1");

        when(userService.findByEmail("alice@example.com")).thenReturn(user);
        when(userService.mapToDTO(user)).thenReturn(dto);

        UserController controller = new UserController(
                userService,
                userRepository,
                modelDocumentRepository,
                clientDocumentRepository,
                countryAccessService,
                consentService,
                ageGatePolicyService
        );

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new ObjectMapper()))
                .build();

        mockMvc.perform(get("/api/users/me")
                        .principal(new TestingAuthenticationToken("alice@example.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consentCompliant").value(false))
                .andExpect(jsonPath("$.consentRequired").value(true))
                .andExpect(jsonPath("$.missingAdultConfirmation").value(true))
                .andExpect(jsonPath("$.missingTermsAcceptance").value(true))
                .andExpect(jsonPath("$.requiredTermsVersion").value("v1"));
    }
}
