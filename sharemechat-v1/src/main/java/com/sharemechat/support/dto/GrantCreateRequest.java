package com.sharemechat.support.dto;

/**
 * Body de {@code POST /api/admin/support/profiles/{profileId}/grants}. Ver ADR-046.
 */
public class GrantCreateRequest {
    private Long userId;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
}
