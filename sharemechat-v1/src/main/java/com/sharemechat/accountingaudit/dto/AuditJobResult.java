package com.sharemechat.accountingaudit.dto;

public class AuditJobResult {

    private Long auditRunId;
    private String status;

    private int checksExecuted;
    private int anomaliesFound;
    private int anomaliesCreated;
    private int anomaliesUpdated;

    private Long executionMs;

    // getters / setters

    public Long getAuditRunId() {
        return auditRunId;
    }

    public void setAuditRunId(Long auditRunId) {
        this.auditRunId = auditRunId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getChecksExecuted() {
        return checksExecuted;
    }

    public void setChecksExecuted(int checksExecuted) {
        this.checksExecuted = checksExecuted;
    }

    public int getAnomaliesFound() {
        return anomaliesFound;
    }

    public void setAnomaliesFound(int anomaliesFound) {
        this.anomaliesFound = anomaliesFound;
    }

    public int getAnomaliesCreated() {
        return anomaliesCreated;
    }

    public void setAnomaliesCreated(int anomaliesCreated) {
        this.anomaliesCreated = anomaliesCreated;
    }

    public int getAnomaliesUpdated() {
        return anomaliesUpdated;
    }

    public void setAnomaliesUpdated(int anomaliesUpdated) {
        this.anomaliesUpdated = anomaliesUpdated;
    }

    public Long getExecutionMs() {
        return executionMs;
    }

    public void setExecutionMs(Long executionMs) {
        this.executionMs = executionMs;
    }
}
