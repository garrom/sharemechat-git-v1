package com.sharemechat.accountingaudit.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "audit_runs")
public class AuditRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Identidad del job
    @Column(name = "job_name", nullable = false, length = 100)
    private String jobName;

    @Column(name = "`trigger`", nullable = false, length = 30)
    private String trigger; // MANUAL | SCHEDULED | API

    @Column(name = "requested_by_user_id")
    private Long requestedByUserId;

    // Inputs
    @Column(name = "from_ts")
    private Instant fromTs;

    @Column(name = "to_ts")
    private Instant toTs;

    @Column(name = "scope", nullable = false, length = 50)
    private String scope;

    @Column(name = "dry_run", nullable = false)
    private boolean dryRun;

    // Estado
    @Column(name = "status", nullable = false, length = 20)
    private String status; // RUNNING | SUCCESS | FAILED | PARTIAL

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    // Métricas
    @Column(name = "checks_executed", nullable = false)
    private int checksExecuted;

    @Column(name = "anomalies_found", nullable = false)
    private int anomaliesFound;

    @Column(name = "anomalies_created", nullable = false)
    private int anomaliesCreated;

    @Column(name = "anomalies_updated", nullable = false)
    private int anomaliesUpdated;

    // Diagnóstico
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "execution_ms")
    private Long executionMs;

    @Column(name = "input_hash", length = 64)
    private String inputHash;

    // getters / setters (sin lógica)


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getJobName() {
        return jobName;
    }

    public void setJobName(String jobName) {
        this.jobName = jobName;
    }

    public String getTrigger() {
        return trigger;
    }

    public void setTrigger(String trigger) {
        this.trigger = trigger;
    }

    public Long getRequestedByUserId() {
        return requestedByUserId;
    }

    public void setRequestedByUserId(Long requestedByUserId) {
        this.requestedByUserId = requestedByUserId;
    }

    public Instant getFromTs() {
        return fromTs;
    }

    public void setFromTs(Instant fromTs) {
        this.fromTs = fromTs;
    }

    public Instant getToTs() {
        return toTs;
    }

    public void setToTs(Instant toTs) {
        this.toTs = toTs;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public boolean isDryRun() {
        return dryRun;
    }

    public void setDryRun(boolean dryRun) {
        this.dryRun = dryRun;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(Instant finishedAt) {
        this.finishedAt = finishedAt;
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

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Long getExecutionMs() {
        return executionMs;
    }

    public void setExecutionMs(Long executionMs) {
        this.executionMs = executionMs;
    }

    public String getInputHash() {
        return inputHash;
    }

    public void setInputHash(String inputHash) {
        this.inputHash = inputHash;
    }
}
