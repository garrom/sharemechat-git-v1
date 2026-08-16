package com.sharemechat.integration;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Balance;
import com.sharemechat.entity.Client;
import com.sharemechat.entity.PlatformTransaction;
import com.sharemechat.entity.User;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.PlatformTransactionRepository;
import com.sharemechat.repository.PromoGrantCounterRepository;
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
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-012 / promo "100 primeros clientes": tests de integración del bono de
 * bienvenida (BONUS_GRANT/BONUS_FUNDING) concedido en el PRIMER pago mientras
 * quede cupo. Contexto Spring completo contra MySQL real (Testcontainers), con
 * la migración V52 (tabla promo_grant_counter) aplicada.
 *
 * <p>La promo se enciende SOLO en esta clase vía {@code @DynamicPropertySource}
 * (enabled=true, cap=1, amount=10.00), sin afectar al resto de la suite (donde
 * la promo está apagada por default y los asserts de saldo no cambian).
 *
 * <p>Cada test es {@code @Transactional}: revierte al terminar, así que el
 * contador vuelve a 0 (valor sembrado por V52) entre tests.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class PromoWelcomeIntegrationTest {

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.0")
            .withDatabaseName("sharemechat_it");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        // Promo ON solo para esta clase.
        registry.add("product.promo.welcome.enabled", () -> "true");
        registry.add("product.promo.welcome.cap", () -> "1");
        registry.add("product.promo.welcome.amount-eur", () -> "10.00");
        registry.add("product.promo.welcome.promo-key", () -> "WELCOME_100");
    }

    @Autowired TransactionService transactionService;
    @Autowired UserRepository userRepository;
    @Autowired BalanceRepository balanceRepository;
    @Autowired ClientRepository clientRepository;
    @Autowired PlatformTransactionRepository platformTransactionRepository;
    @Autowired PromoGrantCounterRepository promoGrantCounterRepository;

    private Long persistFormClient(String nick, String email) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x");
        u.setRole(Constants.Roles.USER);
        u.setUserType(Constants.UserTypes.FORM_CLIENT);
        u.setUiLocale("es");
        u.setClientKycStatus(Constants.VerificationStatuses.APPROVED);
        return userRepository.save(u).getId();
    }

    private Client reloadClient(Long userId) {
        User u = userRepository.findById(userId).orElseThrow();
        return clientRepository.findByUser(u).orElseThrow();
    }

    private long promoBonusFundingCount() {
        return platformTransactionRepository.findAll().stream()
                .filter(p -> Constants.OperationTypes.BONUS_FUNDING.equals(p.getOperationType()))
                .filter(p -> p.getDescription() != null && p.getDescription().contains("promo=welcome100"))
                .count();
    }

    @Test
    @Transactional
    void primerPago_conCupo_concedeBonoPromoExtra() {
        Long userId = persistFormClient("ci-promo-1", "ci-promo-1@example.test");

        // Primer pago de 20€ SIN pack-bonus. La promo añade +10€.
        transactionService.creditPackWithBonus(
                userId, new BigDecimal("20.00"), BigDecimal.ZERO,
                "order-p1", "pack-min", true, "TEST");

        // Saldo final = 20 (INGRESO) + 10 (promo) = 30; última fila BONUS_GRANT.
        Balance bal = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(userId).orElseThrow();
        assertThat(bal.getBalance()).isEqualByComparingTo("30.00");
        assertThat(bal.getOperationType()).isEqualTo(Constants.OperationTypes.BONUS_GRANT);

        // clients: saldo 30, total_pagos 20 (el bono promo NO es pago).
        Client client = reloadClient(userId);
        assertThat(client.getSaldoActual()).isEqualByComparingTo("30.00");
        assertThat(client.getTotalPagos()).isEqualByComparingTo("20.00");

        // Plataforma: BONUS_FUNDING promo -10.00 (invariante BFPM).
        List<PlatformTransaction> promoFunders = platformTransactionRepository.findAll().stream()
                .filter(p -> Constants.OperationTypes.BONUS_FUNDING.equals(p.getOperationType()))
                .filter(p -> p.getDescription() != null && p.getDescription().contains("promo=welcome100"))
                .collect(Collectors.toList());
        assertThat(promoFunders).hasSize(1);
        assertThat(promoFunders.get(0).getAmount()).isEqualByComparingTo("-10.00");

        // Contador: 1 concedido.
        assertThat(promoGrantCounterRepository.findById("WELCOME_100").orElseThrow().getGranted())
                .isEqualTo(1);
    }

    @Test
    @Transactional
    void cupoLleno_noConcedeAlSiguiente() {
        // cap=1: el primer cliente agota el cupo.
        Long a = persistFormClient("ci-promo-a", "ci-promo-a@example.test");
        transactionService.creditPackWithBonus(
                a, new BigDecimal("20.00"), BigDecimal.ZERO, "order-a", "pack-min", true, "TEST");

        // Segundo cliente, también primer pago: NO recibe promo (cupo lleno).
        Long b = persistFormClient("ci-promo-b", "ci-promo-b@example.test");
        transactionService.creditPackWithBonus(
                b, new BigDecimal("20.00"), BigDecimal.ZERO, "order-b", "pack-min", true, "TEST");

        Balance balB = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(b).orElseThrow();
        assertThat(balB.getBalance()).isEqualByComparingTo("20.00"); // solo INGRESO
        assertThat(balB.getOperationType()).isEqualTo("INGRESO");
        assertThat(reloadClient(b).getSaldoActual()).isEqualByComparingTo("20.00");

        // Solo se concedió 1 bono promo en total.
        assertThat(promoBonusFundingCount()).isEqualTo(1L);
        assertThat(promoGrantCounterRepository.findById("WELCOME_100").orElseThrow().getGranted())
                .isEqualTo(1);
    }

    @Test
    @Transactional
    void recargaNoPrimerPago_noConcedePromo() {
        Long userId = persistFormClient("ci-promo-2", "ci-promo-2@example.test");
        // Primer pago (se convierte en CLIENT; consume el bono promo).
        transactionService.creditPackWithBonus(
                userId, new BigDecimal("20.00"), BigDecimal.ZERO, "order-f", "pack-min", true, "TEST");

        // Recarga posterior (NO primer pago): +20 INGRESO, sin promo.
        transactionService.creditPackWithBonus(
                userId, new BigDecimal("20.00"), BigDecimal.ZERO, "order-2", "pack-min", false, "TEST");

        // Última fila: INGRESO de la 2ª recarga; saldo = 30 (1ª:20+10 promo) + 20 = 50.
        Balance bal = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(userId).orElseThrow();
        assertThat(bal.getOperationType()).isEqualTo("INGRESO");
        assertThat(reloadClient(userId).getSaldoActual()).isEqualByComparingTo("50.00");

        // La 2ª recarga no añadió otro bono promo: sigue habiendo 1.
        assertThat(promoBonusFundingCount()).isEqualTo(1L);
    }
}
