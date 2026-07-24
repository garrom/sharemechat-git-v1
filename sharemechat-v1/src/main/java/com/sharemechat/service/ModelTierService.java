package com.sharemechat.service;

import com.sharemechat.entity.ModelPricingTier;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelPricingTierRepository;
import com.sharemechat.repository.ModelTierDailySnapshotRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Resuelve el tramo de reparto y rango de precio de la modelo (ADR-052
 * §D1, §D2, §D3, §D6). Rediseñado desde el sistema de tiers previo
 * (5-15/7-20/9-40 sobre minutos facturados) al sistema de 4 tramos
 * (T0/T1/T2/T3) por facturacion bruta rolling 30d.
 *
 * <p>Ventana rolling 30 dias, snapshot diario en
 * {@code model_tier_daily_snapshots}. El tramo se resuelve buscando
 * la fila vigente de {@code model_pricing_tiers} con el mayor
 * {@code min_billed_gross_eur_30d} <= facturacion bruta acumulada.
 *
 * <p>Al bajar de tramo, si la {@code chosen_rate_eur_per_min} de la
 * modelo excede el {@code rate_max} del tramo destino, se recorta
 * automaticamente en el snapshot. Al subir de tramo la tarifa elegida
 * NO se toca (la modelo puede subirla manualmente desde su panel).
 */
@Service
public class ModelTierService {

    private final ModelPricingTierRepository pricingTierRepository;
    private final ModelTierDailySnapshotRepository snapshotRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final ModelTierService self;
    private final BigDecimal proStatusMinBilledGross;

    private static final int WINDOW_DAYS = 30;

    public ModelTierService(ModelPricingTierRepository pricingTierRepository,
                            ModelTierDailySnapshotRepository snapshotRepository,
                            TransactionRepository transactionRepository,
                            UserRepository userRepository,
                            @Lazy ModelTierService self,
                            @Value("${billing.pro-status.min-billed-gross-eur-30d:1500}") BigDecimal proStatusMinBilledGross) {
        this.pricingTierRepository = pricingTierRepository;
        this.snapshotRepository = snapshotRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
        this.self = self;
        this.proStatusMinBilledGross = proStatusMinBilledGross != null
                ? proStatusMinBilledGross
                : new BigDecimal("1500");
    }

    public void ensureSnapshotsInRange(Long modelId, LocalDate fromDay, LocalDate toDay) {
        if (modelId == null || fromDay == null || toDay == null || fromDay.isAfter(toDay)) return;

        LocalDate cursor = fromDay;
        while (!cursor.isAfter(toDay)) {
            self.ensureSnapshotExists(modelId, cursor);
            cursor = cursor.plusDays(1);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ModelTierDailySnapshot ensureSnapshotExists(Long modelId, LocalDate snapshotDate) {
        ModelTierDailySnapshot existing = snapshotRepository.findByModelIdAndSnapshotDate(modelId, snapshotDate).orElse(null);
        if (existing != null) return existing;

        try {
            return computeAndUpsertSnapshot(modelId, snapshotDate);
        } catch (DataIntegrityViolationException ex) {
            return snapshotRepository.findByModelIdAndSnapshotDate(modelId, snapshotDate).orElse(null);
        }
    }

    /**
     * Tramo vigente para PAGO hoy: usa snapshot de AYER. Si no existe,
     * lo calcula y persiste.
     */
    @Transactional
    public ModelPricingTier resolveEffectiveTierForPayout(Long modelId) {
        LocalDate snapshotDate = LocalDate.now().minusDays(1);
        ModelTierDailySnapshot snap = snapshotRepository.findByModelIdAndSnapshotDate(modelId, snapshotDate).orElse(null);
        if (snap == null) {
            snap = computeAndUpsertSnapshot(modelId, snapshotDate);
        }
        if (snap == null || snap.getPricingTierId() == null) {
            // Fallback: primer tramo vigente (T0)
            List<ModelPricingTier> vigentes = pricingTierRepository.findAllCurrentAsc();
            return vigentes.isEmpty() ? null : vigentes.get(0);
        }
        return pricingTierRepository.findById(snap.getPricingTierId()).orElse(null);
    }

    /**
     * Calcula y guarda el snapshot de un dia concreto. Contiene:
     * <ul>
     *   <li>billedGrossEur30d: bruto acumulado en la ventana</li>
     *   <li>pricingTierId + tierCode + share + rango: tramo resuelto</li>
     *   <li>proStatusActive: bool derivado del umbral Pro</li>
     * </ul>
     *
     * <p>Ademas, si la {@code chosen_rate_eur_per_min} de la modelo
     * excede el {@code rate_max} del tramo destino, la recorta al max
     * del tramo (evita que quede fuera de rango tras bajar de tramo).
     */
    @Transactional
    public ModelTierDailySnapshot computeAndUpsertSnapshot(Long modelId, LocalDate snapshotDate) {
        // Ventana [snapshotDate-30, snapshotDate+1) UTC
        LocalDateTime windowEnd = snapshotDate.plusDays(1).atStartOfDay();
        LocalDateTime windowStart = windowEnd.minusDays(WINDOW_DAYS);

        // Bruto rolling 30d = STREAM_CHARGE (bruto cliente) + TRIAL_EARNING (bruto trial).
        // Llamada directa a los dos metodos + suma en Java (evita el default
        // method del repository, que Mockito no delega en tests unitarios).
        BigDecimal streamCharge = transactionRepository.sumStreamChargeGrossForModelWindow(
                modelId, windowStart, windowEnd);
        BigDecimal trialEarning = transactionRepository.sumTrialEarningsForModelWindow(
                modelId, windowStart, windowEnd);
        BigDecimal billedGross = (streamCharge != null ? streamCharge : BigDecimal.ZERO)
                .add(trialEarning != null ? trialEarning : BigDecimal.ZERO);

        ModelPricingTier tier = pricingTierRepository
                .findCurrentByBilledGross(billedGross)
                .orElseGet(() -> {
                    List<ModelPricingTier> vigentes = pricingTierRepository.findAllCurrentAsc();
                    return vigentes.isEmpty() ? null : vigentes.get(0);
                });
        if (tier == null) return null;

        // Compat legacy: billed_seconds / billed_minutes se mantienen para
        // el frontend legacy que aun lee esos campos del snapshot. Se
        // calculan como el equivalente en minutos del bruto a la tarifa
        // MINIMA del tramo (proxy conservador). No es exacto pero es
        // suficiente para el panel legacy hasta que 3.C lo reemplace.
        // Los nuevos consumidores usan billed_gross_eur_30d directamente.
        long approxSeconds = billedGross.divide(
                tier.getRateMinEurPerMin().max(new BigDecimal("0.01")), 2, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("60"))
                .longValue();
        int approxMinutes = (int) Math.min(Integer.MAX_VALUE, approxSeconds / 60L);

        ModelTierDailySnapshot snap = snapshotRepository.findByModelIdAndSnapshotDate(modelId, snapshotDate).orElse(null);
        if (snap == null) {
            snap = new ModelTierDailySnapshot();
            snap.setModelId(modelId);
            snap.setSnapshotDate(snapshotDate);
        }

        snap.setWindowStart(windowStart);
        snap.setWindowEnd(windowEnd);
        snap.setBilledSeconds(approxSeconds);
        snap.setBilledMinutes(approxMinutes);

        // Columnas legacy quedan NULL en snapshots nuevos (V39 las hizo nullable)
        snap.setTierId(null);
        snap.setTierName(null);
        snap.setFirstMinuteEarningPerMin(null);
        snap.setNextMinutesEarningPerMin(null);

        // Columnas nuevas del regimen ADR-052
        snap.setBilledGrossEur30d(billedGross.setScale(2, RoundingMode.HALF_UP));
        snap.setPricingTierId(tier.getId());
        snap.setPricingTierCode(tier.getTierCode());
        snap.setModelSharePct(tier.getModelSharePct());
        snap.setRateMinEurPerMin(tier.getRateMinEurPerMin());
        snap.setRateMaxEurPerMin(tier.getRateMaxEurPerMin());
        snap.setProStatusActive(billedGross.compareTo(proStatusMinBilledGross) >= 0);

        // Recorte defensivo de chosen_rate al max del tramo destino
        User user = userRepository.findById(modelId).orElse(null);
        if (user != null && user.getChosenRateEurPerMin() != null
                && user.getChosenRateEurPerMin().compareTo(tier.getRateMaxEurPerMin()) > 0) {
            user.setChosenRateEurPerMin(tier.getRateMaxEurPerMin());
            userRepository.save(user);
        }

        return snapshotRepository.save(snap);
    }
}
