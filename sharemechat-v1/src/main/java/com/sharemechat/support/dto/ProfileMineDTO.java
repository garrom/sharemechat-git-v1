package com.sharemechat.support.dto;

/**
 * Item de {@code GET /api/admin/support/profiles/mine}. Devuelve solo profiles
 * con grant activo del current user, con conteo de conversaciones activas para
 * la transparencia "Pepito atendiendo N casos ahora" del selector. Ver ADR-046.
 */
public class ProfileMineDTO {

    private Long id;
    private String displayName;
    private String category;
    private long activeConversations;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public long getActiveConversations() { return activeConversations; }
    public void setActiveConversations(long activeConversations) { this.activeConversations = activeConversations; }
}
