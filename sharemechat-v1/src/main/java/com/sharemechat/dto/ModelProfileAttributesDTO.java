package com.sharemechat.dto;

/**
 * Datos físicos editables por la modelo (Card 1 Fase 2). Sirve tanto de
 * respuesta de {@code GET /api/me/profile-attributes} como de body de
 * {@code PUT /api/me/profile-attributes}.
 *
 * <p>Los enums ({@code sex}, {@code bustSize}, {@code buttSize},
 * {@code bodyType}) son códigos canónicos validados en
 * {@code ModelProfileAttributesService}; {@code null} = campo no rellenado
 * (se acepta y se limpia). La EDAD no está aquí: se deriva de
 * {@code date_of_birth} y solo se expone en el perfil público.
 */
public record ModelProfileAttributesDTO(
        String sex,
        String bustSize,
        Integer heightCm,
        String buttSize,
        String bodyType
) {
}
