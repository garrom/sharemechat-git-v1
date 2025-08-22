package com.sharemechat.dto;

import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public class UserUpdateDTO {

    @Size(max = 100, message = "El nombre no puede superar 100 caracteres")
    private String name;

    @Size(max = 100, message = "El apellido no puede superar 100 caracteres")
    private String surname;

    @Size(max = 50, message = "El nickname no puede superar 50 caracteres")
    private String nickname;

    // Este nombre coincide con el que ya usas en el frontend
    private String profilePicture;

    private LocalDate dateOfBirth;

    @Size(max = 1000, message = "La biografía no puede superar 1000 caracteres")
    private String biography;

    @Size(max = 500, message = "Los intereses no pueden superar 500 caracteres")
    private String interests;

    // Getters/Setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSurname() { return surname; }
    public void setSurname(String surname) { this.surname = surname; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getProfilePicture() { return profilePicture; }
    public void setProfilePicture(String profilePicture) { this.profilePicture = profilePicture; }

    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }

    public String getBiography() { return biography; }
    public void setBiography(String biography) { this.biography = biography; }

    public String getInterests() { return interests; }
    public void setInterests(String interests) { this.interests = interests; }
}
