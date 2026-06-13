package com.sharemechat.service;

import com.sharemechat.dto.DiditCreateSessionResult;

public interface DiditClient {

    /**
     * Crea una sesion Didit para un usuario (flujo KYC de modelo, Document +
     * Selfie + Liveness via Workflow Builder).
     *
     * Los parametros {@code givenName} y {@code lastName} son opcionales: si
     * llegan {@code null} o vacios (tras {@code trim}), la implementacion debe
     * OMITIR las claves correspondientes del bloque {@code expected_details}
     * del JSON enviado a Didit. Es el mismo principio aplicado al payload de
     * Veriff tras el incidente 400/1104 (2026-06-11): no se envian strings
     * vacios en campos de identidad.
     *
     * NO se acepta idNumber: igual que en Veriff, no lo conocemos antes de la
     * verificacion (lo lee Didit del documento).
     */
    DiditCreateSessionResult createSession(Long userId, String email, String givenName, String lastName);
}
