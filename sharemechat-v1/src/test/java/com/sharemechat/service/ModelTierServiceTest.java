package com.sharemechat.service;

import com.sharemechat.entity.ModelPricingTier;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelPricingTierRepository;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-052 Frente 3 (V39, 2026-07-25): tests del nuevo ModelTierService
 * que resuelve tramo por facturacion bruta rolling 30d. Cubre:
 * <ul>
 *   <li>Resolucion de tramo T0/T1/T2/T3 por umbral.</li>
 *   <li>Escritura de columnas nuevas del snapshot (billedGross, pricingTierId,
 *       modelSharePct, rateMin/Max, proStatusActive).</li>
 *   <li>Recorte defensivo de chosen_rate si excede rateMax del tramo destino.</li>
 *   <li>Umbral Pro (default 1500 EUR).</li>
 * </ul>
 */
class ModelTierServiceTest {

    private ModelPricingTierRepository pricingTierRepository;
    private ModelTierDailySnapshotRepository snapshotRepository;
    private TransactionRepository transactionRepository;
    private UserRepository userRepository;
    private ModelTierService service;

    private ModelPricingTier T0;
    private ModelPricingTier T1;
    private ModelPricingTier T2;
    private ModelPricingTier T3;

    @BeforeEach
    void setUp() {
        pricingTierRepository = mock(ModelPricingTierRepository.class);
        snapshotRepository = mock(ModelTierDailySnapshotRepository.class);
        transactionRepository = mock(TransactionRepository.class);
        userRepository = mock(UserRepository.class);

        // Self reference — devolvemos el mismo service para simplificar
        service = new ModelTierService(
                pricingTierRepository, snapshotRepository, transactionRepository, userRepository,
                null, new BigDecimal("1500"));

        T0 = tier(1L, "T0", "0", "75.00", "1.00", "1.00");
        T1 = tier(2L, "T1", "3500", "77.00", "1.00", "3.00");
        T2 = tier(3L, "T2", "5000", "78.00", "1.00", "6.00");
        T3 = tier(4L, "T3", "6500", "79.00", "1.00", "9.00");
    }

    private ModelPricingTier tier(Long id, String code, String minGross, String share,
                                    String rateMin, String rateMax) {
        ModelPricingTier t = new ModelPricingTier();
        // No hay setId publico; para el test lo ponemos via reflection ligera.
        try {
            java.lang.reflect.Field f = ModelPricingTier.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(t, id);
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
        t.setTierCode(code);
        t.setMinBilledGrossEur30d(new BigDecimal(minGross));
        t.setModelSharePct(new BigDecimal(share));
        t.setRateMinEurPerMin(new BigDecimal(rateMin));
        t.setRateMaxEurPerMin(new BigDecimal(rateMax));
        return t;
    }

    private User model(BigDecimal chosenRate) {
        User u = new User();
        u.setId(10L);
        u.setEmail("m@test.local");
        u.setChosenRateEurPerMin(chosenRate);
        return u;
    }

    // ---------------------------------------------------------------
    // Resolucion de tramo por umbral
    // ---------------------------------------------------------------

    @Test
    @DisplayName("computeAndUpsertSnapshot con bruto 0 EUR -> T0 (75%, 1-1 EUR/min)")
    void snapshot_T0() {
        when(transactionRepository.sumStreamChargeGrossForModelWindow(any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumTrialEarningsForModelWindow(any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(pricingTierRepository.findCurrentByBilledGross(any()))
                .thenReturn(Optional.of(T0));
        when(pricingTierRepository.findAllCurrentByTargetTypeAsc("INDIVIDUAL"))
                .thenReturn(List.of(T0, T1, T2, T3));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.empty());
        when(userRepository.findById(10L)).thenReturn(Optional.of(model(new BigDecimal("1.00"))));
        when(snapshotRepository.save(any(ModelTierDailySnapshot.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ModelTierDailySnapshot snap = service.computeAndUpsertSnapshot(10L, LocalDate.of(2026, 7, 25));

        assertNotNull(snap);
        assertEquals("T0", snap.getPricingTierCode());
        assertEquals(new BigDecimal("75.00"), snap.getModelSharePct());
        assertEquals(new BigDecimal("1.00"), snap.getRateMaxEurPerMin());
        assertEquals(BigDecimal.ZERO.setScale(2), snap.getBilledGrossEur30d());
        assertFalse(snap.getProStatusActive(), "0 EUR < 1500 EUR umbral Pro");
    }

    @Test
    @DisplayName("computeAndUpsertSnapshot con bruto 4000 EUR -> T1 (77%, 1-3 EUR/min)")
    void snapshot_T1() {
        when(transactionRepository.sumStreamChargeGrossForModelWindow(any(), any(), any()))
                .thenReturn(new BigDecimal("4000.00"));
        when(transactionRepository.sumTrialEarningsForModelWindow(any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(pricingTierRepository.findCurrentByBilledGross(any()))
                .thenReturn(Optional.of(T1));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.empty());
        when(userRepository.findById(10L)).thenReturn(Optional.of(model(new BigDecimal("1.00"))));
        when(snapshotRepository.save(any(ModelTierDailySnapshot.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ModelTierDailySnapshot snap = service.computeAndUpsertSnapshot(10L, LocalDate.of(2026, 7, 25));

        assertEquals("T1", snap.getPricingTierCode());
        assertEquals(new BigDecimal("77.00"), snap.getModelSharePct());
        assertEquals(new BigDecimal("3.00"), snap.getRateMaxEurPerMin());
        assertTrue(snap.getProStatusActive(), "4000 EUR >= 1500 EUR umbral Pro");
    }

    @Test
    @DisplayName("computeAndUpsertSnapshot con bruto 5500 EUR -> T2 (78%, 1-6 EUR/min)")
    void snapshot_T2() {
        when(transactionRepository.sumStreamChargeGrossForModelWindow(any(), any(), any()))
                .thenReturn(new BigDecimal("5500.00"));
        when(transactionRepository.sumTrialEarningsForModelWindow(any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(pricingTierRepository.findCurrentByBilledGross(any()))
                .thenReturn(Optional.of(T2));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.empty());
        when(userRepository.findById(10L)).thenReturn(Optional.of(model(new BigDecimal("1.00"))));
        when(snapshotRepository.save(any(ModelTierDailySnapshot.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ModelTierDailySnapshot snap = service.computeAndUpsertSnapshot(10L, LocalDate.of(2026, 7, 25));

        assertEquals("T2", snap.getPricingTierCode());
        assertEquals(new BigDecimal("78.00"), snap.getModelSharePct());
        assertEquals(new BigDecimal("6.00"), snap.getRateMaxEurPerMin());
    }

    @Test
    @DisplayName("computeAndUpsertSnapshot con bruto 8000 EUR (STREAM_CHARGE + trial) -> T3")
    void snapshot_T3_conTrial() {
        when(transactionRepository.sumStreamChargeGrossForModelWindow(any(), any(), any()))
                .thenReturn(new BigDecimal("7500.00"));
        when(transactionRepository.sumTrialEarningsForModelWindow(any(), any(), any()))
                .thenReturn(new BigDecimal("500.00"));
        when(pricingTierRepository.findCurrentByBilledGross(any()))
                .thenReturn(Optional.of(T3));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.empty());
        when(userRepository.findById(10L)).thenReturn(Optional.of(model(new BigDecimal("5.00"))));
        when(snapshotRepository.save(any(ModelTierDailySnapshot.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ModelTierDailySnapshot snap = service.computeAndUpsertSnapshot(10L, LocalDate.of(2026, 7, 25));

        assertEquals("T3", snap.getPricingTierCode());
        assertEquals(new BigDecimal("8000.00"), snap.getBilledGrossEur30d());
        assertEquals(new BigDecimal("9.00"), snap.getRateMaxEurPerMin());
    }

    // ---------------------------------------------------------------
    // Recorte de chosen_rate al bajar de tramo
    // ---------------------------------------------------------------

    @Test
    @DisplayName("Recorte defensivo: chosen_rate 5.00 EUR/min en tramo T1 (max 3.00) -> se recorta a 3.00")
    void snapshot_recortaChosenRate() {
        when(transactionRepository.sumStreamChargeGrossForModelWindow(any(), any(), any()))
                .thenReturn(new BigDecimal("4000.00"));
        when(transactionRepository.sumTrialEarningsForModelWindow(any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(pricingTierRepository.findCurrentByBilledGross(any()))
                .thenReturn(Optional.of(T1));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.empty());
        User user = model(new BigDecimal("5.00")); // era T2/T3, ahora baja a T1
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(snapshotRepository.save(any(ModelTierDailySnapshot.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.computeAndUpsertSnapshot(10L, LocalDate.of(2026, 7, 25));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals(new BigDecimal("3.00"), captor.getValue().getChosenRateEurPerMin(),
                "chosen_rate debe recortarse al max del tramo T1");
    }

    @Test
    @DisplayName("Sin recorte: chosen_rate 1.00 EUR/min en tramo T1 (max 3.00) -> no toca")
    void snapshot_noRecortaChosenRateSiEstaEnRango() {
        when(transactionRepository.sumStreamChargeGrossForModelWindow(any(), any(), any()))
                .thenReturn(new BigDecimal("4000.00"));
        when(transactionRepository.sumTrialEarningsForModelWindow(any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(pricingTierRepository.findCurrentByBilledGross(any()))
                .thenReturn(Optional.of(T1));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.empty());
        User user = model(new BigDecimal("1.00"));
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(snapshotRepository.save(any(ModelTierDailySnapshot.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.computeAndUpsertSnapshot(10L, LocalDate.of(2026, 7, 25));

        // userRepository.save NO se llama si no hay recorte
        verify(userRepository, never()).save(any());
    }

    // ---------------------------------------------------------------
    // Columnas legacy quedan NULL en snapshots nuevos
    // ---------------------------------------------------------------

    @Test
    @DisplayName("Snapshot nuevo no escribe columnas legacy (tier_id/tier_name/first/next)")
    void snapshot_columnasLegacyEnNULL() {
        when(transactionRepository.sumStreamChargeGrossForModelWindow(any(), any(), any()))
                .thenReturn(new BigDecimal("2000.00"));
        when(transactionRepository.sumTrialEarningsForModelWindow(any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(pricingTierRepository.findCurrentByBilledGross(any()))
                .thenReturn(Optional.of(T0));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.empty());
        when(userRepository.findById(10L)).thenReturn(Optional.of(model(new BigDecimal("1.00"))));
        when(snapshotRepository.save(any(ModelTierDailySnapshot.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ModelTierDailySnapshot snap = service.computeAndUpsertSnapshot(10L, LocalDate.of(2026, 7, 25));

        assertNull(snap.getTierId());
        assertNull(snap.getTierName());
        assertNull(snap.getFirstMinuteEarningPerMin());
        assertNull(snap.getNextMinutesEarningPerMin());
    }
}
