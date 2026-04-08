package com.sharemechat.service;

public class EmailDeliveryException extends RuntimeException {

    private final String provider;
    private final EmailMessage.Category category;
    private final EmailMessage.Priority priority;
    private final String to;
    private final Integer statusCode;

    public EmailDeliveryException(String provider,
                                  EmailMessage message,
                                  String detail,
                                  Throwable cause) {
        this(provider, message, null, detail, cause);
    }

    public EmailDeliveryException(String provider,
                                  EmailMessage message,
                                  Integer statusCode,
                                  String detail,
                                  Throwable cause) {
        super(buildMessage(provider, message, statusCode, detail), cause);
        this.provider = provider;
        this.category = message != null ? message.category() : null;
        this.priority = message != null ? message.priority() : null;
        this.to = message != null ? message.to() : null;
        this.statusCode = statusCode;
    }

    private static String buildMessage(String provider,
                                       EmailMessage message,
                                       Integer statusCode,
                                       String detail) {
        String category = message != null && message.category() != null ? message.category().name() : "UNKNOWN";
        String priority = message != null && message.priority() != null ? message.priority().name() : "UNKNOWN";
        String to = message != null ? message.to() : "unknown";
        String status = statusCode != null ? String.valueOf(statusCode) : "n/a";
        String safeDetail = detail != null && !detail.isBlank() ? detail : "unknown";
        return "Email delivery failed provider=%s category=%s priority=%s to=%s status=%s error=%s"
                .formatted(provider, category, priority, to, status, safeDetail);
    }

    public String getProvider() {
        return provider;
    }

    public EmailMessage.Category getCategory() {
        return category;
    }

    public EmailMessage.Priority getPriority() {
        return priority;
    }

    public String getTo() {
        return to;
    }

    public Integer getStatusCode() {
        return statusCode;
    }
}
