package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelEconomicsDTO;
import com.sharemechat.entity.ModelPricingTier;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.entity.User;
import com.sharemechat.master.repository.MasterModelSplitRepository;
import com.sharemechat.master.repository.MasterRepository;
import com.sharemechat.repository.ModelPricingTierRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.ModelTierDailySnapshotRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-052 Frente 3 sub-frente 3.B: tests de PricingService.
 * Cubre: getEconomics con tramo desde snapshot, updateChosenRate con
 * validacion de rango, updateProAcceptsTrial (elegible / no elegible),
 * y edge cases (rol MODEL, tramo T3 sin siguiente).
 */
class PricingServiceTest {

    private UserRepository userRepository;
    private ModelRepository modelRepository;
    private ModelPricingTierRepository pricingTierRepository;
    private ModelTierDailySnapshotRepository snapshotRepository;
    private ModelTierService modelTierService;
    private MasterModelSplitRepository masterModelSplitRepository;
    private MasterRepository masterRepository;
    private PricingService service;

    private ModelPricingTier T0;
    private ModelPricingTier T1;
    private ModelPricingTier T3;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        modelRepository = mock(ModelRepository.class);
        pricingTierRepository = mock(ModelPricingTierRepository.class);
        snapshotRepository = mock(ModelTierDailySnapshotRepository.class);
        modelTierService = mock(ModelTierService.class);
        masterModelSplitRepository = mock(MasterModelSplitRepository.class);
        masterRepository = mock(MasterRepository.class);

        // ADR-056 Opcion D (2026-08-01): constructor amplia con
        // modelRepository (detectar master_user_id), masterModelSplit
        // Repository (leer % pactado), masterRepository (nombre visible
        // Master). El parametro giftModelShare fue eliminado — los gifts
        // aplican ahora el % del tramo (ver TransactionService.processGift).
        service = new PricingService(userRepository, modelRepository, pricingTierRepository,
                snapshotRepository, modelTierService, masterModelSplitRepository,
                masterRepository, new BigDecimal("1500"));

        T0 = tier(1L, "T0", "0", "75.00", "1.00", "1.00");
        T1 = tier(2L, "T1", "3500", "77.00", "1.00", "3.00");
        T3 = tier(4L, "T3", "6500", "79.00", "1.00", "9.00");

        when(modelTierService.ensureSnapshotExists(any(), any())).thenReturn(null);
    }

    private ModelPricingTier tier(Long id, String code, String minGross, String share,
                                    String rateMin, String rateMax) {
        ModelPricingTier t = new ModelPricingTier();
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

    private User model(BigDecimal chosenRate, Boolean acceptsTrial) {
        User u = new User();
        u.setId(10L);
        u.setEmail("m@test.local");
        u.setRole(Constants.Roles.MODEL);
        u.setChosenRateEurPerMin(chosenRate);
        u.setProAcceptsTrial(acceptsTrial);
        return u;
    }

    private ModelTierDailySnapshot snap(String billedGross, Long tierId, String tierCode,
                                         boolean proActive) {
        ModelTierDailySnapshot s = new ModelTierDailySnapshot();
        s.setModelId(10L);
        s.setSnapshotDate(LocalDate.now().minusDays(1));
        s.setBilledGrossEur30d(new BigDecimal(billedGross));
        s.setPricingTierId(tierId);
        s.setPricingTierCode(tierCode);
        s.setProStatusActive(proActive);
        return s;
    }

    // ---------------------------------------------------------------
    // getEconomics
    // ---------------------------------------------------------------

    @Test
    @DisplayName("getEconomics happy path: tramo T1 desde snapshot, Pro elegible, chosen_rate 2.00")
    void getEconomics_T1_ProElegible() {
        User user = model(new BigDecimal("2.00"), Boolean.TRUE);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.of(snap("4000.00", 2L, "T1", true)));
        when(pricingTierRepository.findById(2L)).thenReturn(Optional.of(T1));
        when(pricingTierRepository.findAllCurrentByTargetTypeAsc("INDIVIDUAL")).thenReturn(List.of(T0, T1, T3));

        ModelEconomicsDTO dto = service.getEconomics(10L);

        assertEquals("T1", dto.tierCode);
        assertEquals(new BigDecimal("77.00"), dto.modelSharePct);
        assertEquals(new BigDecimal("1.00"), dto.rateMinEurPerMin);
        assertEquals(new BigDecimal("3.00"), dto.rateMaxEurPerMin);
        assertEquals(new BigDecimal("2.00"), dto.chosenRateEurPerMin);
        assertTrue(dto.proStatusEligible);
        assertTrue(dto.proAcceptsTrial);
        assertEquals(new BigDecimal("4000.00"), dto.billedGrossEur30d);
        assertEquals(new BigDecimal("1500"), dto.proStatusMinBilledGrossEur30d);
        // Siguiente tramo desde T1: T3 (T2 no esta en la lista mock; el service
        // toma "el primer tramo con umbral > actual" en la lista current asc).
        assertEquals("T3", dto.nextTierCode);
        assertEquals(new BigDecimal("6500"), dto.nextTierMinBilledGrossEur30d);
    }

    @Test
    @DisplayName("getEconomics T0: Pro no elegible, no hay siguiente tramo si T0 solo esta en la lista")
    void getEconomics_T0_ProNoElegible() {
        User user = model(new BigDecimal("1.00"), Boolean.TRUE);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.of(snap("500.00", 1L, "T0", false)));
        when(pricingTierRepository.findById(1L)).thenReturn(Optional.of(T0));
        when(pricingTierRepository.findAllCurrentByTargetTypeAsc("INDIVIDUAL")).thenReturn(List.of(T0, T1, T3));

        ModelEconomicsDTO dto = service.getEconomics(10L);

        assertEquals("T0", dto.tierCode);
        assertFalse(dto.proStatusEligible);
        assertEquals("T1", dto.nextTierCode);
        assertEquals(new BigDecimal("3500"), dto.nextTierMinBilledGrossEur30d);
    }

    @Test
    @DisplayName("getEconomics T3: no hay siguiente tramo (nextTierCode null)")
    void getEconomics_T3_sinSiguiente() {
        User user = model(new BigDecimal("9.00"), Boolean.FALSE);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.of(snap("7000.00", 4L, "T3", true)));
        when(pricingTierRepository.findById(4L)).thenReturn(Optional.of(T3));
        when(pricingTierRepository.findAllCurrentByTargetTypeAsc("INDIVIDUAL")).thenReturn(List.of(T0, T1, T3));

        ModelEconomicsDTO dto = service.getEconomics(10L);

        assertEquals("T3", dto.tierCode);
        assertNull(dto.nextTierCode);
        assertNull(dto.nextTierMinBilledGrossEur30d);
    }

    @Test
    @DisplayName("getEconomics sin snapshot: fallback a T0 con billedGross=0 y Pro no elegible")
    void getEconomics_sinSnapshot_fallbackT0() {
        User user = model(new BigDecimal("1.00"), Boolean.TRUE);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.empty());
        when(pricingTierRepository.findAllCurrentByTargetTypeAsc("INDIVIDUAL")).thenReturn(List.of(T0, T1, T3));

        ModelEconomicsDTO dto = service.getEconomics(10L);

        assertEquals("T0", dto.tierCode);
        assertEquals(BigDecimal.ZERO.setScale(2), dto.billedGrossEur30d);
        assertFalse(dto.proStatusEligible);
    }

    @Test
    @DisplayName("getEconomics falla si usuario no es MODEL")
    void getEconomics_userNotModel() {
        User user = model(new BigDecimal("1.00"), Boolean.TRUE);
        user.setRole(Constants.Roles.CLIENT);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));

        assertThrows(IllegalStateException.class, () -> service.getEconomics(10L));
    }

    // ---------------------------------------------------------------
    // updateChosenRate
    // ---------------------------------------------------------------

    @Test
    @DisplayName("updateChosenRate happy path: tarifa 2.50 en tramo T1 [1.00, 3.00] -> persiste")
    void updateChosenRate_ok() {
        User user = model(new BigDecimal("1.00"), Boolean.TRUE);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.of(snap("4000.00", 2L, "T1", true)));
        when(pricingTierRepository.findById(2L)).thenReturn(Optional.of(T1));
        when(pricingTierRepository.findAllCurrentByTargetTypeAsc("INDIVIDUAL")).thenReturn(List.of(T0, T1, T3));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ModelEconomicsDTO dto = service.updateChosenRate(10L, new BigDecimal("2.50"));

        assertEquals(new BigDecimal("2.50"), dto.chosenRateEurPerMin);
        assertEquals(new BigDecimal("2.50"), user.getChosenRateEurPerMin());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("updateChosenRate fuera de rango (tarifa 5.00 en T1 max 3.00) -> IllegalArgumentException")
    void updateChosenRate_fueraDeRango() {
        User user = model(new BigDecimal("1.00"), Boolean.TRUE);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.of(snap("4000.00", 2L, "T1", true)));
        when(pricingTierRepository.findById(2L)).thenReturn(Optional.of(T1));
        when(pricingTierRepository.findAllCurrentByTargetTypeAsc("INDIVIDUAL")).thenReturn(List.of(T0, T1, T3));

        assertThrows(IllegalArgumentException.class,
                () -> service.updateChosenRate(10L, new BigDecimal("5.00")));
    }

    @Test
    @DisplayName("updateChosenRate null / negativa / cero -> IllegalArgumentException")
    void updateChosenRate_invalido() {
        assertThrows(IllegalArgumentException.class,
                () -> service.updateChosenRate(10L, null));

        User user = model(new BigDecimal("1.00"), Boolean.TRUE);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));

        assertThrows(IllegalArgumentException.class,
                () -> service.updateChosenRate(10L, new BigDecimal("-1.00")));
        assertThrows(IllegalArgumentException.class,
                () -> service.updateChosenRate(10L, BigDecimal.ZERO));
    }

    // ---------------------------------------------------------------
    // updateProAcceptsTrial
    // ---------------------------------------------------------------

    @Test
    @DisplayName("updateProAcceptsTrial happy path: persiste toggle")
    void updateProAcceptsTrial_ok() {
        User user = model(new BigDecimal("2.00"), Boolean.TRUE);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(snapshotRepository.findByModelIdAndSnapshotDate(any(), any()))
                .thenReturn(Optional.of(snap("4000.00", 2L, "T1", true)));
        when(pricingTierRepository.findById(2L)).thenReturn(Optional.of(T1));
        when(pricingTierRepository.findAllCurrentByTargetTypeAsc("INDIVIDUAL")).thenReturn(List.of(T0, T1, T3));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ModelEconomicsDTO dto = service.updateProAcceptsTrial(10L, Boolean.FALSE);

        assertFalse(dto.proAcceptsTrial);
        assertFalse(user.getProAcceptsTrial());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("updateProAcceptsTrial null -> IllegalArgumentException")
    void updateProAcceptsTrial_null() {
        assertThrows(IllegalArgumentException.class,
                () -> service.updateProAcceptsTrial(10L, null));
    }
}
