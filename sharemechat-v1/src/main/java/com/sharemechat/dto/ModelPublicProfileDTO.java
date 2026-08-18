package com.sharemechat.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Perfil público del modelo expuesto al cliente en "Ver perfil completo"
 * (Capa 2 — Fase 4; ampliado en Card 1 Fase 2, 2026-08-18).
 *
 * <p>Diseñado a propósito para NO incluir datos legales ni de privacidad:
 * <ul>
 *   <li>Sin {@code name} / {@code surname} (nombre legal): el modelo se
 *       identifica al cliente solo por {@code nickname}.</li>
 *   <li>Sin {@code email}.</li>
 *   <li>Sin {@code country}.</li>
 *   <li>Sin {@code dateOfBirth}: se expone solo la EDAD derivada
 *       ({@code age}), nunca la fecha.</li>
 *   <li>Sin {@code accountStatus} ni flags internos.</li>
 * </ul>
 *
 * <p>El payload se compone con datos del entity {@code User} (nickname,
 * biography, interests, chosenRateEurPerMin, edad derivada de date_of_birth),
 * los idiomas de {@code user_languages}, los datos físicos de
 * {@code model_profile_attributes} y la disponibilidad agregada de
 * {@code model_presence_samples}. Los assets gráficos (fotos + vídeos
 * aprobados) se obtienen aparte vía {@code GET /api/models/{userId}/assets}.
 *
 * <p>Card 1 Fase 2: campos físicos ({@code bustSize}, {@code heightCm},
 * {@code buttSize}, {@code bodyType}) como códigos canónicos (el frontend
 * traduce vía i18n); {@code age} como entero; el sexo no viaja (constante
 * femenina, lo pinta el frontend); {@code availability} = histograma "suele
 * estar en línea" (buckets día×hora en zona Europe/Madrid, intensidad 0-100).
 * {@code hasAvailabilityData} permite ocultar la sección cuando aún no hay
 * muestras (PRELAUNCH).
 */
public record ModelPublicProfileDTO(
        Long id,
        String nickname,
        String biography,
        String interests,
        BigDecimal chosenRateEurPerMin,
        List<LanguageEntry> languages,
        // ---- Card 1 Fase 2: datos físicos ----
        Integer age,
        String bustSize,
        Integer heightCm,
        String buttSize,
        String bodyType,
        // ---- Card 1 Fase 2: disponibilidad observada ----
        List<AvailabilityBucket> availability,
        boolean hasAvailabilityData
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

    /**
     * Casilla del histograma de disponibilidad. {@code dayOfWeek} 1=Lunes
     * .. 7=Domingo (java.time.DayOfWeek.getValue()); {@code hour} 0-23 en
     * hora peninsular (Europe/Madrid); {@code intensity} 0-100 (frecuencia
     * relativa de presencia observada en esa franja dentro de la ventana).
     */
    public record AvailabilityBucket(
            int dayOfWeek,
            int hour,
            int intensity
    ) {}
}
