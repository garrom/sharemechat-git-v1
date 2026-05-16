package com.sharemechat.content.dto;

/**
 * Request del endpoint POST .../runs/{runId}/output-bilingual (ADR-024).
 *
 * Flujo bilingue dentro del editor del articulo ES:
 *  - rawJsonEs: JSON crudo del articulo ES (obligatorio). Equivalente al
 *    rawOutput de SubmitOutputRequest del flujo monolingue.
 *  - rawJsonEn: JSON crudo del articulo EN (opcional). Si null o blank,
 *    el endpoint delega al flujo monolingue (igual que submitOutput de
 *    ADR-014). Si presente, dispara la creacion atomica del articulo hijo
 *    EN con parent_article_id apuntando al articulo del run.
 *  - modelId / modelVersion: declaracion del modelo Claude que produjo
 *    los JSON. Whitelist del adapter en backend.
 */
public class SubmitOutputBilingualRequest {

    private String rawJsonEs;
    private String rawJsonEn;
    private String modelId;
    private String modelVersion;

    public String getRawJsonEs() { return rawJsonEs; }
    public void setRawJsonEs(String rawJsonEs) { this.rawJsonEs = rawJsonEs; }

    public String getRawJsonEn() { return rawJsonEn; }
    public void setRawJsonEn(String rawJsonEn) { this.rawJsonEn = rawJsonEn; }

    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }
}
