package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Balance;
import com.sharemechat.entity.Client;
import com.sharemechat.entity.PlatformBalance;
import com.sharemechat.entity.PlatformTransaction;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.PlatformBalanceRepository;
import com.sharemechat.repository.PlatformTransactionRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;

/**
 * ADR-049 Subpasada 2B: bono de bienvenida al cliente atribuido (D7, D23).
 *
 * <p>El bono es <b>saldo real en EUR</b> en el ledger del cliente (10 EUR
 * por default), financiado por la plataforma via patron BFPM (ADR-012):
 * dos operaciones de doble entrada preservando el invariante
 * {@code Sum(REFERRAL_WELCOME_GRANT) + Sum(REFERRAL_WELCOME_FUNDING) = 0}.
 *
 * <p><b>Idempotencia (D23)</b>: un cliente solo puede recibir un
 * {@code REFERRAL_WELCOME_GRANT} durante su vida. Guard via
 * {@code transactionRepository.existsByUserIdAndOperationType(clientId,
 * REFERRAL_WELCOME_GRANT)} antes de crear filas. La "idempotency key"
 * conceptual es {@code WELCOME_BONUS_${clientUserId}}, materializada por
 * la propia existencia de la operacion.
 *
 * <p><b>Disparo</b>: en Subpasada 2B se llama <b>directamente</b> desde
 * {@code AffiliateAttributionService.attributeOnRegister} (D6+D7 dicen
 * "en el registro"). Cuando la Subpasada 3 introduzca el punto de exito
 * de pago, este mismo servicio podra recablearse como listener de un
 * evento {@code PaymentConfirmed} sin cambiar la firma publica.
 */
@Service
public class AffiliateBonusService {

    private static final Logger log = LoggerFactory.getLogger(AffiliateBonusService.class);
    private final ReentrantLock platformLedgerLock = new ReentrantLock(true);

    private final TransactionRepository transactionRepository;
    private final BalanceRepository balanceRepository;
    private final PlatformTransactionRepository platformTransactionRepository;
    private final PlatformBalanceRepository platformBalanceRepository;
    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final BigDecimal welcomeBonusEur;

    public AffiliateBonusService(TransactionRepository transactionRepository,
                                 BalanceRepository balanceRepository,
                                 PlatformTransactionRepository platformTransactionRepository,
                                 PlatformBalanceRepository platformBalanceRepository,
                                 ClientRepository clientRepository,
                                 UserRepository userRepository,
                                 @Value("${affiliate.welcome-bonus.amount-eur:10.00}") BigDecimal welcomeBonusEur) {
        this.transactionRepository = transactionRepository;
        this.balanceRepository = balanceRepository;
        this.platformTransactionRepository = platformTransactionRepository;
        this.platformBalanceRepository = platformBalanceRepository;
        this.clientRepository = clientRepository;
        this.userRepository = userRepository;
        this.welcomeBonusEur = welcomeBonusEur == null
                ? BigDecimal.ZERO
                : welcomeBonusEur.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Otorga el bono de bienvenida al cliente atribuido si es elegible.
     * Idempotente y silencioso: si ya se ha otorgado o si el bono esta
     * apagado (0 EUR), retorna sin efecto y con log info.
     *
     * @param clientUserId user id del cliente recien atribuido.
     * @param referrerModelUserId user id de la modelo referidora (informativo,
     *                            para la descripcion del ledger).
     * @return true si se otorgo el bono; false si se salto (idempotencia o off).
     */
    @Transactional
    public boolean grantWelcomeBonusIfEligible(Long clientUserId, Long referrerModelUserId) {
        if (clientUserId == null) {
            throw new IllegalArgumentException("clientUserId requerido");
        }
        if (welcomeBonusEur.compareTo(BigDecimal.ZERO) <= 0) {
            log.info("[AFFILIATE-BONUS] skipped clientUserId={} reason=bonus_disabled_zero_eur", clientUserId);
            return false;
        }
        if (transactionRepository.existsByUserIdAndOperationType(
                clientUserId, Constants.OperationTypes.REFERRAL_WELCOME_GRANT)) {
            log.info("[AFFILIATE-BONUS] skipped clientUserId={} reason=already_granted", clientUserId);
            return false;
        }

        User client = userRepository.findByIdForUpdate(clientUserId)
                .orElseThrow(() -> new IllegalStateException("client_not_found:" + clientUserId));

        BigDecimal lastBalance = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(clientUserId)
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);
        BigDecimal newClientBalance = lastBalance.add(welcomeBonusEur);
        String desc = "REFERRAL welcome_bonus clientUserId=" + clientUserId
                + " referrerModelUserId=" + referrerModelUserId;

        // 1) Transaction + Balance del cliente (GRANT positivo).
        Transaction txGrant = new Transaction();
        txGrant.setUser(client);
        txGrant.setAmount(welcomeBonusEur);
        txGrant.setOperationType(Constants.OperationTypes.REFERRAL_WELCOME_GRANT);
        txGrant.setDescription(desc);
        Transaction savedTxGrant = transactionRepository.save(txGrant);

        Balance balGrant = new Balance();
        balGrant.setUserId(clientUserId);
        balGrant.setTransactionId(savedTxGrant.getId());
        balGrant.setOperationType(Constants.OperationTypes.REFERRAL_WELCOME_GRANT);
        balGrant.setAmount(welcomeBonusEur);
        balGrant.setBalance(newClientBalance);
        balGrant.setDescription(desc);
        balanceRepository.save(balGrant);

        // 2) PlatformTransaction + PlatformBalance (FUNDING negativo).
        BigDecimal negated = welcomeBonusEur.negate();
        PlatformTransaction ptx = new PlatformTransaction();
        ptx.setAmount(negated);
        ptx.setOperationType(Constants.OperationTypes.REFERRAL_WELCOME_FUNDING);
        ptx.setDescription(desc);
        PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);

        appendPlatformBalance(savedPtx.getId(), negated, desc);

        // 3) Client.saldo_actual (upsert). El cliente puede no tener fila aun
        // si el registro no la crea; la creamos con saldo == bono.
        Optional<Client> existing = clientRepository.findByUser(client);
        Client c = existing.orElseGet(() -> {
            Client fresh = new Client();
            fresh.setUser(client);
            fresh.setSaldoActual(BigDecimal.ZERO);
            fresh.setTotalPagos(BigDecimal.ZERO);
            return fresh;
        });
        c.setSaldoActual(newClientBalance);
        clientRepository.save(c);

        log.info("[AFFILIATE-BONUS] granted clientUserId={} referrerModelUserId={} amountEur={} grantTxId={} fundingPtxId={}",
                clientUserId, referrerModelUserId, welcomeBonusEur,
                savedTxGrant.getId(), savedPtx.getId());
        return true;
    }

    private void appendPlatformBalance(Long transactionId, BigDecimal amount, String description) {
        platformLedgerLock.lock();
        try {
            BigDecimal previous = platformBalanceRepository.findTopByOrderByTimestampDescIdDesc()
                    .map(PlatformBalance::getBalance)
                    .orElse(BigDecimal.ZERO);
            BigDecimal newBalance = previous.add(amount);
            PlatformBalance pbal = new PlatformBalance();
            pbal.setTransactionId(transactionId);
            pbal.setAmount(amount);
            pbal.setBalance(newBalance);
            pbal.setDescription(description);
            platformBalanceRepository.save(pbal);
        } finally {
            platformLedgerLock.unlock();
        }
    }
}
