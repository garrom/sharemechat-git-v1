package com.sharemechat.content.dto;

import java.time.Instant;
import java.util.List;

/**
 * Detalle completo de un run IA.
 * - prompt: texto del prompt expandido (devuelto en creacion para que el editor
 *   lo copie a Claude Cowork). En GET posterior puede llegar null si no se quiere
 *   recargar desde S3.
 * - validationErrors: errores de la ultima validacion del output (vacio si no hubo
 *   submit todavia o si la validacion paso).
 */
public record RunDetailDTO(
        Long id,
        Long articleId,
        String runType,
        String modelProvider,
        String modelId,
        String modelVersion,
        String mode,
        String status,
        boolean outputValidated,
        String promptTemplateId,
        String promptS3Key,
        String promptHash,
        String outputS3Key,
        String outputHash,
        Long triggeredByUserId,
        Instant createdAt,
        String prompt,
        List<ValidationErrorDTO> validationErrors
) {}
