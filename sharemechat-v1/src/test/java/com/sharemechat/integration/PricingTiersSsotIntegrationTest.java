package com.sharemechat.integration;

import com.sharemechat.entity.ModelPricingTier;
import com.sharemechat.repository.ModelPricingTierRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.yaml.snakeyaml.Yaml;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-061 "Facts as Code" — cierre de bucle del Motor 1 para el dominio pricing.
 *
 * <p>Verifica que la FUENTE ÚNICA {@code docs/_data/pricing-tiers.yaml} (de la que
 * se generan la KB, los docs de negocio y las tablas financieras) coincide EXACTAMENTE
 * con lo que corre el sistema: las filas vigentes (effective_to IS NULL,
 * target_type='INDIVIDUAL') de {@code model_pricing_tiers}, sembradas por las
 * migraciones Flyway (baseline IT).
 *
 * <p>Si una migración cambia el pricing y el YAML no (o al revés), este test falla:
 * es imposible que docs y sistema diverjan sin que el CI lo pare. Ese es el punto
 * de "facts as code" — no basta con generar los docs, hay que anclar la fuente a la
 * realidad ejecutable.
 *
 * <p>@SpringBootTest + MySQL real (perfil ci). Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class PricingTiersSsotIntegrationTest {

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

    @Autowired
    ModelPricingTierRepository pricingTierRepository;

    /** Fila esperada, tal como la declara el YAML. */
    private record ExpectedTier(String code, BigDecimal threshold, BigDecimal sharePct,
                                BigDecimal rateFirst, BigDecimal rateRest) {}

    @Test
    void yamlSsotMatchesEffectiveIndividualPricingInDb() {
        List<ExpectedTier> expected = loadYamlTiers();

        List<ModelPricingTier> actual =
                pricingTierRepository.findAllCurrentByTargetTypeAsc("INDIVIDUAL");
        actual.sort(Comparator.comparing(ModelPricingTier::getMinBilledGrossEur30d));

        assertThat(actual)
                .as("nº de tramos vigentes INDIVIDUAL en model_pricing_tiers vs pricing-tiers.yaml "
                        + "(si difiere, una migración cambió el pricing y el YAML no, o al revés)")
                .hasSameSizeAs(expected);

        for (int i = 0; i < expected.size(); i++) {
            ExpectedTier e = expected.get(i);
            ModelPricingTier a = actual.get(i);
            String ctx = "tramo #" + i + " (yaml=" + e.code() + ")";

            assertThat(a.getTierCode()).as(ctx + " tier_code").isEqualTo(e.code());
            assertThat(a.getMinBilledGrossEur30d())
                    .as(ctx + " umbral (min_billed_gross_eur_30d)")
                    .isEqualByComparingTo(e.threshold());
            assertThat(a.getModelSharePct())
                    .as(ctx + " reparto (model_share_pct)")
                    .isEqualByComparingTo(e.sharePct());
            assertThat(a.getRateMinEurPerMin())
                    .as(ctx + " tarifa primer minuto (rate_min_eur_per_min)")
                    .isEqualByComparingTo(e.rateFirst());
            assertThat(a.getRateMaxEurPerMin())
                    .as(ctx + " tarifa resto (rate_max_eur_per_min)")
                    .isEqualByComparingTo(e.rateRest());
        }
    }

    @SuppressWarnings("unchecked")
    private List<ExpectedTier> loadYamlTiers() {
        File yamlFile = locateYaml();
        Map<String, Object> root;
        try (InputStream in = new FileInputStream(yamlFile)) {
            root = new Yaml().load(in);
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo leer " + yamlFile.getAbsolutePath(), ex);
        }
        assertThat(root).as("pricing-tiers.yaml debe declarar régimen INDIVIDUAL")
                .containsEntry("regime", "INDIVIDUAL");

        List<Map<String, Object>> rows = (List<Map<String, Object>>) root.get("tiers");
        assertThat(rows).as("pricing-tiers.yaml debe tener una lista 'tiers' no vacía").isNotEmpty();

        List<ExpectedTier> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            out.add(new ExpectedTier(
                    String.valueOf(r.get("code")),
                    num(r.get("threshold_eur_30d")),
                    num(r.get("model_share_pct")),
                    num(r.get("rate_first_eur")),
                    num(r.get("rate_rest_eur"))));
        }
        out.sort(Comparator.comparing(ExpectedTier::threshold));
        return out;
    }

    private static BigDecimal num(Object o) {
        if (o instanceof Number n) {
            return new BigDecimal(n.toString());
        }
        return new BigDecimal(String.valueOf(o));
    }

    /**
     * El YAML vive en docs/_data/ del repo. Los tests corren con user.dir = módulo
     * (sharemechat-v1); se prueban rutas alternativas por robustez.
     */
    private static File locateYaml() {
        String[] candidates = {
                "docs/_data/pricing-tiers.yaml",
                "sharemechat-v1/docs/_data/pricing-tiers.yaml",
                "../sharemechat-v1/docs/_data/pricing-tiers.yaml",
        };
        for (String c : candidates) {
            File f = new File(c);
            if (f.isFile()) {
                return f;
            }
        }
        throw new IllegalStateException(
                "No se encontró pricing-tiers.yaml (user.dir=" + System.getProperty("user.dir") + ")");
    }
}
