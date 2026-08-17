package com.sharemechat.service;

import com.sharemechat.config.BillingProperties;
import com.sharemechat.config.PromoProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.TransactionRequestDTO;
import com.sharemechat.entity.*;
import com.sharemechat.repository.*;
import com.sharemechat.support.entity.SupportTicket;
import com.sharemechat.support.repository.SupportTicketRepository;
import com.sharemechat.support.service.TicketService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class TransactionService {

    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);
    private final ReentrantLock platformLedgerLock = new ReentrantLock(true);

    private final TransactionRepository transactionRepository;
    private final BalanceRepository balanceRepository;
    private final ClientRepository clientRepository;
    private final ModelRepository modelRepository;
    private final UserRepository userRepository;
    private final GiftRepository giftRepository;
    private final StreamRecordRepository streamRecordRepository;
    private final PlatformTransactionRepository platformTransactionRepository;
    private final PlatformBalanceRepository platformBalanceRepository;

    // [NEW] payout_requests
    private final PayoutRequestRepository payoutRequestRepository;

    // ADR-054: solo se usa desde manualRefundToClient cuando el DTO trae
    // ticketId; sin ticketId el flujo es identico al pre-ADR-054.
    private final SupportTicketRepository supportTicketRepository;

    private final BillingProperties billing;
    // ADR-056 revision 2026-08-01: giftProperties.modelShare eliminada.
    // Los gifts ahora aplican el mismo motor de tramos que streams
    // (ModelTierService), unificando el reparto Master↔Modelo. La property
    // gift.model-share=0.90 se retiro tambien de application.properties.
    private final ModelTierService modelTierService;
    private final EmailVerificationService emailVerificationService;
    private final ClientKycGate clientKycGate;

    // Promo de bienvenida "100 primeros clientes" (BFPM ADR-012). Cupo
    // atómico via promoGrantCounterRepository; config via promoProperties.
    private final PromoProperties promoProperties;
    private final PromoGrantCounterRepository promoGrantCounterRepository;

    public TransactionService(
            TransactionRepository transactionRepository,
            BalanceRepository balanceRepository,
            ClientRepository clientRepository,
            ModelRepository modelRepository,
            UserRepository userRepository,
            GiftRepository giftRepository,
            StreamRecordRepository streamRecordRepository,
            PlatformTransactionRepository platformTransactionRepository,
            PlatformBalanceRepository platformBalanceRepository,
            PayoutRequestRepository payoutRequestRepository,
            SupportTicketRepository supportTicketRepository,
            BillingProperties billing,
            ModelTierService modelTierService,
            EmailVerificationService emailVerificationService,
            ClientKycGate clientKycGate,
            PromoProperties promoProperties,
            PromoGrantCounterRepository promoGrantCounterRepository
    ) {
        this.transactionRepository = transactionRepository;
        this.balanceRepository = balanceRepository;
        this.clientRepository = clientRepository;
        this.modelRepository = modelRepository;
        this.userRepository = userRepository;
        this.giftRepository = giftRepository;
        this.streamRecordRepository = streamRecordRepository;
        this.platformTransactionRepository = platformTransactionRepository;
        this.platformBalanceRepository = platformBalanceRepository;
        this.payoutRequestRepository = payoutRequestRepository;
        this.supportTicketRepository = supportTicketRepository;
        this.billing = billing;
        this.modelTierService = modelTierService;
        this.emailVerificationService = emailVerificationService;
        this.clientKycGate = clientKycGate;
        this.promoProperties = promoProperties;
        this.promoGrantCounterRepository = promoGrantCounterRepository;
    }

    /**
     * LOCK wallet industrial:
     * - Serializa por usuario antes de leer "ultimo balance" y escribir ledger.
     * - Para regalos, lock de 2 usuarios en orden fijo (minId -> maxId) para evitar deadlocks.
     */
    private User lockUserOrThrow(Long userId) {
        return userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + userId));
    }

    private void lockUsersInOrder(Long a, Long b) {
        if (a == null || b == null) throw new IllegalArgumentException("userId nulo");
        long min = Math.min(a, b);
        long max = Math.max(a, b);
        log.debug("processGift: locking wallets minUserId={} maxUserId={}", min, max);
        lockUserOrThrow(min);
        if (max != min) lockUserOrThrow(max);
    }

    private BigDecimal lastBalanceOf(Long userId) {
        BigDecimal balance = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(userId)
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);
        log.debug("processGift: lastBalanceOf userId={} balance={}", userId, balance);
        return balance;
    }

    private BigDecimal appendPlatformBalance(Long transactionId, BigDecimal amount, String description) {
        platformLedgerLock.lock();
        try {
            BigDecimal previousBalance = platformBalanceRepository.findTopByOrderByTimestampDescIdDesc()
                    .map(PlatformBalance::getBalance)
                    .orElse(BigDecimal.ZERO);
            BigDecimal newBalance = previousBalance.add(amount);

            PlatformBalance pbal = new PlatformBalance();
            pbal.setTransactionId(transactionId);
            pbal.setAmount(amount);
            pbal.setBalance(newBalance);
            pbal.setDescription(description);
            platformBalanceRepository.save(pbal);

            return newBalance;
        } finally {
            platformLedgerLock.unlock();
        }
    }

    /**
     * PRIMER PAGO (atomicidad total, 4 mapeos):
     * 1) transactions (inmutable)
     * 2) balances (inmutable)
     * 3) clients (mutable, upsert saldo_actual/total_pagos)
     * 4) users.role: USER -> CLIENT (unidireccional; no se revierte)
     *
     * Reglas:
     * - Debe venir con operationType = "INGRESO"
     * - amount > 0
     * - Consistencia: ultimo balance == clients.saldo_actual (si existe fila clients)
     */
    @Transactional
    public void processFirstTransaction(Long userId, TransactionRequestDTO request) {
        User user = lockUserOrThrow(userId);

        if (!Constants.Roles.USER.equals(user.getRole())) {
            throw new IllegalArgumentException("El usuario ya es CLIENT o MODEL");
        }
        if (!Constants.UserTypes.FORM_CLIENT.equals(user.getUserType())) {
            throw new IllegalArgumentException("Solo USER + FORM_CLIENT puede activar premium con primer pago");
        }
        if (request == null) {
            throw new IllegalArgumentException("Body requerido");
        }
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }

        final String op = (request.getOperationType() == null) ? "INGRESO" : request.getOperationType().toUpperCase();
        if (!"INGRESO".equals(op)) {
            throw new IllegalArgumentException("Para el primer pago, operationType debe ser INGRESO");
        }

        // Gate de email: garantizado por EmailVerifiedFilter (frente
        // "Email verification gate total" 2026-06-15). Antes habia un
        // assertEmailVerified inline aqui; ahora lo cubre el filter global
        // para TODOS los endpoints autenticados, no solo /first.

        // Gate KYC cliente (ADR-029/-035): edad verificada con Didit antes
        // del primer pago. Lanza ClientKycRequiredException -> 403 con
        // code=CLIENT_KYC_REQUIRED. Este gate sigue siendo especifico del
        // flujo de pago, no global.
        clientKycGate.assertClientKycApproved(user);

        BigDecimal lastBalance = lastBalanceOf(userId);

        Optional<Client> existingClientOpt = clientRepository.findByUser(user);
        if (existingClientOpt.isPresent()) {
            BigDecimal currentSaldo = existingClientOpt.get().getSaldoActual();
            if (currentSaldo != null && currentSaldo.compareTo(lastBalance) != 0) {
                throw new IllegalStateException(
                        "Inconsistencia: saldo_actual (" + currentSaldo + ") != ultimo balance (" + lastBalance + ")"
                );
            }
        }

        BigDecimal newBalance = lastBalance.add(request.getAmount());

        Transaction tx = new Transaction();
        tx.setUser(user);
        tx.setAmount(request.getAmount());
        tx.setOperationType(op);
        tx.setDescription(request.getDescription());
        Transaction savedTx = transactionRepository.save(tx);

        Balance bal = new Balance();
        bal.setUserId(userId);
        bal.setTransactionId(savedTx.getId());
        bal.setOperationType(op);
        bal.setAmount(request.getAmount());
        bal.setBalance(newBalance);
        bal.setDescription(request.getDescription());
        balanceRepository.save(bal);

        Client client = existingClientOpt.orElseGet(() -> {
            Client c = new Client();
            c.setUser(user);
            c.setSaldoActual(BigDecimal.ZERO);
            c.setTotalPagos(BigDecimal.ZERO);
            return c;
        });
        client.setSaldoActual(newBalance);
        client.setTotalPagos((client.getTotalPagos() == null ? BigDecimal.ZERO : client.getTotalPagos()).add(request.getAmount()));
        clientRepository.save(client);

        user.setRole(Constants.Roles.CLIENT);
        userRepository.save(user);
    }

    /**
     * BFPM Fase 4A (ADR-012). Acredita una compra de pack con posible bonus financiado por la plataforma.
     *
     * Atómico (@Transactional). Realiza, en orden:
     *  1) INGRESO cliente por priceEur (Transaction + Balance).
     *  2) BONUS_GRANT cliente por bonusEur (Transaction + Balance), solo si bonusEur > 0.
     *  3) BONUS_FUNDING plataforma por -bonusEur (PlatformTransaction + PlatformBalance), solo si bonusEur > 0.
     *  4) clients.saldo_actual = lastBalance + priceEur + bonusEur.
     *  5) clients.total_pagos += priceEur (NO suma bonusEur).
     *  6) Si firstPayment, promueve user.role USER -> CLIENT.
     *
     * Si bonusEur == 0, equivale a una recarga simple sin asientos de bonus.
     * Si bonusEur < 0, lanza IllegalStateException (catálogo inconsistente).
     *
     * Trazabilidad sin schema: la pareja BONUS_GRANT (cliente) ↔ BONUS_FUNDING (plataforma)
     * se empareja por la descripción estructurada con pack_id y order_id.
     *
     * No reemplaza a processFirstTransaction ni addBalance: aquellos siguen sirviendo
     * a los endpoints directos /api/transactions/first y /api/transactions/add-balance,
     * que en BFPM Fase 4A no aplican bonus.
     */
    @Transactional
    public void creditPackWithBonus(Long userId,
                                    BigDecimal priceEur,
                                    BigDecimal bonusEur,
                                    String orderId,
                                    String packId,
                                    boolean firstPayment,
                                    String providerKey) {
        if (userId == null) {
            throw new IllegalArgumentException("userId requerido");
        }
        if (priceEur == null || priceEur.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("priceEur debe ser mayor que cero");
        }
        if (bonusEur == null) {
            throw new IllegalArgumentException("bonusEur requerido (use 0 si no aplica)");
        }
        if (bonusEur.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalStateException("Catálogo inconsistente: bonusEur < 0 para pack=" + packId);
        }

        BigDecimal priceEurScaled = priceEur.setScale(2, RoundingMode.HALF_UP);
        BigDecimal bonusEurScaled = bonusEur.setScale(2, RoundingMode.HALF_UP);

        User user = lockUserOrThrow(userId);

        if (firstPayment) {
            if (!Constants.Roles.USER.equals(user.getRole())) {
                throw new IllegalArgumentException("El usuario ya es CLIENT o MODEL");
            }
            if (!Constants.UserTypes.FORM_CLIENT.equals(user.getUserType())) {
                throw new IllegalArgumentException("Solo USER + FORM_CLIENT puede activar premium con primer pago");
            }
            // Gate de email cubierto por EmailVerifiedFilter (filter global).
        } else {
            if (!Constants.Roles.CLIENT.equals(user.getRole())) {
                throw new IllegalArgumentException("El usuario debe ser CLIENT para recargar saldo");
            }
        }

        BigDecimal lastBalance = lastBalanceOf(userId);

        Optional<Client> existingClientOpt = clientRepository.findByUser(user);
        if (existingClientOpt.isPresent()) {
            BigDecimal currentSaldo = existingClientOpt.get().getSaldoActual();
            if (currentSaldo != null && currentSaldo.compareTo(lastBalance) != 0) {
                throw new IllegalStateException(
                        "Inconsistencia: saldo_actual (" + currentSaldo + ") != ultimo balance (" + lastBalance + ")"
                );
            }
        }

        // Descripciones estructuradas para trazabilidad sin schema.
        // 2026-07-16 (ADR-051 D9): providerKey parametrizado (antes hardcoded 'CCBILL').
        // Si no se pasa, fallback a 'UNKNOWN' para no ocultar el bug de un caller.
        String safePackId = packId == null ? "" : packId;
        String safeOrderId = orderId == null ? "" : orderId;
        String safeProvider = (providerKey == null || providerKey.isBlank())
                ? "UNKNOWN" : providerKey.toUpperCase();
        String descIngreso = "Recarga via " + safeProvider + " pack=" + safePackId + " order=" + safeOrderId;
        String descBonusGrant = "BFPM bonus_grant pack=" + safePackId + " order=" + safeOrderId;
        String descBonusFunding = "BFPM bonus_funding pack=" + safePackId + " order=" + safeOrderId;

        // 1) INGRESO cliente
        BigDecimal balanceAfterIngreso = lastBalance.add(priceEurScaled);

        Transaction txIngreso = new Transaction();
        txIngreso.setUser(user);
        txIngreso.setAmount(priceEurScaled);
        txIngreso.setOperationType("INGRESO");
        txIngreso.setDescription(descIngreso);
        Transaction savedTxIngreso = transactionRepository.save(txIngreso);

        Balance balIngreso = new Balance();
        balIngreso.setUserId(userId);
        balIngreso.setTransactionId(savedTxIngreso.getId());
        balIngreso.setOperationType("INGRESO");
        balIngreso.setAmount(priceEurScaled);
        balIngreso.setBalance(balanceAfterIngreso);
        balIngreso.setDescription(descIngreso);
        balanceRepository.save(balIngreso);

        BigDecimal finalClientBalance = balanceAfterIngreso;

        // 2) BONUS_GRANT cliente y 3) BONUS_FUNDING plataforma — solo si bonus > 0
        if (bonusEurScaled.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal balanceAfterBonus = balanceAfterIngreso.add(bonusEurScaled);

            Transaction txBonus = new Transaction();
            txBonus.setUser(user);
            txBonus.setAmount(bonusEurScaled);
            txBonus.setOperationType(Constants.OperationTypes.BONUS_GRANT);
            txBonus.setDescription(descBonusGrant);
            Transaction savedTxBonus = transactionRepository.save(txBonus);

            Balance balBonus = new Balance();
            balBonus.setUserId(userId);
            balBonus.setTransactionId(savedTxBonus.getId());
            balBonus.setOperationType(Constants.OperationTypes.BONUS_GRANT);
            balBonus.setAmount(bonusEurScaled);
            balBonus.setBalance(balanceAfterBonus);
            balBonus.setDescription(descBonusGrant);
            balanceRepository.save(balBonus);

            finalClientBalance = balanceAfterBonus;

            // Plataforma: PlatformTransaction(BONUS_FUNDING, -bonusEur) + PlatformBalance vía helper
            BigDecimal bonusEurNegated = bonusEurScaled.negate();

            PlatformTransaction ptx = new PlatformTransaction();
            ptx.setAmount(bonusEurNegated);
            ptx.setOperationType(Constants.OperationTypes.BONUS_FUNDING);
            ptx.setDescription(descBonusFunding);
            PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);

            appendPlatformBalance(savedPtx.getId(), bonusEurNegated, descBonusFunding);

            log.info("[BFPM] bonus_grant userId={} pack={} order={} priceEur={} bonusEur={} bonusGrantTxId={} bonusFundingPtxId={}",
                    userId, safePackId, safeOrderId, priceEurScaled, bonusEurScaled,
                    savedTxBonus.getId(), savedPtx.getId());
        } else {
            log.info("[BFPM] no_bonus userId={} pack={} order={} priceEur={}",
                    userId, safePackId, safeOrderId, priceEurScaled);
        }

        // 3-bis) Bono promo "100 primeros clientes" (welcome), BFPM ADR-012.
        // Solo en primer pago y mientras quede cupo global (< cap). El cupo es
        // race-safe: UPDATE condicional atómico (1 fila = hueco reservado).
        // Va en esta misma @Transactional, así que revierte con la recarga.
        // total_pagos NO incluye este bono (igual que el pack-bonus).
        if (firstPayment
                && promoProperties.isEnabled()
                && promoProperties.getAmountEur() != null
                && promoProperties.getAmountEur().compareTo(BigDecimal.ZERO) > 0) {
            int reserved = promoGrantCounterRepository.tryIncrement(
                    promoProperties.getPromoKey(), promoProperties.getCap());
            if (reserved == 1) {
                BigDecimal promoAmount = promoProperties.getAmountEur().setScale(2, RoundingMode.HALF_UP);
                String descPromoGrant = "BFPM bonus_grant promo=welcome100 order=" + safeOrderId;
                String descPromoFunding = "BFPM bonus_funding promo=welcome100 order=" + safeOrderId;
                BigDecimal balanceAfterPromo = finalClientBalance.add(promoAmount);

                Transaction txPromo = new Transaction();
                txPromo.setUser(user);
                txPromo.setAmount(promoAmount);
                txPromo.setOperationType(Constants.OperationTypes.BONUS_GRANT);
                txPromo.setDescription(descPromoGrant);
                Transaction savedTxPromo = transactionRepository.save(txPromo);

                Balance balPromo = new Balance();
                balPromo.setUserId(userId);
                balPromo.setTransactionId(savedTxPromo.getId());
                balPromo.setOperationType(Constants.OperationTypes.BONUS_GRANT);
                balPromo.setAmount(promoAmount);
                balPromo.setBalance(balanceAfterPromo);
                balPromo.setDescription(descPromoGrant);
                balanceRepository.save(balPromo);

                finalClientBalance = balanceAfterPromo;

                BigDecimal promoNegated = promoAmount.negate();
                PlatformTransaction ptxPromo = new PlatformTransaction();
                ptxPromo.setAmount(promoNegated);
                ptxPromo.setOperationType(Constants.OperationTypes.BONUS_FUNDING);
                ptxPromo.setDescription(descPromoFunding);
                PlatformTransaction savedPtxPromo = platformTransactionRepository.save(ptxPromo);
                appendPlatformBalance(savedPtxPromo.getId(), promoNegated, descPromoFunding);

                log.info("[PROMO-WELCOME] grant userId={} order={} amountEur={} bonusGrantTxId={} bonusFundingPtxId={}",
                        userId, safeOrderId, promoAmount, savedTxPromo.getId(), savedPtxPromo.getId());
            } else {
                log.info("[PROMO-WELCOME] cap_reached userId={} order={} cap={}",
                        userId, safeOrderId, promoProperties.getCap());
            }
        }

        // 4) clients.saldo_actual y 5) clients.total_pagos += priceEur (NO bonus)
        Client client = existingClientOpt.orElseGet(() -> {
            Client c = new Client();
            c.setUser(user);
            c.setSaldoActual(BigDecimal.ZERO);
            c.setTotalPagos(BigDecimal.ZERO);
            return c;
        });
        client.setSaldoActual(finalClientBalance);
        BigDecimal currentTotalPagos = client.getTotalPagos() == null ? BigDecimal.ZERO : client.getTotalPagos();
        client.setTotalPagos(currentTotalPagos.add(priceEurScaled));
        clientRepository.save(client);

        // 6) Promoción USER -> CLIENT solo en firstPayment
        if (firstPayment) {
            user.setRole(Constants.Roles.CLIENT);
            userRepository.save(user);
        }
    }

    @Transactional
    public void addBalance(Long userId, TransactionRequestDTO request) {
        User user = lockUserOrThrow(userId);

        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            throw new IllegalArgumentException("El usuario debe ser CLIENT");
        }

        // Gate KYC cliente (ADR-029/-035): recarga tambien bloqueada si
        // client_kyc_status revoca o expira en el futuro. El check se
        // ejecuta despues del role check para no leakear estado KYC a
        // usuarios que ni siquiera son CLIENT.
        clientKycGate.assertClientKycApproved(user);

        if (request == null) {
            throw new IllegalArgumentException("Body requerido");
        }
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }

        final String op = (request.getOperationType() == null) ? "INGRESO" : request.getOperationType().toUpperCase();
        if (!"INGRESO".equals(op) && !"GASTO".equals(op)) {
            throw new IllegalArgumentException("operationType no soportado: " + op);
        }

        BigDecimal lastBalance = lastBalanceOf(userId);

        Client client = clientRepository.findByUser(user)
                .orElseThrow(() -> new IllegalStateException("Cliente no encontrado para el usuario " + userId));

        BigDecimal saldoActual = client.getSaldoActual() == null ? BigDecimal.ZERO : client.getSaldoActual();
        if (saldoActual.compareTo(lastBalance) != 0) {
            throw new IllegalStateException("Inconsistencia: saldo_actual (" + saldoActual + ") != ultimo balance (" + lastBalance + ")");
        }

        BigDecimal signedAmount;
        BigDecimal newBalance;
        if ("INGRESO".equals(op)) {
            signedAmount = request.getAmount();
            newBalance = lastBalance.add(request.getAmount());
        } else {
            signedAmount = request.getAmount().negate();
            newBalance = lastBalance.subtract(request.getAmount());
            if (newBalance.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Saldo insuficiente");
            }
        }

        Transaction tx = new Transaction();
        tx.setUser(user);
        tx.setAmount(signedAmount);
        tx.setOperationType(op);
        tx.setDescription(request.getDescription());
        Transaction savedTx = transactionRepository.save(tx);

        Balance bal = new Balance();
        bal.setUserId(userId);
        bal.setTransactionId(savedTx.getId());
        bal.setOperationType(op);
        bal.setAmount(signedAmount);
        bal.setBalance(newBalance);
        bal.setDescription(request.getDescription());
        balanceRepository.save(bal);

        client.setSaldoActual(newBalance);
        if ("INGRESO".equals(op)) {
            BigDecimal totalPagos = client.getTotalPagos() == null ? BigDecimal.ZERO : client.getTotalPagos();
            client.setTotalPagos(totalPagos.add(request.getAmount()));
        }
        clientRepository.save(client);
    }

    @Transactional
    public void requestPayout(Long userId, TransactionRequestDTO request) {
        User user = lockUserOrThrow(userId);

        if (request == null) {
            throw new IllegalArgumentException("Body requerido");
        }
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }

        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            throw new IllegalArgumentException("El usuario debe tener rol MODEL para solicitar un retiro");
        }

        Model model = modelRepository.findByUser(user)
                .orElseThrow(() -> new IllegalStateException("No existe registro de modelo para el usuario: " + userId));

        BigDecimal amountAbs = request.getAmount().setScale(2, RoundingMode.HALF_UP);
        if (amountAbs.compareTo(new BigDecimal("50.00")) < 0) {
            throw new IllegalArgumentException("El retiro mínimo es de 50 EUR");
        }

        if (amountAbs.compareTo(new BigDecimal("1000.00")) > 0) {
            throw new IllegalArgumentException("El retiro máximo por solicitud es de 1000 EUR");
        }
        BigDecimal previousBalance = lastBalanceOf(userId);

        BigDecimal saldoCache = model.getSaldoActual() == null ? BigDecimal.ZERO : model.getSaldoActual();
        if (saldoCache.compareTo(previousBalance) != 0) {
            throw new IllegalStateException(
                    "Inconsistencia detectada: ultimo balance (" + previousBalance + ") != models.saldo_actual (" + saldoCache + ")"
            );
        }

        if (previousBalance.compareTo(amountAbs) < 0) {
            throw new IllegalArgumentException("Saldo insuficiente para completar el retiro");
        }

        PayoutRequest pr = new PayoutRequest();
        pr.setModelUserId(userId);
        pr.setAmount(amountAbs);
        pr.setCurrency("EUR");
        pr.setStatus("REQUESTED");
        pr.setReason(request.getDescription());
        PayoutRequest savedPr = payoutRequestRepository.save(pr);

        BigDecimal signedAmount = amountAbs.negate();

        Transaction tx = new Transaction();
        tx.setUser(user);
        tx.setAmount(signedAmount);
        tx.setOperationType("PAYOUT_REQUEST");
        tx.setDescription("Payout request #" + savedPr.getId());
        Transaction savedTx = transactionRepository.save(tx);

        BigDecimal newBalance = previousBalance.add(signedAmount);

        Balance b = new Balance();
        b.setUserId(userId);
        b.setTransactionId(savedTx.getId());
        b.setOperationType("PAYOUT_REQUEST");
        b.setAmount(signedAmount);
        b.setBalance(newBalance);
        b.setDescription("Payout request #" + savedPr.getId());
        balanceRepository.save(b);

        model.setSaldoActual(newBalance);
        modelRepository.save(model);
    }

    @Transactional
    public PayoutRequest adminReviewPayoutRequest(Long payoutRequestId, Long adminId, String newStatus, String adminNotes) {
        if (payoutRequestId == null || payoutRequestId <= 0) {
            throw new IllegalArgumentException("payoutRequestId invalido");
        }
        if (adminId == null || adminId <= 0) {
            throw new IllegalArgumentException("adminId invalido");
        }
        if (newStatus == null || newStatus.isBlank()) {
            throw new IllegalArgumentException("status requerido");
        }

        final String target = newStatus.trim().toUpperCase(Locale.ROOT);

        if (!"REQUESTED".equals(target)
                && !"APPROVED".equals(target)
                && !"REJECTED".equals(target)
                && !"PAID".equals(target)
                && !"CANCELED".equals(target)) {
            throw new IllegalArgumentException("status no valido: " + newStatus);
        }

        PayoutRequest pr = payoutRequestRepository.findByIdForUpdate(payoutRequestId)
                .orElseThrow(() -> new IllegalArgumentException("PayoutRequest no encontrada: " + payoutRequestId));

        final String current = (pr.getStatus() == null ? "REQUESTED" : pr.getStatus().trim().toUpperCase(Locale.ROOT));

        if ("REJECTED".equals(current) || "CANCELED".equals(current) || "PAID".equals(current)) {
            throw new IllegalStateException("PayoutRequest en estado terminal: " + current);
        }

        if ("REQUESTED".equals(current)) {
            if (!"APPROVED".equals(target) && !"REJECTED".equals(target) && !"CANCELED".equals(target)) {
                throw new IllegalStateException("Transicion no permitida: " + current + " -> " + target);
            }
        } else if ("APPROVED".equals(current)) {
            if (!"PAID".equals(target) && !"REJECTED".equals(target) && !"CANCELED".equals(target)) {
                throw new IllegalStateException("Transicion no permitida: " + current + " -> " + target);
            }
        }

        Long modelUserId = pr.getModelUserId();
        if (modelUserId == null || modelUserId <= 0) {
            throw new IllegalStateException("modelUserId invalido en payout_request");
        }
        User modelUser = lockUserOrThrow(modelUserId);

        if (!Constants.Roles.MODEL.equals(modelUser.getRole())) {
            throw new IllegalStateException("El usuario no es MODEL: " + modelUserId);
        }

        Model model = modelRepository.findByUser(modelUser)
                .orElseThrow(() -> new IllegalStateException("No existe registro de modelo para userId=" + modelUserId));

        if ("REJECTED".equals(target) || "CANCELED".equals(target)) {
            BigDecimal amountAbs = pr.getAmount() == null ? BigDecimal.ZERO : pr.getAmount().setScale(2, RoundingMode.HALF_UP);
            if (amountAbs.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalStateException("Amount invalido en payout_request: " + pr.getAmount());
            }

            BigDecimal previousBalance = lastBalanceOf(modelUserId);

            BigDecimal saldoCache = model.getSaldoActual() == null ? BigDecimal.ZERO : model.getSaldoActual();
            if (saldoCache.compareTo(previousBalance) != 0) {
                throw new IllegalStateException(
                        "Inconsistencia MODEL: ultimo balance (" + previousBalance + ") != models.saldo_actual (" + saldoCache + ")"
                );
            }

            BigDecimal signedAmount = amountAbs;

            Transaction tx = new Transaction();
            tx.setUser(modelUser);
            tx.setAmount(signedAmount);
            tx.setOperationType("PAYOUT_REQUEST_REVERT");
            tx.setDescription("Revert payout request #" + pr.getId());
            Transaction savedTx = transactionRepository.save(tx);

            BigDecimal newBalance = previousBalance.add(signedAmount);

            Balance bal = new Balance();
            bal.setUserId(modelUserId);
            bal.setTransactionId(savedTx.getId());
            bal.setOperationType("PAYOUT_REQUEST_REVERT");
            bal.setAmount(signedAmount);
            bal.setBalance(newBalance);
            bal.setDescription("Revert payout request #" + pr.getId());
            balanceRepository.save(bal);

            model.setSaldoActual(newBalance);
            modelRepository.save(model);
        }

        pr.setStatus(target);
        pr.setAdminNotes(adminNotes);
        pr.setReviewedByUserId(adminId);
        pr.setReviewedAt(LocalDateTime.now());

        return payoutRequestRepository.save(pr);
    }

    @Transactional
    public Gift processGift(Long clientId, Long modelId, Long giftId, Long streamIdOrNull) {
        Gift gift = resolveSendableGift(giftId);
        if (streamIdOrNull != null) {
            requireConfirmedGiftStream(clientId, modelId, streamIdOrNull);
        }
        return processGiftInternal(clientId, modelId, gift, streamIdOrNull, true);
    }

    private StreamRecord requireConfirmedGiftStream(Long clientId, Long modelId, Long streamId) {
        if (streamId == null || streamId <= 0) {
            throw new IllegalArgumentException("Sesion invalida para enviar el regalo");
        }

        StreamRecord stream = streamRecordRepository.findById(streamId)
                .orElseThrow(() -> new IllegalArgumentException("Sesion no encontrada para enviar el regalo"));

        if (stream.getEndTime() != null) {
            throw new IllegalArgumentException("La sesion ya no esta activa para enviar regalos");
        }
        if (stream.getConfirmedAt() == null) {
            throw new IllegalArgumentException("No se pueden enviar regalos de pago sin sesion confirmada");
        }

        Long streamClientId = stream.getClient() != null ? stream.getClient().getId() : null;
        Long streamModelId = stream.getModel() != null ? stream.getModel().getId() : null;
        if (!clientId.equals(streamClientId) || !modelId.equals(streamModelId)) {
            throw new IllegalArgumentException("La sesion no corresponde al par del regalo");
        }

        return stream;
    }

    private Gift resolveSendableGift(Long giftId) {
        Gift gift = giftRepository.findByIdAndActiveTrue(giftId)
                .orElseThrow(() -> {
                    boolean exists = giftRepository.existsById(giftId);
                    return new IllegalArgumentException(exists
                            ? "Gift no enviable: inactive id=" + giftId
                            : "Gift inexistente: " + giftId);
                });

        BigDecimal rawCost = gift.getCost();
        if (rawCost == null) {
            throw new IllegalArgumentException("Gift no enviable: cost nulo id=" + giftId);
        }

        BigDecimal cost = rawCost.setScale(2, RoundingMode.HALF_UP);
        if (cost.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Gift no enviable: cost invalido id=" + giftId);
        }
        gift.setCost(cost);
        return gift;
    }

    private Gift processGiftInternal(Long clientId, Long modelId, Gift gift, Long streamIdOrNull, boolean enableRandomFallback) {
        Long giftId = gift.getId();
        log.info("processGift: start clientId={} modelId={} giftId={} streamIdOrNull={} enableRandomFallback={}",
                clientId, modelId, giftId, streamIdOrNull, enableRandomFallback);
        log.info("gift_tx_begin actorUserId={} peerUserId={} giftId={} streamRecordId={} enableRandomFallback={}",
                clientId, modelId, giftId, streamIdOrNull, enableRandomFallback);

        lockUsersInOrder(clientId, modelId);

        User clientUser = userRepository.findById(clientId)
                .orElseThrow(() -> new IllegalArgumentException("Cliente no encontrado: " + clientId));
        log.debug("processGift: loaded client userId={} role={}", clientId, clientUser.getRole());
        if (!Constants.Roles.CLIENT.equals(clientUser.getRole())) {
            throw new IllegalArgumentException("El remitente debe ser CLIENT");
        }

        User modelUser = userRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Modelo no encontrado: " + modelId));
        log.debug("processGift: loaded model userId={} role={}", modelId, modelUser.getRole());
        if (!Constants.Roles.MODEL.equals(modelUser.getRole())) {
            throw new IllegalArgumentException("El destinatario debe ser MODEL");
        }

        BigDecimal cost = gift.getCost();
        log.debug("processGift: loaded gift id={} name={} cost={}", gift.getId(), gift.getName(), cost);

        Client client = clientRepository.findByUser(clientUser)
                .orElseThrow(() -> new IllegalStateException("Cliente no encontrado para userId=" + clientId));
        log.debug("processGift: loaded client entity userId={} saldoActual={}", clientId, client.getSaldoActual());

        BigDecimal lastClientBalance = lastBalanceOf(clientId);

        BigDecimal clientSaldoCache = client.getSaldoActual() == null ? BigDecimal.ZERO : client.getSaldoActual();
        log.debug("processGift: validating client balances clientId={} ledgerBalance={} saldoCache={}",
                clientId, lastClientBalance, clientSaldoCache);
        if (clientSaldoCache.compareTo(BigDecimal.ZERO) > 0 && lastClientBalance.compareTo(clientSaldoCache) != 0) {
            throw new IllegalStateException(
                    "Inconsistencia CLIENT: ultimo balance (" + lastClientBalance + ") != clients.saldo_actual (" + clientSaldoCache + ")"
            );
        }

        log.debug("processGift: validating funds clientId={} cost={} balance={}", clientId, cost, lastClientBalance);
        if (lastClientBalance.compareTo(cost) < 0) {
            throw new IllegalArgumentException("Saldo insuficiente para enviar el regalo");
        }

        Model model = modelRepository.findByUser(modelUser)
                .orElseGet(() -> {
                    Model m = new Model();
                    m.setUser(modelUser);
                    m.setUserId(modelId);
                    return m;
                });
        log.debug("processGift: loaded model entity userId={} saldoActual={} totalIngresos={}",
                modelId, model.getSaldoActual(), model.getTotalIngresos());

        // ADR-056 revision 2026-08-01: los gifts pasan a aplicar el mismo
        // motor de tramos que streams (ModelTierService). Antes iba con
        // share fijo giftProperties.modelShare=0.90; ahora respeta el
        // tramo INDIVIDUAL o MASTER T1-T4 vigente para la modelo.
        // Gifts NO cuentan para determinar el tramo (level-independent
        // income segun LiveJasmin/estandar sector) — solo lo consumen.
        com.sharemechat.entity.ModelPricingTier giftTier = null;
        try {
            giftTier = modelTierService.resolveEffectiveTierForPayout(modelId);
        } catch (Exception ex) {
            log.warn("processGift: error resolviendo tier modelId={} -> {}",
                    modelId, ex.getMessage());
        }
        BigDecimal modelEarning;
        if (giftTier == null || giftTier.getModelSharePct() == null) {
            // Sin tramo resoluble: no repartir a modelo (defensive).
            // La plataforma se queda todo. Log warning para investigar.
            modelEarning = BigDecimal.ZERO;
            log.warn("processGift: no tier resolvable modelId={} giftId={} — modelEarning=0",
                    modelId, giftId);
        } else {
            modelEarning = cost.multiply(giftTier.getModelSharePct())
                    .divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP)
                    .setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal platformEarning = cost.subtract(modelEarning).setScale(2, RoundingMode.HALF_UP);
        if (platformEarning.compareTo(BigDecimal.ZERO) < 0) {
            // defensive: nunca margen negativo
            platformEarning = BigDecimal.ZERO;
            modelEarning = cost;
        }
        log.debug("processGift: split giftId={} tierCode={} tierPct={} modelEarning={} platformEarning={}",
                giftId,
                giftTier != null ? giftTier.getTierCode() : "-",
                giftTier != null ? giftTier.getModelSharePct() : "-",
                modelEarning, platformEarning);

        // ADR-056 D4: si la modelo tiene master_user_id, el modelEarning
        // se atribuye al MASTER (mismo patron StreamService.endSession).
        // Model.saldoActual/totalIngresos NO se tocan cuando hay Master.
        // La modelo cobra off-platform del Master segun master_model_splits.
        Long masterUserIdOfModel = model.getMasterUserId();
        Long earningRecipientId;
        User earningRecipient;
        if (masterUserIdOfModel != null) {
            earningRecipientId = masterUserIdOfModel;
            earningRecipient = userRepository.findById(masterUserIdOfModel)
                    .orElseThrow(() -> new IllegalStateException(
                            "Master no encontrado para modelId=" + modelId
                                    + " masterUserId=" + masterUserIdOfModel));
        } else {
            earningRecipientId = modelId;
            earningRecipient = modelUser;
        }
        BigDecimal lastRecipientBalance = lastBalanceOf(earningRecipientId);

        StreamRecord stream = null;

        if (streamIdOrNull != null) {
            stream = streamRecordRepository.findById(streamIdOrNull).orElse(null);
        } else if (enableRandomFallback) {
            log.debug("processGift: streamIdOrNull is null, activating RANDOM DB fallback clientId={} modelId={}", clientId, modelId);
            stream = streamRecordRepository
                    .findTopByClient_IdAndModel_IdAndStreamTypeAndConfirmedAtIsNotNullAndEndTimeIsNullOrderByStartTimeDesc(
                            clientId,
                            modelId,
                            Constants.StreamTypes.RANDOM
                    )
                    .orElse(null);

            if (stream != null) {
                log.debug("processGift: RANDOM DB fallback found streamId={} clientId={} modelId={}",
                        stream.getId(), clientId, modelId);
            } else {
                log.debug("processGift: RANDOM DB fallback found no active confirmed stream clientId={} modelId={}",
                        clientId, modelId);
            }
        }

        log.info("processGift: resolved stream streamIdOrNull={} foundStreamId={}",
                streamIdOrNull, stream != null ? stream.getId() : null);

        Transaction txClient = new Transaction();
        txClient.setUser(clientUser);
        txClient.setAmount(cost.negate());
        txClient.setOperationType("GIFT_SEND");
        txClient.setStreamRecord(stream);
        txClient.setGift(gift);
        txClient.setDescription("Regalo: " + gift.getName());
        Transaction savedTxClient = transactionRepository.save(txClient);
        log.debug("processGift: saved client transaction txId={} amount={} op={}",
                savedTxClient.getId(), txClient.getAmount(), txClient.getOperationType());

        BigDecimal newClientBalance = lastClientBalance.subtract(cost);

        Balance balClient = new Balance();
        balClient.setUserId(clientId);
        balClient.setTransactionId(savedTxClient.getId());
        balClient.setOperationType("GIFT_SEND");
        balClient.setAmount(cost.negate());
        balClient.setBalance(newClientBalance);
        balClient.setDescription("Regalo enviado: " + gift.getName());
        balanceRepository.save(balClient);
        log.debug("processGift: saved client balance userId={} newBalance={}", clientId, newClientBalance);

        client.setSaldoActual(newClientBalance);
        clientRepository.save(client);
        log.debug("processGift: updated client cache userId={} saldoActual={}", clientId, client.getSaldoActual());

        // Transaction GIFT_EARNING atribuida al recipient (Master si
        // masterUserIdOfModel != null; modelo si es individual). Igual
        // patron que StreamService.endSession.
        Transaction txModel = new Transaction();
        txModel.setUser(earningRecipient);
        txModel.setAmount(modelEarning);
        txModel.setOperationType("GIFT_EARNING");
        txModel.setStreamRecord(stream);
        txModel.setGift(gift);
        if (masterUserIdOfModel != null) {
            // Trazabilidad: modelo original que genero el gift.
            txModel.setAttributedModelUserId(modelId);
            txModel.setDescription("Ingreso por regalo (modeloId=" + modelId
                    + "): " + gift.getName());
        } else {
            txModel.setDescription("Ingreso por regalo: " + gift.getName());
        }
        Transaction savedTxModel = transactionRepository.save(txModel);
        log.debug("processGift: saved earning transaction txId={} recipientId={} amount={} op={}",
                savedTxModel.getId(), earningRecipientId, txModel.getAmount(),
                txModel.getOperationType());

        BigDecimal newRecipientBalance = lastRecipientBalance.add(modelEarning);

        Balance balModel = new Balance();
        balModel.setUserId(earningRecipientId);
        balModel.setTransactionId(savedTxModel.getId());
        balModel.setOperationType("GIFT_EARNING");
        balModel.setAmount(modelEarning);
        balModel.setBalance(newRecipientBalance);
        balModel.setDescription(txModel.getDescription());
        balanceRepository.save(balModel);
        log.debug("processGift: saved earning balance userId={} newBalance={}",
                earningRecipientId, newRecipientBalance);

        if (masterUserIdOfModel == null) {
            // Solo modelo individual: actualizar caches Model.
            // Bajo Master, Model.saldoActual/totalIngresos NO se tocan
            // (el dinero es del Master, no de la modelo).
            model.setSaldoActual(newRecipientBalance);
            BigDecimal totalIngresos = model.getTotalIngresos() == null ? BigDecimal.ZERO : model.getTotalIngresos();
            model.setTotalIngresos(totalIngresos.add(modelEarning));
            modelRepository.save(model);
            log.debug("processGift: updated model cache userId={} saldoActual={} totalIngresos={}",
                    modelId, model.getSaldoActual(), model.getTotalIngresos());
        }

        if (platformEarning.compareTo(BigDecimal.ZERO) > 0) {
            PlatformTransaction ptx = new PlatformTransaction();
            ptx.setAmount(platformEarning);
            ptx.setOperationType("GIFT_MARGIN");
            ptx.setStreamRecord(stream);
            ptx.setDescription("Margen por regalo: " + gift.getName());
            PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);
            log.debug("processGift: saved platform transaction txId={} amount={} op={}",
                    savedPtx.getId(), ptx.getAmount(), ptx.getOperationType());

            BigDecimal newPlatformBalance = appendPlatformBalance(
                    savedPtx.getId(),
                    platformEarning,
                    "Margen por regalo: " + gift.getName()
            );
            log.debug("processGift: saved platform balance newBalance={}", newPlatformBalance);
        }

        log.info("processGift: success clientId={} modelId={} giftId={} recipientId={} finalClientBalance={} finalRecipientBalance={}",
                clientId, modelId, giftId, earningRecipientId, newClientBalance, newRecipientBalance);
        log.info("gift_tx_committed actorUserId={} peerUserId={} recipientUserId={} giftId={} streamRecordId={} senderTransactionId={} recipientTransactionId={} senderBalanceAfter={} recipientBalanceAfter={}",
                clientId,
                modelId,
                earningRecipientId,
                giftId,
                stream != null ? stream.getId() : null,
                savedTxClient.getId(),
                savedTxModel.getId(),
                newClientBalance,
                newRecipientBalance);

        return gift;
    }

    @Transactional
    public BigDecimal forfeitOnUnsubscribe(Long userId, String role, String description) {
        User user = lockUserOrThrow(userId);

        BigDecimal totalForfeited = BigDecimal.ZERO;
        final BigDecimal MODEL_MIN_PAYOUT_THRESHOLD = new BigDecimal("100.00");

        if (Constants.Roles.CLIENT.equals(role)) {
            Optional<Client> clientOpt = clientRepository.findByUser(user);
            if (clientOpt.isPresent()) {
                Client client = clientOpt.get();

                BigDecimal lastBalance = lastBalanceOf(userId);
                BigDecimal saldoCache = client.getSaldoActual() != null ? client.getSaldoActual() : BigDecimal.ZERO;

                if (saldoCache.compareTo(BigDecimal.ZERO) > 0 && lastBalance.compareTo(saldoCache) != 0) {
                    throw new IllegalStateException(
                            "Inconsistencia CLIENT: ultimo balance (" + lastBalance + ") != clients.saldo_actual (" + saldoCache + ")"
                    );
                }

                log.info(
                        "forfeitOnUnsubscribe CLIENT standby: userId={} balance={} -> no se aplica forfeit inmediato",
                        userId,
                        lastBalance
                );
            }

            return BigDecimal.ZERO;
        }

        if (Constants.Roles.MODEL.equals(role)) {
            Optional<Model> modelOpt = modelRepository.findByUser(user);
            if (modelOpt.isPresent()) {
                Model model = modelOpt.get();

                BigDecimal lastBalance = lastBalanceOf(userId);
                BigDecimal saldoCache = model.getSaldoActual() != null ? model.getSaldoActual() : BigDecimal.ZERO;

                if (saldoCache.compareTo(BigDecimal.ZERO) > 0 && lastBalance.compareTo(saldoCache) != 0) {
                    throw new IllegalStateException(
                            "Inconsistencia MODEL: ultimo balance (" + lastBalance + ") != models.saldo_actual (" + saldoCache + ")"
                    );
                }

                BigDecimal saldo = lastBalance;

                if (saldo.compareTo(BigDecimal.ZERO) > 0
                        && saldo.compareTo(MODEL_MIN_PAYOUT_THRESHOLD) < 0) {

                    Transaction tx = new Transaction();
                    tx.setUser(user);
                    tx.setAmount(saldo.negate());
                    tx.setOperationType("UNSUBSCRIBE_FORFEIT");
                    tx.setDescription(description);
                    Transaction savedTx = transactionRepository.save(tx);

                    Balance bal = new Balance();
                    bal.setUserId(userId);
                    bal.setTransactionId(savedTx.getId());
                    bal.setOperationType("UNSUBSCRIBE_FORFEIT");
                    bal.setAmount(saldo.negate());
                    bal.setBalance(lastBalance.subtract(saldo));
                    bal.setDescription(description);
                    balanceRepository.save(bal);

                    PlatformTransaction ptx = new PlatformTransaction();
                    ptx.setAmount(saldo);
                    ptx.setOperationType("UNSUBSCRIBE_FORFEIT");
                    ptx.setDescription("Forfeit modelo " + userId);
                    PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);

                    appendPlatformBalance(
                            savedPtx.getId(),
                            saldo,
                            "Forfeit modelo " + userId
                    );

                    model.setSaldoActual(BigDecimal.ZERO);
                    modelRepository.save(model);

                    totalForfeited = totalForfeited.add(saldo);

                    log.info(
                            "forfeitOnUnsubscribe MODEL forfeited: userId={} saldo={} threshold={}",
                            userId,
                            saldo,
                            MODEL_MIN_PAYOUT_THRESHOLD
                    );
                } else {
                    log.info(
                            "forfeitOnUnsubscribe MODEL no forfeit: userId={} saldo={} threshold={}",
                            userId,
                            saldo,
                            MODEL_MIN_PAYOUT_THRESHOLD
                    );
                }
            }
        }

        return totalForfeited;
    }

    @Transactional
    public BigDecimal manualRefundToClient(Long clientUserId, Long adminId, TransactionRequestDTO request) {
        if (clientUserId == null || clientUserId <= 0) {
            throw new IllegalArgumentException("clientUserId invalido");
        }
        if (adminId == null || adminId <= 0) {
            throw new IllegalArgumentException("adminId invalido");
        }
        if (request == null) {
            throw new IllegalArgumentException("Body requerido");
        }
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }
        if (request.getDescription() == null || request.getDescription().trim().isEmpty()) {
            throw new IllegalArgumentException("La descripcion es obligatoria");
        }

        BigDecimal refundAmount = request.getAmount().setScale(2, RoundingMode.HALF_UP);
        if (refundAmount.compareTo(new BigDecimal("1000.00")) > 0) {
            throw new IllegalArgumentException("Refund demasiado alto");
        }

        User user = lockUserOrThrow(clientUserId);

        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            throw new IllegalArgumentException("El usuario debe ser CLIENT para recibir refund manual");
        }

        Client client = clientRepository.findByUser(user)
                .orElseThrow(() -> new IllegalStateException("Cliente no encontrado para userId=" + clientUserId));

        BigDecimal previousBalance = lastBalanceOf(clientUserId);

        BigDecimal saldoCache = client.getSaldoActual() == null ? BigDecimal.ZERO : client.getSaldoActual();
        if (saldoCache.compareTo(previousBalance) != 0) {
            throw new IllegalStateException(
                    "Inconsistencia CLIENT: ultimo balance (" + previousBalance + ") != clients.saldo_actual (" + saldoCache + ")"
            );
        }

        // ADR-054 D4: validacion bidireccional cuando el refund viene del
        // flujo admin de tickets. Si el DTO trae ticketId, verificamos
        // (a) que el ticket existe, (b) que pertenece al mismo user, (c)
        // que esta en el estado transitorio previo a la compensacion. Si
        // alguna condicion falla, la transaction NO se ejecuta (400).
        SupportTicket ticketToClose = null;
        Long ticketIdReq = request.getTicketId();
        if (ticketIdReq != null) {
            ticketToClose = supportTicketRepository.findById(ticketIdReq)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Ticket no encontrado id=" + ticketIdReq));
            if (!clientUserId.equals(ticketToClose.getUserId())) {
                throw new IllegalArgumentException(
                        "El ticket id=" + ticketIdReq + " no pertenece al userId=" + clientUserId);
            }
            if (!"RESOLVED_COMPENSATED_PENDING_CREDIT".equals(ticketToClose.getStatus())) {
                throw new IllegalStateException(
                        "El ticket id=" + ticketIdReq + " no esta en estado " +
                        "RESOLVED_COMPENSATED_PENDING_CREDIT (actual=" +
                        ticketToClose.getStatus() + ")");
            }
        }

        String cleanDescription = request.getDescription().trim();
        String finalDescription = ticketIdReq != null
                ? "Manual refund by adminId=" + adminId + " (ticketId=" + ticketIdReq + ") | " + cleanDescription
                : "Manual refund by adminId=" + adminId + " | " + cleanDescription;

        log.info("manualRefundToClient: start adminId={} clientUserId={} amount={} previousBalance={} ticketId={}",
                adminId, clientUserId, refundAmount, previousBalance, ticketIdReq);

        Transaction tx = new Transaction();
        tx.setUser(user);
        tx.setAmount(refundAmount);
        tx.setOperationType(Constants.OperationTypes.MANUAL_REFUND);
        tx.setDescription(finalDescription);
        tx.setTicketId(ticketIdReq);
        Transaction savedTx = transactionRepository.save(tx);

        BigDecimal newBalance = previousBalance.add(refundAmount);

        Balance bal = new Balance();
        bal.setUserId(clientUserId);
        bal.setTransactionId(savedTx.getId());
        bal.setOperationType(Constants.OperationTypes.MANUAL_REFUND);
        bal.setAmount(refundAmount);
        bal.setBalance(newBalance);
        bal.setDescription(finalDescription);
        balanceRepository.save(bal);

        client.setSaldoActual(newBalance);
        clientRepository.save(client);

        PlatformTransaction ptx = new PlatformTransaction();
        ptx.setAmount(refundAmount.negate());
        ptx.setOperationType(Constants.OperationTypes.MANUAL_REFUND_EXPENSE);
        ptx.setDescription(finalDescription);
        PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);

        BigDecimal newPlatformBalance = appendPlatformBalance(
                savedPtx.getId(),
                refundAmount.negate(),
                finalDescription
        );

        log.info("manualRefundToClient: success adminId={} clientUserId={} txId={} platformTxId={} refundAmount={} newBalance={} newPlatformBalance={}",
                adminId, clientUserId, savedTx.getId(), savedPtx.getId(), refundAmount, newBalance, newPlatformBalance);

        // ADR-054 D4: cierre del ticket asociado tras acreditar. El ticket
        // pasa de RESOLVED_COMPENSATED_PENDING_CREDIT (validado arriba) a
        // RESOLVED_COMPENSATED, con link a la Transaction creada + monto +
        // timestamp + adminId. Esto sucede dentro de la misma transaccion
        // que la acreditacion, garantizando atomicidad ticket<->transaction.
        if (ticketToClose != null) {
            if (!TicketService.isValidTransition(ticketToClose.getStatus(), "RESOLVED_COMPENSATED")) {
                // Defensa en profundidad — nunca deberia dispararse dado que ya
                // validamos el estado arriba, pero si el enum cambia y este
                // punto no se sincroniza, salta aqui en vez de dejar el
                // ticket en estado inconsistente.
                throw new IllegalStateException(
                        "Transicion invalida " + ticketToClose.getStatus() + " -> RESOLVED_COMPENSATED");
            }
            ticketToClose.setStatus("RESOLVED_COMPENSATED");
            ticketToClose.setCompensatedTransactionId(savedTx.getId());
            ticketToClose.setCompensatedAmountEur(refundAmount);
            ticketToClose.setResolvedAt(LocalDateTime.now());
            ticketToClose.setResolvedByAdminId(adminId);
            supportTicketRepository.save(ticketToClose);
            log.info("[TICKET] closed via refund id={} txId={} amount={} adminId={}",
                    ticketToClose.getId(), savedTx.getId(), refundAmount, adminId);
        }

        return newBalance;
    }

    @Transactional
    public Gift processGiftInChat(Long clientId, Long modelId, Long giftId) {
        return processGift(clientId, modelId, giftId, null);
    }

    // =========================================================================
    // BFPM Fase 4B-b (ADR-012, #D-35): reversal de refund con bonus.
    // Política A: si la compra sigue "entera" en el saldo -> reversal contable
    // limpio del par BFPM (mantiene la invariante Σ BONUS_GRANT + Σ BONUS_FUNDING
    // = 0 y total_pagos == Σ INGRESO). Si el cliente ya consumió parte (saldo
    // fungible) -> NO se revierte automáticamente: se devuelve BLOCKED para que
    // el caller marque la session a revisión manual.
    // =========================================================================

    public enum RefundOutcome {
        /** Reversal contable completo aplicado. */
        REVERSED,
        /** Saldo insuficiente para clawback limpio (consumo parcial): revisión manual. */
        BLOCKED_INSUFFICIENT_BALANCE,
        /** No hay ledger para el order (nada que revertir). */
        NO_LEDGER,
        /** El usuario no es CLIENT (estado inesperado): revisión manual. */
        NOT_CLIENT
    }

    /**
     * Revierte contablemente el crédito de una compra (identificada por
     * {@code orderId}) tras un refund del PSP. Reversal por LEDGER REAL: suma lo
     * efectivamente acreditado (INGRESO = price; BONUS_GRANT = bonus del pack +
     * promo welcome100 si la hubo) emparejando por {@code order=<orderId>}, en
     * vez de re-derivar del catálogo. Atómico (@Transactional) con lock pesimista
     * del cliente. Idempotencia = responsabilidad del caller (guardar por status
     * de la session); adicionalmente el filtro amount>0 de la suma ignora los
     * propios asientos de reversal.
     */
    @Transactional
    public RefundOutcome reversePackRefund(Long clientUserId, String orderId) {
        if (clientUserId == null || clientUserId <= 0) {
            throw new IllegalArgumentException("clientUserId invalido");
        }
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId requerido");
        }

        User user = lockUserOrThrow(clientUserId);
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            log.error("[REFUND] usuario no CLIENT userId={} role={} order={} -> revision manual",
                    clientUserId, user.getRole(), orderId);
            return RefundOutcome.NOT_CLIENT;
        }

        Client client = clientRepository.findByUser(user)
                .orElseThrow(() -> new IllegalStateException("Cliente no encontrado userId=" + clientUserId));

        BigDecimal previousBalance = lastBalanceOf(clientUserId);
        BigDecimal saldoCache = client.getSaldoActual() == null ? BigDecimal.ZERO : client.getSaldoActual();
        if (saldoCache.compareTo(previousBalance) != 0) {
            throw new IllegalStateException(
                    "Inconsistencia CLIENT: ultimo balance (" + previousBalance + ") != clients.saldo_actual (" + saldoCache + ")");
        }

        // Recupera lo realmente acreditado para este order (positivos; excluye reversals).
        String descLike = "%order=" + orderId;
        BigDecimal ingreso = nz(transactionRepository
                .sumPositiveClientAmountByOpAndOrder(clientUserId, "INGRESO", descLike))
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal bonus = nz(transactionRepository
                .sumPositiveClientAmountByOpAndOrder(clientUserId, Constants.OperationTypes.BONUS_GRANT, descLike))
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal credited = ingreso.add(bonus);

        if (credited.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("[REFUND] sin ledger para order={} userId={} (nada que revertir)", orderId, clientUserId);
            return RefundOutcome.NO_LEDGER;
        }

        // Política A: solo reversal limpio si el saldo cubre el clawback total.
        if (previousBalance.compareTo(credited) < 0) {
            log.error("[REFUND] saldo insuficiente para reversal limpio (#D-35) userId={} order={} saldo={} credited={} -> REVISION MANUAL",
                    clientUserId, orderId, previousBalance, credited);
            return RefundOutcome.BLOCKED_INSUFFICIENT_BALANCE;
        }

        // 1) Reversal INGRESO (negativo). total_pagos baja en price (mantiene total_pagos == Σ INGRESO).
        String descIngresoRev = "Refund reversal INGRESO order=" + orderId;
        BigDecimal balanceAfterIngreso = previousBalance.subtract(ingreso);
        Transaction txIng = new Transaction();
        txIng.setUser(user);
        txIng.setAmount(ingreso.negate());
        txIng.setOperationType("INGRESO");
        txIng.setDescription(descIngresoRev);
        Transaction savedIng = transactionRepository.save(txIng);

        Balance balIng = new Balance();
        balIng.setUserId(clientUserId);
        balIng.setTransactionId(savedIng.getId());
        balIng.setOperationType("INGRESO");
        balIng.setAmount(ingreso.negate());
        balIng.setBalance(balanceAfterIngreso);
        balIng.setDescription(descIngresoRev);
        balanceRepository.save(balIng);

        BigDecimal finalBalance = balanceAfterIngreso;

        // 2) Reversal del par BFPM (grant cliente + funding plataforma), solo si hubo bonus.
        // Descripciones simétricas bonus_grant/bonus_funding para que el pairing de
        // auditoría 4B-a (REPLACE) empareje también los reversals (sin falsos huérfanos).
        if (bonus.compareTo(BigDecimal.ZERO) > 0) {
            String descGrantRev = "BFPM bonus_grant REVERSAL order=" + orderId;
            String descFundingRev = "BFPM bonus_funding REVERSAL order=" + orderId;
            BigDecimal balanceAfterBonus = balanceAfterIngreso.subtract(bonus);

            Transaction txBonus = new Transaction();
            txBonus.setUser(user);
            txBonus.setAmount(bonus.negate());
            txBonus.setOperationType(Constants.OperationTypes.BONUS_GRANT);
            txBonus.setDescription(descGrantRev);
            Transaction savedBonus = transactionRepository.save(txBonus);

            Balance balBonus = new Balance();
            balBonus.setUserId(clientUserId);
            balBonus.setTransactionId(savedBonus.getId());
            balBonus.setOperationType(Constants.OperationTypes.BONUS_GRANT);
            balBonus.setAmount(bonus.negate());
            balBonus.setBalance(balanceAfterBonus);
            balBonus.setDescription(descGrantRev);
            balanceRepository.save(balBonus);

            finalBalance = balanceAfterBonus;

            // Plataforma: revierte el BONUS_FUNDING (importe positivo, deshace el negativo original).
            PlatformTransaction ptx = new PlatformTransaction();
            ptx.setAmount(bonus);
            ptx.setOperationType(Constants.OperationTypes.BONUS_FUNDING);
            ptx.setDescription(descFundingRev);
            PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);
            appendPlatformBalance(savedPtx.getId(), bonus, descFundingRev);
        }

        // 3) Caches denormalizadas: saldo baja en credited; total_pagos baja en price.
        client.setSaldoActual(finalBalance);
        BigDecimal currentTotalPagos = client.getTotalPagos() == null ? BigDecimal.ZERO : client.getTotalPagos();
        client.setTotalPagos(currentTotalPagos.subtract(ingreso));
        clientRepository.save(client);

        log.info("[REFUND] reversal OK userId={} order={} ingreso={} bonus={} credited={} newBalance={}",
                clientUserId, orderId, ingreso, bonus, credited, finalBalance);
        return RefundOutcome.REVERSED;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
