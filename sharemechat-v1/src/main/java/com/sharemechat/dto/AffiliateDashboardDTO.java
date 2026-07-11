package com.sharemechat.dto;

/**
 * ADR-049 Subpasada 2A: respuesta de {@code GET /api/models/me/affiliate}.
 *
 * <p>Campos:
 * <ul>
 *   <li>{@code code} — {@code null} si la modelo aun no activo el programa.</li>
 *   <li>{@code active} — {@code true} sii {@code code != null}.</li>
 *   <li>{@code urlCanonical} — URL publica absoluta con formato
 *       {@code <app.public.base-url>/i?ref=<code>}, {@code null} si no activo.</li>
 *   <li>{@code stats} — contadores del funnel de afiliacion (nunca null).</li>
 * </ul>
 */
public class AffiliateDashboardDTO {

    private final String code;
    private final boolean active;
    private final String urlCanonical;
    private final AffiliateStatsDTO stats;

    public AffiliateDashboardDTO(String code,
                                  boolean active,
                                  String urlCanonical,
                                  AffiliateStatsDTO stats) {
        this.code = code;
        this.active = active;
        this.urlCanonical = urlCanonical;
        this.stats = stats;
    }

    public String getCode() { return code; }
    public boolean isActive() { return active; }
    public String getUrlCanonical() { return urlCanonical; }
    public AffiliateStatsDTO getStats() { return stats; }
}
