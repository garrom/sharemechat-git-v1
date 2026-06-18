package com.sharemechat.streammoderation.dto;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Resultado normalizado que el adapter del vendor devuelve al control
 * plane. Es el DTO interno agnostico sobre el que opera el control
 * plane; cada adapter (Sightengine, Hive, Rekognition, MOCK) traduce
 * su shape vendor-specific a este DTO.
 *
 * <p>Campos:
 * <ul>
 *   <li>{@code providerEventId}: identificador estable del vendor
 *       (nullable para respuestas sync sin id).</li>
 *   <li>{@code frameTimestamp}: instante del frame al que aplica el
 *       verdict.</li>
 *   <li>{@code categoryVerdicts}: verdict por categoria normalizada
 *       (clave = constante de
 *       {@link com.sharemechat.constants.Constants.StreamModerationCategory}).</li>
 *   <li>{@code severityOverall}: severidad agregada de las categorias;
 *       deriva del peor verdict individual.</li>
 *   <li>{@code suggestedAction}: accion sugerida por el adapter (NO_OP,
 *       ENQUEUE, CUT, CUT_AND_BAN). El {@code StreamModerationActionService}
 *       de P1.2 decide si la respeta o aplica politica propia.</li>
 *   <li>{@code vendorMetadataJson}: payload crudo del vendor preservado
 *       como opaco, para persistir en
 *       {@code stream_moderation_events.payload_json}.</li>
 * </ul>
 *
 * <p>DTO interno del control plane, NO de transporte REST: sin
 * anotaciones Jackson ni validacion de entrada.
 *
 * <p>Ver ADR-036, ADR-037.
 */
public class ModerationVerdictResult {

    private String providerEventId;
    private Instant frameTimestamp;
    private Map<String, ModerationCategoryVerdict> categoryVerdicts = new HashMap<>();
    private String severityOverall;
    private String suggestedAction;
    private String vendorMetadataJson;

    public ModerationVerdictResult() {
    }

    public String getProviderEventId() {
        return providerEventId;
    }

    public void setProviderEventId(String providerEventId) {
        this.providerEventId = providerEventId;
    }

    public Instant getFrameTimestamp() {
        return frameTimestamp;
    }

    public void setFrameTimestamp(Instant frameTimestamp) {
        this.frameTimestamp = frameTimestamp;
    }

    public Map<String, ModerationCategoryVerdict> getCategoryVerdicts() {
        return categoryVerdicts;
    }

    public void setCategoryVerdicts(Map<String, ModerationCategoryVerdict> categoryVerdicts) {
        this.categoryVerdicts = categoryVerdicts;
    }

    public String getSeverityOverall() {
        return severityOverall;
    }

    public void setSeverityOverall(String severityOverall) {
        this.severityOverall = severityOverall;
    }

    public String getSuggestedAction() {
        return suggestedAction;
    }

    public void setSuggestedAction(String suggestedAction) {
        this.suggestedAction = suggestedAction;
    }

    public String getVendorMetadataJson() {
        return vendorMetadataJson;
    }

    public void setVendorMetadataJson(String vendorMetadataJson) {
        this.vendorMetadataJson = vendorMetadataJson;
    }
}
