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

@Service
public class TransactionService {

    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);

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
            PayoutRequestRepository payoutRequestRepository, // [NEW]
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
        this.payoutRequestRepository = payoutRequestRepository; // [NEW]
        this.billing = billing;
        this.giftProperties = giftProperties;
    }

    /**
     * LOCK wallet industrial:
     * - Serializa por usuario antes de leer "último balance" y escribir ledger.
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
        log.info("processGift: locking wallets minUserId={} maxUserId={}", min, max);
        lockUserOrThrow(min);
        if (max != min) lockUserOrThrow(max);
    }

    private BigDecimal lastBalanceOf(Long userId) {
        BigDecimal balance = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(userId)
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);
        log.info("processGift: lastBalanceOf userId={} balance={}", userId, balance);
        return balance;
    }

    private void lockPlatformBalance() {
        // Fuerza serialización de platform_balances (evita carreras en saldo plataforma).
        log.info("processGift: locking platform balance");
        platformBalanceRepository.findTopForUpdate();
    }

    private BigDecimal lastPlatformBalance() {
        BigDecimal balance = platformBalanceRepository.findTopByOrderByTimestampDescIdDesc()
                .map(PlatformBalance::getBalance)
                .orElse(BigDecimal.ZERO);
        log.info("processGift: lastPlatformBalance balance={}", balance);
        return balance;
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
     * - Consistencia: último balance == clients.saldo_actual (si existe fila clientes)
     */
    @Transactional
    public void processFirstTransaction(Long userId, TransactionRequestDTO request) {
        // 0) LOCK wallet
        User user = lockUserOrThrow(userId);

        // 1) Validaciones básicas
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

        // 2) Último balance & consistencia con clients.saldo_actual (si existe)
        BigDecimal lastBalance = lastBalanceOf(userId);

        Optional<Client> existingClientOpt = clientRepository.findByUser(user);
        if (existingClientOpt.isPresent()) {
            BigDecimal currentSaldo = existingClientOpt.get().getSaldoActual();
            if (currentSaldo != null && currentSaldo.compareTo(lastBalance) != 0) {
                throw new IllegalStateException(
                        "Inconsistencia: saldo_actual (" + currentSaldo + ") != último balance (" + lastBalance + ")"
                );
            }
        }

        // 3) Calcular nuevo saldo
        BigDecimal newBalance = lastBalance.add(request.getAmount());

        // 4) Registrar transacción (amount positivo)
        Transaction tx = new Transaction();
        tx.setUser(user);
        tx.setAmount(request.getAmount());
        tx.setOperationType(op);
        tx.setDescription(request.getDescription());
        Transaction savedTx = transactionRepository.save(tx);

        // 5) Registrar balance
        Balance bal = new Balance();
        bal.setUserId(userId);
        bal.setTransactionId(savedTx.getId());
        bal.setOperationType(op);
        bal.setAmount(request.getAmount()); // positivo
        bal.setBalance(newBalance);
        bal.setDescription(request.getDescription());
        balanceRepository.save(bal);

        // 6) Upsert en clients
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

        // 7) Promover a CLIENT (unidireccional)
        user.setRole(Constants.Roles.CLIENT);
        userRepository.save(user);
    }

    /**
     * Recargas y gastos posteriores (CLIENT ya existente).
     * - Usa último balance como referencia (no recalcula histórico).
     * - Verifica consistencia contra clients.saldo_actual.
     * - Soporta operationType = "INGRESO" (positiva) o "GASTO" (negativa, sin permitir saldo < 0).
     */
    @Transactional
    public void addBalance(Long userId, TransactionRequestDTO request) {
        // 0) LOCK wallet
        User user = lockUserOrThrow(userId);

        // 1) Validaciones
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

        // 2) Último balance + consistencia
        BigDecimal lastBalance = lastBalanceOf(userId);

        Client client = clientRepository.findByUser(user)
                .orElseThrow(() -> new IllegalStateException("Cliente no encontrado para el usuario " + userId));

        BigDecimal saldoActual = client.getSaldoActual() == null ? BigDecimal.ZERO : client.getSaldoActual();
        if (saldoActual.compareTo(lastBalance) != 0) {
            throw new IllegalStateException("Inconsistencia: saldo_actual (" + saldoActual + ") != último balance (" + lastBalance + ")");
        }

        // 3) Cálculo con signo
        BigDecimal signedAmount;
        BigDecimal newBalance;
        if ("INGRESO".equals(op)) {
            signedAmount = request.getAmount();
            newBalance = lastBalance.add(request.getAmount());
        } else { // GASTO
            signedAmount = request.getAmount().negate();
            newBalance = lastBalance.subtract(request.getAmount());
            if (newBalance.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Saldo insuficiente");
            }
        }

        // 4) Registrar transacción
        Transaction tx = new Transaction();
        tx.setUser(user);
        tx.setAmount(signedAmount);
        tx.setOperationType(op);
        tx.setDescription(request.getDescription());
        Transaction savedTx = transactionRepository.save(tx);

        // 5) Registrar balance
        Balance bal = new Balance();
        bal.setUserId(userId);
        bal.setTransactionId(savedTx.getId());
        bal.setOperationType(op);
        bal.setAmount(signedAmount);
        bal.setBalance(newBalance);
        bal.setDescription(request.getDescription());
        balanceRepository.save(bal);

        // 6) Actualizar cliente (cache)
        client.setSaldoActual(newBalance);
        if ("INGRESO".equals(op)) {
            BigDecimal totalPagos = client.getTotalPagos() == null ? BigDecimal.ZERO : client.getTotalPagos();
            client.setTotalPagos(totalPagos.add(request.getAmount()));
        }
        clientRepository.save(client);
    }

    /**
     * Retirada de fondos por parte de un MODELO.
     * (PSP aún NO. Esto solo asienta ledger interno y ajusta cache.)
     *
     * [MEJORA 3.3] payout_requests (sin PSP):
     * - Creamos un registro en payout_requests con status=REQUESTED
     * - Descontamos saldo en ledger con operación PAYOUT_REQUEST (amount NEGATIVO)
     * - Ajustamos models.saldo_actual (cache) para que siga consistente con ledger
     *
     * Nota: La revisión/admin (APPROVE/REJECT/PAID) se implementa fuera (AdminController),
     * aquí solo dejamos cerrado el alta y el asiento contable del request.
     */
    @Transactional
    public void requestPayout(Long userId, TransactionRequestDTO request) {
        // 0) LOCK wallet
        User user = lockUserOrThrow(userId);

        // 1) Validaciones básicas
        if (request == null) {
            throw new IllegalArgumentException("Body requerido");
        }
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }

        // 2) Validar rol
        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            throw new IllegalArgumentException("El usuario debe tener rol MODEL para solicitar un retiro");
        }

        // 3) Buscar entidad Model
        Model model = modelRepository.findByUser(user)
                .orElseThrow(() -> new IllegalStateException("No existe registro de modelo para el usuario: " + userId));

        // 4) Fuente de verdad: ledger
        BigDecimal amountAbs = request.getAmount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal previousBalance = lastBalanceOf(userId);

        BigDecimal saldoCache = model.getSaldoActual() == null ? BigDecimal.ZERO : model.getSaldoActual();
        if (saldoCache.compareTo(previousBalance) != 0) {
            throw new IllegalStateException(
                    "Inconsistencia detectada: último balance (" + previousBalance + ") != models.saldo_actual (" + saldoCache + ")"
            );
        }

        // 5) Verificar fondos suficientes (ledger)
        if (previousBalance.compareTo(amountAbs) < 0) {
            throw new IllegalArgumentException("Saldo insuficiente para completar el retiro");
        }

        // 6) Crear payout_request (sin PSP)
        PayoutRequest pr = new PayoutRequest();
        pr.setModelUserId(userId);
        pr.setAmount(amountAbs);
        pr.setCurrency("EUR");
        pr.setStatus("REQUESTED");
        pr.setReason(request.getDescription());
        PayoutRequest savedPr = payoutRequestRepository.save(pr);

        // 7) Asentar ledger (retención/solicitud)
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

        // 8) Actualizar cache
        model.setSaldoActual(newBalance);
        modelRepository.save(model);
    }

    /**
     * Admin review para payout_requests (sin PSP).
     *
     * Reglas:
     * - APPROVED: solo status + auditoría admin (NO ledger)
     * - PAID: solo status + auditoría admin (NO ledger)
     * - REJECTED/CANCELED: revierte el hold contable creado por PAYOUT_REQUEST:
     *     - crea asiento compensatorio (amount POSITIVO) con operation_type = PAYOUT_REQUEST_REVERT
     *     - crea balance nuevo
     *     - actualiza models.saldo_actual
     *
     * Reglas de transición mínimas (seguras):
     * - REQUESTED -> APPROVED | REJECTED | CANCELED
     * - APPROVED  -> PAID | REJECTED | CANCELED
     * - Estados terminales: REJECTED | CANCELED | PAID (no se pueden cambiar)
     */
    @Transactional
    public PayoutRequest adminReviewPayoutRequest(Long payoutRequestId, Long adminId, String newStatus, String adminNotes) {
        if (payoutRequestId == null || payoutRequestId <= 0) {
            throw new IllegalArgumentException("payoutRequestId inválido");
        }
        if (adminId == null || adminId <= 0) {
            throw new IllegalArgumentException("adminId inválido");
        }
        if (newStatus == null || newStatus.isBlank()) {
            throw new IllegalArgumentException("status requerido");
        }

        final String target = newStatus.trim().toUpperCase(Locale.ROOT);

        // Validar status permitido (según tu entidad)
        if (!"REQUESTED".equals(target)
                && !"APPROVED".equals(target)
                && !"REJECTED".equals(target)
                && !"PAID".equals(target)
                && !"CANCELED".equals(target)) {
            throw new IllegalArgumentException("status no válido: " + newStatus);
        }

        // 1) LOCK payout_request
        //    Requiere que exista en PayoutRequestRepository un método findByIdForUpdate(...)
        PayoutRequest pr = payoutRequestRepository.findByIdForUpdate(payoutRequestId)
                .orElseThrow(() -> new IllegalArgumentException("PayoutRequest no encontrada: " + payoutRequestId));

        final String current = (pr.getStatus() == null ? "REQUESTED" : pr.getStatus().trim().toUpperCase(Locale.ROOT));

        // 2) Estados terminales: no se tocan
        if ("REJECTED".equals(current) || "CANCELED".equals(current) || "PAID".equals(current)) {
            throw new IllegalStateException("PayoutRequest en estado terminal: " + current);
        }

        // 3) Validar transiciones permitidas
        if ("REQUESTED".equals(current)) {
            if (!"APPROVED".equals(target) && !"REJECTED".equals(target) && !"CANCELED".equals(target)) {
                throw new IllegalStateException("Transición no permitida: " + current + " -> " + target);
            }
        } else if ("APPROVED".equals(current)) {
            if (!"PAID".equals(target) && !"REJECTED".equals(target) && !"CANCELED".equals(target)) {
                throw new IllegalStateException("Transición no permitida: " + current + " -> " + target);
            }
        }

        // 4) LOCK wallet del modelo (serializa ledger y cache)
        Long modelUserId = pr.getModelUserId();
        if (modelUserId == null || modelUserId <= 0) {
            throw new IllegalStateException("modelUserId inválido en payout_request");
        }
        User modelUser = lockUserOrThrow(modelUserId);

        // Validación de rol (coherencia básica)
        if (!Constants.Roles.MODEL.equals(modelUser.getRole())) {
            throw new IllegalStateException("El usuario no es MODEL: " + modelUserId);
        }

        Model model = modelRepository.findByUser(modelUser)
                .orElseThrow(() -> new IllegalStateException("No existe registro de modelo para userId=" + modelUserId));

        // 5) Si REJECTED/CANCELED => revertir hold contable
        if ("REJECTED".equals(target) || "CANCELED".equals(target)) {
            BigDecimal amountAbs = pr.getAmount() == null ? BigDecimal.ZERO : pr.getAmount().setScale(2, RoundingMode.HALF_UP);
            if (amountAbs.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalStateException("Amount inválido en payout_request: " + pr.getAmount());
            }

            BigDecimal previousBalance = lastBalanceOf(modelUserId);

            BigDecimal saldoCache = model.getSaldoActual() == null ? BigDecimal.ZERO : model.getSaldoActual();
            if (saldoCache.compareTo(previousBalance) != 0) {
                throw new IllegalStateException(
                        "Inconsistencia MODEL: último balance (" + previousBalance + ") != models.saldo_actual (" + saldoCache + ")"
                );
            }

            // Asiento compensatorio (+amount) => devuelve fondos al modelo
            BigDecimal signedAmount = amountAbs; // positivo

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

            // cache
            model.setSaldoActual(newBalance);
            modelRepository.save(model);
        }

        // 6) Persistir review en payout_requests (sin inventar columnas nuevas)
        pr.setStatus(target);
        pr.setAdminNotes(adminNotes);
        pr.setReviewedByUserId(adminId);
        pr.setReviewedAt(LocalDateTime.now());

        return payoutRequestRepository.save(pr);
    }

    @Transactional
    public Gift processGift(Long clientId, Long modelId, Long giftId, Long streamIdOrNull) {
        log.info("processGift: start clientId={} modelId={} giftId={} streamIdOrNull={}", clientId, modelId, giftId, streamIdOrNull);
        // 0) LOCK ambos wallets (orden fijo)
        lockUsersInOrder(clientId, modelId);

        // 1) Cargar users y validar roles (puedes usar findById normal porque el lock ya está tomado)
        User clientUser = userRepository.findById(clientId)
                .orElseThrow(() -> new IllegalArgumentException("Cliente no encontrado: " + clientId));
        log.info("processGift: loaded client userId={} role={}", clientId, clientUser.getRole());
        if (!Constants.Roles.CLIENT.equals(clientUser.getRole())) {
            throw new IllegalArgumentException("El remitente debe ser CLIENT");
        }

        User modelUser = userRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Modelo no encontrado: " + modelId));
        log.info("processGift: loaded model userId={} role={}", modelId, modelUser.getRole());
        if (!Constants.Roles.MODEL.equals(modelUser.getRole())) {
            throw new IllegalArgumentException("El destinatario debe ser MODEL");
        }

        Gift gift = giftRepository.findById(giftId)
                .orElseThrow(() -> new IllegalArgumentException("Gift inexistente: " + giftId));
        BigDecimal cost = gift.getCost().setScale(2, RoundingMode.HALF_UP);
        log.info("processGift: loaded gift id={} name={} cost={}", gift.getId(), gift.getName(), cost);

        Client client = clientRepository.findByUser(clientUser)
                .orElseThrow(() -> new IllegalStateException("Cliente no encontrado para userId=" + clientId));
        log.info("processGift: loaded client entity userId={} saldoActual={}", clientId, client.getSaldoActual());

        BigDecimal lastClientBalance = lastBalanceOf(clientId);

        // Auditoría cache vs ledger
        BigDecimal clientSaldoCache = client.getSaldoActual() == null ? BigDecimal.ZERO : client.getSaldoActual();
        log.info("processGift: validating client balances clientId={} ledgerBalance={} saldoCache={}",
                clientId, lastClientBalance, clientSaldoCache);
        if (clientSaldoCache.compareTo(BigDecimal.ZERO) > 0 && lastClientBalance.compareTo(clientSaldoCache) != 0) {
            throw new IllegalStateException(
                    "Inconsistencia CLIENT: último balance (" + lastClientBalance + ") != clients.saldo_actual (" + clientSaldoCache + ")"
            );
        }

        // Fuente de verdad para validar fondos: ledger
        log.info("processGift: validating funds clientId={} cost={} balance={}", clientId, cost, lastClientBalance);
        if (lastClientBalance.compareTo(cost) < 0) {
            throw new IllegalArgumentException("Saldo insuficiente para enviar el regalo");
        }

        // Modelo (crear si no existe fila)
        Model model = modelRepository.findByUser(modelUser)
                .orElseGet(() -> {
                    Model m = new Model();
                    m.setUser(modelUser);
                    m.setUserId(modelId);
                    return m;
                });
        log.info("processGift: loaded model entity userId={} saldoActual={} totalIngresos={}",
                modelId, model.getSaldoActual(), model.getTotalIngresos());

        BigDecimal lastModelBalance = lastBalanceOf(modelId);

        // Split
        BigDecimal share = (giftProperties.getModelShare() != null ? giftProperties.getModelShare() : BigDecimal.ZERO);
        BigDecimal modelEarning = cost.multiply(share).setScale(2, RoundingMode.HALF_UP);
        BigDecimal platformEarning = cost.subtract(modelEarning).setScale(2, RoundingMode.HALF_UP);
        log.info("processGift: split giftId={} share={} modelEarning={} platformEarning={}",
                giftId, share, modelEarning, platformEarning);

        // Stream (opcional)
        StreamRecord stream = null;
        if (streamIdOrNull != null) {
            stream = streamRecordRepository.findById(streamIdOrNull).orElse(null);
        }
        log.info("processGift: resolved stream streamIdOrNull={} foundStreamId={}",
                streamIdOrNull, stream != null ? stream.getId() : null);

        // ===== CLIENTE (ledger) =====
        Transaction txClient = new Transaction();
        txClient.setUser(clientUser);
        txClient.setAmount(cost.negate());
        txClient.setOperationType("GIFT_SEND");
        txClient.setStreamRecord(stream);
        txClient.setDescription("Regalo: " + gift.getName());
        Transaction savedTxClient = transactionRepository.save(txClient);
        log.info("processGift: saved client transaction txId={} amount={} op={}",
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
        log.info("processGift: saved client balance userId={} newBalance={}", clientId, newClientBalance);

        client.setSaldoActual(newClientBalance);
        clientRepository.save(client);
        log.info("processGift: updated client cache userId={} saldoActual={}", clientId, client.getSaldoActual());

        // ===== MODELO (ledger) =====
        Transaction txModel = new Transaction();
        txModel.setUser(modelUser);
        txModel.setAmount(modelEarning);
        txModel.setOperationType("GIFT_EARNING");
        txModel.setStreamRecord(stream);
        txModel.setDescription("Ingreso por regalo: " + gift.getName());
        Transaction savedTxModel = transactionRepository.save(txModel);
        log.info("processGift: saved model transaction txId={} amount={} op={}",
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
        log.info("processGift: saved model balance userId={} newBalance={}", modelId, newModelBalance);

        model.setSaldoActual(newModelBalance);
        BigDecimal totalIngresos = model.getTotalIngresos() == null ? BigDecimal.ZERO : model.getTotalIngresos();
        model.setTotalIngresos(totalIngresos.add(modelEarning));
        modelRepository.save(model);
        log.info("processGift: updated model cache userId={} saldoActual={} totalIngresos={}",
                modelId, model.getSaldoActual(), model.getTotalIngresos());

        // ===== PLATAFORMA (ledger plataforma) =====
        if (platformEarning.compareTo(BigDecimal.ZERO) > 0) {
            // LOCK plataforma antes de calcular el balance
            lockPlatformBalance();

            PlatformTransaction ptx = new PlatformTransaction();
            ptx.setAmount(platformEarning);
            ptx.setOperationType("GIFT_MARGIN");
            ptx.setStreamRecord(stream);
            ptx.setDescription("Margen por regalo: " + gift.getName());
            PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);
            log.info("processGift: saved platform transaction txId={} amount={} op={}",
                    savedPtx.getId(), ptx.getAmount(), ptx.getOperationType());

            BigDecimal lastPlatformBalance = lastPlatformBalance();

            PlatformBalance pbal = new PlatformBalance();
            pbal.setTransactionId(savedPtx.getId());
            pbal.setAmount(platformEarning);
            pbal.setBalance(lastPlatformBalance.add(platformEarning));
            pbal.setDescription("Margen por regalo: " + gift.getName());
            platformBalanceRepository.save(pbal);
            log.info("processGift: saved platform balance previousBalance={} newBalance={}",
                    lastPlatformBalance, lastPlatformBalance.add(platformEarning));
        }

        log.info("processGift: success clientId={} modelId={} giftId={} finalClientBalance={} finalModelBalance={}",
                clientId, modelId, giftId, newClientBalance, newModelBalance);
        return gift;
    }

    /**
     * Forfeit interno actual (OJO: esto lo vas a cambiar para MODELO cuando metamos payout_requests).
     * Mantengo la lógica, pero con LOCKS (usuario + plataforma) y lectura determinista.
     */
    @Transactional
    public BigDecimal forfeitOnUnsubscribe(Long userId, String role, String description) {
        // 0) LOCK wallet
        User user = lockUserOrThrow(userId);

        BigDecimal totalForfeited = BigDecimal.ZERO;

        // === CLIENTE ===
        if (Constants.Roles.CLIENT.equals(role)) {
            Optional<Client> clientOpt = clientRepository.findByUser(user);
            if (clientOpt.isPresent()) {
                Client client = clientOpt.get();

                BigDecimal lastBalance = lastBalanceOf(userId);
                BigDecimal saldoCache = client.getSaldoActual() != null ? client.getSaldoActual() : BigDecimal.ZERO;

                if (saldoCache.compareTo(BigDecimal.ZERO) > 0 && lastBalance.compareTo(saldoCache) != 0) {
                    throw new IllegalStateException(
                            "Inconsistencia CLIENT: último balance (" + lastBalance + ") != clients.saldo_actual (" + saldoCache + ")"
                    );
                }

                BigDecimal saldo = lastBalance;

                if (saldo.compareTo(BigDecimal.ZERO) > 0) {
                    // Ledger cliente
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

                    // Ledger plataforma (LOCK)
                    lockPlatformBalance();

                    PlatformTransaction ptx = new PlatformTransaction();
                    ptx.setAmount(saldo);
                    ptx.setOperationType("UNSUBSCRIBE_FORFEIT");
                    ptx.setDescription("Forfeit usuario " + userId);
                    PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);

                    BigDecimal lastPlatformBalance = lastPlatformBalance();

                    PlatformBalance pbal = new PlatformBalance();
                    pbal.setTransactionId(savedPtx.getId());
                    pbal.setAmount(saldo);
                    pbal.setBalance(lastPlatformBalance.add(saldo));
                    pbal.setDescription("Forfeit usuario " + userId);
                    platformBalanceRepository.save(pbal);

                    // cache
                    client.setSaldoActual(BigDecimal.ZERO);
                    clientRepository.save(client);

                    totalForfeited = totalForfeited.add(saldo);
                }
            }
        }

        // === MODELO ===
        if (Constants.Roles.MODEL.equals(role)) {
            Optional<Model> modelOpt = modelRepository.findByUser(user);
            if (modelOpt.isPresent()) {
                Model model = modelOpt.get();

                BigDecimal lastBalance = lastBalanceOf(userId);
                BigDecimal saldoCache = model.getSaldoActual() != null ? model.getSaldoActual() : BigDecimal.ZERO;

                if (saldoCache.compareTo(BigDecimal.ZERO) > 0 && lastBalance.compareTo(saldoCache) != 0) {
                    throw new IllegalStateException(
                            "Inconsistencia MODEL: último balance (" + lastBalance + ") != models.saldo_actual (" + saldoCache + ")"
                    );
                }

                BigDecimal saldo = lastBalance;

                if (saldo.compareTo(BigDecimal.ZERO) > 0) {
                    // Ledger modelo
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

                    // Ledger plataforma (LOCK)
                    lockPlatformBalance();

                    PlatformTransaction ptx = new PlatformTransaction();
                    ptx.setAmount(saldo);
                    ptx.setOperationType("UNSUBSCRIBE_FORFEIT");
                    ptx.setDescription("Forfeit modelo " + userId);
                    PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);

                    BigDecimal lastPlatformBalance = lastPlatformBalance();

                    PlatformBalance pbal = new PlatformBalance();
                    pbal.setTransactionId(savedPtx.getId());
                    pbal.setAmount(saldo);
                    pbal.setBalance(lastPlatformBalance.add(saldo));
                    pbal.setDescription("Forfeit modelo " + userId);
                    platformBalanceRepository.save(pbal);

                    // cache
                    model.setSaldoActual(BigDecimal.ZERO);
                    modelRepository.save(model);

                    totalForfeited = totalForfeited.add(saldo);
                }
            }
        }

        return totalForfeited;
    }

    // Para "chat de favoritos" (sin stream)
    @Transactional
    public Gift processGiftInChat(Long clientId, Long modelId, Long giftId) {
        return processGift(clientId, modelId, giftId, null);
    }
}
