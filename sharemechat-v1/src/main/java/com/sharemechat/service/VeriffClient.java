package com.sharemechat.service;

import com.sharemechat.dto.VeriffCreateSessionResult;

public interface VeriffClient {

    /**
     * Crea una sesión Veriff para un usuario.
     *
     * Los parámetros {@code givenName} y {@code lastName} son opcionales: si
     * llegan {@code null} o vacíos (tras {@code trim}), la implementación
     * debe OMITIR las claves correspondientes del JSON enviado a Veriff
     * (no enviarlas como strings vacíos, que Veriff rechaza con 400/1104).
     *
     * {@code idNumber} no se acepta como parámetro: nunca lo conocemos antes
     * de la verificación (lo lee Veriff del documento), por lo que la clave
     * tampoco aparece en el JSON.
     */
    VeriffCreateSessionResult createSession(Long userId, String email, String givenName, String lastName);
}
