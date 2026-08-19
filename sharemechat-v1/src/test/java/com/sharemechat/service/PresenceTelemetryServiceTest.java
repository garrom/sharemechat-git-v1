package com.sharemechat.service;

import com.sharemechat.config.PresenceTelemetryProperties;
import com.sharemechat.dto.ModelPublicProfileDTO.AvailabilityBucket;
import com.sharemechat.dto.PresenceHeatmapDTO;
import com.sharemechat.entity.ModelPresenceSample;
import com.sharemechat.repository.ModelPresenceSampleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Card 1 Fase 2: agregacion de presencia. Verifica el bucketing por
 * (dia de la semana, hora) sobre timestamps ya en hora local Europe/Madrid
 * y la normalizacion de intensidad 0-100, con muestras sinteticas y sin BD.
 */
class PresenceTelemetryServiceTest {

    private ModelPresenceSampleRepository repository;
    private PresenceTelemetryProperties props;
    private PresenceTelemetryService service;

    @BeforeEach
    void setUp() {
        repository = mock(ModelPresenceSampleRepository.class);
        props = new PresenceTelemetryProperties();
        props.setZone("Europe/Madrid");
        props.setAggregationWeeks(8);
        props.setRetentionDays(90);
        service = new PresenceTelemetryService(repository, props);
    }

    private static ModelPresenceSample sampleAt(LocalDateTime t) {
        return new ModelPresenceSample(1L, "AVAILABLE", t);
    }

    // 2026-08-17 es lunes; 2026-08-18 es martes.
    private static final LocalDateTime MON_22 = LocalDateTime.of(2026, 8, 17, 22, 0);
    private static final LocalDateTime MON_21 = LocalDateTime.of(2026, 8, 17, 21, 0);
    private static final LocalDateTime TUE_20 = LocalDateTime.of(2026, 8, 18, 20, 0);

    @Test
    void countByDayHour_agrupaPorDiaYHora() {
        List<ModelPresenceSample> samples = List.of(
                sampleAt(MON_22), sampleAt(MON_22), sampleAt(MON_22),
                sampleAt(MON_21),
                sampleAt(TUE_20));

        Map<PresenceTelemetryService.DayHour, Integer> counts =
                PresenceTelemetryService.countByDayHour(samples);

        assertEquals(3, counts.get(new PresenceTelemetryService.DayHour(1, 22)));
        assertEquals(1, counts.get(new PresenceTelemetryService.DayHour(1, 21)));
        assertEquals(1, counts.get(new PresenceTelemetryService.DayHour(2, 20)));
    }

    @Test
    void countByDayHour_toleraNullYVacio() {
        assertTrue(PresenceTelemetryService.countByDayHour(null).isEmpty());
        assertTrue(PresenceTelemetryService.countByDayHour(List.of()).isEmpty());
    }

    @Test
    void intensity_normalizaAlMaximo() {
        assertEquals(100, PresenceTelemetryService.intensity(3, 3));
        assertEquals(33, PresenceTelemetryService.intensity(1, 3));
        assertEquals(1, PresenceTelemetryService.intensity(1, 1000)); // nunca 0 con muestras
        assertEquals(0, PresenceTelemetryService.intensity(0, 5));
        assertEquals(0, PresenceTelemetryService.intensity(5, 0));
    }

    @Test
    void availabilityForModel_devuelveBucketsNormalizadosYOrdenados() {
        when(repository.findByModelUserIdAndSampledAtGreaterThanEqual(eq(1L), any()))
                .thenReturn(List.of(
                        sampleAt(MON_22), sampleAt(MON_22), sampleAt(MON_22),
                        sampleAt(MON_21),
                        sampleAt(TUE_20)));

        List<AvailabilityBucket> buckets = service.availabilityForModel(1L);

        assertEquals(3, buckets.size());
        // Orden: (lun 21), (lun 22), (mar 20)
        assertEquals(1, buckets.get(0).dayOfWeek());
        assertEquals(21, buckets.get(0).hour());
        assertEquals(33, buckets.get(0).intensity());
        assertEquals(1, buckets.get(1).dayOfWeek());
        assertEquals(22, buckets.get(1).hour());
        assertEquals(100, buckets.get(1).intensity());
        assertEquals(2, buckets.get(2).dayOfWeek());
        assertEquals(20, buckets.get(2).hour());
    }

    @Test
    void availabilityForModel_vacioSiNoHayMuestras() {
        when(repository.findByModelUserIdAndSampledAtGreaterThanEqual(eq(1L), any()))
                .thenReturn(List.of());
        assertTrue(service.availabilityForModel(1L).isEmpty());
    }

    @Test
    void platformHeatmap_incluyeConteosEIntensidad() {
        when(repository.findBySampledAtGreaterThanEqual(any()))
                .thenReturn(List.of(sampleAt(MON_22), sampleAt(MON_22), sampleAt(TUE_20)));

        PresenceHeatmapDTO dto = service.platformHeatmap();

        assertEquals("PLATFORM", dto.scope());
        assertEquals(2, dto.buckets().size());
        PresenceHeatmapDTO.HeatBucket mon = dto.buckets().get(0);
        assertEquals(1, mon.dayOfWeek());
        assertEquals(22, mon.hour());
        assertEquals(2, mon.onlineCount());
        assertEquals(100, mon.intensity());
    }
}
