package com.sharemechat.dto;

/**
 * ADR-049 Subpasada 2A + Subpasada 5 (revisada 2026-07-12): contadores del
 * panel de la modelo afiliada.
 *
 * <p>Con Subpasada 5 se anaden los desgloses de comision (mes actual UTC vs
 * lifetime) para el panel D11. El total {@code commissionAccruedCents}
 * queda como agregado historico neto (suma vivos + reversos).
 *
 * <p>Campos:
 * <ul>
 *   <li>{@code clicksTotal} — total de {@code AffiliateClickEvent} de tipo
 *       CLICK asociados a la modelo.</li>
 *   <li>{@code clicksUniqueVisitors} — {@code COUNT(DISTINCT ip_hash)} sobre
 *       eventos CLICK de la modelo. Estimador de visitantes unicos usando
 *       {@code ip_hash CHAR(16)} (SHA-256 truncado, D15 GDPR).</li>
 *   <li>{@code clientsReferred} — usuarios con {@code referred_by_user_id}
 *       apuntando a esta modelo.</li>
 *   <li>{@code commissionAccruedCents} — suma neta lifetime de
 *       {@code commission_amount_cents} en estados vivos (PAYABLE + PAID +
 *       REVERSED_CHARGEBACK). En centesimas de EUR.</li>
 *   <li>{@code commissionCurrentMonthCents} — suma neta de comision del
 *       mes calendario UTC actual (mismo criterio de estados). Refleja lo
 *       que la modelo esta acumulando en el ciclo actual.</li>
 * </ul>
 */
public class AffiliateStatsDTO {

    private final long clicksTotal;
    private final long clicksUniqueVisitors;
    private final long clientsReferred;
    private final long commissionAccruedCents;
    private final long commissionCurrentMonthCents;

    public AffiliateStatsDTO(long clicksTotal,
                             long clicksUniqueVisitors,
                             long clientsReferred,
                             long commissionAccruedCents,
                             long commissionCurrentMonthCents) {
        this.clicksTotal = clicksTotal;
        this.clicksUniqueVisitors = clicksUniqueVisitors;
        this.clientsReferred = clientsReferred;
        this.commissionAccruedCents = commissionAccruedCents;
        this.commissionCurrentMonthCents = commissionCurrentMonthCents;
    }

    public long getClicksTotal() { return clicksTotal; }
    public long getClicksUniqueVisitors() { return clicksUniqueVisitors; }
    public long getClientsReferred() { return clientsReferred; }
    public long getCommissionAccruedCents() { return commissionAccruedCents; }
    public long getCommissionCurrentMonthCents() { return commissionCurrentMonthCents; }
}
