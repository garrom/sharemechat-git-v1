package com.sharemechat.master.service;

import com.sharemechat.entity.Balance;
import com.sharemechat.entity.PayoutRequest;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.master.dto.MasterPayoutRequestDTO;
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
 * ADR-056 Fase S5.a.4: solicitud de retiro (payout) del Master
 * autenticado.
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
 *   <li>El {@code channel} es orientativo hasta S6 (adapters multi-rail).</li>
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

    public MasterPayoutService(PayoutRequestRepository payoutRequestRepository,
                                TransactionRepository transactionRepository,
                                BalanceRepository balanceRepository) {
        this.payoutRequestRepository = payoutRequestRepository;
        this.transactionRepository = transactionRepository;
        this.balanceRepository = balanceRepository;
    }

    /**
     * @return el {@link PayoutRequest} persistido con estado {@code REQUESTED}.
     * @throws IllegalArgumentException si importe fuera de rango o saldo insuficiente.
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

        BigDecimal amountAbs = dto.getAmount().setScale(2, RoundingMode.HALF_UP);
        if (amountAbs.compareTo(MIN_PAYOUT_EUR) < 0) {
            throw new IllegalArgumentException("El retiro minimo es de 100 EUR");
        }
        if (amountAbs.compareTo(MAX_PAYOUT_EUR) > 0) {
            throw new IllegalArgumentException("El retiro maximo por solicitud es de 1000 EUR");
        }

        Long masterId = masterUser.getId();
        BigDecimal previousBalance = balanceRepository
                .findTopByUserIdOrderByTimestampDescIdDesc(masterId)
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);
        if (previousBalance.compareTo(amountAbs) < 0) {
            throw new IllegalArgumentException("Saldo insuficiente para completar el retiro");
        }

        // Reason del PayoutRequest: combinar description + channel (si viene) para
        // trazabilidad, sin tocar el schema. Cuando S6 exista, el channel pasara
        // a payout_methods.id.
        String reason = combineReason(dto.getDescription(), dto.getChannel());

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
        tx.setDescription("Payout request #" + savedPr.getId()
                + (dto.getChannel() != null ? " (" + dto.getChannel() + ")" : ""));
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

        log.info("[MASTER-PAYOUT] requested masterId={} payoutRequestId={} amount={} channel={} newBalance={}",
                masterId, savedPr.getId(), amountAbs, dto.getChannel(), newBalance);
        return savedPr;
    }

    private String combineReason(String description, String channel) {
        StringBuilder sb = new StringBuilder();
        if (description != null && !description.isBlank()) sb.append(description.trim());
        if (channel != null && !channel.isBlank()) {
            if (sb.length() > 0) sb.append(" ");
            sb.append("[channel:").append(channel.trim()).append("]");
        }
        return sb.length() > 0 ? sb.toString() : null;
    }
}
