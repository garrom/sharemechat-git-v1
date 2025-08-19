package com.sharemechat.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "platform_balances")
public class PlatformBalance {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="transaction_id", nullable=false)
    private Long transactionId;

    @Column(nullable=false) private BigDecimal amount;
    @Column(nullable=false) private BigDecimal balance;
    private String description;

    @Column(name="timestamp", insertable=false, updatable=false)
    private LocalDateTime timestamp;

    // getters/setters


    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public void setBalance(BigDecimal balance) {
        this.balance = balance;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public Long getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(Long transactionId) {
        this.transactionId = transactionId;
    }

    public Long getId() {
        return id;
    }

}