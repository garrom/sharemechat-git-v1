package com.sharemechat.integration;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Balance;
import com.sharemechat.entity.Client;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.PlatformTransaction;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.PlatformTransactionRepository;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.StreamService;
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
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ADR-059 (Fases 2-4): primer test de integración de STREAMING.
 *
 * <p>Ejercita el bean real {@link StreamService#endSession} (facturación
 * lump-sum de una sesión de vídeo) con el contexto Spring completo (perfil
 * {@code ci}) sobre MySQL real de Testcontainers. Verifica el reparto de una
 * sesión confirmada: débito {@code STREAM_CHARGE} al cliente, crédito
 * {@code STREAM_EARNING} a la modelo (individual) y margen {@code STREAM_MARGIN}
 * a la plataforma.
 *
 * <p>NO requiere Redis: {@code StatusService} traga las {@code DataAccessException}
 * de Redis, así que {@code getActiveSession} devuelve vacío y endSession cae al
 * fallback por BD (client+model+endTime null).
 *
 * <p>El importe absoluto depende de los segundos facturables (endTime = now(),
 * no controlable), por eso se verifican las INVARIANTES del reparto
 * (earning = round(cost·pct), margin = cost − earning, earning+margin = cost),
 * no el valor exacto.
 *
 * <p>Requiere Docker (disponible en el runner de CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class StreamServiceIntegrationTest {

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

    @Autowired StreamService streamService;
    @Autowired TransactionService transactionService;
    @Autowired UserRepository userRepository;
    @Autowired ClientRepository clientRepository;
    @Autowired ModelRepository modelRepository;
    @Autowired BalanceRepository balanceRepository;
    @Autowired PlatformTransactionRepository platformTransactionRepository;
    @Autowired StreamRecordRepository streamRecordRepository;
    @Autowired TransactionRepository transactionRepository;

    /** Crea una sesión con los tiempos dados (endTime queda null → activa). */
    private StreamRecord persistStream(Long clientId, Long modelId,
                                       LocalDateTime start, LocalDateTime confirmedAt, LocalDateTime billableStart) {
        StreamRecord sr = new StreamRecord();
        sr.setClient(userRepository.findById(clientId).orElseThrow());
        sr.setModel(userRepository.findById(modelId).orElseThrow());
        sr.setStartTime(start);
        sr.setConfirmedAt(confirmedAt);
        sr.setBillableStart(billableStart);
        sr.setStreamType(Constants.StreamTypes.RANDOM);
        return streamRecordRepository.save(sr);
    }

    /** CLIENT con saldo (vía primer pago) — saldo consistente en ledger + clients. */
    private Long persistClientWithBalance(String nick, String email, String amount) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x");
        u.setRole(Constants.Roles.USER);
        u.setUserType(Constants.UserTypes.FORM_CLIENT);
        u.setUiLocale("es");
        u.setClientKycStatus(Constants.VerificationStatuses.APPROVED);
        Long id = userRepository.save(u).getId();
        transactionService.creditPackWithBonus(id, new BigDecimal(amount), BigDecimal.ZERO,
                "order-stream", "pack-stream", true, "TEST");
        return id;
    }

    /** MODEL + su entidad Model (rate por defecto 1.00 €/min). masterUserId null = individual. */
    private Long persistModel(String nick, String email, Long masterUserId) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x");
        u.setRole(Constants.Roles.MODEL);
        u.setUserType(Constants.UserTypes.FORM_MODEL);
        u.setUiLocale("es");
        User saved = userRepository.save(u);
        Model m = new Model();
        m.setUser(saved);   // @MapsId; NO setUserId
        if (masterUserId != null) {
            m.setMasterUserId(masterUserId);
        }
        modelRepository.save(m);
        return saved.getId();
    }

    /** Usuario con rol MASTER (estudio). */
    private Long persistMasterUser(String nick, String email) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x");
        u.setRole(Constants.Roles.MASTER);
        u.setUserType(Constants.UserTypes.FORM_MASTER);
        u.setUiLocale("es");
        return userRepository.save(u).getId();
    }

    private BigDecimal reloadClientSaldo(Long clientId) {
        User u = userRepository.findById(clientId).orElseThrow();
        return clientRepository.findByUser(u).orElseThrow().getSaldoActual();
    }

    @Test
    @Transactional
    void endSession_factura_stream_confirmado_reparte_charge_earning_margin() {
        Long clientId = persistClientWithBalance("ci-stream-client", "ci-stream-client@example.test", "1000.00");
        Long modelId = persistModel("ci-stream-model", "ci-stream-model@example.test", null);
        User modelUser = userRepository.findById(modelId).orElseThrow();

        // Sesión confirmada, billable_start 120s en el pasado => se factura.
        LocalDateTime now = LocalDateTime.now();
        persistStream(clientId, modelId, now.minusSeconds(130), now.minusSeconds(125), now.minusSeconds(120));

        // Cerrar la sesión (Redis ausente -> fallback BD por client/model/endTime null).
        streamService.endSession(clientId, modelId, "test");

        // Cliente: última fila STREAM_CHARGE (amount negativo); cost > 0.
        Balance clientBal = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(clientId).orElseThrow();
        assertThat(clientBal.getOperationType()).isEqualTo("STREAM_CHARGE");
        BigDecimal cost = clientBal.getAmount().abs();
        assertThat(cost).isGreaterThan(BigDecimal.ZERO);
        assertThat(reloadClientSaldo(clientId))
                .isEqualByComparingTo(new BigDecimal("1000.00").subtract(cost));

        // Modelo (individual): STREAM_EARNING = round(cost * 50% ) (tramo T1 INDIVIDUAL).
        Balance modelBal = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(modelId).orElseThrow();
        assertThat(modelBal.getOperationType()).isEqualTo("STREAM_EARNING");
        BigDecimal earning = modelBal.getAmount();
        BigDecimal expectedEarning = cost.multiply(new BigDecimal("50"))
                .divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP)
                .setScale(2, RoundingMode.HALF_UP);
        assertThat(earning).isEqualByComparingTo(expectedEarning);

        // Plataforma: STREAM_MARGIN = cost - earning; invariante earning + margin == cost.
        List<PlatformTransaction> margins = platformTransactionRepository.findAll().stream()
                .filter(p -> "STREAM_MARGIN".equals(p.getOperationType()))
                .collect(Collectors.toList());
        assertThat(margins).hasSize(1);
        BigDecimal margin = margins.get(0).getAmount();
        assertThat(margin).isEqualByComparingTo(cost.subtract(earning));
        assertThat(earning.add(margin)).isEqualByComparingTo(cost);

        // Model entity individual: saldo y total_ingresos reflejan el earning.
        Model model = modelRepository.findByUser(modelUser).orElseThrow();
        assertThat(model.getSaldoActual()).isEqualByComparingTo(earning);
        assertThat(model.getTotalIngresos()).isEqualByComparingTo(earning);
    }

    @Test
    @Transactional
    void endSession_sesion_no_confirmada_cierra_sin_cargos() {
        Long clientId = persistClientWithBalance("ci-stream-nc-client", "ci-stream-nc-client@example.test", "1000.00");
        Long modelId = persistModel("ci-stream-nc-model", "ci-stream-nc-model@example.test", null);

        // Sesión NO confirmada (confirmed_at null) aunque tenga duración => se cierra sin cargos.
        LocalDateTime now = LocalDateTime.now();
        StreamRecord sr = persistStream(clientId, modelId, now.minusSeconds(60), null, null);

        streamService.endSession(clientId, modelId, "test");

        // Saldo intacto; última fila de balance sigue siendo el INGRESO (no hay STREAM_CHARGE).
        assertThat(reloadClientSaldo(clientId)).isEqualByComparingTo("1000.00");
        assertThat(balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(clientId).orElseThrow()
                .getOperationType()).isEqualTo("INGRESO");

        // No hay margen de plataforma.
        assertThat(platformTransactionRepository.findAll().stream()
                .anyMatch(p -> "STREAM_MARGIN".equals(p.getOperationType()))).isFalse();

        // La sesión queda cerrada.
        assertThat(streamRecordRepository.findById(sr.getId()).orElseThrow().getEndTime()).isNotNull();
    }

    @Test
    @Transactional
    void endSession_saldo_insuficiente_capa_el_cargo_al_saldo_disponible() {
        // Saldo 0.50; a 1.00 €/min, 120s costarían 2.00 -> se capa a 30s = 0.50 (todo el saldo).
        Long clientId = persistClientWithBalance("ci-stream-cap-client", "ci-stream-cap-client@example.test", "0.50");
        Long modelId = persistModel("ci-stream-cap-model", "ci-stream-cap-model@example.test", null);

        LocalDateTime now = LocalDateTime.now();
        persistStream(clientId, modelId, now.minusSeconds(130), now.minusSeconds(125), now.minusSeconds(120));

        streamService.endSession(clientId, modelId, "test");

        // Cobra exactamente el saldo disponible (0.50) y lo deja a 0 (importe determinista por el cap).
        Balance clientBal = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(clientId).orElseThrow();
        assertThat(clientBal.getOperationType()).isEqualTo("STREAM_CHARGE");
        assertThat(clientBal.getAmount()).isEqualByComparingTo("-0.50");
        assertThat(reloadClientSaldo(clientId)).isEqualByComparingTo("0.00");

        // Reparto sobre 0.50 @ 50%: modelo 0.25, plataforma 0.25.
        assertThat(balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(modelId).orElseThrow()
                .getAmount()).isEqualByComparingTo("0.25");
        List<PlatformTransaction> margins = platformTransactionRepository.findAll().stream()
                .filter(p -> "STREAM_MARGIN".equals(p.getOperationType()))
                .collect(Collectors.toList());
        assertThat(margins).hasSize(1);
        assertThat(margins.get(0).getAmount()).isEqualByComparingTo("0.25");
    }

    @Test
    @Transactional
    void endSession_bajo_master_atribuye_earning_al_master() {
        Long clientId = persistClientWithBalance("ci-stream-m-client", "ci-stream-m-client@example.test", "1000.00");
        Long masterId = persistMasterUser("ci-stream-m-master", "ci-stream-m-master@example.test");
        Long modelId = persistModel("ci-stream-m-model", "ci-stream-m-model@example.test", masterId);
        User modelUser = userRepository.findById(modelId).orElseThrow();

        LocalDateTime now = LocalDateTime.now();
        persistStream(clientId, modelId, now.minusSeconds(130), now.minusSeconds(125), now.minusSeconds(120));

        streamService.endSession(clientId, modelId, "test");

        BigDecimal cost = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(clientId).orElseThrow()
                .getAmount().abs();
        BigDecimal expectedEarning = cost.multiply(new BigDecimal("50"))
                .divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP)
                .setScale(2, RoundingMode.HALF_UP);

        // El MASTER recibe el STREAM_EARNING (no la modelo), con atribución a la modelo.
        Balance masterBal = balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(masterId).orElseThrow();
        assertThat(masterBal.getOperationType()).isEqualTo("STREAM_EARNING");
        assertThat(masterBal.getAmount()).isEqualByComparingTo(expectedEarning);
        Transaction masterTx = transactionRepository.findById(masterBal.getTransactionId()).orElseThrow();
        assertThat(masterTx.getAttributedModelUserId()).isEqualTo(modelId);

        // La modelo NO recibe balance.
        assertThat(balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(modelId)).isEmpty();

        // Model entity NO tocado (saldo/total_ingresos en 0).
        Model model = modelRepository.findByUser(modelUser).orElseThrow();
        assertThat(model.getSaldoActual()).isEqualByComparingTo("0.00");
        assertThat(model.getTotalIngresos()).isEqualByComparingTo("0.00");
    }
}
