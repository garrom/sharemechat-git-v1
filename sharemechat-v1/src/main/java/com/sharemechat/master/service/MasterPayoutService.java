package com.sharemechat.master.service;

import com.sharemechat.entity.Balance;
import com.sharemechat.entity.PayoutRequest;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.master.dto.MasterPayoutRequestDTO;
import com.sharemechat.payout.entity.PayoutMethod;
import com.sharemechat.payout.repository.PayoutMethodRepository;
import com.sharemechat.payout.service.PayoutAdapter;
import com.sharemechat.payout.service.PayoutAdapterFactory;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.PayoutRequestRepository;
import com.sharemechat.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * ADR-056 Fase S5.a.4 (creación) + S6.b (refactor 2026-08-02):
 * solicitud de retiro (payout) del Master autenticado.
 *
 * <p>Simetrico a {@link com.sharemechat.service.TransactionService#requestPayout}
 * pero:
 * <ul>
 *   <li>Sin dependencia de {@code Model.saldoActual} — el Master no
 *       tiene entity Model. Solo se valida contra el balance ledger.</li>
 *   <li>Umbral minimo {@code 100 EUR} (ADR-056 D12) vs 50 EUR del
 *       modelo individual.</li>
 *   <li>Reutiliza {@link PayoutRequest} con {@code modelUserId=masterId}
 *       (la columna se llama asi por legacy; en S7 admin discriminaremos
 *       por rol del usuario asociado).</li>
 *   <li>S6.b: preferentemente vincula la solicitud a un
 *       {@link PayoutMethod} pre-registrado del user
 *       ({@code dto.payoutMethodId}). El adapter concreto se resuelve
 *       via {@link PayoutAdapterFactory} y se ejecuta al aprobar admin
 *       (S6.c pendiente). Coexistencia con el {@code channel} string
 *       legacy: si no viene payoutMethodId se cae al comportamiento
 *       previo con channel guardado en description.</li>
 * </ul>
 */
@Service
public class MasterPayoutService {

    private static final Logger log = LoggerFactory.getLogger(MasterPayoutService.class);
    private static final BigDecimal MIN_PAYOUT_EUR = new BigDecimal("100.00");
    private static final BigDecimal MAX_PAYOUT_EUR = new BigDecimal("1000.00");

    private final PayoutRequestRepository payoutRequestRepository;
    private final TransactionRepository transactionRepository;
    private final BalanceRepository balanceRepository;
    private final PayoutMethodRepository payoutMethodRepository;
    private final PayoutAdapterFactory payoutAdapterFactory;

    public MasterPayoutService(PayoutRequestRepository payoutRequestRepository,
                                TransactionRepository transactionRepository,
                                BalanceRepository balanceRepository,
                                PayoutMethodRepository payoutMethodRepository,
                                PayoutAdapterFactory payoutAdapterFactory) {
        this.payoutRequestRepository = payoutRequestRepository;
        this.transactionRepository = transactionRepository;
        this.balanceRepository = balanceRepository;
        this.payoutMethodRepository = payoutMethodRepository;
        this.payoutAdapterFactory = payoutAdapterFactory;
    }

    /**
     * @return el {@link PayoutRequest} persistido con estado {@code REQUESTED}.
     * @throws IllegalArgumentException si importe fuera de rango, saldo
     *         insuficiente, importe no entero o payoutMethodId no
     *         pertenece al user.
     */
    @Transactional
    public PayoutRequest requestPayout(User masterUser, MasterPayoutRequestDTO dto) {
        if (masterUser == null || masterUser.getId() == null) {
            throw new IllegalArgumentException("masterUser invalido");
        }
        if (dto == null || dto.getAmount() == null
                || dto.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El importe debe ser mayor a cero");
        }

        // Iter S5.a.8b (2026-08-02): solo importes enteros. Rechazo defensivo
        // por si un cliente bypaseara el step=1 del frontend. Compara la
        // parte decimal contra ZERO en escala 2 (equivalente a "no tiene
        // céntimos"). Si BigDecimal("100.50") entra, stripTrailingZeros +
        // scale > 0 → rechazo.
        BigDecimal raw = dto.getAmount();
        if (raw.stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("Solo se aceptan importes enteros (sin céntimos)");
        }

        BigDecimal amountAbs = raw.setScale(2, RoundingMode.HALF_UP);
        if (amountAbs.compareTo(MIN_PAYOUT_EUR) < 0) {
            throw new IllegalArgumentException("El retiro minimo es de 100 EUR");
        }
        if (amountAbs.compareTo(MAX_PAYOUT_EUR) > 0) {
            throw new IllegalArgumentException("El retiro maximo por solicitud es de 1000 EUR");
        }

        Long masterId = masterUser.getId();

        // S6.b: resolver PayoutMethod si viene payoutMethodId. Guard
        // ownership: el método debe pertenecer al user autenticado.
        PayoutMethod method = null;
        String railForLog = null;
        if (dto.getPayoutMethodId() != null) {
            method = payoutMethodRepository
                    .findByIdAndUserId(dto.getPayoutMethodId(), masterId)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Método de cobro no encontrado o no pertenece al usuario"));
            railForLog = method.getRail();
            // Pre-resolver adapter aunque no se ejecute todavía; si el
            // factory no encuentra ninguno (Noop siempre está), lanza
            // IllegalStateException — fail fast en request time en vez
            // de al aprobar admin.
            PayoutAdapter adapter = payoutAdapterFactory.resolve(method.getRail());
            log.debug("[MASTER-PAYOUT] adapter pre-resolved rail={} adapter={}",
                    railForLog, adapter.getClass().getSimpleName());
        }

        BigDecimal previousBalance = balanceRepository
                .findTopByUserIdOrderByTimestampDescIdDesc(masterId)
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);
        if (previousBalance.compareTo(amountAbs) < 0) {
            throw new IllegalArgumentException("Saldo insuficiente para completar el retiro");
        }

        // Reason del PayoutRequest: combinar description + rail + methodId
        // (o channel legacy si no viene payoutMethodId). Cuando exista FK
        // dedicada en payout_requests, este string queda solo como audit
        // trail extra.
        String reason = buildReason(dto.getDescription(), method, dto.getChannel());

        PayoutRequest pr = new PayoutRequest();
        pr.setModelUserId(masterId);  // legacy: la columna se llama modelUserId
        pr.setAmount(amountAbs);
        pr.setCurrency("EUR");
        pr.setStatus("REQUESTED");
        pr.setReason(reason);
        PayoutRequest savedPr = payoutRequestRepository.save(pr);

        BigDecimal signedAmount = amountAbs.negate();

        Transaction tx = new Transaction();
        tx.setUser(masterUser);
        tx.setAmount(signedAmount);
        tx.setOperationType("PAYOUT_REQUEST");
        tx.setDescription(buildTxDescription(savedPr.getId(), method, dto.getChannel()));
        Transaction savedTx = transactionRepository.save(tx);

        BigDecimal newBalance = previousBalance.add(signedAmount);

        Balance b = new Balance();
        b.setUserId(masterId);
        b.setTransactionId(savedTx.getId());
        b.setOperationType("PAYOUT_REQUEST");
        b.setAmount(signedAmount);
        b.setBalance(newBalance);
        b.setDescription(tx.getDescription());
        balanceRepository.save(b);

        log.info("[MASTER-PAYOUT] requested masterId={} payoutRequestId={} amount={} payoutMethodId={} rail={} channelLegacy={} newBalance={}",
                masterId, savedPr.getId(), amountAbs,
                method != null ? method.getId() : null,
                railForLog,
                (method == null && dto.getChannel() != null) ? dto.getChannel() : null,
                newBalance);
        return savedPr;
    }

    // ============================================================
    // Helpers formato de audit strings
    // ============================================================

    private String buildReason(String description, PayoutMethod method, String legacyChannel) {
        StringBuilder sb = new StringBuilder();
        if (description != null && !description.isBlank()) sb.append(description.trim());
        if (method != null) {
            if (sb.length() > 0) sb.append(" ");
            sb.append("[method:").append(method.getRail()).append("#").append(method.getId()).append("]");
        } else if (legacyChannel != null && !legacyChannel.isBlank()) {
            if (sb.length() > 0) sb.append(" ");
            sb.append("[channel:").append(legacyChannel.trim()).append("]");
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private String buildTxDescription(Long payoutRequestId, PayoutMethod method, String legacyChannel) {
        StringBuilder sb = new StringBuilder("Payout request #").append(payoutRequestId);
        if (method != null) {
            sb.append(" (").append(method.getRail()).append("#").append(method.getId()).append(")");
        } else if (legacyChannel != null && !legacyChannel.isBlank()) {
            sb.append(" (").append(legacyChannel.trim()).append(")");
        }
        return sb.toString();
    }
}
