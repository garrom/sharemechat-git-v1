package com.sharemechat.entity;

import jakarta.persistence.*;
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

    @Column(name = "updated_at", nullable = false, columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;

    public User() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    // ===== Getters y Setters =====

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

    public String getUiLocale() {return uiLocale;}

    public void setUiLocale(String uiLocale) {this.uiLocale = uiLocale;}
}
