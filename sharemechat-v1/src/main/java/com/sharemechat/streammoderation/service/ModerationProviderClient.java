package com.sharemechat.streammoderation.service;

import com.sharemechat.streammoderation.dto.ModerationFrameSubmission;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;

/**
 * Adapter vendor-agnostic del control plane de moderacion visual del
 * streaming (frente Moderacion IA; ver ADR-030, ADR-036, ADR-037).
 *
 * <p>Cada vendor (MOCK, SIGHTENGINE, HIVE, REKOGNITION) implementa esta
 * interface; el {@code StreamModerationSessionService} elige cual
 * invocar segun el {@code active_mode} persistido en
 * {@code stream_moderation_provider_config}.
 *
 * <p>El metodo {@link #submitImage(ModerationFrameSubmission)} es
 * sincrono y devuelve un verdict normalizado: la postura arquitectonica
 * de ADR-036 (bloque 1) usa image API frame-a-frame cliente-side, no
 * webhooks asincronos. El control plane envia el frame y bloquea hasta
 * recibir verdict o timeout. El webhook entrante generico (P1.3 stub)
 * absorbera vendors que en el futuro notifiquen asincronamente, pero
 * NO es la via del dia 1.
 *
 * <p>Patron de seleccion (ADR-035 / ADR-037, Plan A + contingencias
 * documentadas): esta interface soporta UN unico vendor activo a la
 * vez en produccion. {@code MOCK} opera durante desarrollo y queda
 * como adapter de fallback para tests. {@code SIGHTENGINE} sera el
 * vendor activo en produccion a partir de P2. {@code HIVE} y
 * {@code REKOGNITION} son contingencias documentadas sin implementar;
 * se materializarian como nuevos implementadores de esta interface
 * solo si Sightengine deja de cubrir. NO hay convivencia productiva
 * entre vendors.
 *
 * <p>Convencion de errores: si el vendor falla (red, 4xx, 5xx,
 * timeout), el adapter lanza {@link RuntimeException}. El caller
 * (control plane) decide la politica fail-closed-soft de ADR-036
 * bloque 3 a partir del fallo.
 */
public interface ModerationProviderClient {

    /**
     * Envia un frame a moderar y devuelve el verdict normalizado.
     * Para el adapter MOCK, devuelve siempre GREEN sin llamar al
     * exterior. Cada implementador traduce su shape vendor-specific
     * al DTO interno agnostico {@link ModerationVerdictResult}.
     */
    ModerationVerdictResult submitImage(ModerationFrameSubmission frame);
}
