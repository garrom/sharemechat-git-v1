package com.sharemechat.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "platform_transactions")
public class PlatformTransaction {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false) private BigDecimal amount;
    @Column(name="operation_type", nullable=false) private String operationType;

    @ManyToOne @JoinColumn(name="stream_record_id")
    private StreamRecord streamRecord;

    private String description;

    @Column(name="timestamp", insertable=false, updatable=false)
    private LocalDateTime timestamp;

    // getters/setters


    public Long getId() {
        return id;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getOperationType() {
        return operationType;
    }

    public void setOperationType(String operationType) {
        this.operationType = operationType;
    }

    public StreamRecord getStreamRecord() {
        return streamRecord;
    }

    public void setStreamRecord(StreamRecord streamRecord) {
        this.streamRecord = streamRecord;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

}