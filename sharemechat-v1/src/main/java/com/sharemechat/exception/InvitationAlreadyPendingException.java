package com.sharemechat.exception;

public class InvitationAlreadyPendingException extends RuntimeException {
    public InvitationAlreadyPendingException() {
        super("invitation_already_pending");
    }
    public InvitationAlreadyPendingException(String message) {
        super(message);
    }
}
