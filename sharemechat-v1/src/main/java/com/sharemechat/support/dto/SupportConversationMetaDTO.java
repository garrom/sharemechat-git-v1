package com.sharemechat.support.dto;

/**
 * Meta ligera de una SupportConversation para el CLIENTE (endpoint
 * público autenticado). Permite pintar el badge de estado en la vista
 * del ticket (ADR-054 D8 — deuda pendiente hasta 2026-08-06): quién le
 * está atendiendo (Agente IA vs Técnico asignado) y en qué estado está
 * la conversación (para decidir read-only).
 *
 * Distinto de {@link SupportConversationSummaryDTO} (admin) porque:
 * - No expone {@code assignedAgentId} / {@code assignedProfileId} (IDs
 *   internos de backoffice, sin valor para el cliente).
 * - Solo el nombre visible del perfil (si hay asignación).
 */
public class SupportConversationMetaDTO {

    private Long id;
    private String resolutionStatus;
    private boolean assignedToHuman;
    private String assignedProfileDisplayName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getResolutionStatus() { return resolutionStatus; }
    public void setResolutionStatus(String resolutionStatus) { this.resolutionStatus = resolutionStatus; }

    public boolean isAssignedToHuman() { return assignedToHuman; }
    public void setAssignedToHuman(boolean assignedToHuman) { this.assignedToHuman = assignedToHuman; }

    public String getAssignedProfileDisplayName() { return assignedProfileDisplayName; }
    public void setAssignedProfileDisplayName(String assignedProfileDisplayName) { this.assignedProfileDisplayName = assignedProfileDisplayName; }
}
