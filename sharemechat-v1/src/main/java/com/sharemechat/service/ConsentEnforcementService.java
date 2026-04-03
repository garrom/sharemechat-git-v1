package com.sharemechat.service;

import com.sharemechat.consent.ConsentState;
import com.sharemechat.entity.User;
import com.sharemechat.exception.ConsentRequiredException;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class ConsentEnforcementService {

    private static final Logger log = LoggerFactory.getLogger(ConsentEnforcementService.class);

    private final UserRepository userRepository;
    private final AgeGatePolicyService ageGatePolicyService;

    public ConsentEnforcementService(UserRepository userRepository, AgeGatePolicyService ageGatePolicyService) {
        this.userRepository = userRepository;
        this.ageGatePolicyService = ageGatePolicyService;
    }

    public void assertAuthenticatedUserCompliant(Authentication authentication, String endpointKey) {
        if (authentication == null || authentication.getName() == null) {
            return;
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        assertUserCompliant(user, endpointKey);
    }

    public void assertUserCompliant(Long userId, String endpointKey) {
        if (userId == null) {
            return;
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        assertUserCompliant(user, endpointKey);
    }

    private void assertUserCompliant(User user, String endpointKey) {
        ConsentState consentState = ageGatePolicyService.resolve(user);
        if (consentState.compliant()) {
            return;
        }

        log.info("[CONSENT][HTTP_BLOCKED] userId={} endpoint={} reason={}",
                user != null ? user.getId() : null,
                endpointKey,
                consentState.reasonCode());

        throw new ConsentRequiredException(
                user != null ? user.getId() : null,
                endpointKey,
                consentState
        );
    }
}
