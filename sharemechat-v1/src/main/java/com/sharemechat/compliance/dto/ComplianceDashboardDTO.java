package com.sharemechat.compliance.dto;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Vista A: dashboard ejecutivo. Agrupa tres ventanas + tabla cronologica
 * + snapshot estado enforcement actual. Composicion fija para Segpay/CCBill
 * auditor; no se permite seleccionar columnas (DEC-CD-2 + Fase A).
 */
public class ComplianceDashboardDTO {

    private LocalDateTime generatedAt;
    private ComplianceMetricsWindowDTO last7Days;
    private ComplianceMetricsWindowDTO last30Days;
    private ComplianceMetricsWindowDTO currentMonth;
    private Map<String, Long> accountStatusSnapshot = new LinkedHashMap<>();
    private List<ComplianceTimelineEntryDTO> timeline7Days;

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }

    public ComplianceMetricsWindowDTO getLast7Days() { return last7Days; }
    public void setLast7Days(ComplianceMetricsWindowDTO last7Days) { this.last7Days = last7Days; }

    public ComplianceMetricsWindowDTO getLast30Days() { return last30Days; }
    public void setLast30Days(ComplianceMetricsWindowDTO last30Days) { this.last30Days = last30Days; }

    public ComplianceMetricsWindowDTO getCurrentMonth() { return currentMonth; }
    public void setCurrentMonth(ComplianceMetricsWindowDTO currentMonth) { this.currentMonth = currentMonth; }

    public Map<String, Long> getAccountStatusSnapshot() { return accountStatusSnapshot; }
    public void setAccountStatusSnapshot(Map<String, Long> accountStatusSnapshot) { this.accountStatusSnapshot = accountStatusSnapshot; }

    public List<ComplianceTimelineEntryDTO> getTimeline7Days() { return timeline7Days; }
    public void setTimeline7Days(List<ComplianceTimelineEntryDTO> timeline7Days) { this.timeline7Days = timeline7Days; }
}
