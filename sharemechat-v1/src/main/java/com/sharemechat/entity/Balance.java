package com.sharemechat.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "balances")
public class Balance {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId; // mantenemos simple (no relacionamos entidad aquí)

    @Column(name = "transaction_id", nullable = false)
    private Long transactionId;

    @Column(name = "operation_type", nullable = false)
    private String operationType;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "balance", nullable = false)
    private BigDecimal balance;

    @Column(name = "timestamp", insertable = false, updatable = false)
    private LocalDateTime timestamp;

    @Column(name = "description")
    private String description;

    public Balance() {}

    public Long getId() { return id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long transactionId) { this.transactionId = transactionId; }

    public String getOperationType() { return operationType; }
    public void setOperationType(String operationType) { this.operationType = operationType; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public LocalDateTime getTimestamp() { return timestamp; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
