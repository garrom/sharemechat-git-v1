package com.sharemechat.exception;

public class HomeFeaturedEmptyException extends RuntimeException {
    public HomeFeaturedEmptyException() {
        super("No hay modelos cargadas en la home actualmente");
    }
}
