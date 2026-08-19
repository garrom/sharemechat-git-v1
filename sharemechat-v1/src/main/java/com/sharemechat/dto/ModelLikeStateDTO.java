package com.sharemechat.dto;

/**
 * Estado de likes de una modelo para el visor actual (Card 1 Fase 3).
 *
 * <p>{@code count} = total de likes de la modelo. {@code hasLiked} = si el
 * cliente que consulta ya le ha dado like. {@code badgeCode} = insignia
 * vigente resuelta contra la escalera de umbrales (null por debajo de 10):
 * {@code TIARA} (10), {@code DIADEM} (25), {@code CROWN} (50),
 * {@code GEMS_CROWN} (100), {@code IMPERIAL} (250). El frontend traduce el
 * nombre y pinta el SVG correspondiente.
 */
public record ModelLikeStateDTO(
        long count,
        boolean hasLiked,
        String badgeCode
) {
}
