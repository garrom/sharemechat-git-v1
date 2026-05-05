package com.sharemechat.content.dto;

/**
 * Cuerpo de POST /articles/{id}/runs/{runId}/output.
 * El editor pega el output crudo de Claude Cowork (texto JSON).
 * Ademas declara el modelId/modelVersion exactos para trazabilidad.
 */
public class SubmitOutputRequest {

    private String rawOutput;
    private String modelId;
    private String modelVersion;
    private Integer tokensInput;
    private Integer tokensOutput;

    public String getRawOutput() { return rawOutput; }
    public void setRawOutput(String rawOutput) { this.rawOutput = rawOutput; }

    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }

    public Integer getTokensInput() { return tokensInput; }
    public void setTokensInput(Integer tokensInput) { this.tokensInput = tokensInput; }

    public Integer getTokensOutput() { return tokensOutput; }
    public void setTokensOutput(Integer tokensOutput) { this.tokensOutput = tokensOutput; }
}
