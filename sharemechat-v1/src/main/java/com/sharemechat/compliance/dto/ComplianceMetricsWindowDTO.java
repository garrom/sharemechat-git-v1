package com.sharemechat.compliance.dto;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Metricas agregadas para una ventana temporal (7d, 30d, mes en curso).
 * Snapshot on-the-fly desde queries del repository (DEC-CD-5).
 */
public class ComplianceMetricsWindowDTO {

    private String window; // "7d" | "30d" | "current_month"
    private long sessionsModerated;
    private long framesAnalyzed;
    private long sessionsSightengine;
    private long sessionsMock;
    private long sessionsDegraded;
    private Map<String, Long> reviewsBySeverity = new LinkedHashMap<>();
    private Map<String, Long> reviewsByStatus = new LinkedHashMap<>();
    private Double reviewResolutionAvgMinutes;
    private Map<String, Long> complaintsByStatus = new LinkedHashMap<>();
    private Map<String, Long> complaintsBySla = new LinkedHashMap<>();
    private Map<String, Long> p2pReportsByStatus = new LinkedHashMap<>();

    public String getWindow() { return window; }
    public void setWindow(String window) { this.window = window; }

    public long getSessionsModerated() { return sessionsModerated; }
    public void setSessionsModerated(long sessionsModerated) { this.sessionsModerated = sessionsModerated; }

    public long getFramesAnalyzed() { return framesAnalyzed; }
    public void setFramesAnalyzed(long framesAnalyzed) { this.framesAnalyzed = framesAnalyzed; }

    public long getSessionsSightengine() { return sessionsSightengine; }
    public void setSessionsSightengine(long sessionsSightengine) { this.sessionsSightengine = sessionsSightengine; }

    public long getSessionsMock() { return sessionsMock; }
    public void setSessionsMock(long sessionsMock) { this.sessionsMock = sessionsMock; }

    public long getSessionsDegraded() { return sessionsDegraded; }
    public void setSessionsDegraded(long sessionsDegraded) { this.sessionsDegraded = sessionsDegraded; }

    public Map<String, Long> getReviewsBySeverity() { return reviewsBySeverity; }
    public void setReviewsBySeverity(Map<String, Long> reviewsBySeverity) { this.reviewsBySeverity = reviewsBySeverity; }

    public Map<String, Long> getReviewsByStatus() { return reviewsByStatus; }
    public void setReviewsByStatus(Map<String, Long> reviewsByStatus) { this.reviewsByStatus = reviewsByStatus; }

    public Double getReviewResolutionAvgMinutes() { return reviewResolutionAvgMinutes; }
    public void setReviewResolutionAvgMinutes(Double reviewResolutionAvgMinutes) { this.reviewResolutionAvgMinutes = reviewResolutionAvgMinutes; }

    public Map<String, Long> getComplaintsByStatus() { return complaintsByStatus; }
    public void setComplaintsByStatus(Map<String, Long> complaintsByStatus) { this.complaintsByStatus = complaintsByStatus; }

    public Map<String, Long> getComplaintsBySla() { return complaintsBySla; }
    public void setComplaintsBySla(Map<String, Long> complaintsBySla) { this.complaintsBySla = complaintsBySla; }

    public Map<String, Long> getP2pReportsByStatus() { return p2pReportsByStatus; }
    public void setP2pReportsByStatus(Map<String, Long> p2pReportsByStatus) { this.p2pReportsByStatus = p2pReportsByStatus; }
}
