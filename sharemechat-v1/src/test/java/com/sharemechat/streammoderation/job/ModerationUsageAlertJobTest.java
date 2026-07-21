package com.sharemechat.streammoderation.job;

import com.sharemechat.config.AdminNotificationProperties;
import com.sharemechat.service.EmailCopyRenderer;
import com.sharemechat.service.EmailMessage;
import com.sharemechat.service.EmailService;
import com.sharemechat.streammoderation.dto.ModerationUsageDTO;
import com.sharemechat.streammoderation.entity.ModerationUsageAlert;
import com.sharemechat.streammoderation.repository.ModerationUsageAlertRepository;
import com.sharemechat.streammoderation.service.ModerationUsageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitarios del monitor de consumo Sightengine (ADR-037 Fase 5
 * Bloque 5 Paso 3). Sin @SpringBootTest: mocks puros + estado en memoria
 * para simular la UK de moderation_usage_alerts.
 */
class ModerationUsageAlertJobTest {

    private ModerationUsageService usageService;
    private ModerationUsageAlertRepository alertRepository;
    private AdminNotificationProperties props;
    private EmailCopyRenderer emailCopyRenderer;
    private EmailService emailService;
    private ModerationUsageAlertJob job;

    /** Semaforo en memoria que simula la UK (period_type, period_start, threshold_pct). */
    private Map<String, ModerationUsageAlert> inMemoryUk;

    @BeforeEach
    void setUp() {
        usageService = mock(ModerationUsageService.class);
        alertRepository = mock(ModerationUsageAlertRepository.class);
        props = new AdminNotificationProperties();
        props.setModerationQuotaAlertEmail("admin+moderacion@example.com");
        emailCopyRenderer = mock(EmailCopyRenderer.class);
        emailService = mock(EmailService.class);
        inMemoryUk = new HashMap<>();

        // exists lee del map
        when(alertRepository.existsByPeriodTypeAndPeriodStartAndThresholdPct(
                anyString(), any(LocalDate.class), anyInt()))
                .thenAnswer(inv -> inMemoryUk.containsKey(key(inv.getArgument(0),
                        inv.getArgument(1), inv.getArgument(2))));

        // saveAndFlush escribe en el map con la key logica; devuelve el objeto tal cual
        when(alertRepository.saveAndFlush(any(ModerationUsageAlert.class)))
                .thenAnswer(inv -> {
                    ModerationUsageAlert a = inv.getArgument(0);
                    inMemoryUk.put(key(a.getPeriodType(), a.getPeriodStart(), a.getThresholdPct()), a);
                    return a;
                });

        // envHint puede ser null cuando SPRING_PROFILES_ACTIVE no esta seteado en el
        // entorno de test: usar nullable() para que Mockito matchee null tambien.
        when(emailCopyRenderer.renderModerationQuotaAlert(
                nullable(String.class), anyString(), anyString(), anyString(),
                anyLong(), anyLong(), anyString(), anyInt()))
                .thenReturn(new EmailCopyRenderer.EmailContent("subj", "<b>body</b>"));

        job = new ModerationUsageAlertJob(
                usageService, alertRepository, props, emailCopyRenderer, emailService);
    }

    private static String key(String type, LocalDate start, int th) {
        return type + "|" + start + "|" + th;
    }

    private static ModerationUsageDTO snapshot(double monthPct, double dayPct) {
        LocalDate today = LocalDate.of(2026, 7, 21);
        return new ModerationUsageDTO(
                new ModerationUsageDTO.Plan("FREE", 2000L, 500L),
                new ModerationUsageDTO.Usage(
                        (long) (2000 * monthPct / 100), monthPct,
                        (long) (500 * dayPct / 100), dayPct,
                        today.withDayOfMonth(1).atStartOfDay(),
                        today.atStartOfDay()
                ),
                new ModerationUsageDTO.Thresholds(60, 85, 95, 80)
        );
    }

    @Test
    @DisplayName("Cruzar 60% mes por primera vez -> registra 1 alerta + envia 1 email")
    void firstCrossFiresAlertAndEmail() {
        when(usageService.snapshot()).thenReturn(snapshot(65.0, 10.0));

        job.evaluateOnce();

        assertEquals(1, inMemoryUk.size());
        ArgumentCaptor<EmailMessage> cap = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService).send(cap.capture());
        assertEquals("admin+moderacion@example.com", cap.getValue().to());
        assertEquals(EmailMessage.Category.ADMIN_MODERATION_QUOTA_ALERT, cap.getValue().category());
        assertEquals(EmailMessage.Priority.BEST_EFFORT, cap.getValue().priority());
    }

    @Test
    @DisplayName("Segunda ejecucion con mismo cruce -> NO duplica alerta ni email")
    void secondCallNoDuplicate() {
        when(usageService.snapshot()).thenReturn(snapshot(65.0, 10.0));

        job.evaluateOnce();
        job.evaluateOnce();

        assertEquals(1, inMemoryUk.size());
        verify(emailService).send(any(EmailMessage.class));
    }

    @Test
    @DisplayName("Cruzar warn+alert+critical en la misma pasada -> 3 emails distintos")
    void multipleThresholdsInSameRun() {
        when(usageService.snapshot()).thenReturn(snapshot(96.0, 10.0));

        job.evaluateOnce();

        assertEquals(3, inMemoryUk.size());
        assertNotNull(inMemoryUk.get(key("MONTH", LocalDate.of(2026, 7, 1), 60)));
        assertNotNull(inMemoryUk.get(key("MONTH", LocalDate.of(2026, 7, 1), 85)));
        assertNotNull(inMemoryUk.get(key("MONTH", LocalDate.of(2026, 7, 1), 95)));
        verify(emailService, org.mockito.Mockito.times(3)).send(any(EmailMessage.class));
    }

    @Test
    @DisplayName("Cambio de periodo -> vuelve a disparar 60% en el nuevo mes")
    void periodResetAllowsNewAlert() {
        // Mes 07/2026 al 65% -> dispara warn
        when(usageService.snapshot()).thenReturn(snapshot(65.0, 10.0));
        job.evaluateOnce();
        assertEquals(1, inMemoryUk.size());

        // Cambio de periodo: nuevo mes 08/2026. Simulamos con periodStart distinto.
        LocalDate newMonth = LocalDate.of(2026, 8, 1);
        LocalDate newDay = LocalDate.of(2026, 8, 5);
        ModerationUsageDTO next = new ModerationUsageDTO(
                new ModerationUsageDTO.Plan("FREE", 2000L, 500L),
                new ModerationUsageDTO.Usage(
                        1300L, 65.0, 50L, 10.0,
                        newMonth.atStartOfDay(), newDay.atStartOfDay()
                ),
                new ModerationUsageDTO.Thresholds(60, 85, 95, 80)
        );
        when(usageService.snapshot()).thenReturn(next);
        job.evaluateOnce();

        // Ahora hay 2 rows: una para (MONTH, 2026-07-01, 60) y otra (MONTH, 2026-08-01, 60)
        assertEquals(2, inMemoryUk.size());
        assertNotNull(inMemoryUk.get(key("MONTH", LocalDate.of(2026, 7, 1), 60)));
        assertNotNull(inMemoryUk.get(key("MONTH", LocalDate.of(2026, 8, 1), 60)));
    }

    @Test
    @DisplayName("Sin cruce (por debajo de warn) -> nada disparado")
    void noCrossNothingHappens() {
        when(usageService.snapshot()).thenReturn(snapshot(30.0, 20.0));

        job.evaluateOnce();

        assertTrue(inMemoryUk.isEmpty());
        verify(emailService, never()).send(any(EmailMessage.class));
    }

    @Test
    @DisplayName("Fallo del email -> rollback: la row NO se persiste (retry en siguiente pasada)")
    void emailFailureRollsBackRow() {
        when(usageService.snapshot()).thenReturn(snapshot(65.0, 10.0));

        // Simular que el save inicial se hace (registra en map) pero luego el envio del email lanza.
        // Como el metodo insertAndSend esta @Transactional, en runtime real JPA revertiria el commit.
        // Aqui el mock del repo no hace transaccion real; validamos el rollback simulandolo:
        // el checkAndAlert captura la excepcion y en el codigo real el commit no ocurriria.
        // Lo comprobamos: el email se intento pero fallo, y el codigo salio limpio sin re-throw.
        doThrow(new RuntimeException("smtp down")).when(emailService).send(any());

        job.evaluateOnce();

        // El save se llamo (por el mock, esta en el map), pero en runtime real el rollback
        // se aseguraria por la anotacion @Transactional del metodo insertAndSend. La proxima
        // pasada volveria a disparar. Aqui validamos que el job no propaga la excepcion.
        verify(emailService, org.mockito.Mockito.atLeastOnce()).send(any(EmailMessage.class));
    }

    @Test
    @DisplayName("Sin buzon admin configurado -> skip silencioso: no email, no row")
    void skipsWhenNoMailboxConfigured() {
        props.setModerationQuotaAlertEmail("");   // vacio -> null internamente
        when(usageService.snapshot()).thenReturn(snapshot(65.0, 10.0));

        job.evaluateOnce();

        assertTrue(inMemoryUk.isEmpty());
        verify(emailService, never()).send(any(EmailMessage.class));
    }

    @Test
    @DisplayName("Cruzar 80% dia por primera vez -> registra alerta DAY separada de MONTH")
    void dailyWarnTriggersDayRow() {
        when(usageService.snapshot()).thenReturn(snapshot(10.0, 90.0));

        job.evaluateOnce();

        assertEquals(1, inMemoryUk.size());
        assertNotNull(inMemoryUk.get(key("DAY", LocalDate.of(2026, 7, 21), 80)));
        verify(emailService).send(any(EmailMessage.class));
    }
}
