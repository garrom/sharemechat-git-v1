package com.sharemechat.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
public class Transaction {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // FK a users(id)
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "operation_type", nullable = false)
    private String operationType;

    // Opcionales (los dejaremos sin usar de momento)
    @ManyToOne
    @JoinColumn(name = "stream_record_id")
    private StreamRecord streamRecord;

    @ManyToOne
    @JoinColumn(name = "gift_id")
    private Gift gift;

    @Column(name = "timestamp", insertable = false, updatable = false)
    private LocalDateTime timestamp;

    @Column(name = "description")
    private String description;

    // ADR-054: FK opcional al ticket de incidencia que origino esta
    // transaction (solo aplica en compensaciones tipo MANUAL_REFUND
    // disparadas desde el flujo de tickets). Sin ManyToOne para evitar
    // dependencia ciclica de entities entre entity/ y support/entity/;
    // se persiste como Long y se resuelve via SupportTicketRepository
    // cuando hace falta.
    @Column(name = "ticket_id")
    private Long ticketId;

    public Transaction() {}

    public Long getId() { return id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getOperationType() { return operationType; }
    public void setOperationType(String operationType) { this.operationType = operationType; }

    public StreamRecord getStreamRecord() { return streamRecord; }
    public void setStreamRecord(StreamRecord streamRecord) { this.streamRecord = streamRecord; }

    public Gift getGift() { return gift; }
    public void setGift(Gift gift) { this.gift = gift; }

    public LocalDateTime getTimestamp() { return timestamp; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Long getTicketId() { return ticketId; }
    public void setTicketId(Long ticketId) { this.ticketId = ticketId; }
}
