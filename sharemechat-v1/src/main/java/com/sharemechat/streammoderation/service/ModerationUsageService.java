package com.sharemechat.streammoderation.service;

import com.sharemechat.streammoderation.config.ModerationUsagePlanProperties;
import com.sharemechat.streammoderation.dto.ModerationUsageDTO;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Servicio de agregacion de consumo Sightengine contra el cupo del
 * plan comercial (ADR-037 Fase 5 Bloque 5, Paso 2).
 *
 * <p>Lee {@code operations_consumed} de {@code stream_moderation_sessions}
 * agregado por ventanas (mes calendario en curso, dia natural en curso)
 * y contrasta con el cupo declarado en
 * {@link ModerationUsagePlanProperties}. Los umbrales de alerta se
 * incluyen en el DTO para consumo del frontend (paint por color) y del
 * job de aviso (Paso 3).
 *
 * <p>Ventana de tiempo: usa hora del servidor (Europe/Madrid por
 * configuracion de zona por defecto en TEST/PROD). El cupo diario de
 * Sightengine se contabiliza por dia natural UTC en el dashboard del
 * vendor; hay hasta 2 horas de desalineamiento respecto a la hora local
 * en TEST/PROD. Aceptable en fase Free/Starter: el widget informa;
 * cuando el aviso operativo dispare por umbral bajo, el operador
 * verifica en el dashboard Sightengine el consumo real.
 */
@Service
public class ModerationUsageService {

    private final StreamModerationSessionRepository sessionRepository;
    private final ModerationUsagePlanProperties planProperties;

    public ModerationUsageService(StreamModerationSessionRepository sessionRepository,
                                  ModerationUsagePlanProperties planProperties) {
        this.sessionRepository = sessionRepository;
        this.planProperties = planProperties;
    }

    @Transactional(readOnly = true)
    public ModerationUsageDTO snapshot() {
        LocalDate today = LocalDate.now();
        LocalDateTime monthStart = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime dayStart = today.atStartOfDay();

        long monthOps = sessionRepository.sumOperationsConsumedSince(monthStart);
        long dayOps = sessionRepository.sumOperationsConsumedSince(dayStart);

        double monthPct = pct(monthOps, planProperties.getMonthlyQuota());
        double dayPct = pct(dayOps, planProperties.getDailyQuota());

        return new ModerationUsageDTO(
                new ModerationUsageDTO.Plan(
                        planProperties.getName(),
                        planProperties.getMonthlyQuota(),
                        planProperties.getDailyQuota()
                ),
                new ModerationUsageDTO.Usage(
                        monthOps, monthPct,
                        dayOps, dayPct,
                        monthStart, dayStart
                ),
                new ModerationUsageDTO.Thresholds(
                        planProperties.getMonthWarnPct(),
                        planProperties.getMonthAlertPct(),
                        planProperties.getMonthCriticalPct(),
                        planProperties.getDayWarnPct()
                )
        );
    }

    private static double pct(long consumed, long quota) {
        if (quota <= 0) return 0.0;
        double raw = (consumed * 100.0) / quota;
        return Math.round(raw * 10.0) / 10.0;
    }
}
