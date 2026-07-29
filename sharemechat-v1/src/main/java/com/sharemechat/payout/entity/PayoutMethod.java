package com.sharemechat.payout.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * ADR-056 D12: metodo de payout registrado por un user (Master o modelo
 * individual) para recibir retiros. Multi-rail: PAXUM (S6 prioritario),
 * YOURSAFE (#D-52), NOWPAYMENTS_CRYPTO (#D-53), SEPA_MANUAL (fallback).
 *
 * <p>El usuario puede tener varios metodos registrados, uno marcado
 * {@code isDefault=true}. La solicitud PayoutRequest referencia este
 * PayoutMethod via {@code payoutMethodId} + denormaliza {@code rail}
 * para reporting eficiente.
 *
 * <p>{@code verified_at} es NULL hasta que el adapter concreto (o el
 * admin) valida que el account_ref es correcto. En v1 la verificacion
 * es manual (admin marca verified_at); adapters futuros (S6 Paxum)
 * pueden implementar handshake automatico.
 */
@Entity
@Table(name = "payout_methods")
public class PayoutMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** PAXUM | YOURSAFE | NOWPAYMENTS_CRYPTO | SEPA_MANUAL — CHECK en BD. */
    @Column(name = "rail", nullable = false, length = 30)
    private String rail;

    /** email Paxum, IBAN Yoursafe, direccion cripto NOWPayments, etc. */
    @Column(name = "account_ref", nullable = false, length = 255)
    private String accountRef;

    /** Alias legible para el user ("Paxum principal", "BTC wallet"...). */
    @Column(name = "display_alias", length = 80)
    private String displayAlias;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault = false;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public PayoutMethod() {}

    public Long getId() { return id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getRail() { return rail; }
    public void setRail(String rail) { this.rail = rail; }

    public String getAccountRef() { return accountRef; }
    public void setAccountRef(String accountRef) { this.accountRef = accountRef; }

    public String getDisplayAlias() { return displayAlias; }
    public void setDisplayAlias(String displayAlias) { this.displayAlias = displayAlias; }

    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean isDefault) { this.isDefault = isDefault; }

    public LocalDateTime getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(LocalDateTime verifiedAt) { this.verifiedAt = verifiedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
