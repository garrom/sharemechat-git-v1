package com.sharemechat.exception;

public class AlreadyFavoritesException extends RuntimeException {
    public AlreadyFavoritesException() {
        super("already_favorites");
    }
    public AlreadyFavoritesException(String message) {
        super(message);
    }
}
