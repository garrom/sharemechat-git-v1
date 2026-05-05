package com.sharemechat.content.dto;

public record ValidationErrorDTO(
        String field,
        String message
) {}
