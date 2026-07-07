package com.sharemechat.support.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Grant N:N entre {@link com.sharemechat.entity.User} y
 * {@link BackofficeAgentProfile}. Un user con {@code active=true} sobre una
 * profile puede hacer claim de conversaciones con esa identidad de servicio.
 */
@Entity
@Table(name = "backoffice_agent_profile_grant")
@IdClass(BackofficeAgentProfileGrantId.class)
public class BackofficeAgentProfileGrant {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Id
    @Column(name = "profile_id")
    private Long profileId;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(name = "granted_by")
    private Long grantedBy;

    @Column(name = "granted_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime grantedAt;

    public BackofficeAgentProfileGrant() {
        this.active = true;
        this.grantedAt = LocalDateTime.now();
    }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getProfileId() { return profileId; }
    public void setProfileId(Long profileId) { this.profileId = profileId; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Long getGrantedBy() { return grantedBy; }
    public void setGrantedBy(Long grantedBy) { this.grantedBy = grantedBy; }
    public LocalDateTime getGrantedAt() { return grantedAt; }
    public void setGrantedAt(LocalDateTime grantedAt) { this.grantedAt = grantedAt; }
}
