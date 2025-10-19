package com.sharemechat.exception;

public class NotMutualFavoritesException extends RuntimeException {
    public NotMutualFavoritesException() {
        super("Debes tener la relación de favoritos aceptada en ambos sentidos para llamar.");
    }
    public NotMutualFavoritesException(String message) {
        super(message);
    }
}
