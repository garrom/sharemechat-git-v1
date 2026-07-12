package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.AffiliateCommission;
import com.sharemechat.entity.User;
import com.sharemechat.repository.AffiliateCommissionRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

/**
 * ADR-049 Subpasada 5 (revisada 2026-07-12): motor de comisiones de
 * afiliadas on-consumption.
 *
 * <p>Diseño: la comision se acumula cuando el cliente atribuido
 * <b>consume</b> streaming (Transaction STREAM_CHARGE), no cuando
 * <b>recarga</b> saldo (PaymentSession SUCCESS). Garantia cash-flow: lo
 * consumido es irrevocable, cero clawback contra la modelo referida.
 *
 * <p>Un único {@code stream_record} genera <b>una única fila</b>
 * {@code affiliate_commissions} (idempotente por
 * {@code (source_type, source_id, status)}). Los ticks per-second del
 * mismo streaming acumulan en la misma fila via find-or-create-then-add,
 * evitando la perdida por redondeo entera que ocurriria con una fila
 * por tick (un tick de 3 cents daria {@code 3 * 3000 / 10000 = 0}).
 */
@Service
public class AffiliateCommissionService {

    private static final Logger log = LoggerFactory.getLogger(AffiliateCommissionService.class);

    /** Rate en basis points (ADR-049 D2). 3000 = 30%. */
    private static final int RATE_BPS = 3000;
    /** Divisor para conversion de basis points a fraccion. */
    private static final long RATE_DIVISOR = 10_000L;

    private final AffiliateCommissionRepository commissionRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public AffiliateCommissionService(AffiliateCommissionRepository commissionRepository,
                                       TransactionRepository transactionRepository,
                                       UserRepository userRepository) {
        this.commissionRepository = commissionRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    /**
     * Hook invocado desde {@link StreamService} tras persistir cada
     * {@code Transaction STREAM_CHARGE}.
     *
     * <p>Comportamiento:
     * <ul>
     *   <li>Si el cliente no tiene {@code referredByUserId}, no hace nada
     *       (mayoria de flujos organicos).</li>
     *   <li>Calcula {@code period_yyyymm} en UTC estricto (ADR-049
     *       convencion UTC) desde el instante actual.</li>
     *   <li>Evalua umbral D4 (¿la modelo referidora tiene
     *       {@code STREAM_EARNING} este mes UTC?). Si si →
     *       {@code PAYABLE}; si no → {@code SKIPPED_NO_ACTIVITY}.</li>
     *   <li>Busca fila existente para
     *       {@code (STREAM_CHARGE, streamRecordId, status)}; si existe,
     *       acumula base y recalcula comision; si no, crea fila nueva.</li>
     * </ul>
     *
     * <p>Diseño defensivo: cualquier excepcion se loguea WARN y NO se
     * propaga. El hook nunca debe romper el ciclo de streaming.
     *
     * @param clientUserId       user_id del cliente que consume
     * @param chargeAmountCents  importe positivo del tick de consumo
     * @param streamRecordId     id del stream_record del que se cobra
     */
    @Transactional
    public void accrueForStreamCharge(Long clientUserId,
                                      long chargeAmountCents,
                                      Long streamRecordId) {
        try {
            if (clientUserId == null || streamRecordId == null || chargeAmountCents <= 0L) {
                return;
            }

            User client = userRepository.findById(clientUserId).orElse(null);
            if (client == null) {
                log.warn("[AFF-COMMISSION] Cliente no encontrado id={}, skip", clientUserId);
                return;
            }
            Long referrerModelUserId = client.getReferredByUserId();
            if (referrerModelUserId == null) {
                return; // cliente sin atribucion, mayoria de flujos
            }

            LocalDateTime nowUtc = LocalDateTime.now(ZoneOffset.UTC);
            int periodYyyymm = nowUtc.getYear() * 100 + nowUtc.getMonthValue();

            boolean hasActivity = hasOwnActivityThisMonth(referrerModelUserId, nowUtc);
            String status = hasActivity
                    ? Constants.AffiliateCommissionStatus.PAYABLE
                    : Constants.AffiliateCommissionStatus.SKIPPED_NO_ACTIVITY;

            Optional<AffiliateCommission> existing = commissionRepository
                    .findBySourceTypeAndSourceIdAndStatus(
                            Constants.AffiliateCommissionSourceType.STREAM_CHARGE,
                            streamRecordId,
                            status);

            if (existing.isPresent()) {
                // Ya hay fila para este stream_record + status: acumular
                // sobre el total para evitar perdida por redondeo entera
                // cuando los ticks son de pocos cents.
                AffiliateCommission row = existing.get();
                long newBase = row.getBaseAmountCents() + chargeAmountCents;
                long newCommission = (newBase * RATE_BPS) / RATE_DIVISOR;
                row.setBaseAmountCents(newBase);
                row.setCommissionAmountCents(newCommission);
                commissionRepository.save(row);
                log.debug("[AFF-COMMISSION] accumulate streamRecordId={} newBaseCents={} newCommissionCents={}",
                        streamRecordId, newBase, newCommission);
                return;
            }

            long commissionAmountCents = (chargeAmountCents * RATE_BPS) / RATE_DIVISOR;

            AffiliateCommission row = new AffiliateCommission();
            row.setClientUserId(clientUserId);
            row.setReferrerModelUserId(referrerModelUserId);
            row.setSourceType(Constants.AffiliateCommissionSourceType.STREAM_CHARGE);
            row.setSourceId(streamRecordId);
            row.setPaymentSessionId(null);
            row.setBaseAmountCents(chargeAmountCents);
            row.setRateBps(RATE_BPS);
            row.setCommissionAmountCents(commissionAmountCents);
            row.setPeriodYyyymm(periodYyyymm);
            row.setStatus(status);
            commissionRepository.save(row);

            log.info("[AFF-COMMISSION] accrue clientId={} referrerId={} streamRecordId={} baseCents={} commissionCents={} status={}",
                    clientUserId, referrerModelUserId, streamRecordId, chargeAmountCents,
                    commissionAmountCents, status);
        } catch (Exception e) {
            log.warn("[AFF-COMMISSION] Error en accrueForStreamCharge clientId={} streamRecordId={}: {}",
                    clientUserId, streamRecordId, e.getMessage());
        }
    }

    /**
     * ADR-049 D8: chargeback/refund sobre PaymentSession que ya devengó
     * comision. Genera fila {@code REVERSED_CHARGEBACK} con importes
     * negativos.
     *
     * <p><b>Fase actual (D2 revisado)</b>: la comision se acumula sobre
     * {@code STREAM_CHARGE}, no sobre PaymentSession. Un chargeback contra
     * una recarga NO genera reverso automatico de comision porque no hay
     * comision sobre saldo no consumido. El endpoint queda listo para
     * cuando entre PSP tarjeta o si en el futuro se activa un hook al
     * SUCCESS de PaymentSession; en ese momento este metodo revierte la
     * comision original.
     *
     * <p>Contrato actual: exige que exista una fila
     * {@code (payment_session_id, PAYABLE)} previa (via el metodo
     * legacy {@link AffiliateCommissionRepository#findByPaymentSessionIdAndStatus}).
     * Si no existe, lanza {@link IllegalStateException} para que el admin
     * sepa que no hay nada que revertir en el motor actual.
     */
    @Transactional
    public AffiliateCommission reverseChargeback(Long paymentSessionId,
                                                  long refundedAmountCents,
                                                  String reason) {
        if (paymentSessionId == null || refundedAmountCents <= 0L) {
            throw new IllegalArgumentException(
                    "paymentSessionId y refundedAmountCents (>0) requeridos");
        }

        Optional<AffiliateCommission> original = commissionRepository
                .findByPaymentSessionIdAndStatus(paymentSessionId,
                        Constants.AffiliateCommissionStatus.PAYABLE);

        if (original.isEmpty()) {
            throw new IllegalStateException(
                    "No hay comision PAYABLE previa para paymentSessionId=" + paymentSessionId +
                    ". En fase actual (D2 revisado) la comision se acumula sobre STREAM_CHARGE, " +
                    "no sobre PaymentSession. Verificar aplicabilidad.");
        }

        AffiliateCommission src = original.get();
        long negativeCommissionCents = -((refundedAmountCents * RATE_BPS) / RATE_DIVISOR);

        AffiliateCommission reversal = new AffiliateCommission();
        reversal.setClientUserId(src.getClientUserId());
        reversal.setReferrerModelUserId(src.getReferrerModelUserId());
        reversal.setSourceType(Constants.AffiliateCommissionSourceType.PAYMENT_SESSION);
        reversal.setSourceId(paymentSessionId);
        reversal.setPaymentSessionId(paymentSessionId);
        reversal.setBaseAmountCents(-refundedAmountCents);
        reversal.setRateBps(RATE_BPS);
        reversal.setCommissionAmountCents(negativeCommissionCents);
        reversal.setPeriodYyyymm(src.getPeriodYyyymm());
        reversal.setStatus(Constants.AffiliateCommissionStatus.REVERSED_CHARGEBACK);
        commissionRepository.save(reversal);

        log.info("[AFF-COMMISSION] reverse chargeback paymentSessionId={} refundedCents={} negativeCommissionCents={} reason={}",
                paymentSessionId, refundedAmountCents, negativeCommissionCents, reason);
        return reversal;
    }

    /**
     * Query D4 (umbral mensual de facturacion propia): ¿existe algun
     * {@code STREAM_EARNING} de la modelo referidora en el mes calendario
     * UTC del instante indicado?
     *
     * <p>Se usa rango temporal semi-abierto {@code [start, end)} calculado
     * explicitamente en UTC (no {@code YEAR()/MONTH()} de SQL que
     * dependen de la zona horaria del servidor).
     */
    private boolean hasOwnActivityThisMonth(Long referrerModelUserId, LocalDateTime nowUtc) {
        LocalDateTime startOfMonth = LocalDateTime.of(
                nowUtc.getYear(), nowUtc.getMonthValue(), 1, 0, 0, 0);
        LocalDateTime startOfNextMonth = startOfMonth.plusMonths(1L);
        return transactionRepository.existsByUserAndOperationTypeBetween(
                referrerModelUserId,
                Constants.OperationTypes.STREAM_EARNING,
                startOfMonth,
                startOfNextMonth);
    }
}
