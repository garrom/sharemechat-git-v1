package com.sharemechat.dto;

/**
 * Datos físicos editables por la modelo (Card 1 Fase 2). Sirve tanto de
 * respuesta de {@code GET /api/me/profile-attributes} como de body de
 * {@code PUT /api/me/profile-attributes}.
 *
 * <p>Los enums ({@code bustSize}, {@code buttSize}, {@code bodyType}) son
 * códigos canónicos validados en {@code ModelProfileAttributesService};
 * {@code null} = campo no rellenado (se acepta y se limpia). La EDAD no está
 * aquí (se deriva de {@code date_of_birth}); el SEXO tampoco (constante
 * femenina, lo pinta el frontend).
 */
public record ModelProfileAttributesDTO(
        String bustSize,
        Integer heightCm,
        String buttSize,
        String bodyType
) {
}
