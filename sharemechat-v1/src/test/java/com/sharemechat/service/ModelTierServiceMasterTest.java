package com.sharemechat.service;

import com.sharemechat.entity.ModelPricingTier;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.repository.ModelPricingTierRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.ModelTierDailySnapshotRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-056 Fase S3.5: tests del régimen MASTER en ModelTierService.
 * Cubre: resolveEffectiveTierForPayout con y sin Master + escalado
 * agregado por Master (bruto sumado del equipo) + snapshot MASTER.
 */
class ModelTierServiceMasterTest {

    private ModelPricingTierRepository pricingTierRepository;
    private ModelTierDailySnapshotRepository snapshotRepository;
    private TransactionRepository transactionRepository;
    private UserRepository userRepository;
    private ModelRepository modelRepository;
    private ModelTierService service;

    // Tiers post-ADR-056 régimen MASTER
    private ModelPricingTier M_T1;
    private ModelPricingTier M_T2;
    private ModelPricingTier M_T3;
    private ModelPricingTier M_T4;

    // Tiers post-ADR-056 régimen INDIVIDUAL (para el resolveEffective sin Master)
    private ModelPricingTier I_T1;

    @BeforeEach
    void setUp() {
        pricingTierRepository = mock(ModelPricingTierRepository.class);
        snapshotRepository = mock(ModelTierDailySnapshotRepository.class);
        transactionRepository = mock(TransactionRepository.class);
        userRepository = mock(UserRepository.class);
        modelRepository = mock(ModelRepository.class);

        service = new ModelTierService(
                pricingTierRepository, snapshotRepository, transactionRepository, userRepository,
                modelRepository, null, new BigDecimal("1500"));

        M_T1 = tier(11L, "T1", "MASTER", "0",     "50.00", "1.00", "1.00");
        M_T2 = tier(12L, "T2", "MASTER", "1000",  "60.00", "1.00", "3.00");
        M_T3 = tier(13L, "T3", "MASTER", "4000",  "65.00", "1.00", "6.00");
        M_T4 = tier(14L, "T4", "MASTER", "15000", "70.00", "1.00", "9.00");

        I_T1 = tier(1L, "T1", "INDIVIDUAL", "0", "50.00", "1.00", "1.00");
    }

    private ModelPricingTier tier(Long id, String code, String target, String minGross,
                                   String share, String rateMin, String rateMax) {
        ModelPricingTier t = new ModelPricingTier();
        try {
            var f = ModelPricingTier.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(t, id);
        } catch (ReflectiveOperationException ex) { throw new RuntimeException(ex); }
        t.setTierCode(code);
        t.setTargetType(target);
        t.setMinBilledGrossEur30d(new BigDecimal(minGross));
        t.setModelSharePct(new BigDecimal(share));
        t.setRateMinEurPerMin(new BigDecimal(rateMin));
        t.setRateMaxEurPerMin(new BigDecimal(rateMax));
        return t;
    }

    // ============================================================
    // resolveEffectiveTierForPayout: detección Master vs Individual
    // ============================================================

    @Test
    @DisplayName("Modelo sin Master -> resuelve tier INDIVIDUAL sobre bruto propio")
    void resolve_individual_when_no_master() {
        when(modelRepository.findMasterUserIdByModelUserId(50L)).thenReturn(Optional.empty());
        LocalDate yesterday = LocalDate.now().minusDays(1);

        // Snapshot INDIVIDUAL existente
        ModelTierDailySnapshot snap = new ModelTierDailySnapshot();
        snap.setModelId(50L);
        snap.setSnapshotDate(yesterday);
        snap.setPricingTierId(1L);
        snap.setTargetType("INDIVIDUAL");
        when(snapshotRepository.findByModelIdAndSnapshotDate(50L, yesterday)).thenReturn(Optional.of(snap));
        when(pricingTierRepository.findById(1L)).thenReturn(Optional.of(I_T1));

        ModelPricingTier res = service.resolveEffectiveTierForPayout(50L);
        assertNotNull(res);
        assertEquals("INDIVIDUAL", res.getTargetType());
        assertEquals("T1", res.getTierCode());
    }

    @Test
    @DisplayName("Modelo bajo Master -> delega en resolveEffectiveTierForMasterPayout con masterId")
    void resolve_master_when_has_master() {
        // Modelo 100 bajo Master 500.
        when(modelRepository.findMasterUserIdByModelUserId(100L)).thenReturn(Optional.of(500L));
        LocalDate yesterday = LocalDate.now().minusDays(1);

        ModelTierDailySnapshot masterSnap = new ModelTierDailySnapshot();
        masterSnap.setModelId(500L);
        masterSnap.setSnapshotDate(yesterday);
        masterSnap.setPricingTierId(14L);
        masterSnap.setTargetType("MASTER");
        masterSnap.setMasterUserId(500L);
        when(snapshotRepository.findByModelIdAndSnapshotDate(500L, yesterday)).thenReturn(Optional.of(masterSnap));
        when(pricingTierRepository.findById(14L)).thenReturn(Optional.of(M_T4));

        ModelPricingTier res = service.resolveEffectiveTierForPayout(100L);
        assertNotNull(res);
        assertEquals("MASTER", res.getTargetType());
        assertEquals("T4", res.getTierCode());
        assertEquals(new BigDecimal("70.00"), res.getModelSharePct());
    }

    // ============================================================
    // computeAndUpsertMasterSnapshot: bruto agregado + tier MASTER
    // ============================================================

    @Test
    @DisplayName("Master pequeño: bruto agregado 500 EUR -> T1 (50%)")
    void master_snapshot_T1() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        // El Master tiene 3 modelos que suman 500 EUR/30d en total.
        when(transactionRepository.sumStreamChargeGrossForMasterWindow(eq(500L), any(), any()))
                .thenReturn(new BigDecimal("500.00"));
        when(transactionRepository.sumTrialEarningsForMasterWindow(eq(500L), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(pricingTierRepository.findCurrentByBilledGross(any(), eq("MASTER"))).thenReturn(Optional.of(M_T1));
        when(snapshotRepository.findByModelIdAndSnapshotDate(500L, yesterday)).thenReturn(Optional.empty());
        when(snapshotRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ModelTierDailySnapshot snap = service.computeAndUpsertMasterSnapshot(500L, yesterday);
        assertNotNull(snap);
        assertEquals("MASTER", snap.getTargetType());
        assertEquals(500L, snap.getMasterUserId());
        assertEquals("T1", snap.getPricingTierCode());
        assertEquals(new BigDecimal("50.00"), snap.getModelSharePct());
        assertEquals(new BigDecimal("500.00"), snap.getBilledGrossEur30d());
    }

    @Test
    @DisplayName("Master grande: 5 modelos suman 20000 EUR agregado -> T4 (70%)")
    void master_snapshot_T4() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        when(transactionRepository.sumStreamChargeGrossForMasterWindow(eq(500L), any(), any()))
                .thenReturn(new BigDecimal("18000.00"));
        when(transactionRepository.sumTrialEarningsForMasterWindow(eq(500L), any(), any()))
                .thenReturn(new BigDecimal("2000.00"));
        // 20000 total >= 15000 (umbral T4).
        when(pricingTierRepository.findCurrentByBilledGross(any(), eq("MASTER"))).thenReturn(Optional.of(M_T4));
        when(snapshotRepository.findByModelIdAndSnapshotDate(500L, yesterday)).thenReturn(Optional.empty());
        when(snapshotRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ModelTierDailySnapshot snap = service.computeAndUpsertMasterSnapshot(500L, yesterday);
        assertNotNull(snap);
        assertEquals("MASTER", snap.getTargetType());
        assertEquals("T4", snap.getPricingTierCode());
        assertEquals(new BigDecimal("70.00"), snap.getModelSharePct());
        assertEquals(new BigDecimal("20000.00"), snap.getBilledGrossEur30d());
    }

    @Test
    @DisplayName("Master snapshot NO recorta chosen_rate del Master (Master no tiene tarifa autoservicio)")
    void master_snapshot_no_chosen_rate_recorte() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        when(transactionRepository.sumStreamChargeGrossForMasterWindow(eq(500L), any(), any()))
                .thenReturn(new BigDecimal("2000.00"));
        when(transactionRepository.sumTrialEarningsForMasterWindow(eq(500L), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(pricingTierRepository.findCurrentByBilledGross(any(), eq("MASTER"))).thenReturn(Optional.of(M_T2));
        when(snapshotRepository.findByModelIdAndSnapshotDate(500L, yesterday)).thenReturn(Optional.empty());
        when(snapshotRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.computeAndUpsertMasterSnapshot(500L, yesterday);

        // No debe consultarse userRepository.findById para el Master (no tiene chosen_rate a recortar).
        verify(userRepository, times(0)).save(any());
    }
}
