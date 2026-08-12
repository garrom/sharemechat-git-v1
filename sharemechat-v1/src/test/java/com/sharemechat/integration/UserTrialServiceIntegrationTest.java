package com.sharemechat.integration;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Balance;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.PlatformTransaction;
import com.sharemechat.entity.User;
import com.sharemechat.entity.UserTrialStream;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.PlatformTransactionRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.repository.UserTrialStreamRepository;
import com.sharemechat.service.UserTrialService;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-059: tests de integración del flujo de TRIAL (primer minuto gratis).
 *
 * <p>Ejercita el bean real {@link UserTrialService} con el contexto Spring completo
 * (perfil {@code ci}) sobre MySQL real. Cubre: la facturación al cerrar el trial
 * ({@code endTrialStream} → TRIAL_EARNING a la modelo/Master + TRIAL_COST negativo a
 * la plataforma, que absorbe el coste; earning plano 0.07 €/min independiente del
 * tramo, ADR-052 §D8), y el gate de disponibilidad ({@code canStartTrial}: primer
 * pack de 3 slots libre, nuevo pack con cooldown, solo rol USER).
 *
 * <p>El importe es DETERMINISTA: el trial capa a {@code TRIAL_MAX_SECONDS_PER_SESSION}
 * = 60s, así que con {@code start_time} suficientemente en el pasado siempre se
 * facturan 60s = 0.07 €.
 *
 * <p>No requiere Redis (StatusService es tolerante). Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class UserTrialServiceIntegrationTest {

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

    @Autowired UserTrialService userTrialService;
    @Autowired UserRepository userRepository;
    @Autowired ModelRepository modelRepository;
    @Autowired BalanceRepository balanceRepository;
    @Autowired PlatformTransactionRepository platformTransactionRepository;
    @Autowired UserTrialStreamRepository userTrialStreamRepository;

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

    private void newClosedTrial(Long viewerId, Long modelId) {
        UserTrialStream t = new UserTrialStream();
        t.setViewer(userRepository.findById(viewerId).orElseThrow());
        t.setModel(userRepository.findById(modelId).orElseThrow());
        t.setStartTime(LocalDateTime.now().minusSeconds(120));
        t.setEndTime(LocalDateTime.now());
        t.setSeconds(60L);
        userTrialStreamRepository.save(t);
    }

    @Test
    @Transactional
    void endTrialStream_factura_trial_earning_al_modelo_y_coste_a_plataforma() {
        Long viewerId = persistUser(Constants.Roles.USER, Constants.UserTypes.FORM_CLIENT,
                "ci-trial-viewer", "ci-trial-viewer@example.test");
        Long modelId = persistModelIndividual("ci-trial-model", "ci-trial-model@example.test");
        User modelUser = userRepository.findById(modelId).orElseThrow();

        // Trial activo con start_time 120s en el pasado -> se capa a 60s.
        UserTrialStream ts = new UserTrialStream();
        ts.setViewer(userRepository.findById(viewerId).orElseThrow());
        ts.setModel(modelUser);
        ts.setStartTime(LocalDateTime.now().minusSeconds(120));
        final Long tsId = userTrialStreamRepository.save(ts).getId();

        userTrialService.endTrialStream(viewerId, modelId);

        // Modelo: TRIAL_EARNING = 0.07 (0.07 €/min * 60s / 60).
        Balance modelBal = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(modelId).orElseThrow();
        assertThat(modelBal.getOperationType()).isEqualTo("TRIAL_EARNING");
        assertThat(modelBal.getAmount()).isEqualByComparingTo("0.07");

        Model model = modelRepository.findByUser(modelUser).orElseThrow();
        assertThat(model.getSaldoActual()).isEqualByComparingTo("0.07");
        assertThat(model.getTotalIngresos()).isEqualByComparingTo("0.07");

        // Plataforma absorbe el coste: TRIAL_COST = -0.07.
        List<PlatformTransaction> costs = platformTransactionRepository.findAll().stream()
                .filter(p -> "TRIAL_COST".equals(p.getOperationType()))
                .collect(Collectors.toList());
        assertThat(costs).hasSize(1);
        assertThat(costs.get(0).getAmount()).isEqualByComparingTo("-0.07");

        // Trial cerrado con 60s (cap).
        UserTrialStream closed = userTrialStreamRepository.findById(tsId).orElseThrow();
        assertThat(closed.getEndTime()).isNotNull();
        assertThat(closed.getSeconds()).isEqualTo(60L);
    }

    @Test
    @Transactional
    void canStartTrial_permite_primer_pack_y_bloquea_nuevo_pack_en_cooldown() {
        Long viewerId = persistUser(Constants.Roles.USER, Constants.UserTypes.FORM_CLIENT,
                "ci-trial-can", "ci-trial-can@example.test");
        Long modelId = persistModelIndividual("ci-trial-can-model", "ci-trial-can-model@example.test");

        // Sin trials previos -> primer pack (slots 1-3), permitido.
        assertThat(userTrialService.canStartTrial(viewerId)).isTrue();

        // 3 trials cerrados (pack 0 completo), el último cerrado ahora mismo.
        newClosedTrial(viewerId, modelId);
        newClosedTrial(viewerId, modelId);
        newClosedTrial(viewerId, modelId);

        // 4º slot = nuevo pack (cooldown 1h desde el último end = ahora) -> bloqueado.
        assertThat(userTrialService.canStartTrial(viewerId)).isFalse();
    }

    @Test
    @Transactional
    void canStartTrial_es_falso_si_el_viewer_no_es_USER() {
        Long clientId = persistUser(Constants.Roles.CLIENT, Constants.UserTypes.FORM_CLIENT,
                "ci-trial-notuser", "ci-trial-notuser@example.test");
        assertThat(userTrialService.canStartTrial(clientId)).isFalse();
    }
}
