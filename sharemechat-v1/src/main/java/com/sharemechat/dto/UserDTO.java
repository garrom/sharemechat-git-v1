package com.sharemechat.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class UserDTO {

    private Long id;
    private String nickname;
    private String email;
    private String role;
    private String userType;
    private String name;
    private String surname;
    private LocalDate dateOfBirth;
    private String biography;
    private String interests;
    private String verificationStatus;
    private Boolean active;
    private Boolean unsubscribe;
    private LocalDateTime createdAt;
    private String uiLocale;

    private String accountStatus;
    private LocalDateTime suspendedUntil;
    private String riskReason;
    private LocalDateTime riskUpdatedAt;
    private Long riskUpdatedBy;
    private Boolean consentCompliant;
    private Boolean consentRequired;
    private Boolean missingAdultConfirmation;
    private Boolean missingTermsAcceptance;
    private Boolean outdatedTerms;
    private String requiredTermsVersion;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getUserType() { return userType; }
    public void setUserType(String userType) { this.userType = userType; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSurname() { return surname; }
    public void setSurname(String surname) { this.surname = surname; }

    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }

    public String getBiography() { return biography; }
    public void setBiography(String biography) { this.biography = biography; }

    public String getInterests() { return interests; }
    public void setInterests(String interests) { this.interests = interests; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public Boolean getUnsubscribe() { return unsubscribe; }
    public void setUnsubscribe(Boolean unsubscribe) { this.unsubscribe = unsubscribe; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getUiLocale() { return uiLocale; }
    public void setUiLocale(String uiLocale) { this.uiLocale = uiLocale; }

    public String getAccountStatus() { return accountStatus; }
    public void setAccountStatus(String accountStatus) { this.accountStatus = accountStatus; }

    public LocalDateTime getSuspendedUntil() { return suspendedUntil; }
    public void setSuspendedUntil(LocalDateTime suspendedUntil) { this.suspendedUntil = suspendedUntil; }

    public String getRiskReason() { return riskReason; }
    public void setRiskReason(String riskReason) { this.riskReason = riskReason; }

    public LocalDateTime getRiskUpdatedAt() { return riskUpdatedAt; }
    public void setRiskUpdatedAt(LocalDateTime riskUpdatedAt) { this.riskUpdatedAt = riskUpdatedAt; }

    public Long getRiskUpdatedBy() { return riskUpdatedBy; }
    public void setRiskUpdatedBy(Long riskUpdatedBy) { this.riskUpdatedBy = riskUpdatedBy; }

    public Boolean getConsentCompliant() { return consentCompliant; }
    public void setConsentCompliant(Boolean consentCompliant) { this.consentCompliant = consentCompliant; }

    public Boolean getConsentRequired() { return consentRequired; }
    public void setConsentRequired(Boolean consentRequired) { this.consentRequired = consentRequired; }

    public Boolean getMissingAdultConfirmation() { return missingAdultConfirmation; }
    public void setMissingAdultConfirmation(Boolean missingAdultConfirmation) { this.missingAdultConfirmation = missingAdultConfirmation; }

    public Boolean getMissingTermsAcceptance() { return missingTermsAcceptance; }
    public void setMissingTermsAcceptance(Boolean missingTermsAcceptance) { this.missingTermsAcceptance = missingTermsAcceptance; }

    public Boolean getOutdatedTerms() { return outdatedTerms; }
    public void setOutdatedTerms(Boolean outdatedTerms) { this.outdatedTerms = outdatedTerms; }

    public String getRequiredTermsVersion() { return requiredTermsVersion; }
    public void setRequiredTermsVersion(String requiredTermsVersion) { this.requiredTermsVersion = requiredTermsVersion; }
}
