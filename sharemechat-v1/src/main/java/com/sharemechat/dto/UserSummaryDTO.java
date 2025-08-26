package com.sharemechat.dto;

public class UserSummaryDTO {
    private Long id;
    private String nickname;
    private String profilePic;
    private String role;      // opcional
    private String userType;  // opcional

    public UserSummaryDTO() {}
    public UserSummaryDTO(Long id, String nickname, String profilePic, String role, String userType) {
        this.id = id; this.nickname = nickname; this.profilePic = profilePic; this.role = role; this.userType = userType;
    }

    // getters/setters
    public Long getId() { return id; }
    public String getNickname() { return nickname; }
    public String getProfilePic() { return profilePic; }
    public String getRole() { return role; }
    public String getUserType() { return userType; }

    public void setId(Long id) { this.id = id; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public void setProfilePic(String profilePic) { this.profilePic = profilePic; }
    public void setRole(String role) { this.role = role; }
    public void setUserType(String userType) { this.userType = userType; }
}
