package com.sharemechat.entity;

import com.sharemechat.constants.Constants;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

// ADR-052 (V39): campos de reparto autoservicio y Estatus Pro se anaden
// abajo tras las columnas de KYC cliente para respetar el orden logico
// de secciones (identidad -> KYC -> economics de modelo -> dormancy).

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

    /**
     * ADR-056 D7 (2026-07-29): flag que fuerza cambio de password al primer
     * login antes de firmar contrato / iniciar KYC. Se pone a 1 cuando el
     * Master crea una modelo bajo su umbrella (la fila users se crea sin
     * password funcional, la modelo la establece via email de activacion).
     * Elimina el vector de coaccion GDPR (Master controla credenciales al
     * momento de firmar). Se resetea a 0 cuando el user cambia password
     * por primera vez.
     */
    @Column(name = "password_temporary", nullable = false)
    private boolean passwordTemporary = false;

    /**
     * ADR-056 D7: auditoria. Instante en que el user cambio password por
     * primera vez. NULL para usuarios legacy (pre-V42) y para usuarios
     * que aun no han cambiado nunca. Poblado por el flujo de first-login
     * password change.
     */
    @Column(name = "first_password_change_at")
    private java.time.LocalDateTime firstPasswordChangeAt;

    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "ui_locale", length = 5, nullable = false)
    private String uiLocale;

    // pending-hardening §5.3 (2026-08-08): idioma preferido para chat P2P.
    // NULL = fallback a uiLocale. El selector del perfil escribe aqui.
    @Column(name = "preferred_chat_lang", length = 5)
    private String preferredChatLang;

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

    /**
     * ADR-052 §D2 (V39, 2026-07-25): tarifa por minuto elegida por la
     * modelo dentro del rango de su tramo vigente. Default 1.00 (rango
     * T0). Se recorta automaticamente al maximo del tramo destino cuando
     * la modelo baja de tramo (por el snapshot diario). El motor de
     * facturacion la lee al arranque de sesion.
     */
    @Column(name = "chosen_rate_eur_per_min", nullable = false, precision = 4, scale = 2)
    private BigDecimal chosenRateEurPerMin = new BigDecimal("1.00");

    /**
     * ADR-052 §D3 (V39, 2026-07-25): toggle Estatus Pro. True si la modelo
     * Pro acepta clientes trial en su tarjeta. Default true para no romper
     * el flujo trial existente cuando Pro se active por primera vez para
     * una modelo. Solo tiene efecto operativo cuando la modelo cumple el
     * umbral de Pro (facturacion bruta rolling 30d >
     * {@code billing.pro-status.min-billed-gross-eur-30d}, default 1500 EUR).
     */
    @Column(name = "pro_accepts_trial", nullable = false)
    private Boolean proAcceptsTrial = Boolean.TRUE;

    /**
     * Politica de cuentas dormidas (V37, 2026-07-23): timestamp UTC del
     * ultimo login o refresh exitoso. NULL para cuentas que aun no han
     * logeado despues del rollout de la politica. El
     * {@code AccountDormancyJob} usa este campo para decidir si marcar
     * una cuenta como dormant.
     */
    @Column(name = "last_activity_at")
    private LocalDateTime lastActivityAt;

    /**
     * Politica de cuentas dormidas (V37): cuando NOT NULL, la cuenta fue
     * marcada dormant automaticamente por el job. Al login se auto-reactiva
     * ({@code dormant_since=NULL, is_active=true, last_activity_at=NOW()})
     * sin intervencion admin. Distingue del bloqueo por ban real
     * ({@code is_active=false sin dormant_since} o
     * {@code account_status=SUSPENDED/BANNED}), que sigue bloqueando el
     * login.
     */
    @Column(name = "dormant_since")
    private LocalDateTime dormantSince;

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

    public boolean isPasswordTemporary() { return passwordTemporary; }
    public void setPasswordTemporary(boolean passwordTemporary) { this.passwordTemporary = passwordTemporary; }

    public java.time.LocalDateTime getFirstPasswordChangeAt() { return firstPasswordChangeAt; }
    public void setFirstPasswordChangeAt(java.time.LocalDateTime firstPasswordChangeAt) { this.firstPasswordChangeAt = firstPasswordChangeAt; }

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

    public String getPreferredChatLang() { return preferredChatLang; }
    public void setPreferredChatLang(String preferredChatLang) { this.preferredChatLang = preferredChatLang; }

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

    public BigDecimal getChosenRateEurPerMin() { return chosenRateEurPerMin; }
    public void setChosenRateEurPerMin(BigDecimal chosenRateEurPerMin) { this.chosenRateEurPerMin = chosenRateEurPerMin; }

    public Boolean getProAcceptsTrial() { return proAcceptsTrial; }
    public void setProAcceptsTrial(Boolean proAcceptsTrial) { this.proAcceptsTrial = proAcceptsTrial; }

    public LocalDateTime getLastActivityAt() { return lastActivityAt; }
    public void setLastActivityAt(LocalDateTime lastActivityAt) { this.lastActivityAt = lastActivityAt; }

    public LocalDateTime getDormantSince() { return dormantSince; }
    public void setDormantSince(LocalDateTime dormantSince) { this.dormantSince = dormantSince; }
}
