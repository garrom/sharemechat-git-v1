package com.sharemechat.support.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.config.ClaudeApiProperties;
import com.sharemechat.support.entity.SupportRateLimitDaily;
import com.sharemechat.support.repository.SupportRateLimitDailyRepository;
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

import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-059: tests del RATE-LIMIT diario del agente IA de soporte
 * ({@link SupportRateLimitService}, DEC-CS-11). Es el CORTAFUEGOS DE COSTE del
 * LLM: doble cap por usuario/día (mensajes OR tokens), reset 00:00 UTC.
 *
 * <p>@SpringBootTest + MySQL real (perfil ci). El test se conduce por el cap real
 * de {@link ClaudeApiProperties} (no hardcodea 30/50000) para no romperse si se
 * reconfigura. Verifica: (1) sin uso previo no limita; (2) al alcanzar el cap de
 * mensajes marca rate-limit y sella {@code exceeded_at}; (3) al alcanzar el cap de
 * tokens marca rate-limit aunque el conteo de mensajes esté por debajo.
 *
 * <p>Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class SupportRateLimitServiceIntegrationTest {

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

    @Autowired SupportRateLimitService rateLimitService;
    @Autowired SupportRateLimitDailyRepository rateLimitRepo;
    @Autowired ClaudeApiProperties props;
    @Autowired UserRepository userRepository;

    private Long persistUser(String nick, String email) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x");
        u.setRole(Constants.Roles.USER);
        u.setUserType(Constants.UserTypes.FORM_CLIENT);
        u.setUiLocale("es");
        return userRepository.save(u).getId();
    }

    private static LocalDate todayUtc() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    @Test
    @Transactional
    void shouldRateLimit_es_false_sin_uso_previo() {
        Long userId = persistUser("ci-rl-fresh", "ci-rl-fresh@example.test");
        assertThat(rateLimitService.shouldRateLimit(userId)).isFalse();
    }

    @Test
    @Transactional
    void al_alcanzar_el_cap_de_mensajes_marca_rate_limit_y_sella_exceeded_at() {
        Long userId = persistUser("ci-rl-msg", "ci-rl-msg@example.test");
        int cap = props.getRateLimitMessagesPerDay();

        // cap mensajes con 0 tokens: solo cruza el cap de mensajes.
        for (int i = 0; i < cap; i++) {
            rateLimitService.registerUsage(userId, 0);
        }

        assertThat(rateLimitService.shouldRateLimit(userId)).isTrue();

        SupportRateLimitDaily r = rateLimitRepo
                .findByUserIdAndUsageDate(userId, todayUtc()).orElseThrow();
        assertThat(r.getMessagesCount()).isEqualTo(cap);
        assertThat(r.getExceededAt()).isNotNull();
    }

    @Test
    @Transactional
    void al_alcanzar_el_cap_de_tokens_marca_rate_limit_con_pocos_mensajes() {
        Long userId = persistUser("ci-rl-tok", "ci-rl-tok@example.test");
        long tokenCap = props.getRateLimitTokensPerDay();

        // 1 solo mensaje pero consumiendo el cap entero de tokens.
        rateLimitService.registerUsage(userId, (int) tokenCap);

        assertThat(rateLimitService.shouldRateLimit(userId)).isTrue();

        SupportRateLimitDaily r = rateLimitRepo
                .findByUserIdAndUsageDate(userId, todayUtc()).orElseThrow();
        assertThat(r.getMessagesCount()).isEqualTo(1);
        assertThat(r.getTokensCount()).isGreaterThanOrEqualTo(tokenCap);
        assertThat(r.getExceededAt()).isNotNull();
    }
}
