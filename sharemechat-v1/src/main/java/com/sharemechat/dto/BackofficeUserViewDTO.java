package com.sharemechat.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Vista completa de un usuario expuesta cuando el viewer ES backoffice
 * (cualquier rol BO: ADMIN, SUPPORT, AUDIT o EDITOR).
 *
 * <p>Diseñada para soportar gestión y auditoría desde el backoffice:
 * incluye todos los campos del entity {@code User} excepto la
 * {@code password}. La granularidad fina por rol BO (qué subset ven
 * SUPPORT vs AUDIT, por ejemplo) queda como mejora futura — por ahora
 * los 4 roles BO ven la misma vista.
 *
 * <p>El endpoint {@code GET /api/users/{id}} selecciona entre este DTO
 * y {@link PublicUserDTO} según los roles backoffice del viewer
 * (vacío → {@code PublicUserDTO}, no vacío → este DTO).
 *
 * <p>Modelado como {@code record} para inmutabilidad y serialización
 * trivial con Jackson (los nombres de los componentes definen las
 * propiedades JSON).
 */
public record BackofficeUserViewDTO(
        Long id,
        String nickname,
        String email,
        String role,
        String userType,
        String name,
        String surname,
        LocalDate dateOfBirth,
        String biography,
        String interests,
        String verificationStatus,
        Boolean isActive,
        Boolean unsubscribe,
        String uiLocale,
        String countryDetected,
        String accountStatus,
        LocalDateTime suspendedUntil,
        String riskReason,
        LocalDateTime riskUpdatedAt,
        Long riskUpdatedBy,
        LocalDateTime emailVerifiedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
