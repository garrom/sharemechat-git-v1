package com.sharemechat.entity;

import com.sharemechat.constants.Constants;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "nickname", unique = true, nullable = false)
    private String nickname;

    @Column(name = "email", unique = true, nullable = false)
    private String email;

    @Column(name = "password", nullable = false)
    private String password;

    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "ui_locale", length = 5, nullable = false)
    private String uiLocale;

    @Column(name = "country_detected", columnDefinition = "CHAR(2)")
    private String countryDetected;

    @Column(name = "user_type", nullable = false)
    private String userType;

    @Column(name = "verification_status")
    private String verificationStatus;

    @Column(name = "name")
    private String name;

    @Column(name = "surname")
    private String surname;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "confir_adult", nullable = false)
    private Boolean confirAdult = false;

    @Column(name = "accept_term")
    private LocalDateTime acceptTerm;

    @Column(name = "term_version")
    private String termVersion;

    @Column(name = "regist_ip")
    private String registIp;

    @Column(name = "unsubscribe", nullable = false)
    private Boolean unsubscribe = false;

    @Column(name = "biography")
    private String biography;

    @Column(name = "interests")
    private String interests;

    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    // updated_at: gestionado 100% por MySQL via columnDefinition
    // (DEFAULT CURRENT_TIMESTAMP + ON UPDATE CURRENT_TIMESTAMP).
    //
    // insertable=false, updatable=false hace que Hibernate NUNCA incluya esta
    // columna en INSERTs ni UPDATEs. Sin esto, Hibernate enviaba en cada
    // UPDATE updated_at=<valor_actual_del_objeto>, y MySQL solo dispara
    // ON UPDATE CURRENT_TIMESTAMP cuando el SQL NO menciona la columna o
    // cuando manda un valor distinto al previo. Con el viejo setup el
    // timestamp se quedaba congelado al valor que dejara el constructor o
    // el ultimo setUpdatedAt manual; los 3 callers que llamaban setUpdatedAt
    // a mano (UserService) solo cubrian 3 de las decenas de updates del User
    // (verification_status, ui_locale, password, account_status, role, etc.).
    //
    // Mismo patron usado por KycProviderConfig y KycSession en este
    // codebase (entidades mas modernas que el resto).
    //
    // El setter publico se conserva para no romper compilacion de los 3
    // callers existentes en UserService; con updatable=false esos calls
    // pasan a ser no-ops inocuos (Hibernate ignorara el valor).
    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;

    @Column(name = "account_status", nullable = false)
    private String accountStatus = Constants.AccountStatuses.ACTIVE;

    @Column(name = "suspended_until")
    private LocalDateTime suspendedUntil;

    @Column(name = "risk_reason", length = 200)
    private String riskReason;

    @Column(name = "risk_updated_at", nullable = false)
    private LocalDateTime riskUpdatedAt = LocalDateTime.now();

    @Column(name = "risk_updated_by")
    private Long riskUpdatedBy;

    @Column(name = "email_verified_at")
    private LocalDateTime emailVerifiedAt;

    // V9 (frente Didit cliente, 2026-06-14): estado del KYC del CLIENTE
    // (Age Estimation). Paralelo a verification_status (que es del MODELO).
    // NULL para usuarios sin verificacion de cliente todavia. Valores
    // PENDING/APPROVED/REJECTED (Constants.VerificationStatuses).
    @Column(name = "client_kyc_status", length = 20)
    private String clientKycStatus;

    @Column(name = "client_kyc_decided_at")
    private LocalDateTime clientKycDecidedAt;

    @Column(name = "client_kyc_estimated_age", precision = 5, scale = 2)
    private BigDecimal clientKycEstimatedAge;

    // ADR-049 Subpasada 1: sistema de afiliadas.
    // - referral_code_owner: codigo publico de afiliacion de la modelo
    //   (Crockford Base32 sin ambiguos, longitud 12). UNIQUE en BD.
    //   NULL si el USER no ha activado el programa (o no es MODEL).
    // - referred_by_user_id: user_id de la modelo referidora si el USER
    //   llego por afiliacion. Inmutable tras el registro (guard en service).
    // - referred_at: timestamp del momento de la atribucion.
    @Column(name = "referral_code_owner", length = 12, unique = true)
    private String referralCodeOwner;

    @Column(name = "referred_by_user_id")
    private Long referredByUserId;

    @Column(name = "referred_at")
    private LocalDateTime referredAt;

    public User() {
        this.createdAt = LocalDateTime.now();
        // updatedAt NO se inicializa aqui: la columna esta con
        // insertable=false (ver anotacion arriba), MySQL le pone el DEFAULT
        // CURRENT_TIMESTAMP en el INSERT y mantiene el ON UPDATE despues.
        this.riskUpdatedAt = LocalDateTime.now();
        this.accountStatus = Constants.AccountStatuses.ACTIVE;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getUserType() { return userType; }
    public void setUserType(String userType) { this.userType = userType; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSurname() { return surname; }
    public void setSurname(String surname) { this.surname = surname; }

    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Boolean getConfirAdult() { return confirAdult; }
    public void setConfirAdult(Boolean confirAdult) { this.confirAdult = confirAdult; }

    public LocalDateTime getAcceptTerm() { return acceptTerm; }
    public void setAcceptTerm(LocalDateTime acceptTerm) { this.acceptTerm = acceptTerm; }

    public String getTermVersion() { return termVersion; }
    public void setTermVersion(String termVersion) { this.termVersion = termVersion; }

    public String getRegistIp() { return registIp; }
    public void setRegistIp(String registIp) { this.registIp = registIp; }

    public Boolean getUnsubscribe() { return unsubscribe; }
    public void setUnsubscribe(Boolean unsubscribe) { this.unsubscribe = unsubscribe; }

    public String getBiography() { return biography; }
    public void setBiography(String biography) { this.biography = biography; }

    public String getInterests() { return interests; }
    public void setInterests(String interests) { this.interests = interests; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getUiLocale() { return uiLocale; }
    public void setUiLocale(String uiLocale) { this.uiLocale = uiLocale; }

    public String getCountryDetected() { return countryDetected; }
    public void setCountryDetected(String countryDetected) { this.countryDetected = countryDetected; }

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

    public LocalDateTime getEmailVerifiedAt() { return emailVerifiedAt; }
    public void setEmailVerifiedAt(LocalDateTime emailVerifiedAt) { this.emailVerifiedAt = emailVerifiedAt; }

    public String getClientKycStatus() { return clientKycStatus; }
    public void setClientKycStatus(String clientKycStatus) { this.clientKycStatus = clientKycStatus; }

    public LocalDateTime getClientKycDecidedAt() { return clientKycDecidedAt; }
    public void setClientKycDecidedAt(LocalDateTime clientKycDecidedAt) { this.clientKycDecidedAt = clientKycDecidedAt; }

    public BigDecimal getClientKycEstimatedAge() { return clientKycEstimatedAge; }
    public void setClientKycEstimatedAge(BigDecimal clientKycEstimatedAge) { this.clientKycEstimatedAge = clientKycEstimatedAge; }

    public String getReferralCodeOwner() { return referralCodeOwner; }
    public void setReferralCodeOwner(String referralCodeOwner) { this.referralCodeOwner = referralCodeOwner; }

    public Long getReferredByUserId() { return referredByUserId; }
    public void setReferredByUserId(Long referredByUserId) { this.referredByUserId = referredByUserId; }

    public LocalDateTime getReferredAt() { return referredAt; }
    public void setReferredAt(LocalDateTime referredAt) { this.referredAt = referredAt; }
}
