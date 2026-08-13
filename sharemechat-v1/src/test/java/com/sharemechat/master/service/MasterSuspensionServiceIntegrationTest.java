package com.sharemechat.master.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.master.entity.Master;
import com.sharemechat.master.entity.MasterModelSplit;
import com.sharemechat.master.repository.MasterModelSplitRepository;
import com.sharemechat.master.repository.MasterRepository;
import com.sharemechat.repository.ModelRepository;
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
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ADR-059 / ADR-056 S7.b (D11): tests de la SUSPENSIÓN del rol Master
 * ({@link MasterSuspensionService}). Al suspender, el Master se marca, sus modelos
 * se liberan a INDIVIDUAL ({@code master_user_id=NULL}) y los splits vigentes se
 * cierran ({@code effective_to=now}), todo en una transacción. Reactivar limpia la
 * suspensión pero NO re-asigna modelos (siguen individuales; se re-invitan aparte).
 *
 * <p>@SpringBootTest + MySQL real (perfil ci). Cubre: (1) suspensión libera modelos
 * y cierra splits; (2) idempotencia (segundo suspend = noop, no sobrescribe autor);
 * (3) reactivación limpia la marca pero deja las modelos liberadas; (4) Master
 * inexistente → IllegalArgumentException. Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class MasterSuspensionServiceIntegrationTest {

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

    @Autowired MasterSuspensionService suspensionService;
    @Autowired MasterRepository masterRepository;
    @Autowired ModelRepository modelRepository;
    @Autowired MasterModelSplitRepository splitRepository;
    @Autowired UserRepository userRepository;

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

    private Long persistMaster(String nick, String email) {
        Long id = persistUser(Constants.Roles.MASTER, Constants.UserTypes.FORM_MASTER, nick, email);
        Master m = new Master();
        m.setUserId(id);
        masterRepository.save(m);
        return id;
    }

    private Long persistModelUnderMaster(String nick, String email, Long masterId) {
        Long id = persistUser(Constants.Roles.MODEL, Constants.UserTypes.FORM_MODEL, nick, email);
        Model m = new Model();
        m.setUser(userRepository.findById(id).orElseThrow()); // @MapsId
        m.setMasterUserId(masterId);
        modelRepository.save(m);
        return id;
    }

    private void createVigentSplit(Long masterId, Long modelId, String pct) {
        LocalDateTime now = LocalDateTime.now();
        MasterModelSplit s = new MasterModelSplit();
        s.setMasterUserId(masterId);
        s.setModelUserId(modelId);
        s.setInternalSharePct(new BigDecimal(pct));
        s.setEffectiveFrom(now);
        s.setSetByMasterAt(now);
        splitRepository.save(s);
    }

    @Test
    @Transactional
    void suspend_libera_modelos_y_cierra_splits() {
        Long masterId = persistMaster("ci-susp-master", "ci-susp-master@example.test");
        Long adminId = persistUser(Constants.Roles.ADMIN, Constants.UserTypes.INTERNAL,
                "ci-susp-admin", "ci-susp-admin@example.test");
        Long m1 = persistModelUnderMaster("ci-susp-m1", "ci-susp-m1@example.test", masterId);
        Long m2 = persistModelUnderMaster("ci-susp-m2", "ci-susp-m2@example.test", masterId);
        createVigentSplit(masterId, m1, "50.00");
        createVigentSplit(masterId, m2, "60.00");

        Master result = suspensionService.suspend(masterId, adminId, "incumplimiento");

        assertThat(result.isSuspended()).isTrue();
        assertThat(result.getSuspendedByUserId()).isEqualTo(adminId);
        assertThat(result.getSuspensionReason()).isEqualTo("incumplimiento");

        // Modelos liberadas a INDIVIDUAL.
        assertThat(modelRepository.findById(m1).orElseThrow().getMasterUserId()).isNull();
        assertThat(modelRepository.findById(m2).orElseThrow().getMasterUserId()).isNull();

        // Ningún split vigente del Master.
        assertThat(splitRepository
                .findAllByMasterUserIdAndEffectiveToIsNullOrderByIdDesc(masterId)).isEmpty();
    }

    @Test
    @Transactional
    void suspend_es_idempotente_no_sobrescribe_al_autor() {
        Long masterId = persistMaster("ci-susp-idem", "ci-susp-idem@example.test");
        Long admin1 = persistUser(Constants.Roles.ADMIN, Constants.UserTypes.INTERNAL,
                "ci-susp-a1", "ci-susp-a1@example.test");
        Long admin2 = persistUser(Constants.Roles.ADMIN, Constants.UserTypes.INTERNAL,
                "ci-susp-a2", "ci-susp-a2@example.test");

        suspensionService.suspend(masterId, admin1, "primera");
        Master again = suspensionService.suspend(masterId, admin2, "segunda"); // noop

        assertThat(again.isSuspended()).isTrue();
        assertThat(again.getSuspendedByUserId()).isEqualTo(admin1); // no sobrescrito
        assertThat(again.getSuspensionReason()).isEqualTo("primera");
    }

    @Test
    @Transactional
    void reactivate_limpia_la_marca_pero_no_reasigna_modelos() {
        Long masterId = persistMaster("ci-react-master", "ci-react-master@example.test");
        Long adminId = persistUser(Constants.Roles.ADMIN, Constants.UserTypes.INTERNAL,
                "ci-react-admin", "ci-react-admin@example.test");
        Long m1 = persistModelUnderMaster("ci-react-m1", "ci-react-m1@example.test", masterId);

        suspensionService.suspend(masterId, adminId, "x");
        assertThat(modelRepository.findById(m1).orElseThrow().getMasterUserId()).isNull();

        Master react = suspensionService.reactivate(masterId, adminId);

        assertThat(react.isSuspended()).isFalse();
        assertThat(react.getSuspendedAt()).isNull();
        // La modelo SIGUE liberada (no se re-asigna automáticamente).
        assertThat(modelRepository.findById(m1).orElseThrow().getMasterUserId()).isNull();
    }

    @Test
    @Transactional
    void suspend_falla_si_el_master_no_existe() {
        Long adminId = persistUser(Constants.Roles.ADMIN, Constants.UserTypes.INTERNAL,
                "ci-susp-nf-admin", "ci-susp-nf-admin@example.test");

        assertThatThrownBy(() -> suspensionService.suspend(999_999L, adminId, "x"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
