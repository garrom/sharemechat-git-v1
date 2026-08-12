package com.sharemechat.integration;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-059 Fase 1 (PoC): primer test de INTEGRACIÓN con dependencias reales.
 *
 * <p>Levanta un MySQL real con Testcontainers, deja que Flyway aplique el BASELINE
 * de esquema real (classpath:db/migration-it — el mismo esquema que TEST/AUDIT/PROD,
 * volcado tras las 51 migraciones) y un repositorio del path de dinero consulta ese
 * esquema real. Valida el patrón Testcontainers + esquema real, base de la capa de
 * integración que faltaba (dinero, matching, streaming).
 *
 * <p>Usa el baseline y NO las 51 migraciones directas porque V42 colisiona de forma
 * no-determinista en fresh-apply (unique con timestamp de segundo; ver
 * docs/pending-hardening). El baseline se regenera con scratchpad/gen-baseline.sh.
 *
 * <p>El escalón superior (contexto Spring completo + servicio + @Transactional real)
 * es {@link TransactionServiceIntegrationTest}.
 *
 * <p>Requiere Docker (disponible en el runner de CI y en el equipo si Docker
 * Desktop está arrancado).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ImportAutoConfiguration(FlywayAutoConfiguration.class)
@Testcontainers
class MoneyPersistenceIntegrationTest {

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4.0")
            .withDatabaseName("sharemechat_it");

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        // Flyway es la autoridad del esquema (baseline determinista); Hibernate no lo toca.
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.flyway.locations", () -> "classpath:db/migration-it");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
    }

    @Autowired
    BalanceRepository balanceRepository;
    @Autowired
    TransactionRepository transactionRepository;
    @Autowired
    UserRepository userRepository;

    @Test
    void migrations_apply_and_money_repository_queries_real_schema() {
        // Si Flyway no hubiera creado la tabla `balances`, esta consulta fallaría
        // (tabla inexistente). Con el esquema real aplicado y sin datos, un userId
        // inexistente devuelve vacío. Prueba: contenedor arriba + migraciones
        // aplicadas + repositorio de dinero consultando el esquema real.
        assertThat(balanceRepository.findTopByUserIdOrderByTimestampDesc(-1L)).isEmpty();
    }

    /**
     * ADR-056 Opción D (2026-08-13): la "ganancia teórica" de la modelo bajo Master
     * suma el neto redondeado POR FILA (para cuadrar con su tabla) e incluye
     * TRIAL_EARNING; excluye gifts de importe 0.
     */
    @Test
    void sumAttributedNetPactado_suma_neto_por_fila_incluye_trial_excluye_gift_cero() {
        User recipient = new User();          // user de las transacciones (haría de Master)
        recipient.setNickname("it-net-recipient");
        recipient.setEmail("it-net-recipient@example.test");
        recipient.setPassword("x");
        recipient.setRole(Constants.Roles.MASTER);
        recipient.setUserType(Constants.UserTypes.FORM_MASTER);
        recipient.setUiLocale("es");
        recipient = userRepository.saveAndFlush(recipient);

        final Long modelId = 987654L;         // id atribuido ficticio, aislado del baseline

        saveEarning(recipient, "STREAM_EARNING", "3.18", modelId);
        saveEarning(recipient, "GIFT_EARNING",   "7.00", modelId);
        saveEarning(recipient, "GIFT_EARNING",   "0.00", modelId); // excluida (gift amount=0)
        saveEarning(recipient, "TRIAL_EARNING",  "1.00", modelId);

        // pct 40%: netos por fila = round(3.18*.4)=1.27, round(7*.4)=2.80,
        //          gift 0 excluida, round(1*.4)=0.40  =>  4.47
        BigDecimal net = transactionRepository.sumAttributedNetPactado(modelId, new BigDecimal("40.00"));
        assertThat(net).isEqualByComparingTo("4.47");
    }

    private void saveEarning(User user, String operationType, String amount, Long attributedModelId) {
        Transaction tx = new Transaction();
        tx.setUser(user);
        tx.setAmount(new BigDecimal(amount));
        tx.setOperationType(operationType);
        tx.setAttributedModelUserId(attributedModelId);
        transactionRepository.saveAndFlush(tx);
    }
}
