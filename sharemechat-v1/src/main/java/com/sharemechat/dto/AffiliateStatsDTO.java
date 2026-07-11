package com.sharemechat.dto;

/**
 * ADR-049 Subpasada 2A: contadores del panel de la modelo afiliada.
 *
 * <p>En 2A todos los contadores se calculan con queries directas sobre las
 * tablas de la subpasada 1; con el sistema recien lanzado y sin trafico
 * real, todos devuelven 0. La forma del DTO ya soporta datos reales.
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
 *   <li>{@code commissionAccruedCents} — suma de {@code commission_amount_cents}
 *       en estados que representan comision viva (ACCRUED, PAYABLE, PAID);
 *       en centesimas de EUR.</li>
 * </ul>
 */
public class AffiliateStatsDTO {

    private final long clicksTotal;
    private final long clicksUniqueVisitors;
    private final long clientsReferred;
    private final long commissionAccruedCents;

    public AffiliateStatsDTO(long clicksTotal,
                             long clicksUniqueVisitors,
                             long clientsReferred,
                             long commissionAccruedCents) {
        this.clicksTotal = clicksTotal;
        this.clicksUniqueVisitors = clicksUniqueVisitors;
        this.clientsReferred = clientsReferred;
        this.commissionAccruedCents = commissionAccruedCents;
    }

    public long getClicksTotal() { return clicksTotal; }
    public long getClicksUniqueVisitors() { return clicksUniqueVisitors; }
    public long getClientsReferred() { return clientsReferred; }
    public long getCommissionAccruedCents() { return commissionAccruedCents; }
}
