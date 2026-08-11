package com.sharemechat.integration;

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
import com.sharemechat.service.TransactionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-059 Fase 1: primer test de integración a nivel SERVICIO con el contexto
 * Spring COMPLETO.
 *
 * <p>Sube un escalón sobre {@link MoneyPersistenceIntegrationTest} (que solo
 * probaba el slice de persistencia): aquí arranca el ApplicationContext entero
 * (perfil {@code ci}, vendors OFF, servicios externos lazy/offline) contra un
 * MySQL real de Testcontainers con las 51 migraciones Flyway aplicadas, y
 * ejercita el bean real {@link TransactionService} — con su proxy
 * {@code @Transactional} activo — sobre el path crítico de dinero.
 *
 * <p>Caso: {@code processFirstTransaction} (primer pago que activa premium).
 * Verifica los 4 efectos atómicos del método: fila en {@code transactions}
 * (INGRESO), fila en {@code balances} (saldo acumulado), upsert en
 * {@code clients} (saldo_actual/total_pagos) y promoción de rol USER→CLIENT.
 *
 * <p>El método usa {@code SELECT ... FOR UPDATE} (findByIdForUpdate), por eso
 * exige MySQL real y no un H2. El método de test es {@code @Transactional}:
 * revierte al terminar, dejando la BD limpia entre ejecuciones.
 *
 * <p>Requiere Docker (disponible en el runner de CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class TransactionServiceIntegrationTest {

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.0")
            .withDatabaseName("sharemechat_it");

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
    }

    @Autowired TransactionService transactionService;
    @Autowired UserRepository userRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired BalanceRepository balanceRepository;
    @Autowired ClientRepository clientRepository;

    @Test
    @Transactional
    void processFirstTransaction_crea_ledger_y_promueve_rol() {
        // --- Arrange: USER + FORM_CLIENT con KYC de cliente aprobado (pasa ClientKycGate) ---
        User u = new User();
        u.setNickname("ci-first-pay");
        u.setEmail("ci-first-pay@example.test");
        u.setPassword("x"); // NOT NULL; no participa en este flujo
        u.setRole(Constants.Roles.USER);
        u.setUserType(Constants.UserTypes.FORM_CLIENT);
        u.setUiLocale("es");
        u.setClientKycStatus(Constants.VerificationStatuses.APPROVED);
        u = userRepository.save(u);
        final Long userId = u.getId();

        TransactionRequestDTO req = new TransactionRequestDTO();
        req.setAmount(new BigDecimal("20.00"));
        req.setOperationType("INGRESO");
        req.setDescription("primer pago (CI)");

        // --- Act ---
        transactionService.processFirstTransaction(userId, req);

        // --- Assert: los 4 efectos del primer pago ---

        // 1) users.role: USER -> CLIENT
        User reloaded = userRepository.findById(userId).orElseThrow();
        assertThat(reloaded.getRole()).isEqualTo(Constants.Roles.CLIENT);

        // 2) balances: última fila con saldo acumulado 20.00 e INGRESO
        Optional<Balance> bal = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(userId);
        assertThat(bal).isPresent();
        assertThat(bal.get().getBalance()).isEqualByComparingTo("20.00");
        assertThat(bal.get().getAmount()).isEqualByComparingTo("20.00");
        assertThat(bal.get().getOperationType()).isEqualTo("INGRESO");

        // 3) transactions: la fila referenciada por el balance es un INGRESO de 20.00
        Optional<Transaction> tx = transactionRepository.findById(bal.get().getTransactionId());
        assertThat(tx).isPresent();
        assertThat(tx.get().getAmount()).isEqualByComparingTo("20.00");
        assertThat(tx.get().getOperationType()).isEqualTo("INGRESO");

        // 4) clients: saldo_actual y total_pagos == 20.00
        Optional<Client> client = clientRepository.findByUser(reloaded);
        assertThat(client).isPresent();
        assertThat(client.get().getSaldoActual()).isEqualByComparingTo("20.00");
        assertThat(client.get().getTotalPagos()).isEqualByComparingTo("20.00");
    }
}
