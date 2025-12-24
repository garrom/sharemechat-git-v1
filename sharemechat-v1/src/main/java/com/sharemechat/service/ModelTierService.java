package com.sharemechat.service;

import com.sharemechat.entity.ModelEarningTier;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.repository.ModelEarningTierRepository;
import com.sharemechat.repository.ModelTierDailySnapshotRepository;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.repository.UserTrialStreamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ModelTierService {

    private final ModelEarningTierRepository tierRepository;
    private final StreamRecordRepository streamRecordRepository;
    private final UserTrialStreamRepository userTrialStreamRepository;
    private final ModelTierDailySnapshotRepository snapshotRepository;

    private static final int WINDOW_DAYS = 30;

    private static final String BASE_TIER_NAME = "BASE";
    private static final int BASE_MIN_BILLED_MINUTES = 0;
    private static final java.math.BigDecimal BASE_FIRST = new java.math.BigDecimal("0.0500");
    private static final java.math.BigDecimal BASE_NEXT  = new java.math.BigDecimal("0.1500");

    public ModelTierService(ModelEarningTierRepository tierRepository,
                            StreamRecordRepository streamRecordRepository,
                            UserTrialStreamRepository userTrialStreamRepository,
                            ModelTierDailySnapshotRepository snapshotRepository) {
        this.tierRepository = tierRepository;
        this.streamRecordRepository = streamRecordRepository;
        this.userTrialStreamRepository = userTrialStreamRepository;
        this.snapshotRepository = snapshotRepository;
    }

    /**
     * Tier “efectivo” para PAGO hoy:
     * - usamos snapshot de AYER (opción 2)
     * - si no existe, lo calculamos y persistimos
     */
    @Transactional
    public ModelEarningTier resolveEffectiveTierForPayout(Long modelId) {
        ensureBaseTierExists();

        LocalDate snapshotDate = LocalDate.now().minusDays(1);
        ModelTierDailySnapshot snap = snapshotRepository.findByModelIdAndSnapshotDate(modelId, snapshotDate).orElse(null);
        if (snap == null) {
            snap = computeAndUpsertSnapshot(modelId, snapshotDate);
        }

        // Con el tierName del snapshot buscamos el tier en la lista activa
        List<ModelEarningTier> tiers = tierRepository.findByActiveTrueOrderByMinBilledMinutesAsc();
        if (tiers == null || tiers.isEmpty()) return null;

        String tierName = snap.getTierName();
        if (tierName != null) {
            for (ModelEarningTier t : tiers) {
                if (tierName.equals(t.getName())) return t;
            }
        }

        // Fallback: resolver por billedMinutes si el name no matchea (robustez)
        Integer billedMinutes = snap.getBilledMinutes() != null ? snap.getBilledMinutes() : 0;
        return resolveTierForBilledMinutes(billedMinutes, tiers);
    }

    /**
     * Calcula y guarda el snapshot de un día concreto (por ejemplo AYER).
     * Contiene: billedMinutes (ventana 30d) + tierName + rates (first/next) para auditoría y UI.
     */
    @Transactional
    public ModelTierDailySnapshot computeAndUpsertSnapshot(Long modelId, LocalDate snapshotDate) {
        ensureBaseTierExists();

        // Ventana del snapshot: últimos 30 días “cerrando” al inicio del día siguiente
        LocalDateTime windowEnd = snapshotDate.plusDays(1).atStartOfDay();      // exclusivo
        LocalDateTime windowStart = windowEnd.minusDays(WINDOW_DAYS);           // inclusivo

        long billedSeconds = computeBilledSecondsForModelWindow(modelId, windowStart, windowEnd);
        int billedMinutes = (int) Math.min(Integer.MAX_VALUE, billedSeconds / 60L); // floor

        List<ModelEarningTier> tiers = tierRepository.findByActiveTrueOrderByMinBilledMinutesAsc();
        if (tiers == null || tiers.isEmpty()) return null;

        ModelEarningTier chosen = resolveTierForBilledMinutes(billedMinutes, tiers);
        if (chosen == null) return null;

        ModelTierDailySnapshot snap = snapshotRepository.findByModelIdAndSnapshotDate(modelId, snapshotDate).orElse(null);
        if (snap == null) {
            snap = new ModelTierDailySnapshot();
            snap.setModelId(modelId);
            snap.setSnapshotDate(snapshotDate);
        }

        snap.setWindowStart(windowStart);
        snap.setWindowEnd(windowEnd);
        snap.setBilledSeconds(billedSeconds);
        snap.setBilledMinutes(billedMinutes);

        // NOT NULL en tu tabla
        snap.setTierId(chosen.getId());
        snap.setTierName(chosen.getName());
        snap.setFirstMinuteEarningPerMin(chosen.getFirstMinuteEarningPerMin());
        snap.setNextMinutesEarningPerMin(chosen.getNextMinutesEarningPerMin());

        return snapshotRepository.save(snap);
    }

    private long computeBilledSecondsForModelWindow(Long modelId, LocalDateTime windowStart, LocalDateTime windowEnd) {
        long totalSeconds = 0L;

        // 1) Pagadas (StreamRecord) - el repo trae desde windowStart hacia delante
        List<StreamRecord> records =
                streamRecordRepository.findByModel_IdAndEndTimeIsNotNullAndEndTimeAfter(modelId, windowStart);

        for (StreamRecord r : records) {
            if (r.getStartTime() == null || r.getEndTime() == null) continue;

            // Recortar al rango [windowStart, windowEnd)
            LocalDateTime start = r.getStartTime().isBefore(windowStart) ? windowStart : r.getStartTime();
            LocalDateTime end = r.getEndTime().isAfter(windowEnd) ? windowEnd : r.getEndTime();

            if (!end.isAfter(start)) continue;
            long s = Duration.between(start, end).getSeconds();
            if (s > 0) totalSeconds += s;
        }

        // 2) Trials (UserTrialStream)
        List<com.sharemechat.entity.UserTrialStream> trials =
                userTrialStreamRepository.findByModel_IdAndEndTimeIsNotNullAndEndTimeAfter(modelId, windowStart);

        for (com.sharemechat.entity.UserTrialStream t : trials) {
            if (t.getStartTime() == null || t.getEndTime() == null) continue;

            LocalDateTime start = t.getStartTime().isBefore(windowStart) ? windowStart : t.getStartTime();
            LocalDateTime end = t.getEndTime().isAfter(windowEnd) ? windowEnd : t.getEndTime();

            if (!end.isAfter(start)) continue;
            long s = Duration.between(start, end).getSeconds();
            if (s > 0) totalSeconds += s;
        }

        return Math.max(0L, totalSeconds);
    }


    /**
     * Resolver tier por minutos ya calculados, dado un listado ordenado asc.
     */
    private ModelEarningTier resolveTierForBilledMinutes(int billedMinutes, List<ModelEarningTier> tiersAsc) {
        ModelEarningTier chosen = tiersAsc.get(0);
        for (ModelEarningTier t : tiersAsc) {
            Integer min = t.getMinBilledMinutes();
            if (min != null && min <= billedMinutes) chosen = t;
            else break;
        }
        return chosen;
    }

    /**
     * Ventana móvil de WINDOW_DAYS:
     * - toma como “now” el final del snapshotDate (o sea, snapshotDate 23:59:59 implícito)
     * - suma segundos pagados (stream_records cerrados) + trials cerrados
     * - convierte a minutos (floor)
     */
    private int computeBilledMinutesForModelWindow(Long modelId, LocalDate snapshotDate, int windowDays) {
        LocalDateTime since = snapshotDate.plusDays(1).atStartOfDay().minusDays(windowDays); // inicio ventana
        LocalDateTime until = snapshotDate.plusDays(1).atStartOfDay();                       // fin (exclusivo)

        long totalSeconds = 0L;

        // Pagadas
        List<StreamRecord> records =
                streamRecordRepository.findByModel_IdAndEndTimeIsNotNullAndEndTimeAfter(modelId, since);

        for (StreamRecord r : records) {
            if (r.getStartTime() == null || r.getEndTime() == null) continue;
            // filtrar hasta "until" por si el repo trae más
            LocalDateTime end = r.getEndTime().isAfter(until) ? until : r.getEndTime();
            if (end.isBefore(since)) continue;
            long s = Duration.between(r.getStartTime().isBefore(since) ? since : r.getStartTime(), end).getSeconds();
            if (s > 0) totalSeconds += s;
        }

        // Trials
        List<com.sharemechat.entity.UserTrialStream> trials =
                userTrialStreamRepository.findByModel_IdAndEndTimeIsNotNullAndEndTimeAfter(modelId, since);

        for (com.sharemechat.entity.UserTrialStream t : trials) {
            if (t.getStartTime() == null || t.getEndTime() == null) continue;
            LocalDateTime end = t.getEndTime().isAfter(until) ? until : t.getEndTime();
            if (end.isBefore(since)) continue;
            long s = Duration.between(t.getStartTime().isBefore(since) ? since : t.getStartTime(), end).getSeconds();
            if (s > 0) totalSeconds += s;
        }

        long minutes = totalSeconds / 60L; // floor
        if (minutes > Integer.MAX_VALUE) return Integer.MAX_VALUE;
        return (int) minutes;
    }

    @Transactional
    protected void ensureBaseTierExists() {
        if (tierRepository.existsByMinBilledMinutes(BASE_MIN_BILLED_MINUTES)) return;

        ModelEarningTier base = new ModelEarningTier();
        base.setName(BASE_TIER_NAME);
        base.setMinBilledMinutes(BASE_MIN_BILLED_MINUTES);
        base.setFirstMinuteEarningPerMin(BASE_FIRST);
        base.setNextMinutesEarningPerMin(BASE_NEXT);
        base.setActive(true);

        tierRepository.save(base);
    }
}
