package com.sharemechat.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MessageDTO(
        Long id,
        Long senderId,
        Long recipientId,
        String body,
        LocalDateTime createdAt,
        LocalDateTime readAt,
        GiftSnapshotDTO gift
) {
    public record GiftSnapshotDTO(
            Long giftId,
            String code,
            String name,
            String icon,
            BigDecimal cost,
            String tier,
            Boolean featured
    ) {}
}
