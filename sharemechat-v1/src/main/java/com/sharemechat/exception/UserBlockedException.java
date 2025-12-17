package com.sharemechat.exception;

public class UserBlockedException extends RuntimeException {

    public UserBlockedException(String message) {
        super(message);
    }

    public static UserBlockedException blockedByOther() {
        return new UserBlockedException("No puedes realizar esta acción porque el usuario te ha bloqueado.");
    }

    public static UserBlockedException youBlockedOther() {
        return new UserBlockedException("No puedes realizar esta acción porque has bloqueado a este usuario.");
    }
}
