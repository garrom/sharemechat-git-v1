package com.sharemechat.affiliate.dto;

import java.time.LocalDateTime;

/**
 * ADR-049 Subpasada 2A: respuesta de {@code POST /api/models/me/affiliate/activate}.
 *
 * <p>Campos:
 * <ul>
 *   <li>{@code code} — codigo de afiliacion Crockford Base32 sin ambiguos,
 *       longitud fija por property {@code affiliate.code.length}.</li>
 *   <li>{@code activatedAt} — timestamp. En primera invocacion es "ahora"
 *       (no persistido; la subpasada 1 no anadio columna dedicada,
 *       decision A del mapping 2A). En invocacion idempotente se devuelve
 *       {@code user.updatedAt} como aproximacion.</li>
 *   <li>{@code alreadyActivated} — {@code true} si el codigo ya existia y
 *       la llamada fue idempotente; {@code false} si se acaba de generar.</li>
 * </ul>
 */
public class AffiliateActivateResponseDTO {

    private final String code;
    private final LocalDateTime activatedAt;
    private final boolean alreadyActivated;

    public AffiliateActivateResponseDTO(String code,
                                         LocalDateTime activatedAt,
                                         boolean alreadyActivated) {
        this.code = code;
        this.activatedAt = activatedAt;
        this.alreadyActivated = alreadyActivated;
    }

    public String getCode() { return code; }
    public LocalDateTime getActivatedAt() { return activatedAt; }
    public boolean isAlreadyActivated() { return alreadyActivated; }
}
