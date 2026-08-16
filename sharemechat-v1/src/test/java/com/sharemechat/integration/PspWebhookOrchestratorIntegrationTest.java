package com.sharemechat.integration;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.PaymentSession;
import com.sharemechat.entity.User;
import com.sharemechat.handler.MessagesWsHandlerSupport;
import com.sharemechat.psp.dto.PaymentStatus;
import com.sharemechat.psp.dto.WebhookEvent;
import com.sharemechat.psp.service.PaymentProvider;
import com.sharemechat.psp.service.PaymentProviderRegistry;
import com.sharemechat.psp.service.PspWebhookOrchestratorService;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.PaymentSessionRepository;
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
 * ADR-059 — cobertura del orquestador de webhooks PSP (dinero, ADR-051/053).
 * Foco: la decisión de TOLERANCIA de pagos parciales cripto que cambió con
 * cosmo-payments (3% del pack, suelo 0,50€, techo 5€) y el crédito BFPM
 * resultante — hasta ahora SIN test pese a mover dinero real.
 *
 * <p>El provider (firma HMAC + parse) tiene su propio test; aquí se MOCKEA
 * el {@link PaymentProviderRegistry} para devolver un {@link WebhookEvent}
 * controlado y ejercitar el orquestador de punta a punta contra MySQL real
 * (Testcontainers): lookup con lock, decisión de tolerancia, y el crédito
 * real vía {@code TransactionService.creditPackWithBonus}.
 *
 * <p>Solo corre en CI (Testcontainers no conecta en local — ver
 * docs/03-environments/test.md §Docker).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class PspWebhookOrchestratorIntegrationTest {

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

    @MockBean PaymentProviderRegistry providerRegistry;
    @MockBean MessagesWsHandlerSupport wsSupport; // el notify WS es best-effort; lo aislamos

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

    // ---- tests ----

    @Test
    void finished_acreditaPackMasBonoYPoneSessionSuccess() throws Exception {
        Long userId = persistFormClient("psp-finished", "psp-finished@example.test");
        PaymentSession s = seedPendingSession(userId, "P40", "40.00", "ord-finished-1", "psp-finished-1");
        stubProvider(new WebhookEvent("ev-fin-1", "psp-finished-1", "payment", "ord-finished-1",
                PaymentStatus.SUCCESS, "finished"));

        boolean handled = orchestrator.processWebhook(PROVIDER, "{}".getBytes(), Map.of());

        assertThat(handled).isTrue();
        assertThat(statusOf(s.getId())).isEqualTo("SUCCESS");
        // P40: INGRESO 40 + BONUS_GRANT 4 = 44 de saldo acreditado.
        assertThat(clientRepository.findById(userId).orElseThrow().getSaldoActual())
                .isEqualByComparingTo("44.00");
    }

    @Test
    void partiallyPaid_dentroDeTolerancia_acreditaComoSuccess() throws Exception {
        Long userId = persistFormClient("psp-partial-ok", "psp-partial-ok@example.test");
        PaymentSession s = seedPendingSession(userId, "P40", "40.00", "ord-partial-ok", "psp-partial-ok");
        // P40 -> allowed = max(40×3%, 0,50€) topado 5 = 1,20€. Falta 1,00€ (ratio 0,975) ≤ 1,20 -> acepta.
        stubProvider(new WebhookEvent("ev-partial-ok", "psp-partial-ok", "payment", "ord-partial-ok",
                PaymentStatus.FAILED, "partially_paid", new BigDecimal("100"), new BigDecimal("97.5")));

        orchestrator.processWebhook(PROVIDER, "{}".getBytes(), Map.of());

        assertThat(statusOf(s.getId())).isEqualTo("SUCCESS");
        assertThat(clientRepository.findById(userId).orElseThrow().getSaldoActual())
                .isEqualByComparingTo("44.00");
    }

    @Test
    void partiallyPaid_fueraDeTolerancia_quedaFailedSinAcreditar() throws Exception {
        Long userId = persistFormClient("psp-partial-ko", "psp-partial-ko@example.test");
        PaymentSession s = seedPendingSession(userId, "P40", "40.00", "ord-partial-ko", "psp-partial-ko");
        // Falta 2,00€ (ratio 0,95) > 1,20€ -> NO acepta.
        stubProvider(new WebhookEvent("ev-partial-ko", "psp-partial-ko", "payment", "ord-partial-ko",
                PaymentStatus.FAILED, "partially_paid", new BigDecimal("100"), new BigDecimal("95")));

        orchestrator.processWebhook(PROVIDER, "{}".getBytes(), Map.of());

        assertThat(statusOf(s.getId())).isEqualTo("FAILED");
        // Sin crédito -> el USER no fue promocionado a CLIENT, no hay fila client.
        assertThat(clientRepository.findById(userId)).isEmpty();
    }

    @Test
    void partiallyPaid_sinCamposCripto_noAplicaToleranciaYQuedaFailed() throws Exception {
        Long userId = persistFormClient("psp-partial-null", "psp-partial-null@example.test");
        PaymentSession s = seedPendingSession(userId, "P40", "40.00", "ord-partial-null", "psp-partial-null");
        stubProvider(new WebhookEvent("ev-partial-null", "psp-partial-null", "payment", "ord-partial-null",
                PaymentStatus.FAILED, "partially_paid", null, null));

        orchestrator.processWebhook(PROVIDER, "{}".getBytes(), Map.of());

        assertThat(statusOf(s.getId())).isEqualTo("FAILED");
        assertThat(clientRepository.findById(userId)).isEmpty();
    }
}
