package com.sharemechat.integration;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.KycSession;
import com.sharemechat.entity.KycWebhookEvent;
import com.sharemechat.entity.User;
import com.sharemechat.repository.KycSessionRepository;
import com.sharemechat.repository.KycWebhookEventRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.HmacSha256;
import com.sharemechat.service.KycSessionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-059: tests de INTEGRACIÓN del procesado de webhooks KYC
 * ({@link KycSessionService#processVeriffWebhook} / {@code processDiditWebhook}).
 * Es el flujo real punta a punta que decide la verificación: firma HMAC →
 * idempotencia → sesión → estado interno → actualización del user + auditoría.
 *
 * <p>@SpringBootTest + MySQL real (perfil ci). El secret HMAC se fija por
 * {@code @DynamicPropertySource} ({@code kyc.veriff/didit.api-secret}) y la firma
 * válida se computa con la MISMA utilidad {@link HmacSha256#hexHmacSha256}. El
 * vendor client NO interviene en webhooks (solo en start-session), así que no se
 * mockea. Tests SIN {@code @Transactional} con RELECTURA FRESCA tras el commit.
 *
 * <p>Cubre: Veriff firma válida code 9001→APPROVED (+user), firma inválida→false
 * sin cambios + auditoría {@code invalid_signature}, code 9102→REJECTED,
 * idempotencia por event_id; Didit CLIENT "Approved"→clientKycStatus APPROVED,
 * timestamp stale→false + {@code invalid_timestamp}. Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class KycWebhookIntegrationTest {

    private static final String VERIFF_SECRET = "test-veriff-secret-abc123";
    private static final String DIDIT_SECRET = "test-didit-secret-xyz789";

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.0")
            .withDatabaseName("sharemechat_it");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        // Secrets HMAC conocidos para poder firmar payloads válidos en el test.
        registry.add("kyc.veriff.api-secret", () -> VERIFF_SECRET);
        registry.add("kyc.didit.api-secret", () -> DIDIT_SECRET);
    }

    @Autowired KycSessionService kycService;
    @Autowired UserRepository userRepository;
    @Autowired KycSessionRepository kycSessionRepository;
    @Autowired KycWebhookEventRepository webhookRepository;

    private Long persistUser(String role, String userType, String nick, String email) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x");
        u.setRole(role);
        u.setUserType(userType);
        u.setUiLocale("es");
        u.setVerificationStatus(Constants.VerificationStatuses.PENDING);
        u.setClientKycStatus(Constants.VerificationStatuses.PENDING);
        return userRepository.save(u).getId();
    }

    private Long persistKycSession(Long userId, String provider, String sessionId, String sessionType) {
        KycSession s = new KycSession();
        s.setUserId(userId);
        s.setProvider(provider);
        s.setProviderSessionId(sessionId);
        s.setProviderStatus("started"); // NOT NULL
        s.setKycStatus(Constants.VerificationStatuses.PENDING);
        s.setSessionType(sessionType);
        return kycSessionRepository.saveAndFlush(s).getId();
    }

    private static byte[] bytes(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    private static String signVeriff(byte[] body) {
        return HmacSha256.hexHmacSha256(VERIFF_SECRET, body);
    }

    private static String signDidit(byte[] body) {
        return HmacSha256.hexHmacSha256(DIDIT_SECRET, body);
    }

    // ---------------- Veriff ----------------

    @Test
    void veriff_firma_valida_code_9001_aprueba_sesion_y_user() {
        Long userId = persistUser(Constants.Roles.USER, Constants.UserTypes.FORM_MODEL,
                "ci-kyc-v-ok", "ci-kyc-v-ok@example.test");
        Long sessId = persistKycSession(userId, "VERIFF", "vs-approve", Constants.SessionTypes.MODEL);

        byte[] body = bytes("{\"verification\":{\"id\":\"vs-approve\",\"attemptId\":\"att-approve\",\"status\":\"approved\",\"code\":9001}}");
        boolean ok = kycService.processVeriffWebhook(body, signVeriff(body));

        assertThat(ok).isTrue();
        KycSession s = kycSessionRepository.findById(sessId).orElseThrow();
        assertThat(s.getKycStatus()).isEqualTo(Constants.VerificationStatuses.APPROVED);
        assertThat(s.getDecidedAt()).isNotNull();
        assertThat(userRepository.findById(userId).orElseThrow().getVerificationStatus())
                .isEqualTo(Constants.VerificationStatuses.APPROVED);

        KycWebhookEvent ev = webhookRepository.findByProviderAndProviderEventId("VERIFF", "att-approve").orElseThrow();
        assertThat(ev.isSignatureValid()).isTrue();
        assertThat(ev.isProcessed()).isTrue();
    }

    @Test
    void veriff_firma_invalida_no_procesa_y_audita_el_intento() {
        Long userId = persistUser(Constants.Roles.USER, Constants.UserTypes.FORM_MODEL,
                "ci-kyc-v-bad", "ci-kyc-v-bad@example.test");
        Long sessId = persistKycSession(userId, "VERIFF", "vs-badsig", Constants.SessionTypes.MODEL);

        byte[] body = bytes("{\"verification\":{\"id\":\"vs-badsig\",\"attemptId\":\"att-badsig\",\"status\":\"approved\",\"code\":9001}}");
        boolean ok = kycService.processVeriffWebhook(body, "deadbeefbadsignature");

        assertThat(ok).isFalse();
        // Sesión y user intactos.
        assertThat(kycSessionRepository.findById(sessId).orElseThrow().getKycStatus())
                .isEqualTo(Constants.VerificationStatuses.PENDING);
        assertThat(userRepository.findById(userId).orElseThrow().getVerificationStatus())
                .isEqualTo(Constants.VerificationStatuses.PENDING);

        KycWebhookEvent ev = webhookRepository.findByProviderAndProviderEventId("VERIFF", "att-badsig").orElseThrow();
        assertThat(ev.isSignatureValid()).isFalse();
        assertThat(ev.isProcessed()).isFalse();
        assertThat(ev.getProcessingError()).isEqualTo("invalid_signature");
    }

    @Test
    void veriff_code_9102_rechaza_sesion_y_user() {
        Long userId = persistUser(Constants.Roles.USER, Constants.UserTypes.FORM_MODEL,
                "ci-kyc-v-rej", "ci-kyc-v-rej@example.test");
        Long sessId = persistKycSession(userId, "VERIFF", "vs-reject", Constants.SessionTypes.MODEL);

        byte[] body = bytes("{\"verification\":{\"id\":\"vs-reject\",\"attemptId\":\"att-reject\",\"status\":\"declined\",\"code\":9102}}");
        boolean ok = kycService.processVeriffWebhook(body, signVeriff(body));

        assertThat(ok).isTrue();
        assertThat(kycSessionRepository.findById(sessId).orElseThrow().getKycStatus())
                .isEqualTo(Constants.VerificationStatuses.REJECTED);
        assertThat(userRepository.findById(userId).orElseThrow().getVerificationStatus())
                .isEqualTo(Constants.VerificationStatuses.REJECTED);
    }

    @Test
    void veriff_es_idempotente_por_event_id() {
        Long userId = persistUser(Constants.Roles.USER, Constants.UserTypes.FORM_MODEL,
                "ci-kyc-v-idem", "ci-kyc-v-idem@example.test");
        Long sessId = persistKycSession(userId, "VERIFF", "vs-idem", Constants.SessionTypes.MODEL);

        byte[] body = bytes("{\"verification\":{\"id\":\"vs-idem\",\"attemptId\":\"att-idem\",\"status\":\"approved\",\"code\":9001}}");
        String sig = signVeriff(body);

        assertThat(kycService.processVeriffWebhook(body, sig)).isTrue();
        // Segundo envío idéntico: idempotente, no re-procesa ni rompe.
        assertThat(kycService.processVeriffWebhook(body, sig)).isTrue();

        assertThat(kycSessionRepository.findById(sessId).orElseThrow().getKycStatus())
                .isEqualTo(Constants.VerificationStatuses.APPROVED);
        // La UNIQUE (provider, event_id) garantiza una sola fila de auditoría.
        assertThat(webhookRepository.findByProviderAndProviderEventId("VERIFF", "att-idem")).isPresent();
    }

    // ---------------- Didit ----------------

    @Test
    void didit_client_approved_aprueba_client_kyc_status() {
        Long userId = persistUser(Constants.Roles.USER, Constants.UserTypes.FORM_CLIENT,
                "ci-kyc-d-ok", "ci-kyc-d-ok@example.test");
        Long sessId = persistKycSession(userId, "DIDIT", "ds-client", Constants.SessionTypes.CLIENT);

        byte[] body = bytes("{\"session_id\":\"ds-client\",\"event_id\":\"de-client\",\"status\":\"Approved\",\"webhook_type\":\"status.updated\"}");
        String ts = String.valueOf(Instant.now().getEpochSecond());
        boolean ok = kycService.processDiditWebhook(body, signDidit(body), ts);

        assertThat(ok).isTrue();
        assertThat(kycSessionRepository.findById(sessId).orElseThrow().getKycStatus())
                .isEqualTo(Constants.VerificationStatuses.APPROVED);
        assertThat(userRepository.findById(userId).orElseThrow().getClientKycStatus())
                .isEqualTo(Constants.VerificationStatuses.APPROVED);
    }

    @Test
    void didit_timestamp_stale_se_rechaza_sin_procesar() {
        Long userId = persistUser(Constants.Roles.USER, Constants.UserTypes.FORM_CLIENT,
                "ci-kyc-d-stale", "ci-kyc-d-stale@example.test");
        Long sessId = persistKycSession(userId, "DIDIT", "ds-stale", Constants.SessionTypes.CLIENT);

        byte[] body = bytes("{\"session_id\":\"ds-stale\",\"event_id\":\"de-stale\",\"status\":\"Approved\"}");
        String staleTs = String.valueOf(Instant.now().getEpochSecond() - 1000); // fuera de la ventana 300s
        boolean ok = kycService.processDiditWebhook(body, signDidit(body), staleTs);

        assertThat(ok).isFalse();
        assertThat(kycSessionRepository.findById(sessId).orElseThrow().getKycStatus())
                .isEqualTo(Constants.VerificationStatuses.PENDING); // sin cambios

        KycWebhookEvent ev = webhookRepository.findByProviderAndProviderEventId("DIDIT", "de-stale").orElseThrow();
        assertThat(ev.getProcessingError()).isEqualTo("invalid_timestamp");
        assertThat(ev.isSignatureValid()).isFalse();
    }
}
