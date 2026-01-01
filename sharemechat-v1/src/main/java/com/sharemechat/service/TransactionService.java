package com.sharemechat.service;

import com.sharemechat.config.GiftProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.TransactionRequestDTO;
import com.sharemechat.entity.*;
import com.sharemechat.repository.*;
import com.sharemechat.config.BillingProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.RoundingMode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final BalanceRepository balanceRepository;
    private final ClientRepository clientRepository;
    private final ModelRepository modelRepository;
    private final UserRepository userRepository;
    private final GiftRepository giftRepository;
    private final StreamRecordRepository streamRecordRepository;
    private final PlatformTransactionRepository platformTransactionRepository;
    private final PlatformBalanceRepository platformBalanceRepository;
    private final BillingProperties billing;
    private final GiftProperties giftProperties;


    public TransactionService(TransactionRepository transactionRepository,
                              BalanceRepository balanceRepository,
                              ClientRepository clientRepository,
                              ModelRepository modelRepository,
                              UserRepository userRepository,
                              GiftRepository giftRepository,
                              StreamRecordRepository streamRecordRepository,
                              PlatformTransactionRepository platformTransactionRepository,
                              PlatformBalanceRepository platformBalanceRepository,
                              BillingProperties billing,
                              GiftProperties giftProperties) {
        this.transactionRepository = transactionRepository;
        this.balanceRepository = balanceRepository;
        this.clientRepository = clientRepository;
        this.modelRepository = modelRepository;
        this.userRepository = userRepository;
        this.giftRepository = giftRepository;
        this.streamRecordRepository = streamRecordRepository;
        this.platformTransactionRepository = platformTransactionRepository;
        this.platformBalanceRepository = platformBalanceRepository;
        this.billing = billing;
        this.giftProperties = giftProperties;
    }


    /**
     * PRIMER PAGO (atomicidad total, 4 mapeos):
     * 1) transactions (inmutable)
     * 2) balances (inmutable)
     * 3) clients (mutable, upsert saldo_actual/total_pagos)
     * 4) users.role: USER -> CLIENT (unidireccional; no se revierte) + is_premium=true
     *
     * Reglas:
     * - Debe venir con operationType = "INGRESO"
     * - amount > 0
     * - Consistencia: último balance == clients.saldo_actual (si existe fila clientes)
     */
    @Transactional
    public void processFirstTransaction(Long userId, TransactionRequestDTO request) {
        // 1) Validaciones básicas
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + userId));

        if (!Constants.Roles.USER.equals(user.getRole())) {
            throw new IllegalArgumentException("El usuario ya es CLIENT o MODEL");
        }
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }
        final String op = (request.getOperationType() == null)
                ? "INGRESO"
                : request.getOperationType().toUpperCase();
        if (!"INGRESO".equals(op)) {
            throw new IllegalArgumentException("Para el primer pago, operationType debe ser INGRESO");
        }

        // 2) Último balance & consistencia con clients.saldo_actual (si existe)
        Optional<Balance> lastBalanceOpt = balanceRepository.findTopByUserIdOrderByTimestampDesc(userId);
        BigDecimal lastBalance = lastBalanceOpt.map(Balance::getBalance).orElse(BigDecimal.ZERO);

        Optional<Client> existingClientOpt = clientRepository.findByUser(user);
        if (existingClientOpt.isPresent()) {
            BigDecimal currentSaldo = existingClientOpt.get().getSaldoActual();
            if (currentSaldo.compareTo(lastBalance) != 0) {
                throw new IllegalStateException("Inconsistencia: saldo_actual (" + currentSaldo
                        + ") != último balance (" + lastBalance + ")");
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

        // 6) Upsert en clients (hereda id con @MapsId) — sin start/end date aquí
        Client client = existingClientOpt.orElseGet(() -> {
            Client c = new Client();
            c.setUser(user);
            c.setSaldoActual(BigDecimal.ZERO);
            c.setTotalPagos(BigDecimal.ZERO);
            return c;
        });
        client.setSaldoActual(newBalance);
        client.setTotalPagos(client.getTotalPagos().add(request.getAmount()));
        clientRepository.save(client);

        // 7) Promover a CLIENT (unidireccional) + premium y fijar startDate en User si no lo tenía
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
        // 1) Validaciones
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + userId));
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            throw new IllegalArgumentException("El usuario debe ser CLIENT");
        }
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }

        final String op = (request.getOperationType() == null)
                ? "INGRESO"
                : request.getOperationType().toUpperCase();
        if (!"INGRESO".equals(op) && !"GASTO".equals(op)) {
            throw new IllegalArgumentException("operationType no soportado: " + op);
        }

        // 2) Último balance + consistencia
        Optional<Balance> lastBalanceOpt = balanceRepository.findTopByUserIdOrderByTimestampDesc(userId);
        BigDecimal lastBalance = lastBalanceOpt.map(Balance::getBalance).orElse(BigDecimal.ZERO);

        Client client = clientRepository.findByUser(user)
                .orElseThrow(() -> new IllegalStateException("Cliente no encontrado para el usuario " + userId));

        if (client.getSaldoActual().compareTo(lastBalance) != 0) {
            throw new IllegalStateException("Inconsistencia: saldo_actual (" + client.getSaldoActual()
                    + ") != último balance (" + lastBalance + ")");
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

        // 6) Actualizar cliente
        client.setSaldoActual(newBalance);
        if ("INGRESO".equals(op)) {
            client.setTotalPagos(client.getTotalPagos().add(request.getAmount()));
        }
        clientRepository.save(client);
    }

    /**
     * Retirada de fondos por parte de un MODELO.
     * Registra:
     *  - transactions: operation_type = "PAYOUT", amount NEGATIVO (sale dinero del modelo)
     *  - balances: amount NEGATIVO y balance recalculado (prev - amountAbs)
     *  - models: update saldo_actual (prev - amountAbs)
     */
    @Transactional
    public void requestPayout(Long userId, TransactionRequestDTO request) {
        // 1) Validaciones básicas
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }

        // 2) Cargar usuario y validar rol
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + userId));

        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            throw new IllegalArgumentException("El usuario debe tener rol MODEL para solicitar un retiro");
        }

        // 3) Buscar entidad Model (MapsId con User)
        Model model = modelRepository.findByUser(user)
                .orElseThrow(() -> new IllegalStateException("No existe registro de modelo para el usuario: " + userId));

        // 4) Consistencia con balances: último balance = saldo_actual del modelo
        BigDecimal amountAbs = request.getAmount();
        Balance lastBalance = balanceRepository.findTopByUserIdOrderByTimestampDesc(userId).orElse(null);
        BigDecimal previousBalance = (lastBalance != null) ? lastBalance.getBalance() : BigDecimal.ZERO;

        BigDecimal currentSaldo = (model.getSaldoActual() != null) ? model.getSaldoActual() : BigDecimal.ZERO;
        if (previousBalance.compareTo(currentSaldo) != 0) {
            throw new IllegalStateException("Inconsistencia detectada: el último balance (" + previousBalance +
                    ") no coincide con el saldo actual del modelo (" + currentSaldo + ")");
        }

        // 5) Verificar fondos suficientes
        if (currentSaldo.compareTo(amountAbs) < 0) {
            throw new IllegalArgumentException("Saldo insuficiente para completar el retiro");
        }

        // 6) Registrar transacción (amount NEGATIVO para salidas)
        BigDecimal signedAmount = amountAbs.negate();

        Transaction tx = new Transaction();
        tx.setUser(user);                      // ManyToOne User
        tx.setAmount(signedAmount);            // NEGATIVO
        tx.setOperationType("PAYOUT");         // etiqueta de operación
        tx.setDescription(request.getDescription());
        // streamRecord y gift son null en esta operación
        Transaction savedTx = transactionRepository.save(tx);

        // 7) Guardar balance (nuevo balance = previousBalance + signedAmount)
        BigDecimal newBalance = previousBalance.add(signedAmount);

        Balance b = new Balance();
        b.setUserId(userId);
        b.setTransactionId(savedTx.getId());
        b.setOperationType("PAYOUT");
        b.setAmount(signedAmount);             // NEGATIVO
        b.setBalance(newBalance);
        b.setDescription(request.getDescription());
        balanceRepository.save(b);

        // 8) Actualizar Model.saldo_actual
        model.setSaldoActual(newBalance);
        modelRepository.save(model);
    }

    @Transactional
    public Gift processGift(Long clientId, Long modelId, Long giftId, Long streamIdOrNull) {
        User clientUser = userRepository.findById(clientId)
                .orElseThrow(() -> new IllegalArgumentException("Cliente no encontrado: " + clientId));
        if (!Constants.Roles.CLIENT.equals(clientUser.getRole())) {
            throw new IllegalArgumentException("El remitente debe ser CLIENT");
        }
        User modelUser = userRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Modelo no encontrado: " + modelId));
        if (!Constants.Roles.MODEL.equals(modelUser.getRole())) {
            throw new IllegalArgumentException("El destinatario debe ser MODEL");
        }

        Gift gift = giftRepository.findById(giftId)
                .orElseThrow(() -> new IllegalArgumentException("Gift inexistente: " + giftId));
        BigDecimal cost = gift.getCost().setScale(2, RoundingMode.HALF_UP);

        Client client = clientRepository.findByUser(clientUser)
                .orElseThrow(() -> new IllegalStateException("Cliente no encontrado para userId=" + clientId));

        BigDecimal lastClientBalance = balanceRepository.findTopByUserIdOrderByTimestampDesc(clientId)
                .map(Balance::getBalance).orElse(BigDecimal.ZERO);

        // (Opcional) auditoría: detectando desvíos de cache
        if (client.getSaldoActual() != null && lastClientBalance.compareTo(client.getSaldoActual()) != 0) {
            throw new IllegalStateException("Inconsistencia CLIENT: último balance ("+lastClientBalance+") != clients.saldo_actual ("+client.getSaldoActual()+")");
        }

        // Fuente de verdad para validar fondos: ledger
        if (lastClientBalance.compareTo(cost) < 0) {
            throw new IllegalArgumentException("Saldo insuficiente para enviar el regalo");
        }


        // Saldo modelo
        Model model = modelRepository.findByUser(modelUser)
                .orElseGet(() -> { Model m=new Model(); m.setUser(modelUser); m.setUserId(modelId); return m; });
        BigDecimal lastModelBalance = balanceRepository.findTopByUserIdOrderByTimestampDesc(modelId)
                .map(Balance::getBalance).orElse(BigDecimal.ZERO);

        // Split
        BigDecimal share = (giftProperties.getModelShare() != null ? giftProperties.getModelShare() : BigDecimal.ZERO);
        BigDecimal modelEarning    = cost.multiply(share).setScale(2, RoundingMode.HALF_UP);

        BigDecimal platformEarning = cost.subtract(modelEarning).setScale(2, RoundingMode.HALF_UP);

        // (Opcional) enlazar a stream si existe
        StreamRecord stream = null;
        if (streamIdOrNull != null) {
            stream = streamRecordRepository.findById(streamIdOrNull).orElse(null);
        }

        // ===== CLIENTE =====
        Transaction txClient = new Transaction();
        txClient.setUser(clientUser);
        txClient.setAmount(cost.negate());
        txClient.setOperationType("GIFT_SEND");
        txClient.setStreamRecord(stream);
        txClient.setDescription("Regalo: " + gift.getName());
        Transaction savedTxClient = transactionRepository.save(txClient);

        BigDecimal newClientBalance = lastClientBalance.subtract(cost);
        Balance balClient = new Balance();
        balClient.setUserId(clientId);
        balClient.setTransactionId(savedTxClient.getId());
        balClient.setOperationType("GIFT_SEND");
        balClient.setAmount(cost.negate());
        balClient.setBalance(newClientBalance);
        balClient.setDescription("Regalo enviado: " + gift.getName());
        balanceRepository.save(balClient);

        client.setSaldoActual(newClientBalance);
        clientRepository.save(client);

        // ===== MODELO =====
        Transaction txModel = new Transaction();
        txModel.setUser(modelUser);
        txModel.setAmount(modelEarning);
        txModel.setOperationType("GIFT_EARNING");
        txModel.setStreamRecord(stream);
        txModel.setDescription("Ingreso por regalo: " + gift.getName());
        Transaction savedTxModel = transactionRepository.save(txModel);

        BigDecimal newModelBalance = lastModelBalance.add(modelEarning);
        Balance balModel = new Balance();
        balModel.setUserId(modelId);
        balModel.setTransactionId(savedTxModel.getId());
        balModel.setOperationType("GIFT_EARNING");
        balModel.setAmount(modelEarning);
        balModel.setBalance(newModelBalance);
        balModel.setDescription("Ingreso por regalo: " + gift.getName());
        balanceRepository.save(balModel);

        model.setSaldoActual(newModelBalance);
        BigDecimal totalIngresos = model.getTotalIngresos() == null ? BigDecimal.ZERO : model.getTotalIngresos();
        model.setTotalIngresos(totalIngresos.add(modelEarning));
        modelRepository.save(model);

        // ===== Plataforma (margen) =====
        if (platformEarning.compareTo(BigDecimal.ZERO) > 0) {
            PlatformTransaction ptx = new PlatformTransaction();
            ptx.setAmount(platformEarning);
            ptx.setOperationType("GIFT_MARGIN");
            ptx.setStreamRecord(stream);
            ptx.setDescription("Margen por regalo: " + gift.getName());
            PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);

            BigDecimal lastPlatformBalance = platformBalanceRepository.findTopByOrderByTimestampDesc()
                    .map(PlatformBalance::getBalance).orElse(BigDecimal.ZERO);

            PlatformBalance pbal = new PlatformBalance();
            pbal.setTransactionId(savedPtx.getId());
            pbal.setAmount(platformEarning);
            pbal.setBalance(lastPlatformBalance.add(platformEarning));
            pbal.setDescription("Margen por regalo: " + gift.getName());
            platformBalanceRepository.save(pbal);
        }

        return gift;
    }

    // [NEW]
    @Transactional
    public java.math.BigDecimal forfeitOnUnsubscribe(Long userId, String role, String description) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + userId));

        java.math.BigDecimal totalForfeited = java.math.BigDecimal.ZERO;

        // === CLIENTE ===
        if (Constants.Roles.CLIENT.equals(role)) {
            Optional<Client> clientOpt = clientRepository.findByUser(user);
            if (clientOpt.isPresent()) {
                Client client = clientOpt.get();

                java.math.BigDecimal lastBalance = balanceRepository.findTopByUserIdOrderByTimestampDesc(userId)
                        .map(Balance::getBalance).orElse(java.math.BigDecimal.ZERO);

                java.math.BigDecimal saldoCache = client.getSaldoActual() != null ? client.getSaldoActual() : java.math.BigDecimal.ZERO;

                if (saldoCache.compareTo(java.math.BigDecimal.ZERO) > 0 && lastBalance.compareTo(saldoCache) != 0) {
                    throw new IllegalStateException("Inconsistencia CLIENT: último balance (" + lastBalance
                            + ") != clients.saldo_actual (" + saldoCache + ")");
                }

                java.math.BigDecimal saldo = lastBalance;

                if (saldo.compareTo(java.math.BigDecimal.ZERO) > 0) {

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
                    ptx.setDescription("Forfeit usuario " + userId);
                    PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);

                    java.math.BigDecimal lastPlatformBalance = platformBalanceRepository.findTopByOrderByTimestampDesc()
                            .map(PlatformBalance::getBalance).orElse(java.math.BigDecimal.ZERO);

                    PlatformBalance pbal = new PlatformBalance();
                    pbal.setTransactionId(savedPtx.getId());
                    pbal.setAmount(saldo);
                    pbal.setBalance(lastPlatformBalance.add(saldo));
                    pbal.setDescription("Forfeit usuario " + userId);
                    platformBalanceRepository.save(pbal);

                    client.setSaldoActual(java.math.BigDecimal.ZERO);
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

                java.math.BigDecimal lastBalance = balanceRepository.findTopByUserIdOrderByTimestampDesc(userId)
                        .map(Balance::getBalance).orElse(java.math.BigDecimal.ZERO);

                java.math.BigDecimal saldoCache = model.getSaldoActual() != null ? model.getSaldoActual() : java.math.BigDecimal.ZERO;

                if (saldoCache.compareTo(java.math.BigDecimal.ZERO) > 0 && lastBalance.compareTo(saldoCache) != 0) {
                    throw new IllegalStateException("Inconsistencia MODEL: último balance (" + lastBalance
                            + ") != models.saldo_actual (" + saldoCache + ")");
                }

                java.math.BigDecimal saldo = lastBalance;

                if (saldo.compareTo(java.math.BigDecimal.ZERO) > 0) {

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

                    java.math.BigDecimal lastPlatformBalance = platformBalanceRepository.findTopByOrderByTimestampDesc()
                            .map(PlatformBalance::getBalance).orElse(java.math.BigDecimal.ZERO);

                    PlatformBalance pbal = new PlatformBalance();
                    pbal.setTransactionId(savedPtx.getId());
                    pbal.setAmount(saldo);
                    pbal.setBalance(lastPlatformBalance.add(saldo));
                    pbal.setDescription("Forfeit modelo " + userId);
                    platformBalanceRepository.save(pbal);

                    model.setSaldoActual(java.math.BigDecimal.ZERO);
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