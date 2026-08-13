package com.sharemechat.integration;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.ModelPricingTier;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelPricingTierRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.ModelTierDailySnapshotRepository;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.ModelTierService;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-059: tests del MOTOR DE TRAMOS ({@link ModelTierService}), que gobierna el
 * % de reparto de TODOS los earnings (streaming, gifts, trial). Se usa
 * indirectamente en el resto de tests; aquí se prueba directo.
 *
 * <p>Cubre: (1) el mapeo bruto→tramo por umbral (`findCurrentByBilledGross`, los
 * umbrales del baseline INDIVIDUAL 0/1000/4000/15000 → T1/T2/T3/T4 con shares
 * 50/54/57/60); (2) `resolveEffectiveTierForPayout` para una modelo sin historial
 * → T1 y escribe el snapshot; (3) `computeAndUpsertSnapshot` sumando el bruto real
 * (STREAM_CHARGE atribuido a la modelo vía stream_record) → tramo por facturación.
 *
 * <p>@SpringBootTest + MySQL real (perfil ci). Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class ModelTierServiceIntegrationTest {

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

    @Autowired ModelTierService modelTierService;
    @Autowired ModelPricingTierRepository pricingTierRepository;
    @Autowired ModelTierDailySnapshotRepository snapshotRepository;
    @Autowired UserRepository userRepository;
    @Autowired ModelRepository modelRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired StreamRecordRepository streamRecordRepository;

    private Long persistUser(String role, String userType, String nick, String email) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x");
        u.setRole(role);
        u.setUserType(userType);
        u.setUiLocale("es");
        return userRepository.save(u).getId();
    }

    private Long persistModelIndividual(String nick, String email) {
        Long id = persistUser(Constants.Roles.MODEL, Constants.UserTypes.FORM_MODEL, nick, email);
        Model m = new Model();
        m.setUser(userRepository.findById(id).orElseThrow()); // @MapsId
        modelRepository.save(m);
        return id;
    }

    private void assertTier(Optional<ModelPricingTier> opt, String code, String share) {
        assertThat(opt).isPresent();
        assertThat(opt.get().getTierCode()).isEqualTo(code);
        assertThat(opt.get().getModelSharePct()).isEqualByComparingTo(share);
    }

    @Test
    @Transactional
    void findCurrentByBilledGross_mapea_el_bruto_al_tramo_por_umbral() {
        // Umbrales INDIVIDUAL del baseline: T1=0, T2=1000, T3=4000, T4=15000.
        assertTier(pricingTierRepository.findCurrentByBilledGross(new BigDecimal("0")), "T1", "50.00");
        assertTier(pricingTierRepository.findCurrentByBilledGross(new BigDecimal("999.99")), "T1", "50.00");
        assertTier(pricingTierRepository.findCurrentByBilledGross(new BigDecimal("1000")), "T2", "54.00");
        assertTier(pricingTierRepository.findCurrentByBilledGross(new BigDecimal("3999.99")), "T2", "54.00");
        assertTier(pricingTierRepository.findCurrentByBilledGross(new BigDecimal("4000")), "T3", "57.00");
        assertTier(pricingTierRepository.findCurrentByBilledGross(new BigDecimal("15000")), "T4", "60.00");
        assertTier(pricingTierRepository.findCurrentByBilledGross(new BigDecimal("50000")), "T4", "60.00");
    }

    @Test
    @Transactional
    void resolveEffectiveTierForPayout_sin_historial_devuelve_T1_y_escribe_snapshot() {
        Long modelId = persistModelIndividual("ci-tier-nohist", "ci-tier-nohist@example.test");

        ModelPricingTier tier = modelTierService.resolveEffectiveTierForPayout(modelId);

        // Sin facturación -> bruto 0 -> tramo base T1 (50%).
        assertThat(tier).isNotNull();
        assertThat(tier.getTierCode()).isEqualTo("T1");
        assertThat(tier.getModelSharePct()).isEqualByComparingTo("50.00");

        // Y dejó escrito el snapshot del día anterior con bruto 0 / T1.
        LocalDate snapshotDate = LocalDate.now().minusDays(1);
        ModelTierDailySnapshot snap = snapshotRepository
                .findByModelIdAndSnapshotDate(modelId, snapshotDate).orElseThrow();
        assertThat(snap.getBilledGrossEur30d()).isEqualByComparingTo("0.00");
        assertThat(snap.getPricingTierCode()).isEqualTo("T1");
    }

    @Test
    @Transactional
    void computeAndUpsertSnapshot_suma_el_bruto_real_y_resuelve_el_tramo() {
        Long modelId = persistModelIndividual("ci-tier-gross", "ci-tier-gross@example.test");
        Long clientId = persistUser(Constants.Roles.CLIENT, Constants.UserTypes.FORM_CLIENT,
                "ci-tier-client", "ci-tier-client@example.test");
        User clientUser = userRepository.findById(clientId).orElseThrow();
        User modelUser = userRepository.findById(modelId).orElseThrow();

        // Sesión del par (para atribuir el STREAM_CHARGE a la modelo vía stream_record.model).
        StreamRecord sr = new StreamRecord();
        sr.setClient(clientUser);
        sr.setModel(modelUser);
        sr.setStartTime(LocalDateTime.now().minusMinutes(30));
        sr.setStreamType(Constants.StreamTypes.RANDOM);
        StreamRecord savedSr = streamRecordRepository.saveAndFlush(sr);

        // STREAM_CHARGE de 1500 (amount −1500) -> bruto 1500 en la ventana.
        Transaction tx = new Transaction();
        tx.setUser(clientUser);
        tx.setAmount(new BigDecimal("-1500.00"));
        tx.setOperationType("STREAM_CHARGE");
        tx.setStreamRecord(savedSr);
        transactionRepository.saveAndFlush(tx);

        // Snapshot de hoy: la ventana [hoy−30, mañana) incluye el timestamp recién insertado.
        ModelTierDailySnapshot snap = modelTierService.computeAndUpsertSnapshot(modelId, LocalDate.now());

        // Bruto 1500 -> tramo T2 (umbral 1000, share 54%).
        assertThat(snap.getBilledGrossEur30d()).isEqualByComparingTo("1500.00");
        assertThat(snap.getPricingTierCode()).isEqualTo("T2");
        assertThat(snap.getModelSharePct()).isEqualByComparingTo("54.00");
    }

    /** Genera un STREAM_CHARGE bruto atribuido a la modelo (via stream_record.model). */
    private void persistStreamChargeGross(Long modelId, String grossAmount) {
        Long clientId = persistUser(Constants.Roles.CLIENT, Constants.UserTypes.FORM_CLIENT,
                "ci-tier-cli-" + modelId, "ci-tier-cli-" + modelId + "@example.test");
        User clientUser = userRepository.findById(clientId).orElseThrow();
        User modelUser = userRepository.findById(modelId).orElseThrow();
        StreamRecord sr = new StreamRecord();
        sr.setClient(clientUser);
        sr.setModel(modelUser);
        sr.setStartTime(LocalDateTime.now().minusMinutes(30));
        sr.setStreamType(Constants.StreamTypes.RANDOM);
        StreamRecord savedSr = streamRecordRepository.saveAndFlush(sr);
        Transaction tx = new Transaction();
        tx.setUser(clientUser);
        tx.setAmount(new BigDecimal(grossAmount).negate());
        tx.setOperationType("STREAM_CHARGE");
        tx.setStreamRecord(savedSr);
        transactionRepository.saveAndFlush(tx);
    }

    @Test
    @Transactional
    void computeAndUpsertSnapshot_marca_pro_status_segun_el_umbral() {
        // Umbral Pro por defecto = 1500 (billing.pro-status.min-billed-gross-eur-30d).
        Long proModel = persistModelIndividual("ci-tier-pro", "ci-tier-pro@example.test");
        persistStreamChargeGross(proModel, "2000"); // bruto 2000 >= 1500
        ModelTierDailySnapshot proSnap = modelTierService.computeAndUpsertSnapshot(proModel, LocalDate.now());
        assertThat(proSnap.getBilledGrossEur30d()).isEqualByComparingTo("2000.00");
        assertThat(proSnap.getProStatusActive()).isTrue();

        // Sin bruto -> 0 < 1500 -> Estatus Pro inactivo.
        Long freeModel = persistModelIndividual("ci-tier-nopro", "ci-tier-nopro@example.test");
        ModelTierDailySnapshot freeSnap = modelTierService.computeAndUpsertSnapshot(freeModel, LocalDate.now());
        assertThat(freeSnap.getBilledGrossEur30d()).isEqualByComparingTo("0.00");
        assertThat(freeSnap.getProStatusActive()).isFalse();
    }

    @Test
    @Transactional
    void computeAndUpsertSnapshot_recorta_la_tarifa_al_max_del_tramo() {
        Long modelId = persistModelIndividual("ci-tier-clip", "ci-tier-clip@example.test");
        // Tarifa elegida 5.00 €/min, muy por encima del rate_max de T1 (1.00).
        User u = userRepository.findById(modelId).orElseThrow();
        u.setChosenRateEurPerMin(new BigDecimal("5.00"));
        userRepository.saveAndFlush(u);

        // Sin bruto -> T1 (rate_max 1.00). Debe recortar 5.00 -> 1.00.
        modelTierService.computeAndUpsertSnapshot(modelId, LocalDate.now());

        User after = userRepository.findById(modelId).orElseThrow();
        assertThat(after.getChosenRateEurPerMin()).isEqualByComparingTo("1.00");
    }

    @Test
    @Transactional
    void computeAndUpsertSnapshot_no_toca_la_tarifa_dentro_de_rango() {
        Long modelId = persistModelIndividual("ci-tier-noclip", "ci-tier-noclip@example.test");
        User u = userRepository.findById(modelId).orElseThrow();
        u.setChosenRateEurPerMin(new BigDecimal("0.50")); // <= rate_max T1 (1.00)
        userRepository.saveAndFlush(u);

        modelTierService.computeAndUpsertSnapshot(modelId, LocalDate.now());

        User after = userRepository.findById(modelId).orElseThrow();
        assertThat(after.getChosenRateEurPerMin()).isEqualByComparingTo("0.50");
    }
}
