package com.sharemechat.jobs;

import com.sharemechat.service.AccountDormancyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job semanal de higiene de cuentas dormidas (2026-07-23). Marca dormant
 * a los usuarios con {@code last_activity_at} anterior a
 * {@code NOW() - dormancyDays} respetando bans/unsubscribes. Los
 * usuarios afectados pueden reactivarse simplemente logeando o via
 * accion admin ({@code POST /api/admin/users/{id}/reactivate}).
 *
 * <p>Cadencia: lunes 03:00 UTC. Suficiente para higiene general.
 *
 * <p>Cap de {@code batchLimit} cuentas por ejecucion: defensa contra un
 * primer barrido masivo post-rollout si hay mucha cola.
 */
@Component
public class AccountDormancyJob {

    private static final Logger log = LoggerFactory.getLogger(AccountDormancyJob.class);

    private static final int BATCH_LIMIT = 500;

    private final AccountDormancyService service;

    public AccountDormancyJob(AccountDormancyService service) {
        this.service = service;
    }

    @Scheduled(cron = "0 0 3 ? * MON", zone = "UTC")
    public void runWeekly() {
        try {
            int marked = service.markDormantBatch(BATCH_LIMIT);
            if (marked > 0) {
                log.info("[DORMANCY-JOB] semanal: marcadas {} cuentas dormant", marked);
            }
        } catch (Exception ex) {
            log.warn("[DORMANCY-JOB] semanal FAIL: {}", ex.getMessage(), ex);
        }
    }
}
