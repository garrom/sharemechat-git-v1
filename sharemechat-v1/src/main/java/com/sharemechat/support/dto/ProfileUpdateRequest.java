package com.sharemechat.support.dto;

/**
 * Body de {@code PATCH /api/admin/support/profiles/{id}}. Todos los campos
 * son opcionales; solo se actualiza lo enviado. Ver ADR-046.
 */
public class ProfileUpdateRequest {
    private String displayName;
    private String category;
    private Boolean active;

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
