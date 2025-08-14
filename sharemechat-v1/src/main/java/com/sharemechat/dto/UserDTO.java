package com.sharemechat.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class UserDTO {
    private Long id;
    private String nickname;
    private String email;
    private String role;
    private String userType;
    private String verificationStatus;
    private String name;
    private String surname;
    private String profilePic;
    private LocalDate dateOfBirth;
    private Boolean isPremium;
    private Boolean unsubscribe;
    private LocalDateTime createdAt;
    private String biography;
    private String interests;

    // Getters y Setters
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
    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSurname() { return surname; }
    public void setSurname(String surname) { this.surname = surname; }
    public String getProfilePic() { return profilePic; }
    public void setProfilePic(String profilePic) { this.profilePic = profilePic; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }
    public Boolean getIsPremium() { return isPremium; }
    public void setIsPremium(Boolean isPremium) { this.isPremium = isPremium; }
    public Boolean getUnsubscribe() { return unsubscribe; }
    public void setUnsubscribe(Boolean unsubscribe) { this.unsubscribe = unsubscribe; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public String getBiography() { return biography; }
    public void setBiography(String biography) { this.biography = biography; }
    public String getInterests() { return interests; }
    public void setInterests(String interests) { this.interests = interests; }
}