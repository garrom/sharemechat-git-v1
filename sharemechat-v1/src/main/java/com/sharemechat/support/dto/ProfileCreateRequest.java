package com.sharemechat.support.dto;

/**
 * Body de {@code POST /api/admin/support/profiles}. Ver ADR-046.
 */
public class ProfileCreateRequest {
    private String displayName;
    private String category;

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
}
