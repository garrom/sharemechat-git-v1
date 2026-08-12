package com.sharemechat.integration;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.TransactionRequestDTO;
import com.sharemechat.entity.Balance;
import com.sharemechat.entity.Client;
import com.sharemechat.entity.PlatformTransaction;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.PlatformTransactionRepository;
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
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ADR-059 Fase 1: tests de integración a nivel SERVICIO del path de dinero, con
 * el contexto Spring COMPLETO.
 *
 * <p>Arranca el ApplicationContext entero (perfil {@code ci}, vendors OFF,
 * servicios externos lazy/offline) contra un MySQL real de Testcontainers con el
 * esquema real aplicado desde el baseline determinista
 * ({@code classpath:db/migration-it}, ver
 * {@link MoneyPersistenceIntegrationTest} y docs/pending-hardening §Parte 7), y
 * ejercita el bean real {@link TransactionService} — con su proxy
 * {@code @Transactional} activo — sobre los métodos de dinero del cliente.
 *
 * <p>Cubre: primer pago (activación premium), recarga de pack con bonus
 * (doble ledger cliente↔plataforma) y los guards de {@code addBalance}
 * (saldo insuficiente en GASTO, y que GASTO no altera total_pagos). Los métodos
 * usan {@code SELECT ... FOR UPDATE}, por eso exigen MySQL real. Cada test es
 * {@code @Transactional}: revierte al terminar, dejando la BD limpia.
 *
 * <p>Pendiente (mismo frente, requiere setup de Model + tramo + Gift):
 * {@code processGift}/{@code processGiftInChat} (regalo cliente→modelo con
 * reparto por tramo y lock de 2 wallets).
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
    @Autowired PlatformTransactionRepository platformTransactionRepository;

    // --- Helpers ---

    /** USER + FORM_CLIENT con KYC de cliente aprobado (pasa ClientKycGate). Devuelve su id. */
    private Long persistFormClient(String nick, String email) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x"); // NOT NULL; no participa en estos flujos
        u.setRole(Constants.Roles.USER);
        u.setUserType(Constants.UserTypes.FORM_CLIENT);
        u.setUiLocale("es");
        u.setClientKycStatus(Constants.VerificationStatuses.APPROVED);
        return userRepository.save(u).getId();
    }

    private static TransactionRequestDTO dto(String amount, String operationType, String description) {
        TransactionRequestDTO d = new TransactionRequestDTO();
        d.setAmount(new BigDecimal(amount));
        d.setOperationType(operationType);
        d.setDescription(description);
        return d;
    }

    private Client reloadClient(Long userId) {
        User u = userRepository.findById(userId).orElseThrow();
        return clientRepository.findByUser(u).orElseThrow();
    }

    // --- Tests ---

    @Test
    @Transactional
    void processFirstTransaction_crea_ledger_y_promueve_rol() {
        Long userId = persistFormClient("ci-first-pay", "ci-first-pay@example.test");

        transactionService.processFirstTransaction(userId, dto("20.00", "INGRESO", "primer pago (CI)"));

        // 1) users.role: USER -> CLIENT
        assertThat(userRepository.findById(userId).orElseThrow().getRole())
                .isEqualTo(Constants.Roles.CLIENT);

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
        Client client = reloadClient(userId);
        assertThat(client.getSaldoActual()).isEqualByComparingTo("20.00");
        assertThat(client.getTotalPagos()).isEqualByComparingTo("20.00");
    }

    @Test
    @Transactional
    void creditPackWithBonus_conBonus_dobleLedger_cliente_y_plataforma() {
        Long userId = persistFormClient("ci-pack-bonus", "ci-pack-bonus@example.test");

        // Pack de 20.00 con 5.00 de bonus financiado por la plataforma, primer pago.
        transactionService.creditPackWithBonus(
                userId, new BigDecimal("20.00"), new BigDecimal("5.00"),
                "order-1", "pack-1", true, "TEST");

        // Cliente: la última fila de balance refleja INGRESO(20) + BONUS_GRANT(5) = 25.00.
        Balance bal = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(userId).orElseThrow();
        assertThat(bal.getBalance()).isEqualByComparingTo("25.00");
        assertThat(bal.getOperationType()).isEqualTo(Constants.OperationTypes.BONUS_GRANT);

        // clients: saldo = 25.00 (price+bonus) pero total_pagos = 20.00 (el bonus NO es pago).
        Client client = reloadClient(userId);
        assertThat(client.getSaldoActual()).isEqualByComparingTo("25.00");
        assertThat(client.getTotalPagos()).isEqualByComparingTo("20.00");

        // firstPayment promueve el rol.
        assertThat(userRepository.findById(userId).orElseThrow().getRole())
                .isEqualTo(Constants.Roles.CLIENT);

        // Plataforma: asiento BONUS_FUNDING por -5.00 (la plataforma asume el coste del bonus).
        List<PlatformTransaction> funders = platformTransactionRepository.findAll().stream()
                .filter(p -> Constants.OperationTypes.BONUS_FUNDING.equals(p.getOperationType()))
                .collect(Collectors.toList());
        assertThat(funders).hasSize(1);
        assertThat(funders.get(0).getAmount()).isEqualByComparingTo("-5.00");
    }

    @Test
    @Transactional
    void addBalance_gasto_con_saldo_insuficiente_lanza() {
        Long userId = persistFormClient("ci-gasto-insuf", "ci-gasto-insuf@example.test");
        // Estado consistente: saldo 20.00 (recarga simple sin bonus, promueve a CLIENT).
        transactionService.creditPackWithBonus(
                userId, new BigDecimal("20.00"), BigDecimal.ZERO,
                "order-2", "pack-2", true, "TEST");

        // El guard de saldo insuficiente corta ANTES de escribir Transaction/Balance,
        // así que rechazar el GASTO es lo que impide dejar el balance en negativo.
        // (No se comprueba estado tras la excepción: al unirse a la tx del test, el
        // rollback-only del método haría frágiles las lecturas posteriores.)
        assertThatThrownBy(() ->
                transactionService.addBalance(userId, dto("100.00", "GASTO", "compra cara")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Saldo insuficiente");
    }

    @Test
    @Transactional
    void addBalance_gasto_baja_saldo_sin_tocar_total_pagos() {
        Long userId = persistFormClient("ci-gasto-ok", "ci-gasto-ok@example.test");
        // Saldo 20.00, total_pagos 20.00.
        transactionService.creditPackWithBonus(
                userId, new BigDecimal("20.00"), BigDecimal.ZERO,
                "order-3", "pack-3", true, "TEST");

        transactionService.addBalance(userId, dto("5.00", "GASTO", "compra"));

        Client client = reloadClient(userId);
        assertThat(client.getSaldoActual()).isEqualByComparingTo("15.00"); // 20 - 5
        assertThat(client.getTotalPagos()).isEqualByComparingTo("20.00");  // GASTO no toca total_pagos
    }
}
