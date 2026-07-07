package com.sharemechat.support.dto;

/**
 * Body de {@code POST /api/admin/support/conversations/{id}/claim}. El agent
 * elige con que identidad de servicio toma el caso. Ver ADR-046.
 */
public class SupportClaimRequest {
    private Long profileId;

    public Long getProfileId() { return profileId; }
    public void setProfileId(Long profileId) { this.profileId = profileId; }
}
