package com.sharemechat.dto;

import java.time.LocalDateTime;

public record MessageDTO(
        Long id, Long senderId, Long recipientId,
        String body, LocalDateTime createdAt, LocalDateTime readAt
) {}