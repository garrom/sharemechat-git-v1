package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.TransactionRequestDTO;
import com.sharemechat.entity.Balance;
import com.sharemechat.entity.Client;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final BalanceRepository balanceRepository;
    private final ClientRepository clientRepository;
    private final UserRepository userRepository;

    public TransactionService(TransactionRepository transactionRepository,
                              BalanceRepository balanceRepository,
                              ClientRepository clientRepository,
                              UserRepository userRepository) {
        this.transactionRepository = transactionRepository;
        this.balanceRepository = balanceRepository;
        this.clientRepository = clientRepository;
        this.userRepository = userRepository;
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
        user.setIsPremium(true);
        if (user.getStartDate() == null) {
            user.setStartDate(LocalDate.now());
        }
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
}
