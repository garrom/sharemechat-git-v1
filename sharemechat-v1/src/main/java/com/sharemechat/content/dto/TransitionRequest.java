package com.sharemechat.content.dto;

public class TransitionRequest {

    private String toState;
    private String comment;
    private String reason;

    public String getToState() { return toState; }
    public void setToState(String toState) { this.toState = toState; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
