package com.sharemechat.service;

import com.sharemechat.dto.DiditCreateSessionResult;

public interface DiditClient {

    /**
     * Crea una sesion Didit para un usuario, contra el workflow indicado.
     *
     * El parametro {@code workflowId} permite distinguir entre el flujo MODELO
     * (Document + Selfie + Liveness) y el flujo CLIENTE (Adaptive Age
     * Verification). El caller resuelve cual usar antes de llamar y le pasa
     * el id correspondiente leido de {@code DiditProperties.modelWorkflowId}
     * o {@code DiditProperties.clientWorkflowId}.
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
    DiditCreateSessionResult createSession(Long userId, String email, String givenName, String lastName, String workflowId);
}
