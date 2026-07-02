package com.sharemechat.support.dto;

/**
 * Response envelope de una llamada Claude API (DEC-CS-1).
 * Mantiene solo los campos que el pipeline necesita: texto final, tokens,
 * finish reason, y si el modelo llamo la tool escalate_to_human (DEC-CS-2).
 */
public class ClaudeApiResponse {

    private String textContent;
    private int tokensInput;
    private int tokensOutput;
    private String finishReason;
    private String modelId;
    private boolean escalationToolCalled;
    private String escalationReason;

    public String getTextContent() { return textContent; }
    public void setTextContent(String textContent) { this.textContent = textContent; }
    public int getTokensInput() { return tokensInput; }
    public void setTokensInput(int tokensInput) { this.tokensInput = tokensInput; }
    public int getTokensOutput() { return tokensOutput; }
    public void setTokensOutput(int tokensOutput) { this.tokensOutput = tokensOutput; }
    public String getFinishReason() { return finishReason; }
    public void setFinishReason(String finishReason) { this.finishReason = finishReason; }
    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }
    public boolean isEscalationToolCalled() { return escalationToolCalled; }
    public void setEscalationToolCalled(boolean escalationToolCalled) { this.escalationToolCalled = escalationToolCalled; }
    public String getEscalationReason() { return escalationReason; }
    public void setEscalationReason(String escalationReason) { this.escalationReason = escalationReason; }
}
