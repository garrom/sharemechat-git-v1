package com.sharemechat.service;

import com.sharemechat.dto.ConsentAcceptRequest;
import com.sharemechat.entity.ConsentEvent;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ConsentEventRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.consent.HmacSigner;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ConsentServiceTest {

    @Test
    @DisplayName("acceptAccountConsent is transactional")
    void acceptAccountConsentIsTransactional() throws Exception {
        assertNotNull(ConsentService.class
                .getMethod("acceptAccountConsent", HttpServletRequest.class, Long.class, ConsentAcceptRequest.class)
                .getAnnotation(org.springframework.transaction.annotation.Transactional.class));
    }

    @Test
    void acceptAccountConsentUpdatesUserAndRecordsAudit() {
        ConsentEventRepository consentEventRepository = mock(ConsentEventRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        HmacSigner signer = mock(HmacSigner.class);

        when(signer.sign(any(LinkedHashMap.class))).thenReturn("sig");

        ConsentService service = new ConsentService(consentEventRepository, signer, userRepository);
        ReflectionTestUtils.setField(service, "currentTermsVersion", "v1");

        User user = new User();
        user.setId(7L);
        user.setConfirAdult(false);
        user.setAcceptTerm(null);
        user.setTermVersion(null);

        when(userRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(consentEventRepository.save(any(ConsentEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        ConsentAcceptRequest body = new ConsentAcceptRequest();
        body.setConfirmAdult(true);
        body.setAcceptTerms(true);
        body.setTermsVersion("v1");

        HttpServletRequest request = new MockHttpServletRequest("POST", "/api/consent/accept");

        service.acceptAccountConsent(request, 7L, body);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());

        User saved = userCaptor.getValue();
        assertTrue(saved.getConfirAdult());
        assertNotNull(saved.getAcceptTerm());
        assertEquals("v1", saved.getTermVersion());

        ArgumentCaptor<ConsentEvent> eventCaptor = ArgumentCaptor.forClass(ConsentEvent.class);
        verify(consentEventRepository, times(2)).save(eventCaptor.capture());
        assertTrue(eventCaptor.getAllValues().stream().allMatch(e -> e.getConsentId() == null));
        assertTrue(eventCaptor.getAllValues().stream().allMatch(e -> "v1".equals(e.getVersion())));
    }

    @Test
    void acceptAccountConsentAlwaysCreatesNewAuditRows() {
        ConsentEventRepository consentEventRepository = mock(ConsentEventRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        HmacSigner signer = mock(HmacSigner.class);

        when(signer.sign(any(LinkedHashMap.class))).thenReturn("sig");

        ConsentService service = new ConsentService(consentEventRepository, signer, userRepository);
        ReflectionTestUtils.setField(service, "currentTermsVersion", "v1");

        User user = new User();
        user.setId(7L);

        when(userRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(consentEventRepository.save(any(ConsentEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        ConsentAcceptRequest body = new ConsentAcceptRequest();
        body.setConfirmAdult(true);
        body.setAcceptTerms(true);
        body.setTermsVersion("v1");

        HttpServletRequest request = new MockHttpServletRequest("POST", "/api/consent/accept");

        service.acceptAccountConsent(request, 7L, body);
        service.acceptAccountConsent(request, 7L, body);

        ArgumentCaptor<ConsentEvent> eventCaptor = ArgumentCaptor.forClass(ConsentEvent.class);
        verify(consentEventRepository, times(4)).save(eventCaptor.capture());

        List<ConsentEvent> savedEvents = new ArrayList<>(eventCaptor.getAllValues());
        long ageGateEvents = savedEvents.stream()
                .filter(e -> "age_gate_accept".equals(e.getEventType()))
                .count();
        long termsEvents = savedEvents.stream()
                .filter(e -> "terms_accept".equals(e.getEventType()))
                .count();

        assertEquals(2L, ageGateEvents);
        assertEquals(2L, termsEvents);
        assertTrue(savedEvents.stream().allMatch(e -> Long.valueOf(7L).equals(e.getUserId())));
        assertTrue(savedEvents.stream().allMatch(e -> "v1".equals(e.getVersion())));
        assertTrue(savedEvents.stream().allMatch(e -> e.getConsentId() == null));
    }
}
