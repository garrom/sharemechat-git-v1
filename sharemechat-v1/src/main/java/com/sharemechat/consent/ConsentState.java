package com.sharemechat.consent;

public record ConsentState(
        boolean compliant,
        boolean missingAdultConfirmation,
        boolean missingTermsAcceptance,
        boolean outdatedTerms,
        String requiredTermsVersion
) {

    public boolean consentRequired() {
        return !compliant;
    }

    public String reasonCode() {
        if (missingAdultConfirmation) {
            return "missing_adult";
        }
        if (missingTermsAcceptance) {
            return "missing_terms";
        }
        if (outdatedTerms) {
            return "outdated_terms";
        }
        return "compliant";
    }
}
