package com.sharemechat.service;

import com.sharemechat.config.ModelWindowProperties;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fase C: tests puros de la lógica de ventana horaria (sin reloj real salvo el
 * caso kill-switch y 24h, que son deterministas).
 */
class ModelWindowServiceTest {

    private ModelWindowService svc(boolean enabled, String open, String close, List<String> america) {
        ModelWindowProperties p = new ModelWindowProperties();
        p.setEnabled(enabled);
        p.setOpen(open);
        p.setClose(close);
        p.setZoneEurope("Europe/Madrid");
        p.setZoneAmerica("America/New_York");
        p.setAmericaCountries(america);
        return new ModelWindowService(p);
    }

    // --- withinRange (núcleo, con cruce de medianoche) ---

    @Test
    void within_range_ventana_normal_diurna() {
        LocalTime open = LocalTime.of(9, 0), close = LocalTime.of(17, 0);
        assertThat(ModelWindowService.withinRange(LocalTime.of(12, 0), open, close)).isTrue();
        assertThat(ModelWindowService.withinRange(LocalTime.of(9, 0), open, close)).isTrue();   // borde inicio incluido
        assertThat(ModelWindowService.withinRange(LocalTime.of(17, 0), open, close)).isFalse(); // borde fin excluido
        assertThat(ModelWindowService.withinRange(LocalTime.of(8, 59), open, close)).isFalse();
        assertThat(ModelWindowService.withinRange(LocalTime.of(23, 0), open, close)).isFalse();
    }

    @Test
    void within_range_ventana_cruza_medianoche_18_a_02() {
        LocalTime open = LocalTime.of(18, 0), close = LocalTime.of(2, 0);
        assertThat(ModelWindowService.withinRange(LocalTime.of(20, 0), open, close)).isTrue();  // noche
        assertThat(ModelWindowService.withinRange(LocalTime.of(1, 0), open, close)).isTrue();   // madrugada
        assertThat(ModelWindowService.withinRange(LocalTime.of(18, 0), open, close)).isTrue();  // borde inicio
        assertThat(ModelWindowService.withinRange(LocalTime.of(2, 0), open, close)).isFalse();  // borde fin excluido
        assertThat(ModelWindowService.withinRange(LocalTime.of(12, 0), open, close)).isFalse(); // mediodía fuera
        assertThat(ModelWindowService.withinRange(LocalTime.of(3, 0), open, close)).isFalse();
    }

    @Test
    void within_range_open_igual_close_es_24h() {
        LocalTime t = LocalTime.of(0, 0);
        assertThat(ModelWindowService.withinRange(LocalTime.of(4, 0), t, t)).isTrue();
        assertThat(ModelWindowService.withinRange(LocalTime.of(23, 59), t, t)).isTrue();
    }

    // --- kill-switch ---

    @Test
    void gate_apagado_siempre_dentro() {
        ModelWindowService s = svc(false, "18:00", "02:00", List.of("US"));
        assertThat(s.isEnabled()).isFalse();
        assertThat(s.isWithinWindow("US")).isTrue();
        assertThat(s.isWithinWindow("ES")).isTrue();
        assertThat(s.isWithinWindow(null)).isTrue();
    }

    // --- clasificación de bloque por país ---

    @Test
    void zona_por_pais_america_vs_europa() {
        ModelWindowService s = svc(true, "18:00", "02:00", List.of("US", "MX", "BR", "CO"));
        assertThat(s.zoneForCountry("US")).isEqualTo("America/New_York");
        assertThat(s.zoneForCountry("mx")).isEqualTo("America/New_York"); // case-insensitive
        assertThat(s.zoneForCountry("BR")).isEqualTo("America/New_York");
        assertThat(s.zoneForCountry("ES")).isEqualTo("Europe/Madrid");
        assertThat(s.zoneForCountry("FR")).isEqualTo("Europe/Madrid");
        assertThat(s.zoneForCountry(null)).isEqualTo("Europe/Madrid"); // desconocido -> Europa
    }

    @Test
    void window_info_expone_franja_del_bloque() {
        ModelWindowService s = svc(true, "18:00", "02:00", List.of("US"));
        ModelWindowService.WindowInfo us = s.windowInfo("US");
        assertThat(us.enabled).isTrue();
        assertThat(us.zone).isEqualTo("America/New_York");
        assertThat(us.open).isEqualTo("18:00");
        assertThat(us.close).isEqualTo("02:00");
        assertThat(s.windowInfo("ES").zone).isEqualTo("Europe/Madrid");
    }

    @Test
    void config_invalida_fail_open() {
        // hora mal formada -> isWithinWindow no debe romper, devuelve true (fail-open).
        ModelWindowService s = svc(true, "no-es-hora", "02:00", List.of("US"));
        assertThat(s.isWithinWindow("US")).isTrue();
    }
}
