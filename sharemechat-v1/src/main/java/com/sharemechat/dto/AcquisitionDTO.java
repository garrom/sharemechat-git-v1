package com.sharemechat.dto;

/**
 * Datos de atribucion de origen (capa B, ADR-057) que el frontend adjunta,
 * opcionalmente, al cuerpo de las peticiones de registro (cliente, modelo,
 * master). Son first-touch, leidos de la cookie propia smc_attribution que
 * escribe la capa A. Todos los campos son opcionales y auto-declarados por el
 * cliente; sin PII directa (solo canal de marketing).
 */
public class AcquisitionDTO {

    private String utmSource;
    private String utmMedium;
    private String utmCampaign;
    private String referrerHost;
    private String landingPath;

    public String getUtmSource() {
        return utmSource;
    }

    public void setUtmSource(String utmSource) {
        this.utmSource = utmSource;
    }

    public String getUtmMedium() {
        return utmMedium;
    }

    public void setUtmMedium(String utmMedium) {
        this.utmMedium = utmMedium;
    }

    public String getUtmCampaign() {
        return utmCampaign;
    }

    public void setUtmCampaign(String utmCampaign) {
        this.utmCampaign = utmCampaign;
    }

    public String getReferrerHost() {
        return referrerHost;
    }

    public void setReferrerHost(String referrerHost) {
        this.referrerHost = referrerHost;
    }

    public String getLandingPath() {
        return landingPath;
    }

    public void setLandingPath(String landingPath) {
        this.landingPath = landingPath;
    }
}
