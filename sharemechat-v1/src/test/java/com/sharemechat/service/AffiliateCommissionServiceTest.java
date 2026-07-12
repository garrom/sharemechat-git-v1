package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.AffiliateCommission;
import com.sharemechat.entity.User;
import com.sharemechat.repository.AffiliateCommissionRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-049 Subpasada 5 (revisada 2026-07-12): unit test de
 * {@link AffiliateCommissionService}.
 *
 * <p>Cubre los casos del contrato del service:
 * <ul>
 *   <li>Cliente sin referrer → no-op.</li>
 *   <li>Cliente con referrer + umbral D4 OK → PAYABLE.</li>
 *   <li>Cliente con referrer + umbral D4 KO → SKIPPED_NO_ACTIVITY.</li>
 *   <li>Segundo tick del mismo stream → acumula base y recalcula commission.</li>
 *   <li>Guards de entrada (null / 0 / negativos) → no-op silencioso.</li>
 *   <li>{@code reverseChargeback}: OK, sin fila previa, args invalidos.</li>
 * </ul>
 */
class AffiliateCommissionServiceTest {

    private AffiliateCommissionRepository commissionRepository;
    private TransactionRepository transactionRepository;
    private UserRepository userRepository;
    private AffiliateCommissionService service;

    private static final Long CLIENT_ID = 101L;
    private static final Long REFERRER_ID = 97L;
    private static final Long STREAM_RECORD_ID = 5001L;

    @BeforeEach
    void setUp() {
        commissionRepository = mock(AffiliateCommissionRepository.class);
        transactionRepository = mock(TransactionRepository.class);
        userRepository = mock(UserRepository.class);
        service = new AffiliateCommissionService(
                commissionRepository, transactionRepository, userRepository);
        // save() devuelve el argumento tal cual (patron usado en
        // AffiliateBonusServiceTest y similares).
        when(commissionRepository.save(any(AffiliateCommission.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    // =====================================================
    // accrueForStreamCharge - guards de entrada
    // =====================================================

    @Test
    @DisplayName("clientUserId null → no-op")
    void accrue_nullClient_noop() {
        service.accrueForStreamCharge(null, 100L, STREAM_RECORD_ID);
        verify(commissionRepository, never()).save(any());
        verify(userRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("streamRecordId null → no-op")
    void accrue_nullStreamRecord_noop() {
        service.accrueForStreamCharge(CLIENT_ID, 100L, null);
        verify(commissionRepository, never()).save(any());
    }

    @Test
    @DisplayName("chargeAmountCents = 0 → no-op")
    void accrue_zeroAmount_noop() {
        service.accrueForStreamCharge(CLIENT_ID, 0L, STREAM_RECORD_ID);
        verify(commissionRepository, never()).save(any());
    }

    @Test
    @DisplayName("chargeAmountCents negativo → no-op")
    void accrue_negativeAmount_noop() {
        service.accrueForStreamCharge(CLIENT_ID, -10L, STREAM_RECORD_ID);
        verify(commissionRepository, never()).save(any());
    }

    @Test
    @DisplayName("cliente inexistente → no-op con WARN")
    void accrue_clientNotFound_noop() {
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.empty());
        service.accrueForStreamCharge(CLIENT_ID, 300L, STREAM_RECORD_ID);
        verify(commissionRepository, never()).save(any());
    }

    @Test
    @DisplayName("cliente sin referredByUserId → no-op silencioso (mayoria de flujos)")
    void accrue_clientWithoutReferrer_noop() {
        User client = clientOf(CLIENT_ID, null);
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(client));
        service.accrueForStreamCharge(CLIENT_ID, 300L, STREAM_RECORD_ID);
        verify(commissionRepository, never()).save(any());
    }

    // =====================================================
    // accrueForStreamCharge - happy paths (umbral D4)
    // =====================================================

    @Test
    @DisplayName("cliente con referrer + umbral D4 OK → PAYABLE nueva fila")
    void accrue_referrerWithActivity_createsPayable() {
        // client 101 → referrer 97; referrer tiene STREAM_EARNING este mes → PAYABLE
        User client = clientOf(CLIENT_ID, REFERRER_ID);
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(client));
        when(transactionRepository.existsByUserAndOperationTypeBetween(
                eq(REFERRER_ID),
                eq(Constants.OperationTypes.STREAM_EARNING),
                any(LocalDateTime.class),
                any(LocalDateTime.class)))
                .thenReturn(true);
        when(commissionRepository.findBySourceTypeAndSourceIdAndStatus(
                Constants.AffiliateCommissionSourceType.STREAM_CHARGE,
                STREAM_RECORD_ID,
                Constants.AffiliateCommissionStatus.PAYABLE))
                .thenReturn(Optional.empty());

        // 300 cents de consumo → 30% = 90 cents comision
        service.accrueForStreamCharge(CLIENT_ID, 300L, STREAM_RECORD_ID);

        ArgumentCaptor<AffiliateCommission> captor =
                ArgumentCaptor.forClass(AffiliateCommission.class);
        verify(commissionRepository, times(1)).save(captor.capture());
        AffiliateCommission saved = captor.getValue();
        assertEquals(CLIENT_ID, saved.getClientUserId());
        assertEquals(REFERRER_ID, saved.getReferrerModelUserId());
        assertEquals(Constants.AffiliateCommissionSourceType.STREAM_CHARGE, saved.getSourceType());
        assertEquals(STREAM_RECORD_ID, saved.getSourceId());
        assertNull(saved.getPaymentSessionId(),
                "STREAM_CHARGE no lleva paymentSessionId");
        assertEquals(300L, saved.getBaseAmountCents());
        assertEquals(3000, saved.getRateBps());
        assertEquals(90L, saved.getCommissionAmountCents());
        assertEquals(Constants.AffiliateCommissionStatus.PAYABLE, saved.getStatus());
        assertNotNull(saved.getPeriodYyyymm());
    }

    @Test
    @DisplayName("cliente con referrer + umbral D4 KO → SKIPPED_NO_ACTIVITY")
    void accrue_referrerWithoutActivity_createsSkipped() {
        User client = clientOf(CLIENT_ID, REFERRER_ID);
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(client));
        when(transactionRepository.existsByUserAndOperationTypeBetween(
                eq(REFERRER_ID),
                eq(Constants.OperationTypes.STREAM_EARNING),
                any(LocalDateTime.class),
                any(LocalDateTime.class)))
                .thenReturn(false);
        when(commissionRepository.findBySourceTypeAndSourceIdAndStatus(
                Constants.AffiliateCommissionSourceType.STREAM_CHARGE,
                STREAM_RECORD_ID,
                Constants.AffiliateCommissionStatus.SKIPPED_NO_ACTIVITY))
                .thenReturn(Optional.empty());

        service.accrueForStreamCharge(CLIENT_ID, 500L, STREAM_RECORD_ID);

        ArgumentCaptor<AffiliateCommission> captor =
                ArgumentCaptor.forClass(AffiliateCommission.class);
        verify(commissionRepository, times(1)).save(captor.capture());
        AffiliateCommission saved = captor.getValue();
        assertEquals(Constants.AffiliateCommissionStatus.SKIPPED_NO_ACTIVITY, saved.getStatus());
        assertEquals(500L, saved.getBaseAmountCents());
        assertEquals(150L, saved.getCommissionAmountCents());
    }

    @Test
    @DisplayName("segundo tick del mismo stream → acumula base y recalcula commission")
    void accrue_secondTickSameStream_accumulates() {
        User client = clientOf(CLIENT_ID, REFERRER_ID);
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(client));
        when(transactionRepository.existsByUserAndOperationTypeBetween(
                eq(REFERRER_ID),
                eq(Constants.OperationTypes.STREAM_EARNING),
                any(LocalDateTime.class),
                any(LocalDateTime.class)))
                .thenReturn(true);

        // Simular fila existente con 300 cents base + 90 cents commission
        AffiliateCommission existing = new AffiliateCommission();
        existing.setClientUserId(CLIENT_ID);
        existing.setReferrerModelUserId(REFERRER_ID);
        existing.setSourceType(Constants.AffiliateCommissionSourceType.STREAM_CHARGE);
        existing.setSourceId(STREAM_RECORD_ID);
        existing.setBaseAmountCents(300L);
        existing.setCommissionAmountCents(90L);
        existing.setRateBps(3000);
        existing.setPeriodYyyymm(202607);
        existing.setStatus(Constants.AffiliateCommissionStatus.PAYABLE);
        when(commissionRepository.findBySourceTypeAndSourceIdAndStatus(
                Constants.AffiliateCommissionSourceType.STREAM_CHARGE,
                STREAM_RECORD_ID,
                Constants.AffiliateCommissionStatus.PAYABLE))
                .thenReturn(Optional.of(existing));

        // Segundo tick de 200 cents: base pasa a 500, commission a 150
        service.accrueForStreamCharge(CLIENT_ID, 200L, STREAM_RECORD_ID);

        ArgumentCaptor<AffiliateCommission> captor =
                ArgumentCaptor.forClass(AffiliateCommission.class);
        verify(commissionRepository, times(1)).save(captor.capture());
        AffiliateCommission saved = captor.getValue();
        assertEquals(500L, saved.getBaseAmountCents());
        assertEquals(150L, saved.getCommissionAmountCents());
        assertEquals(Constants.AffiliateCommissionStatus.PAYABLE, saved.getStatus());
    }

    @Test
    @DisplayName("excepcion en persistencia → NO propaga (fail-soft)")
    void accrue_saveThrows_swallowed() {
        User client = clientOf(CLIENT_ID, REFERRER_ID);
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(client));
        when(transactionRepository.existsByUserAndOperationTypeBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(true);
        when(commissionRepository.findBySourceTypeAndSourceIdAndStatus(
                anyString(), anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(commissionRepository.save(any(AffiliateCommission.class)))
                .thenThrow(new RuntimeException("boom (simulado)"));

        // No debe lanzar
        service.accrueForStreamCharge(CLIENT_ID, 300L, STREAM_RECORD_ID);
    }

    // =====================================================
    // reverseChargeback
    // =====================================================

    @Test
    @DisplayName("reverseChargeback OK → fila REVERSED con importes negativos")
    void reverseChargeback_happyPath() {
        AffiliateCommission original = new AffiliateCommission();
        original.setClientUserId(CLIENT_ID);
        original.setReferrerModelUserId(REFERRER_ID);
        original.setPeriodYyyymm(202607);
        original.setStatus(Constants.AffiliateCommissionStatus.PAYABLE);
        when(commissionRepository.findByPaymentSessionIdAndStatus(
                999L, Constants.AffiliateCommissionStatus.PAYABLE))
                .thenReturn(Optional.of(original));

        AffiliateCommission result = service.reverseChargeback(999L, 400L, "chargeback tarjeta");

        assertEquals(-400L, result.getBaseAmountCents());
        assertEquals(-120L, result.getCommissionAmountCents());
        assertEquals(Constants.AffiliateCommissionStatus.REVERSED_CHARGEBACK, result.getStatus());
        assertEquals(Constants.AffiliateCommissionSourceType.PAYMENT_SESSION, result.getSourceType());
        assertEquals(999L, result.getSourceId());
        assertEquals(999L, result.getPaymentSessionId());
        assertEquals(REFERRER_ID, result.getReferrerModelUserId());
        assertEquals(202607, result.getPeriodYyyymm());
    }

    @Test
    @DisplayName("reverseChargeback sin fila previa → IllegalStateException")
    void reverseChargeback_noOriginal_throws() {
        when(commissionRepository.findByPaymentSessionIdAndStatus(
                888L, Constants.AffiliateCommissionStatus.PAYABLE))
                .thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class,
                () -> service.reverseChargeback(888L, 500L, "any"));
        verify(commissionRepository, never()).save(any());
    }

    @Test
    @DisplayName("reverseChargeback con paymentSessionId null → IllegalArgumentException")
    void reverseChargeback_nullId_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> service.reverseChargeback(null, 500L, "any"));
    }

    @Test
    @DisplayName("reverseChargeback con refundedAmountCents <= 0 → IllegalArgumentException")
    void reverseChargeback_nonPositiveAmount_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> service.reverseChargeback(1L, 0L, "any"));
        assertThrows(IllegalArgumentException.class,
                () -> service.reverseChargeback(1L, -1L, "any"));
    }

    // =====================================================
    // helpers
    // =====================================================

    private static User clientOf(Long id, Long referredByUserId) {
        User u = new User();
        try {
            java.lang.reflect.Field idField = User.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(u, id);
        } catch (Exception e) {
            throw new IllegalStateException("no puedo setear id via reflection", e);
        }
        u.setReferredByUserId(referredByUserId);
        return u;
    }
}
