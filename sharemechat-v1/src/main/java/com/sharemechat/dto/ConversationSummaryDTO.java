package com.sharemechat.dto;

import java.time.LocalDateTime;

public record ConversationSummaryDTO(
        String conversationKey,
        Long me, Long peer,
        String lastBody,
        LocalDateTime lastAt,
        int unreadCount
) {}