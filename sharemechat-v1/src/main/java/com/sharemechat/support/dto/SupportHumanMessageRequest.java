package com.sharemechat.support.dto;

/**
 * Body de {@code POST /api/admin/support/conversations/{id}/message}. Contenido
 * del mensaje del agente humano. Max 4000 chars. Ver ADR-046.
 */
public class SupportHumanMessageRequest {
    private String content;

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
