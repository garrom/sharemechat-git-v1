package com.sharemechat.streammoderation.dto;

/**
 * Body del endpoint {@code POST /api/admin/stream-moderation/config/mode}.
 *
 * <p>Validacion en service-layer:
 * <ul>
 *   <li>{@code mode} requerido y dentro del set
 *       {@code {MOCK, SIGHTENGINE, HIVE, REKOGNITION}}.</li>
 *   <li>{@code note} opcional, max 255 chars.</li>
 * </ul>
 */
public record StreamModerationConfigUpdateRequest(
        String mode,
        String note
) {
}
