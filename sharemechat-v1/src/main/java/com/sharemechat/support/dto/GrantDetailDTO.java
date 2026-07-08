package com.sharemechat.support.dto;

import java.time.LocalDateTime;

/**
 * Fila del listado admin de grants sobre una profile. Enriquecida con
 * user_email y granted_by_email via join en el service, no via FetchType.EAGER
 * en la entidad. Ver ADR-046.
 */
public class GrantDetailDTO {

    private Long userId;
    private String userEmail;
    private Long grantedBy;
    private String grantedByEmail;
    private LocalDateTime grantedAt;
    private boolean active;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    public Long getGrantedBy() { return grantedBy; }
    public void setGrantedBy(Long grantedBy) { this.grantedBy = grantedBy; }
    public String getGrantedByEmail() { return grantedByEmail; }
    public void setGrantedByEmail(String grantedByEmail) { this.grantedByEmail = grantedByEmail; }
    public LocalDateTime getGrantedAt() { return grantedAt; }
    public void setGrantedAt(LocalDateTime grantedAt) { this.grantedAt = grantedAt; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
