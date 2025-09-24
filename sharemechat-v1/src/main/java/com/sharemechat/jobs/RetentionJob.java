package com.sharemechat.jobs;

import com.sharemechat.repository.ConsentEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
public class RetentionJob {

    private static final Logger log = LoggerFactory.getLogger(RetentionJob.class);

    private final ConsentEventRepository repository;

    @Value("${consent.retentionDays:180}")
    private int retentionDays;

    public RetentionJob(ConsentEventRepository repository) {
        this.repository = repository;
    }

    /**
     * Purga diaria de eventos antiguos (retención configurable).
     * Nota: requiere @EnableScheduling en tu aplicación.
     */
    @Transactional
    @Scheduled(cron = "0 30 3 * * *") // 03:30 todos los días
    public void purgeOldEvents() {
        Instant threshold = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        long deleted = repository.deleteByTsBefore(threshold);
        if (deleted > 0) {
            log.info("Consent retention purge: deleted {} rows older than {} days", deleted, retentionDays);
        }
    }
}
