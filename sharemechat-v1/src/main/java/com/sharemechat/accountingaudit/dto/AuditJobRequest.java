package com.sharemechat.accountingaudit.dto;

import java.time.Instant;

public class AuditJobRequest {

    private Instant fromTs;
    private Instant toTs;
    private String scope;
    private boolean dryRun;

    private String trigger;              // MANUAL | SCHEDULED | API
    private Long requestedByUserId;       // opcional

    // getters / setters

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
}
