package com.sharemechat.content.dto;

/**
 * Request del endpoint POST .../runs/{runId}/apply-bilingual (ADR-025).
 *
 * Flujo bilingue post-rediseno: el operador pega UN UNICO JSON con
 * estructura schema 2.0 ({ shared, locales: { es, en } }).
 *
 *  - rawJson: JSON crudo pegado por el operador. Obligatorio.
 *  - modelId: declaracion del modelo Claude que produjo el JSON
 *    (validado contra whitelist en el adapter).
 *  - modelVersion: opcional.
 */
public class ApplyBilingualRequest {

    private String rawJson;
    private String modelId;
    private String modelVersion;

    public String getRawJson() { return rawJson; }
    public void setRawJson(String rawJson) { this.rawJson = rawJson; }

    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }
}
