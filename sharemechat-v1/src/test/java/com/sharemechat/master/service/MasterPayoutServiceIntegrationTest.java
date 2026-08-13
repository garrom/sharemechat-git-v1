package com.sharemechat.master.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Balance;
import com.sharemechat.entity.PayoutRequest;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.master.dto.MasterPayoutRequestDTO;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ADR-059 / ADR-056 D12: tests del RETIRO del Master
 * ({@link MasterPayoutService#requestPayout}). Análogo al payout de modelo pero:
 * mínimo 100 EUR (vs 50), sin entidad Model (solo el ledger de {@code balances}),
 * y guards de importe entero + rango + ownership del método de cobro.
 *
 * <p>@SpringBootTest + MySQL real (perfil ci). Cubre: (1) alta REQUESTED que DEBITA
 * el ledger (PAYOUT_REQUEST −importe); (2) saldo insuficiente; (3) bajo el mínimo
 * (100); (4) sobre el máximo (1000); (5) importe con céntimos; (6) payoutMethodId
 * que no pertenece al user. Los guards se validan por la excepción (sin lecturas
 * post-excepción, por rollback-only). Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class MasterPayoutServiceIntegrationTest {

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

    @Autowired MasterPayoutService masterPayoutService;
    @Autowired BalanceRepository balanceRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired UserRepository userRepository;

    private User persistMasterUser(String nick, String email) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x");
        u.setRole(Constants.Roles.MASTER);
        u.setUserType(Constants.UserTypes.FORM_MASTER);
        u.setUiLocale("es");
        return userRepository.save(u);
    }

    /** Siembra el saldo del ledger (Transaction + Balance) sin entidad Model. */
    private void seedBalance(Long userId, String amount) {
        User u = userRepository.findById(userId).orElseThrow();
        BigDecimal amt = new BigDecimal(amount);
        Transaction tx = new Transaction();
        tx.setUser(u);
        tx.setAmount(amt);
        tx.setOperationType("STREAM_EARNING");
        Transaction saved = transactionRepository.saveAndFlush(tx);
        Balance b = new Balance();
        b.setUserId(userId);
        b.setTransactionId(saved.getId());
        b.setOperationType("STREAM_EARNING");
        b.setAmount(amt);
        b.setBalance(amt);
        b.setDescription("seed saldo test");
        balanceRepository.saveAndFlush(b);
    }

    private MasterPayoutRequestDTO dto(String amount) {
        MasterPayoutRequestDTO d = new MasterPayoutRequestDTO();
        d.setAmount(new BigDecimal(amount));
        return d;
    }

    @Test
    @Transactional
    void requestPayout_crea_solicitud_REQUESTED_y_debita_el_saldo() {
        User master = persistMasterUser("ci-mpay-ok", "ci-mpay-ok@example.test");
        seedBalance(master.getId(), "300.00");

        PayoutRequest pr = masterPayoutService.requestPayout(master, dto("200"));

        assertThat(pr.getStatus()).isEqualTo("REQUESTED");
        assertThat(pr.getAmount()).isEqualByComparingTo("200.00");
        assertThat(pr.getModelUserId()).isEqualTo(master.getId()); // columna legacy = masterId

        // Ledger debitado: última fila PAYOUT_REQUEST −200, saldo 100.
        Balance last = balanceRepository
                .findTopByUserIdOrderByTimestampDescIdDesc(master.getId()).orElseThrow();
        assertThat(last.getOperationType()).isEqualTo("PAYOUT_REQUEST");
        assertThat(last.getAmount()).isEqualByComparingTo("-200.00");
        assertThat(last.getBalance()).isEqualByComparingTo("100.00");
    }

    @Test
    @Transactional
    void requestPayout_falla_si_saldo_insuficiente() {
        User master = persistMasterUser("ci-mpay-low", "ci-mpay-low@example.test");
        seedBalance(master.getId(), "50.00");

        assertThatThrownBy(() -> masterPayoutService.requestPayout(master, dto("100")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @Transactional
    void requestPayout_falla_bajo_el_minimo_de_100() {
        User master = persistMasterUser("ci-mpay-min", "ci-mpay-min@example.test");
        seedBalance(master.getId(), "500.00");

        assertThatThrownBy(() -> masterPayoutService.requestPayout(master, dto("50")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @Transactional
    void requestPayout_falla_sobre_el_maximo_de_1000() {
        User master = persistMasterUser("ci-mpay-max", "ci-mpay-max@example.test");

        // El guard de máximo actúa antes de leer el saldo.
        assertThatThrownBy(() -> masterPayoutService.requestPayout(master, dto("1200")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @Transactional
    void requestPayout_falla_con_importe_no_entero() {
        User master = persistMasterUser("ci-mpay-cents", "ci-mpay-cents@example.test");

        assertThatThrownBy(() -> masterPayoutService.requestPayout(master, dto("150.50")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @Transactional
    void requestPayout_falla_si_el_metodo_no_pertenece_al_user() {
        User master = persistMasterUser("ci-mpay-method", "ci-mpay-method@example.test");
        MasterPayoutRequestDTO d = dto("200");
        d.setPayoutMethodId(999_999L); // método inexistente / de otro user

        assertThatThrownBy(() -> masterPayoutService.requestPayout(master, d))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
