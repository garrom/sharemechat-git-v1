package com.sharemechat.dto;

import java.time.LocalDateTime;

public class StreamActiveAdminRowDto {

    private Long streamId;
    private String streamType;
    private Long clientId;
    private String clientEmail;
    private String clientNickname;
    private Long modelId;
    private String modelEmail;
    private String modelNickname;
    private LocalDateTime startTime;
    private LocalDateTime confirmedAt;
    private LocalDateTime billableStart;
    private LocalDateTime endTime;
    private Long durationSeconds;
    private String statusDerivado;
    private boolean stuck;

    public StreamActiveAdminRowDto() {
    }

    public Long getStreamId() {
        return streamId;
    }

    public void setStreamId(Long streamId) {
        this.streamId = streamId;
    }

    public String getStreamType() {
        return streamType;
    }

    public void setStreamType(String streamType) {
        this.streamType = streamType;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public String getClientEmail() {
        return clientEmail;
    }

    public void setClientEmail(String clientEmail) {
        this.clientEmail = clientEmail;
    }

    public String getClientNickname() {
        return clientNickname;
    }

    public void setClientNickname(String clientNickname) {
        this.clientNickname = clientNickname;
    }

    public Long getModelId() {
        return modelId;
    }

    public void setModelId(Long modelId) {
        this.modelId = modelId;
    }

    public String getModelEmail() {
        return modelEmail;
    }

    public void setModelEmail(String modelEmail) {
        this.modelEmail = modelEmail;
    }

    public String getModelNickname() {
        return modelNickname;
    }

    public void setModelNickname(String modelNickname) {
        this.modelNickname = modelNickname;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public LocalDateTime getConfirmedAt() {
        return confirmedAt;
    }

    public void setConfirmedAt(LocalDateTime confirmedAt) {
        this.confirmedAt = confirmedAt;
    }

    public LocalDateTime getBillableStart() {
        return billableStart;
    }

    public void setBillableStart(LocalDateTime billableStart) {
        this.billableStart = billableStart;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }

    public Long getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Long durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public String getStatusDerivado() {
        return statusDerivado;
    }

    public void setStatusDerivado(String statusDerivado) {
        this.statusDerivado = statusDerivado;
    }

    public boolean isStuck() {
        return stuck;
    }

    public void setStuck(boolean stuck) {
        this.stuck = stuck;
    }
}
