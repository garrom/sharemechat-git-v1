package com.sharemechat.service;

import com.sharemechat.dto.FinanceDTOs;
import com.sharemechat.entity.ModelEarningTier;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.repository.ModelEarningTierRepository;
import com.sharemechat.repository.ModelTierDailySnapshotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class ModelStatsService {

    private final ModelTierDailySnapshotRepository snapshotRepository;
    private final ModelEarningTierRepository tierRepository;

    public ModelStatsService(ModelTierDailySnapshotRepository snapshotRepository,
                             ModelEarningTierRepository tierRepository) {
        this.snapshotRepository = snapshotRepository;
        this.tierRepository = tierRepository;
    }

    @Transactional(readOnly = true)
    public FinanceDTOs.ModelTierSnapshotSummary getMySummary(Long modelId) {
        LocalDate day = LocalDate.now().minusDays(1); // AYER
        ModelTierDailySnapshot snap = snapshotRepository.findByModelIdAndSnapshotDate(modelId, day).orElse(null);

        // Si no hay snapshot (job aún no lo ha creado), devolvemos resumen vacío pero válido
        if (snap == null) {
            return emptySummary(day);
        }

        return toSummary(snap);
    }

    @Transactional(readOnly = true)
    public FinanceDTOs.ModelTierStats getMyStats(Long modelId, int historyDays) {
        LocalDate day = LocalDate.now().minusDays(1);

        ModelTierDailySnapshot snap = snapshotRepository.findByModelIdAndSnapshotDate(modelId, day).orElse(null);

        FinanceDTOs.ModelTierStats out = new FinanceDTOs.ModelTierStats();
        out.current = (snap != null) ? toSummary(snap) : emptySummary(day);

        int limit = Math.max(1, Math.min(historyDays, 120));
        org.springframework.data.domain.Page<ModelTierDailySnapshot> page =
                snapshotRepository.findByModelIdOrderBySnapshotDateDesc(
                        modelId,
                        org.springframework.data.domain.PageRequest.of(0, limit)
                );

        List<FinanceDTOs.ModelTierHistoryRow> history = new ArrayList<>();
        for (ModelTierDailySnapshot s : page.getContent()) {
            FinanceDTOs.ModelTierHistoryRow r = new FinanceDTOs.ModelTierHistoryRow();
            r.snapshotDate = s.getSnapshotDate() != null ? s.getSnapshotDate().toString() : null;
            r.billedMinutes30d = s.getBilledMinutes();
            r.tierName = s.getTierName();
            history.add(r);
        }
        out.history = history;

        List<ModelEarningTier> tiers = tierRepository.findByActiveTrueOrderByMinBilledMinutesAsc();
        List<FinanceDTOs.TierRow> tierRows = new ArrayList<>();
        for (ModelEarningTier t : tiers) {
            FinanceDTOs.TierRow tr = new FinanceDTOs.TierRow();
            tr.tierId = t.getId();
            tr.name = t.getName();
            tr.minBilledMinutes = t.getMinBilledMinutes();
            tr.firstMinuteEURPerMin = fmt4(t.getFirstMinuteEarningPerMin());
            tr.nextMinutesEURPerMin = fmt4(t.getNextMinutesEarningPerMin());
            tr.active = t.getActive();
            tierRows.add(tr);
        }
        out.tiers = tierRows;

        return out;
    }

    private FinanceDTOs.ModelTierSnapshotSummary emptySummary(LocalDate day) {
        FinanceDTOs.ModelTierSnapshotSummary dto = new FinanceDTOs.ModelTierSnapshotSummary();
        dto.snapshotDate = day != null ? day.toString() : null;
        dto.billedMinutes30d = 0;
        dto.billedHours30d = "0.00";
        dto.tierName = "—";
        dto.firstMinuteEURPerMin = "0.0000";
        dto.nextMinutesEURPerMin = "0.0000";
        return dto;
    }

    private FinanceDTOs.ModelTierSnapshotSummary toSummary(ModelTierDailySnapshot s) {
        FinanceDTOs.ModelTierSnapshotSummary dto = new FinanceDTOs.ModelTierSnapshotSummary();
        dto.snapshotDate = s.getSnapshotDate() != null ? s.getSnapshotDate().toString() : null;
        dto.billedMinutes30d = s.getBilledMinutes() != null ? s.getBilledMinutes() : 0;

        BigDecimal hours = BigDecimal.valueOf(dto.billedMinutes30d)
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);

        dto.billedHours30d = hours.toPlainString();
        dto.tierName = s.getTierName();
        dto.firstMinuteEURPerMin = fmt4(s.getFirstMinuteEarningPerMin());
        dto.nextMinutesEURPerMin = fmt4(s.getNextMinutesEarningPerMin());
        return dto;
    }

    private String fmt4(BigDecimal v) {
        if (v == null) return "0.0000";
        return v.setScale(4, RoundingMode.HALF_UP).toPlainString();
    }
}
