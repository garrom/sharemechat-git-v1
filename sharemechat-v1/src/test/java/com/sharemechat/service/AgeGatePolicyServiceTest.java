package com.sharemechat.service;

import com.sharemechat.consent.ConsentState;
import com.sharemechat.entity.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class AgeGatePolicyServiceTest {

    private final AgeGatePolicyService service = new AgeGatePolicyService("v1");

    @Test
    void resolvesCompliantUser() {
        User user = new User();
        user.setConfirAdult(true);
        user.setAcceptTerm(LocalDateTime.now());
        user.setTermVersion("v1");

        ConsentState state = service.resolve(user);

        assertTrue(state.compliant());
        assertFalse(state.consentRequired());
        assertFalse(state.missingAdultConfirmation());
        assertFalse(state.missingTermsAcceptance());
        assertFalse(state.outdatedTerms());
        assertEquals("v1", state.requiredTermsVersion());
    }

    @Test
    void resolvesMissingAdultConfirmation() {
        User user = new User();
        user.setConfirAdult(false);
        user.setAcceptTerm(LocalDateTime.now());
        user.setTermVersion("v1");

        ConsentState state = service.resolve(user);

        assertFalse(state.compliant());
        assertTrue(state.missingAdultConfirmation());
        assertEquals("missing_adult", state.reasonCode());
    }

    @Test
    void resolvesMissingTermsAcceptance() {
        User user = new User();
        user.setConfirAdult(true);
        user.setAcceptTerm(null);
        user.setTermVersion("v1");

        ConsentState state = service.resolve(user);

        assertFalse(state.compliant());
        assertTrue(state.missingTermsAcceptance());
        assertEquals("missing_terms", state.reasonCode());
    }

    @Test
    void resolvesOutdatedTerms() {
        User user = new User();
        user.setConfirAdult(true);
        user.setAcceptTerm(LocalDateTime.now());
        user.setTermVersion("v0");

        ConsentState state = service.resolve(user);

        assertFalse(state.compliant());
        assertTrue(state.outdatedTerms());
        assertEquals("outdated_terms", state.reasonCode());
    }
}
