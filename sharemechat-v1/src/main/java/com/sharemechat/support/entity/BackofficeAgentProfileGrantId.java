package com.sharemechat.support.entity;

import java.io.Serializable;
import java.util.Objects;

/**
 * Composite PK (user_id, profile_id) de {@link BackofficeAgentProfileGrant}.
 * Necesaria para el mapeo {@code @IdClass} porque JPA requiere una clase con
 * los mismos nombres de campo que los {@code @Id} de la entidad.
 */
public class BackofficeAgentProfileGrantId implements Serializable {

    private Long userId;
    private Long profileId;

    public BackofficeAgentProfileGrantId() {}

    public BackofficeAgentProfileGrantId(Long userId, Long profileId) {
        this.userId = userId;
        this.profileId = profileId;
    }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getProfileId() { return profileId; }
    public void setProfileId(Long profileId) { this.profileId = profileId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BackofficeAgentProfileGrantId)) return false;
        BackofficeAgentProfileGrantId that = (BackofficeAgentProfileGrantId) o;
        return Objects.equals(userId, that.userId)
                && Objects.equals(profileId, that.profileId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, profileId);
    }
}
