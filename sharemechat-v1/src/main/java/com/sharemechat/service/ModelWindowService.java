package com.sharemechat.service;

import com.sharemechat.config.ModelWindowProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Fase C: decide si una modelo está DENTRO de su ventana horaria según su país
 * ({@code country_detected}). Clase pura: sin BD ni Redis; solo reloj + config.
 *
 * Zona SIEMPRE explícita (patrón de {@link PresenceTelemetryService}), nunca
 * {@code LocalTime.now()} a secas: el bloque América se evalúa en su zona
 * ({@code America/New_York}) y el resto en la europea ({@code Europe/Madrid}).
 *
 * Fail-open: ante error de config/reloj o zona inválida, devuelve "dentro"
 * (no dejar la plataforma muerta por un bug de zona). El kill-switch
 * {@code enabled=false} también deja pasar siempre.
 */
@Service
public class ModelWindowService {

    private static final Logger log = LoggerFactory.getLogger(ModelWindowService.class);

    private final ModelWindowProperties props;
    private final Set<String> americaSet;

    public ModelWindowService(ModelWindowProperties props) {
        this.props = props;
        Set<String> s = new HashSet<>();
        if (props.getAmericaCountries() != null) {
            for (String c : props.getAmericaCountries()) {
                if (c != null && !c.isBlank()) s.add(c.trim().toUpperCase(Locale.ROOT));
            }
        }
        this.americaSet = s;
    }

    public boolean isEnabled() {
        return props.isEnabled();
    }

    /** Zona IANA del bloque de la modelo según su país (América vs resto=Europa). */
    public String zoneForCountry(String iso2) {
        String c = iso2 == null ? "" : iso2.trim().toUpperCase(Locale.ROOT);
        return americaSet.contains(c) ? props.getZoneAmerica() : props.getZoneEurope();
    }

    /**
     * true si AHORA estamos dentro de la ventana para el país dado. Si el gate
     * está apagado ({@code enabled=false}) devuelve siempre true. Fail-open ante
     * cualquier error.
     */
    public boolean isWithinWindow(String iso2) {
        if (!props.isEnabled()) return true;
        try {
            ZoneId zone = ZoneId.of(zoneForCountry(iso2));
            LocalTime now = LocalTime.now(zone);
            LocalTime open = LocalTime.parse(props.getOpen());
            LocalTime close = LocalTime.parse(props.getClose());
            return withinRange(now, open, close);
        } catch (Exception ex) {
            log.warn("[MODEL-WINDOW] fail-open por error evaluando ventana country={} err={}", iso2, ex.getMessage());
            return true;
        }
    }

    /**
     * Comparación pura de hora-del-día con manejo del cruce de medianoche:
     * si {@code open > close} (p.ej. 18:00-02:00), se está dentro cuando
     * {@code now >= open} O {@code now < close}.
     */
    static boolean withinRange(LocalTime now, LocalTime open, LocalTime close) {
        if (open.equals(close)) return true; // franja de 24h
        if (open.isBefore(close)) {
            return !now.isBefore(open) && now.isBefore(close);
        }
        return !now.isBefore(open) || now.isBefore(close);
    }

    /** Info de la ventana para exponer al frontend (que la convierte a hora local). */
    public WindowInfo windowInfo(String iso2) {
        return new WindowInfo(props.isEnabled(), zoneForCountry(iso2), props.getOpen(), props.getClose());
    }

    public static final class WindowInfo {
        public final boolean enabled;
        public final String zone;
        public final String open;
        public final String close;

        public WindowInfo(boolean enabled, String zone, String open, String close) {
            this.enabled = enabled;
            this.zone = zone;
            this.open = open;
            this.close = close;
        }
    }
}
