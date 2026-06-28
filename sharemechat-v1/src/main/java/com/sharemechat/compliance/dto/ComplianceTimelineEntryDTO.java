package com.sharemechat.compliance.dto;

import java.time.LocalDateTime;

/**
 * Entrada de la tabla cronologica del dashboard (ultimos 7 dias).
 * Es UNION ALL de SESSION_STARTED / REVIEW_CREATED / COMPLAINT_CREATED /
 * ACCOUNT_STATUS_CHANGE / EVIDENCE_ACCESS.
 */
public class ComplianceTimelineEntryDTO {

    private String type;       // SESSION_STARTED, REVIEW_CREATED, etc.
    private Long refId;        // id de la fila origen
    private String detail;     // severity, category, etc.
    private LocalDateTime ts;

    public ComplianceTimelineEntryDTO() {}

    public ComplianceTimelineEntryDTO(String type, Long refId, String detail, LocalDateTime ts) {
        this.type = type;
        this.refId = refId;
        this.detail = detail;
        this.ts = ts;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Long getRefId() { return refId; }
    public void setRefId(Long refId) { this.refId = refId; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public LocalDateTime getTs() { return ts; }
    public void setTs(LocalDateTime ts) { this.ts = ts; }
}
