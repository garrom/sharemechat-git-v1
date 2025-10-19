package com.sharemechat.exception;

public class InvitationAlreadyPendingException extends RuntimeException {
    public InvitationAlreadyPendingException() {
        super("Ya tienes la solicitud en proceso");
    }
    public InvitationAlreadyPendingException(String message) {
        super(message);
    }
}
