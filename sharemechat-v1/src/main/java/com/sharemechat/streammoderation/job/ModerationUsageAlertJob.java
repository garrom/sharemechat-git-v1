package com.sharemechat.streammoderation.job;

import com.sharemechat.config.AdminNotificationProperties;
import com.sharemechat.service.EmailCopyRenderer;
import com.sharemechat.service.EmailMessage;
import com.sharemechat.service.EmailService;
import com.sharemechat.streammoderation.dto.ModerationUsageDTO;
import com.sharemechat.streammoderation.entity.ModerationUsageAlert;
import com.sharemechat.streammoderation.repository.ModerationUsageAlertRepository;
import com.sharemechat.streammoderation.service.ModerationUsageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * ADR-037 Fase 5 Bloque 5 Paso 3: monitor de consumo Sightengine.
 *
 * <p>Cada hora evalua el snapshot de consumo (mes + dia) contra los
 * umbrales configurados y, la primera vez que se cruza un umbral en
 * cada periodo, registra una fila en {@code moderation_usage_alerts}
 * y envia un email al buzon {@code notifications.admin.moderation-quota-alert-email}.
 *
 * <p>Idempotencia: la UK {@code (period_type, period_start, threshold_pct)}
 * de la tabla actua como semaforo. La segunda ejecucion del job dentro
 * del mismo periodo con el mismo umbral cruzado no produce nuevo aviso.
 * Al cambiar de periodo las claves cambian y el mecanismo se resetea
 * sin necesidad de job de limpieza.
 *
 * <p>Atomicidad: la insercion de la row y el envio del email viven en
 * la misma transaccion. Si el envio del email lanza excepcion, la
 * insercion se revierte y el proximo tick del job vuelve a intentarlo.
 * Evita "aviso perdido" silencioso.
 *
 * <p>Comportamiento en TEST/AUDIT: la property del buzon queda vacia
 * por defecto (skip silencioso). El job corre y evalua el snapshot,
 * pero al llegar al envio detecta que no hay buzon configurado y
 * omite la insercion (nada que revertir).
 */
@Component
public class ModerationUsageAlertJob {

    private static final Logger log = LoggerFactory.getLogger(ModerationUsageAlertJob.class);

    private static final String PERIOD_MONTH = "MONTH";
    private static final String PERIOD_DAY = "DAY";
    private static final String PERIOD_MONTH_ES = "MES";
    private static final String PERIOD_DAY_ES = "DIA";

    private final ModerationUsageService usageService;
    private final ModerationUsageAlertRepository alertRepository;
    private final AdminNotificationProperties adminNotificationProperties;
    private final EmailCopyRenderer emailCopyRenderer;
    private final EmailService emailService;

    public ModerationUsageAlertJob(ModerationUsageService usageService,
                                   ModerationUsageAlertRepository alertRepository,
                                   AdminNotificationProperties adminNotificationProperties,
                                   EmailCopyRenderer emailCopyRenderer,
                                   EmailService emailService) {
        this.usageService = usageService;
        this.alertRepository = alertRepository;
        this.adminNotificationProperties = adminNotificationProperties;
        this.emailCopyRenderer = emailCopyRenderer;
        this.emailService = emailService;
    }

    /**
     * Cadencia 1 hora. Retraso inicial 60s para dejar arrancar el
     * contexto tras un restart antes de meter carga adicional.
     */
    @Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT60S")
    public void evaluate() {
        try {
            evaluateOnce();
        } catch (Exception ex) {
            log.warn("[STREAM-MOD-ALERT] evaluate FAIL: {}", ex.getMessage(), ex);
        }
    }

    // Package-private para invocacion directa desde tests.
    void evaluateOnce() {
        ModerationUsageDTO snapshot = usageService.snapshot();
        if (snapshot == null || snapshot.getPlan() == null || snapshot.getUsage() == null) {
            return;
        }

        LocalDate monthStart = snapshot.getUsage().monthStartAt().toLocalDate();
        LocalDate dayStart = snapshot.getUsage().dayStartAt().toLocalDate();

        // Umbrales de mes: warn / alert / critical. Solo se dispara si > 0.
        checkAndAlert(PERIOD_MONTH, PERIOD_MONTH_ES, monthStart,
                snapshot.getThresholds().monthWarnPct(),
                snapshot.getUsage().monthPct(),
                snapshot.getPlan().monthlyQuota(),
                snapshot.getUsage().monthOperations(),
                snapshot.getPlan().name());

        checkAndAlert(PERIOD_MONTH, PERIOD_MONTH_ES, monthStart,
                snapshot.getThresholds().monthAlertPct(),
                snapshot.getUsage().monthPct(),
                snapshot.getPlan().monthlyQuota(),
                snapshot.getUsage().monthOperations(),
                snapshot.getPlan().name());

        checkAndAlert(PERIOD_MONTH, PERIOD_MONTH_ES, monthStart,
                snapshot.getThresholds().monthCriticalPct(),
                snapshot.getUsage().monthPct(),
                snapshot.getPlan().monthlyQuota(),
                snapshot.getUsage().monthOperations(),
                snapshot.getPlan().name());

        // Umbral unico dia: warn.
        checkAndAlert(PERIOD_DAY, PERIOD_DAY_ES, dayStart,
                snapshot.getThresholds().dayWarnPct(),
                snapshot.getUsage().dayPct(),
                snapshot.getPlan().dailyQuota(),
                snapshot.getUsage().dayOperations(),
                snapshot.getPlan().name());
    }

    private void checkAndAlert(String periodType,
                               String periodTypeEs,
                               LocalDate periodStart,
                               int thresholdPct,
                               double currentPct,
                               long quota,
                               long operations,
                               String planName) {
        if (thresholdPct <= 0) return;               // umbral desactivado
        if (currentPct < thresholdPct) return;       // no cruzado
        if (alertRepository.existsByPeriodTypeAndPeriodStartAndThresholdPct(
                periodType, periodStart, thresholdPct)) {
            return;                                   // ya avisado en este periodo
        }
        try {
            insertAndSend(periodType, periodTypeEs, periodStart, thresholdPct,
                    currentPct, quota, operations, planName);
        } catch (DataIntegrityViolationException dup) {
            // Otra ejecucion concurrente insertó primero: correcto, ya se aviso.
            log.info("[STREAM-MOD-ALERT] dup skip periodType={} periodStart={} thresholdPct={}",
                    periodType, periodStart, thresholdPct);
        } catch (Exception ex) {
            // Rollback automatico de la insercion por @Transactional. La proxima
            // pasada del job volvera a intentarlo si el umbral sigue cruzado.
            log.warn("[STREAM-MOD-ALERT] send FAIL periodType={} periodStart={} thresholdPct={} err={}",
                    periodType, periodStart, thresholdPct, ex.getMessage(), ex);
        }
    }

    /**
     * Insercion + envio de email en la misma transaccion. Si el envio
     * lanza, JPA revierte la insercion.
     */
    @Transactional
    void insertAndSend(String periodType,
                       String periodTypeEs,
                       LocalDate periodStart,
                       int thresholdPct,
                       double currentPct,
                       long quota,
                       long operations,
                       String planName) {
        String to = adminNotificationProperties.getModerationQuotaAlertEmail();
        if (to == null || to.isBlank()) {
            // Skip silencioso en entornos sin buzon configurado (TEST/AUDIT).
            // No se inserta row: si en el futuro el operador rellena la
            // property, el aviso podra dispararse desde el proximo tick.
            log.info("[STREAM-MOD-ALERT] skip (no admin mailbox) periodType={} thresholdPct={}",
                    periodType, thresholdPct);
            return;
        }

        BigDecimal pctBd = BigDecimal.valueOf(currentPct).setScale(1, RoundingMode.HALF_UP);

        ModerationUsageAlert alert = new ModerationUsageAlert();
        alert.setPeriodType(periodType);
        alert.setPeriodStart(periodStart);
        alert.setThresholdPct(thresholdPct);
        alert.setPlanName(planName);
        alert.setQuotaAtAlert(quota);
        alert.setOperationsAtAlert(operations);
        alert.setPctAtAlert(pctBd);
        alert.setEmailTo(to);
        alertRepository.saveAndFlush(alert);

        String envHint = System.getenv("SPRING_PROFILES_ACTIVE");
        EmailCopyRenderer.EmailContent content = emailCopyRenderer.renderModerationQuotaAlert(
                envHint, periodTypeEs, periodStart.toString(),
                planName, quota, operations, pctBd.toPlainString(), thresholdPct);

        emailService.send(new EmailMessage(
                to, content.subject(), content.body(),
                EmailMessage.Category.ADMIN_MODERATION_QUOTA_ALERT,
                EmailMessage.Priority.BEST_EFFORT
        ));

        alert.setEmailSent(true);
        alert.setEmailSentAt(LocalDateTime.now());
        alertRepository.saveAndFlush(alert);

        log.info("[STREAM-MOD-ALERT] sent periodType={} periodStart={} thresholdPct={} pct={} operations={} to={}",
                periodType, periodStart, thresholdPct, pctBd, operations, to);
    }

    // Reservado para posibles evoluciones (auditoria bulk, admin endpoints).
    List<ModerationUsageAlert> allAlerts() {
        return alertRepository.findAll();
    }
}
