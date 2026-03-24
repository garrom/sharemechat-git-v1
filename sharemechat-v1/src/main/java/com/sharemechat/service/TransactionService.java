package com.sharemechat.service;

import com.sharemechat.config.BillingProperties;
import com.sharemechat.config.GiftProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.TransactionRequestDTO;
import com.sharemechat.entity.*;
import com.sharemechat.repository.*;
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

    private final BillingProperties billing;
    private final GiftProperties giftProperties;

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
            BillingProperties billing,
            GiftProperties giftProperties
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
        this.billing = billing;
        this.giftProperties = giftProperties;
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

    @Transactional
    public void addBalance(Long userId, TransactionRequestDTO request) {
        User user = lockUserOrThrow(userId);

        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            throw new IllegalArgumentException("El usuario debe ser CLIENT");
        }
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
        return processGiftInternal(clientId, modelId, giftId, streamIdOrNull, true);
    }


    private Gift processGiftInternal(Long clientId, Long modelId, Long giftId, Long streamIdOrNull, boolean enableRandomFallback) {
        log.info("processGift: start clientId={} modelId={} giftId={} streamIdOrNull={} enableRandomFallback={}",
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

        Gift gift = giftRepository.findById(giftId)
                .orElseThrow(() -> new IllegalArgumentException("Gift inexistente: " + giftId));
        BigDecimal cost = gift.getCost().setScale(2, RoundingMode.HALF_UP);
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

        BigDecimal lastModelBalance = lastBalanceOf(modelId);

        BigDecimal share = (giftProperties.getModelShare() != null ? giftProperties.getModelShare() : BigDecimal.ZERO);
        BigDecimal modelEarning = cost.multiply(share).setScale(2, RoundingMode.HALF_UP);
        BigDecimal platformEarning = cost.subtract(modelEarning).setScale(2, RoundingMode.HALF_UP);
        log.debug("processGift: split giftId={} share={} modelEarning={} platformEarning={}",
                giftId, share, modelEarning, platformEarning);

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

        Transaction txModel = new Transaction();
        txModel.setUser(modelUser);
        txModel.setAmount(modelEarning);
        txModel.setOperationType("GIFT_EARNING");
        txModel.setStreamRecord(stream);
        txModel.setGift(gift);
        txModel.setDescription("Ingreso por regalo: " + gift.getName());
        Transaction savedTxModel = transactionRepository.save(txModel);
        log.debug("processGift: saved model transaction txId={} amount={} op={}",
                savedTxModel.getId(), txModel.getAmount(), txModel.getOperationType());

        BigDecimal newModelBalance = lastModelBalance.add(modelEarning);

        Balance balModel = new Balance();
        balModel.setUserId(modelId);
        balModel.setTransactionId(savedTxModel.getId());
        balModel.setOperationType("GIFT_EARNING");
        balModel.setAmount(modelEarning);
        balModel.setBalance(newModelBalance);
        balModel.setDescription("Ingreso por regalo: " + gift.getName());
        balanceRepository.save(balModel);
        log.debug("processGift: saved model balance userId={} newBalance={}", modelId, newModelBalance);

        model.setSaldoActual(newModelBalance);
        BigDecimal totalIngresos = model.getTotalIngresos() == null ? BigDecimal.ZERO : model.getTotalIngresos();
        model.setTotalIngresos(totalIngresos.add(modelEarning));
        modelRepository.save(model);
        log.debug("processGift: updated model cache userId={} saldoActual={} totalIngresos={}",
                modelId, model.getSaldoActual(), model.getTotalIngresos());

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

        log.info("processGift: success clientId={} modelId={} giftId={} finalClientBalance={} finalModelBalance={}",
                clientId, modelId, giftId, newClientBalance, newModelBalance);

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

        String cleanDescription = request.getDescription().trim();
        String finalDescription = "Manual refund by adminId=" + adminId + " | " + cleanDescription;

        log.info("manualRefundToClient: start adminId={} clientUserId={} amount={} previousBalance={}",
                adminId, clientUserId, refundAmount, previousBalance);

        Transaction tx = new Transaction();
        tx.setUser(user);
        tx.setAmount(refundAmount);
        tx.setOperationType(Constants.OperationTypes.MANUAL_REFUND);
        tx.setDescription(finalDescription);
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

        return newBalance;
    }

    @Transactional
    public Gift processGiftInChat(Long clientId, Long modelId, Long giftId) {
        return processGift(clientId, modelId, giftId, null);
    }
}
