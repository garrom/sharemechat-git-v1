package com.sharemechat.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Perfil público del modelo expuesto al cliente en el modal
 * "Ver perfil completo" (Capa 2 — Fase 4).
 *
 * <p>Diseñado a propósito para NO incluir datos legales ni de privacidad:
 * <ul>
 *   <li>Sin {@code name} / {@code surname} (nombre legal): el modelo se
 *       identifica al cliente solo por {@code nickname}.</li>
 *   <li>Sin {@code email}.</li>
 *   <li>Sin {@code country} (decisión de negocio Fase 4: el
 *       {@code country_detected} por IP no es fiable y no merece
 *       exponerse).</li>
 *   <li>Sin {@code dateOfBirth}, sin {@code accountStatus}, sin flags
 *       internos.</li>
 * </ul>
 *
 * <p>El payload se compone con datos del entity {@code User} (nickname,
 * biography, interests, chosenRateEurPerMin) más los idiomas declarados
 * en {@code user_languages}. Los assets gráficos (fotos + vídeos aprobados)
 * se obtienen aparte vía {@code GET /api/models/{userId}/assets}.
 *
 * <p>ADR-052 Superficie 2 (2026-07-25): {@code chosenRateEurPerMin} se
 * añade para que el cliente vea el precio por minuto elegido por la
 * modelo antes de iniciar sesión (ADR-052 §D10). Rango 1-9 EUR/min según
 * tramo vigente de la modelo.
 */
public record ModelPublicProfileDTO(
        Long id,
        String nickname,
        String biography,
        String interests,
        BigDecimal chosenRateEurPerMin,
        List<LanguageEntry> languages
) {

    /**
     * Entrada de idioma del modelo (fila de {@code user_languages}).
     * El {@code level} viene de la columna del mismo nombre (NATIVE,
     * FLUENT, BASIC, ...). {@code primary} indica si es el idioma
     * principal del modelo.
     */
    public record LanguageEntry(
            String langCode,
            String level,
            boolean primary
    ) {}
}
