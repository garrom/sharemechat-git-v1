package com.sharemechat.service;

import com.sharemechat.dto.FinanceDTOs;
import com.sharemechat.entity.ModelPricingTier;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelPricingTierRepository;
import com.sharemechat.repository.ModelTierDailySnapshotRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Servicio de estadisticas del snapshot economico del modelo (endpoint
 * legacy del dashboard modelo). Tras ADR-052 (V39), el panel canonico
 * pasa a ser {@code /model/economics} con {@code PricingService}; este
 * servicio se mantiene por compat con el frontend legacy que consume
 * los endpoints {@code /api/models/me/stats*} hasta que el sub-frente
 * 3.C sustituya la UI.
 *
 * <p>El DTO {@link FinanceDTOs} se conserva sin cambios de firma para no
 * romper el frontend, pero los campos se rellenan desde las columnas
 * NUEVAS del snapshot (V39): {@code pricingTierCode}, {@code modelSharePct},
 * {@code rateMinEurPerMin}, {@code rateMaxEurPerMin}. Los campos
 * legacy del snapshot ({@code tierName}, {@code firstMinuteEarningPerMin},
 * {@code nextMinutesEarningPerMin}) quedan NULL para snapshots nuevos.
 */
@Service
public class ModelStatsService {

    private final ModelTierDailySnapshotRepository snapshotRepository;
    private final ModelPricingTierRepository pricingTierRepository;
    private final UserRepository userRepository;
    private final ModelTierService modelTierService;

    public ModelStatsService(ModelTierDailySnapshotRepository snapshotRepository,
                             ModelPricingTierRepository pricingTierRepository,
                             UserRepository userRepository,
                             ModelTierService modelTierService) {
        this.snapshotRepository = snapshotRepository;
        this.pricingTierRepository = pricingTierRepository;
        this.userRepository = userRepository;
        this.modelTierService = modelTierService;
    }

    @Transactional(readOnly = true)
    public FinanceDTOs.ModelTierSnapshotSummary getMySummary(Long modelId) {
        LocalDate day = LocalDate.now().minusDays(1); // AYER
        modelTierService.ensureSnapshotExists(modelId, day);
        ModelTierDailySnapshot snap = snapshotRepository.findByModelIdAndSnapshotDate(modelId, day).orElse(null);

        if (snap == null) {
            return emptySummary(day);
        }

        return toSummary(snap, modelId);
    }

    @Transactional(readOnly = true)
    public FinanceDTOs.ModelTierStats getMyStats(Long modelId, int historyDays) {
        LocalDate day = LocalDate.now().minusDays(1);
        int limit = Math.max(1, Math.min(historyDays, 120));
        LocalDate fromDay = day.minusDays(limit - 1L);

        modelTierService.ensureSnapshotsInRange(modelId, fromDay, day);

        ModelTierDailySnapshot snap = snapshotRepository.findByModelIdAndSnapshotDate(modelId, day).orElse(null);

        FinanceDTOs.ModelTierStats out = new FinanceDTOs.ModelTierStats();
        out.current = (snap != null) ? toSummary(snap, modelId) : emptySummary(day);

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

        List<ModelPricingTier> tiers = pricingTierRepository.findAllCurrentAsc();
        List<FinanceDTOs.TierRow> tierRows = new ArrayList<>();
        for (ModelPricingTier t : tiers) {
            FinanceDTOs.TierRow tr = new FinanceDTOs.TierRow();
            tr.tierId = t.getId();
            tr.name = t.getTierCode();
            // Mapping legacy -> nuevo: minBilledMinutes no aplica al nuevo
            // regimen (que usa facturacion bruta, no minutos). El frontend
            // legacy espera un int; lo reutilizamos para exponer el umbral
            // en centesimas de EUR (mult *100 sobre BigDecimal) para no
            // perder informacion sin cambiar la firma del DTO.
            tr.minBilledMinutes = t.getMinBilledGrossEur30d()
                    .movePointRight(2)
                    .setScale(0, RoundingMode.HALF_UP)
                    .intValueExact();
            tr.firstMinuteEURPerMin = t.getRateMinEurPerMin()
                    .setScale(4, RoundingMode.HALF_UP)
                    .toPlainString();
            tr.nextMinutesEURPerMin = t.getRateMaxEurPerMin()
                    .setScale(4, RoundingMode.HALF_UP)
                    .toPlainString();
            tr.active = Boolean.TRUE;
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

    private FinanceDTOs.ModelTierSnapshotSummary toSummary(ModelTierDailySnapshot s, Long modelId) {
        FinanceDTOs.ModelTierSnapshotSummary dto = new FinanceDTOs.ModelTierSnapshotSummary();
        dto.snapshotDate = s.getSnapshotDate() != null ? s.getSnapshotDate().toString() : null;
        dto.billedMinutes30d = s.getBilledMinutes() != null ? s.getBilledMinutes() : 0;

        BigDecimal hours = BigDecimal.valueOf(dto.billedMinutes30d)
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);

        dto.billedHours30d = hours.toPlainString();

        // Preferir columnas nuevas (V39) sobre legacy. Si el snapshot es
        // pre-V39 y solo tiene tierName / firstMinute / nextMinutes,
        // caemos al valor legacy sin crash.
        if (s.getPricingTierCode() != null) {
            dto.tierName = s.getPricingTierCode();
        } else {
            dto.tierName = s.getTierName() != null ? s.getTierName() : "—";
        }

        // Rate min/max del tramo vigente. Los snapshots pre-V39 solo tienen
        // first/next legacy: los mostramos como fallback.
        BigDecimal rateMin = s.getRateMinEurPerMin();
        BigDecimal rateMax = s.getRateMaxEurPerMin();
        if (rateMin != null) {
            dto.firstMinuteEURPerMin = fmt4(rateMin);
        } else {
            dto.firstMinuteEURPerMin = fmt4(s.getFirstMinuteEarningPerMin());
        }
        if (rateMax != null) {
            dto.nextMinutesEURPerMin = fmt4(rateMax);
        } else {
            dto.nextMinutesEURPerMin = fmt4(s.getNextMinutesEarningPerMin());
        }

        // Si tenemos rango + reparto, calcular el earning efectivo por minuto
        // basado en la tarifa ELEGIDA por la modelo (users.chosen_rate_eur_per_min)
        // × %reparto / 100. Es el valor mas util comercialmente para la modelo
        // en la vista legacy. Fallback: dejamos rateMax puro.
        if (s.getModelSharePct() != null) {
            User user = userRepository.findById(modelId).orElse(null);
            if (user != null && user.getChosenRateEurPerMin() != null) {
                BigDecimal earningPerMin = user.getChosenRateEurPerMin()
                        .multiply(s.getModelSharePct())
                        .divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
                dto.nextMinutesEURPerMin = fmt4(earningPerMin);
            }
        }

        return dto;
    }

    private String fmt4(BigDecimal v) {
        if (v == null) return "0.0000";
        return v.setScale(4, RoundingMode.HALF_UP).toPlainString();
    }
}
