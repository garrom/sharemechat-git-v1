package com.sharemechat.support.dto;

import java.util.List;

/**
 * Detalle de conversacion admin: summary + hilo completo. Un solo endpoint,
 * un solo round-trip. Ver ADR-046.
 */
public class SupportConversationDetailDTO {

    private SupportConversationSummaryDTO conversation;
    private List<SupportMessageAdminDTO> messages;

    public SupportConversationSummaryDTO getConversation() { return conversation; }
    public void setConversation(SupportConversationSummaryDTO conversation) { this.conversation = conversation; }
    public List<SupportMessageAdminDTO> getMessages() { return messages; }
    public void setMessages(List<SupportMessageAdminDTO> messages) { this.messages = messages; }
}
