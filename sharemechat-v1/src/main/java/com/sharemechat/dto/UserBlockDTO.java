package com.sharemechat.dto;

import java.time.LocalDateTime;

public class UserBlockDTO {
    public Long id;
    public Long blockerUserId;
    public Long blockedUserId;
    public String reason;
    public LocalDateTime createdAt;

    public UserBlockDTO() {}

    public UserBlockDTO(Long id, Long blockerUserId, Long blockedUserId, String reason, LocalDateTime createdAt) {
        this.id = id;
        this.blockerUserId = blockerUserId;
        this.blockedUserId = blockedUserId;
        this.reason = reason;
        this.createdAt = createdAt;
    }
}
