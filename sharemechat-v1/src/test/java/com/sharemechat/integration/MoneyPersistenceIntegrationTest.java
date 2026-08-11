package com.sharemechat.integration;

import com.sharemechat.repository.BalanceRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
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
 * <p>Levanta un MySQL real con Testcontainers, deja que Flyway aplique TODAS las
 * migraciones (V1..V51 — el mismo esquema que TEST/AUDIT/PROD) y un repositorio
 * del path de dinero consulta ese esquema real. Valida el patrón Testcontainers
 * + esquema real, que es la base de la capa de integración que faltaba (dinero,
 * matching, streaming). El siguiente paso (mismo frente) es subir del repositorio
 * a la LÓGICA de negocio: TransactionService (cargos/balances/gift charge) con
 * @SpringBootTest + este mismo MySQL + Redis.
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
        // Flyway es la autoridad del esquema; Hibernate no lo toca.
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
    }

    @Autowired
    BalanceRepository balanceRepository;

    @Test
    void migrations_apply_and_money_repository_queries_real_schema() {
        // Si Flyway no hubiera creado la tabla `balances`, esta consulta fallaría
        // (tabla inexistente). Con el esquema real aplicado y sin datos, un userId
        // inexistente devuelve vacío. Prueba: contenedor arriba + migraciones
        // aplicadas + repositorio de dinero consultando el esquema real.
        assertThat(balanceRepository.findTopByUserIdOrderByTimestampDesc(-1L)).isEmpty();
    }
}
