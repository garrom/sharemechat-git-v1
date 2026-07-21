package com.sharemechat.streammoderation.dto;

import java.time.LocalDateTime;

/**
 * Snapshot de consumo del vendor de moderacion visual contra el plan
 * contratado. Payload del endpoint {@code GET /api/admin/moderation/usage}
 * (ADR-037 Bloque 5).
 *
 * <p>Ventanas:
 * <ul>
 *   <li>{@code monthOperations}: suma acumulada desde el primer dia
 *       del mes calendario actual (00:00 hora servidor).</li>
 *   <li>{@code dayOperations}: suma acumulada desde 00:00 hora servidor
 *       del dia actual.</li>
 * </ul>
 * Los porcentajes se calculan con la cuota del plan; 0 si la cuota es 0.
 */
public class ModerationUsageDTO {

    public record Plan(String name, long monthlyQuota, long dailyQuota) {}

    public record Usage(long monthOperations,
                        double monthPct,
                        long dayOperations,
                        double dayPct,
                        LocalDateTime monthStartAt,
                        LocalDateTime dayStartAt) {}

    public record Thresholds(int monthWarnPct,
                             int monthAlertPct,
                             int monthCriticalPct,
                             int dayWarnPct) {}

    private final Plan plan;
    private final Usage usage;
    private final Thresholds thresholds;

    public ModerationUsageDTO(Plan plan, Usage usage, Thresholds thresholds) {
        this.plan = plan;
        this.usage = usage;
        this.thresholds = thresholds;
    }

    public Plan getPlan() { return plan; }
    public Usage getUsage() { return usage; }
    public Thresholds getThresholds() { return thresholds; }
}
