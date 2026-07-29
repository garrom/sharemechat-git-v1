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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-056 D4 (revision 2026-07-30): tras confirmar que el sector no agrega
 * por estudio (LiveJasmin/Stripchat/BongaCams calculan tramo per modelo),
 * SharemeChat revierte la agregacion MASTER. Estos tests verifican que
 * {@link ModelTierService#resolveEffectiveTierForPayout(Long)} devuelve
 * SIEMPRE el tramo INDIVIDUAL de la modelo, con o sin master_user_id.
 * El pago se atribuye al Master en StreamService pero al % INDIVIDUAL
 * per modelo (sin bonus por agregacion).
 */
class ModelTierServiceMasterTest {

    private ModelPricingTierRepository pricingTierRepository;
    private ModelTierDailySnapshotRepository snapshotRepository;
    private TransactionRepository transactionRepository;
    private UserRepository userRepository;
    private ModelRepository modelRepository;
    private ModelTierService service;

    private ModelPricingTier I_T1;
    private ModelPricingTier I_T4;

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

        I_T1 = tier(1L, "T1", "INDIVIDUAL", "0",     "50.00", "1.00", "1.00");
        I_T4 = tier(4L, "T4", "INDIVIDUAL", "15000", "60.00", "1.00", "9.00");
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

    @Test
    @DisplayName("Modelo sin Master -> resuelve tier INDIVIDUAL sobre bruto propio")
    void resolve_individual_when_no_master() {
        LocalDate yesterday = LocalDate.now().minusDays(1);

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
    @DisplayName("Modelo BAJO Master -> tambien resuelve tier INDIVIDUAL (no agrega, sector-aligned)")
    void resolve_individual_when_HAS_master() {
        // La modelo esta bajo Master, pero el motor NO consulta master_user_id
        // desde aqui — el tramo lo determina la facturacion propia de la modelo.
        // Verificamos que:
        //   (a) NO se consulta findMasterUserIdByModelUserId
        //   (b) NO se consultan queries agregadas del Master
        //   (c) El tier devuelto es INDIVIDUAL del snapshot propio de la modelo
        LocalDate yesterday = LocalDate.now().minusDays(1);

        ModelTierDailySnapshot snap = new ModelTierDailySnapshot();
        snap.setModelId(100L);
        snap.setSnapshotDate(yesterday);
        snap.setPricingTierId(4L);
        snap.setTargetType("INDIVIDUAL");
        when(snapshotRepository.findByModelIdAndSnapshotDate(100L, yesterday)).thenReturn(Optional.of(snap));
        when(pricingTierRepository.findById(4L)).thenReturn(Optional.of(I_T4));

        ModelPricingTier res = service.resolveEffectiveTierForPayout(100L);
        assertNotNull(res);
        assertEquals("INDIVIDUAL", res.getTargetType());
        assertEquals("T4", res.getTierCode());
        assertEquals(new BigDecimal("60.00"), res.getModelSharePct());

        // Guards:
        verify(modelRepository, never()).findMasterUserIdByModelUserId(any());
        verify(transactionRepository, never())
                .sumStreamChargeGrossForMasterWindow(any(), any(), any());
        verify(transactionRepository, never())
                .sumTrialEarningsForMasterWindow(any(), any(), any());
    }

    @Test
    @DisplayName("Fallback sin snapshot ni tier resuelto -> primera fila INDIVIDUAL vigente")
    void resolve_individual_fallback_when_no_snapshot() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        when(snapshotRepository.findByModelIdAndSnapshotDate(eq(77L), eq(yesterday)))
                .thenReturn(Optional.empty());
        // computeAndUpsertSnapshot fallback: sin transacciones -> 0 EUR bruto
        when(transactionRepository.sumStreamChargeGrossForModelWindow(eq(77L), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumTrialEarningsForModelWindow(eq(77L), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(pricingTierRepository.findCurrentByBilledGross(any()))
                .thenReturn(Optional.of(I_T1));
        when(snapshotRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(77L)).thenReturn(Optional.empty());
        when(pricingTierRepository.findById(1L)).thenReturn(Optional.of(I_T1));

        ModelPricingTier res = service.resolveEffectiveTierForPayout(77L);
        assertNotNull(res);
        assertEquals("INDIVIDUAL", res.getTargetType());
        assertEquals("T1", res.getTierCode());
    }
}
