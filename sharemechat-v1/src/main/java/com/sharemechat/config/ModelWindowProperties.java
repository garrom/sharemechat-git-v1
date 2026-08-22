package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Collections;
import java.util.List;

/**
 * Fase C: ventana horaria de la modelo. Al arranque la plataforma solo "abre"
 * para modelos durante una franja diaria (por defecto 18:00-02:00) por bloque
 * regional. La modelo se asigna a un bloque por su {@code country_detected}:
 *  - Bloque América (zona {@code zone-america}) si el país está en
 *    {@code america-countries}.
 *  - Bloque Europa (zona {@code zone-europe}) en cualquier otro caso.
 *
 * La franja es la MISMA hora de reloj en cada bloque (18:00-02:00), pero cada
 * una en SU zona de referencia, así que el instante absoluto difiere por bloque.
 * La UI la muestra convertida a la hora local de cada modelo.
 *
 * {@code enabled=false} por defecto = kill-switch (comportamiento actual intacto:
 * sin restricción horaria). Se activa por env {@code MODEL_WINDOW_ENABLED=true}.
 */
@Configuration
@ConfigurationProperties(prefix = "model.window")
public class ModelWindowProperties {

    private boolean enabled = false;
    private String open = "18:00";
    private String close = "02:00";
    private String zoneEurope = "Europe/Madrid";
    private String zoneAmerica = "America/New_York";
    private List<String> americaCountries = Collections.emptyList();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getOpen() {
        return open;
    }

    public void setOpen(String open) {
        this.open = open == null ? "18:00" : open;
    }

    public String getClose() {
        return close;
    }

    public void setClose(String close) {
        this.close = close == null ? "02:00" : close;
    }

    public String getZoneEurope() {
        return zoneEurope;
    }

    public void setZoneEurope(String zoneEurope) {
        this.zoneEurope = zoneEurope == null ? "Europe/Madrid" : zoneEurope;
    }

    public String getZoneAmerica() {
        return zoneAmerica;
    }

    public void setZoneAmerica(String zoneAmerica) {
        this.zoneAmerica = zoneAmerica == null ? "America/New_York" : zoneAmerica;
    }

    public List<String> getAmericaCountries() {
        return americaCountries;
    }

    public void setAmericaCountries(List<String> americaCountries) {
        this.americaCountries = americaCountries == null ? Collections.emptyList() : americaCountries;
    }
}
