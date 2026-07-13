package com.sharemechat.service;

import com.sharemechat.dto.FaceAttributesResult;

/**
 * ADR-050 Fase B: interface agnostica para el vendor de face-attributes
 * usado en el liveness challenge. El nombre del vendor concreto vive
 * solo en la implementacion adapter (regla vendor-agnostic en dominio
 * del proyecto).
 *
 * <p>Contrato:
 * <ul>
 *   <li>Recibe los bytes JPEG del frame capturado del stream local.</li>
 *   <li>Devuelve {@link FaceAttributesResult} normalizado.</li>
 *   <li>Politica de errores fail-closed-soft (ADR-050 D5): si el vendor
 *       esta deshabilitado, sin credenciales o inalcanzable, lanza
 *       {@link IllegalStateException} o {@link RuntimeException}; el
 *       caller (service {@code LivenessChallengeService}) lo traduce a
 *       marca de {@code vendor_unavailable} con TTL corto (5 min).</li>
 * </ul>
 */
public interface LivenessFaceAttributesProvider {

    /**
     * @param frameBytes JPEG del frame local capturado del stream.
     * @return atributos normalizados de la cara detectada (o
     *         {@code faceDetected=false} si el vendor no detecta cara).
     * @throws IllegalStateException si el vendor no esta configurado.
     * @throws RuntimeException      si hay error HTTP / parse / timeout.
     */
    FaceAttributesResult analyze(byte[] frameBytes);
}
