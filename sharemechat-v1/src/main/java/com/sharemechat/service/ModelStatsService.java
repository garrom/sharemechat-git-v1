package com.sharemechat.service;

import com.sharemechat.dto.FinanceDTOs;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.repository.ModelTierDailySnapshotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Servicio del tab Histórico del panel Estadisticas del modelo. Tras la
 * limpieza post-ADR-052 (2026-07-25) sirve unicamente {@code getMyStats}
 * para el listado historico de snapshots. La fuente canonica del
 * dashboard economico vigente es {@link PricingService}
 * ({@code /model/economics}); este servicio ya no cubre el snapshot
 * actual ni el catalogo de tramos (frontend legacy retirado en iter.2).
 */
@Service
public class ModelStatsService {

    private final ModelTierDailySnapshotRepository snapshotRepository;
    private final ModelTierService modelTierService;

    public ModelStatsService(ModelTierDailySnapshotRepository snapshotRepository,
                             ModelTierService modelTierService) {
        this.snapshotRepository = snapshotRepository;
        this.modelTierService = modelTierService;
    }

    @Transactional(readOnly = true)
    public FinanceDTOs.ModelTierStats getMyStats(Long modelId, int historyDays) {
        LocalDate day = LocalDate.now().minusDays(1);
        int limit = Math.max(1, Math.min(historyDays, 120));
        LocalDate fromDay = day.minusDays(limit - 1L);

        modelTierService.ensureSnapshotsInRange(modelId, fromDay, day);

        FinanceDTOs.ModelTierStats out = new FinanceDTOs.ModelTierStats();

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
            // Preferir codigo nuevo (T0/T1/T2/T3) sobre tierName legacy.
            r.tierName = s.getPricingTierCode() != null
                    ? s.getPricingTierCode()
                    : s.getTierName();
            history.add(r);
        }
        out.history = history;

        return out;
    }
}
