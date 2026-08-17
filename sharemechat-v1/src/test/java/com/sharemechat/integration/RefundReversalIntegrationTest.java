package com.sharemechat.integration;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Balance;
import com.sharemechat.entity.Client;
import com.sharemechat.entity.PaymentSession;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.handler.MessagesWsHandlerSupport;
import com.sharemechat.psp.dto.PaymentStatus;
import com.sharemechat.psp.dto.WebhookEvent;
import com.sharemechat.psp.service.PaymentProvider;
import com.sharemechat.psp.service.PaymentProviderRegistry;
import com.sharemechat.psp.service.PspWebhookOrchestratorService;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.PaymentSessionRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * BFPM Fase 4B-b (ADR-012, #D-35): reversal de refund con bonus (política A),
 * end-to-end sobre el orquestador de webhooks PSP contra MySQL real
 * (Testcontainers). Cubre:
 *   - refund de una compra ENTERA -> reversal contable limpio + session REFUNDED
 *     (saldo y total_pagos vuelven a 0);
 *   - refund con saldo ya CONSUMIDO -> NO revierte, session REFUND_REVIEW.
 *
 * <p>El provider se mockea (igual que {@link PspWebhookOrchestratorIntegrationTest})
 * para inyectar un {@link WebhookEvent} controlado. Solo corre en CI
 * (Testcontainers no conecta en local — ver docs/03-environments/test.md §Docker).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class RefundReversalIntegrationTest {

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

    private static final String PROVIDER = "nowpayments";

    @Autowired PspWebhookOrchestratorService orchestrator;
    @Autowired UserRepository userRepository;
    @Autowired PaymentSessionRepository paymentSessionRepository;
    @Autowired ClientRepository clientRepository;
    @Autowired BalanceRepository balanceRepository;
    @Autowired TransactionRepository transactionRepository;

    @MockBean PaymentProviderRegistry providerRegistry;
    @MockBean MessagesWsHandlerSupport wsSupport;

    // ---- helpers ----

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

    private PaymentSession seedPendingSession(Long userId, String packId, String amount,
                                              String orderId, String pspTxId) {
        User u = userRepository.findById(userId).orElseThrow();
        PaymentSession s = new PaymentSession();
        s.setUser(u);
        s.setPackId(packId);
        s.setProvider(PROVIDER);
        s.setAmount(new BigDecimal(amount));
        s.setCurrency("EUR");
        s.setFirstPayment(true);
        s.setStatus("PENDING");
        s.setOrderId(orderId);
        s.setPspTransactionId(pspTxId);
        return paymentSessionRepository.save(s);
    }

    private void stubProvider(WebhookEvent event) throws Exception {
        PaymentProvider provider = mock(PaymentProvider.class);
        when(provider.verifyWebhookSignature(any(), any())).thenReturn(true);
        when(provider.parseWebhook(any())).thenReturn(event);
        when(providerRegistry.find(PROVIDER)).thenReturn(Optional.of(provider));
    }

    private String statusOf(Long sessionId) {
        return paymentSessionRepository.findById(sessionId).orElseThrow().getStatus();
    }

    /** Simula consumo de saldo: apéndice STREAM_CHARGE negativo + actualiza el cache del cliente. */
    private void seedConsumption(Long userId, String amountToSpend) {
        User u = userRepository.findById(userId).orElseThrow();
        BigDecimal spend = new BigDecimal(amountToSpend).negate();
        BigDecimal prev = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(userId)
                .map(Balance::getBalance).orElse(BigDecimal.ZERO);
        BigDecimal after = prev.add(spend);

        Transaction t = new Transaction();
        t.setUser(u);
        t.setAmount(spend);
        t.setOperationType("STREAM_CHARGE");
        t.setDescription("test consumo");
        Transaction saved = transactionRepository.save(t);

        Balance b = new Balance();
        b.setUserId(userId);
        b.setTransactionId(saved.getId());
        b.setOperationType("STREAM_CHARGE");
        b.setAmount(spend);
        b.setBalance(after);
        b.setDescription("test consumo");
        balanceRepository.save(b);

        Client c = clientRepository.findById(userId).orElseThrow();
        c.setSaldoActual(after);
        clientRepository.save(c);
    }

    // ---- tests ----

    @Test
    void refunded_compraEntera_reversalLimpioYSessionRefunded() throws Exception {
        Long userId = persistFormClient("refund-ok", "refund-ok@example.test");
        PaymentSession s = seedPendingSession(userId, "P40", "40.00", "ord-refund-ok", "psp-refund-ok");

        // Acredita el pack (P40 -> INGRESO 40 + BONUS_GRANT 4 = 44; total_pagos 40).
        stubProvider(new WebhookEvent("ev-ok-1", "psp-refund-ok", "payment", "ord-refund-ok",
                PaymentStatus.SUCCESS, "finished"));
        orchestrator.processWebhook(PROVIDER, "{}".getBytes(), Map.of());
        assertThat(statusOf(s.getId())).isEqualTo("SUCCESS");
        Client credited = clientRepository.findById(userId).orElseThrow();
        assertThat(credited.getSaldoActual()).isEqualByComparingTo("44.00");
        assertThat(credited.getTotalPagos()).isEqualByComparingTo("40.00");

        // Refund -> reversal contable limpio.
        stubProvider(new WebhookEvent("ev-ok-2", "psp-refund-ok", "payment", "ord-refund-ok",
                PaymentStatus.REFUNDED, "refunded"));
        orchestrator.processWebhook(PROVIDER, "{}".getBytes(), Map.of());

        assertThat(statusOf(s.getId())).isEqualTo("REFUNDED");
        Client reversed = clientRepository.findById(userId).orElseThrow();
        assertThat(reversed.getSaldoActual()).isEqualByComparingTo("0.00");
        assertThat(reversed.getTotalPagos()).isEqualByComparingTo("0.00");
    }

    @Test
    void refunded_saldoConsumido_bloqueaYSessionRefundReview() throws Exception {
        Long userId = persistFormClient("refund-consumed", "refund-consumed@example.test");
        PaymentSession s = seedPendingSession(userId, "P40", "40.00", "ord-refund-consumed", "psp-refund-consumed");

        stubProvider(new WebhookEvent("ev-c-1", "psp-refund-consumed", "payment", "ord-refund-consumed",
                PaymentStatus.SUCCESS, "finished"));
        orchestrator.processWebhook(PROVIDER, "{}".getBytes(), Map.of());
        assertThat(clientRepository.findById(userId).orElseThrow().getSaldoActual())
                .isEqualByComparingTo("44.00");

        // Consume 10 -> saldo 34 < credited 44.
        seedConsumption(userId, "10.00");
        assertThat(clientRepository.findById(userId).orElseThrow().getSaldoActual())
                .isEqualByComparingTo("34.00");

        stubProvider(new WebhookEvent("ev-c-2", "psp-refund-consumed", "payment", "ord-refund-consumed",
                PaymentStatus.REFUNDED, "refunded"));
        orchestrator.processWebhook(PROVIDER, "{}".getBytes(), Map.of());

        // Bloqueado: session a revisión, saldo intacto (sin reversal parcial).
        assertThat(statusOf(s.getId())).isEqualTo("REFUND_REVIEW");
        assertThat(clientRepository.findById(userId).orElseThrow().getSaldoActual())
                .isEqualByComparingTo("34.00");
    }
}
