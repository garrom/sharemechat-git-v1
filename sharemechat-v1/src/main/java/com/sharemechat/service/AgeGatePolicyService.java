package com.sharemechat.service;

import com.sharemechat.consent.ConsentState;
import com.sharemechat.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AgeGatePolicyService {

    private final String currentTermsVersion;

    public AgeGatePolicyService(@Value("${terms.version:v1}") String currentTermsVersion) {
        this.currentTermsVersion = currentTermsVersion;
    }

    public ConsentState resolve(User user) {
        boolean adultConfirmed = user != null && Boolean.TRUE.equals(user.getConfirAdult());
        boolean termsAccepted = user != null && user.getAcceptTerm() != null;
        boolean termsCurrent = user != null
                && StringUtils.hasText(user.getTermVersion())
                && user.getTermVersion().trim().equals(currentTermsVersion);

        return new ConsentState(
                adultConfirmed && termsAccepted && termsCurrent,
                !adultConfirmed,
                !termsAccepted,
                termsAccepted && !termsCurrent,
                currentTermsVersion
        );
    }

    public String getCurrentTermsVersion() {
        return currentTermsVersion;
    }
}
