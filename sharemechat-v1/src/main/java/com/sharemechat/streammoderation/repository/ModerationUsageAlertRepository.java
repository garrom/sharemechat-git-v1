package com.sharemechat.streammoderation.repository;

import com.sharemechat.streammoderation.entity.ModerationUsageAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface ModerationUsageAlertRepository
        extends JpaRepository<ModerationUsageAlert, Long> {

    /**
     * Idempotencia del job de alerta: si ya se ha registrado un aviso
     * para esta combinacion (periodo, umbral), el job no vuelve a
     * intentar el envio.
     */
    boolean existsByPeriodTypeAndPeriodStartAndThresholdPct(
            String periodType, LocalDate periodStart, int thresholdPct);
}
