package com.sharemechat.master.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.master.entity.MasterModelSplit;
import com.sharemechat.master.repository.MasterModelSplitRepository;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ADR-059 / ADR-056 D10: tests del ACUERDO INTERNO Master ↔ modelo
 * ({@link MasterModelManagementService#setInternalShare}). Es el pacto que el
 * Master registra con cada modelo, versionado por effective_from/effective_to
 * (audit trail); gobierna cuánto paga el Master a la modelo off-platform.
 *
 * <p>@SpringBootTest + MySQL real (perfil ci). Cubre: (1) alta del split vigente;
 * (2) versionado (cierra la vigencia previa con effective_to y deja UNA sola
 * vigente, preservando el histórico); (3) guard de ownership (modelo de otro
 * Master → IllegalArgumentException); (4) guard de rango [0,100] (fuera de rango
 * → IllegalArgumentException, sin crear fila).
 *
 * <p>Tests {@code @Transactional} (rollback por método). En los guards se asserta
 * SOLO la excepción, sin leer estado después: al compartir la tx del test, la
 * excepción del servicio la marca rollback-only y fragiliza lecturas posteriores
 * (el "no crea fila" está garantizado porque el guard corta antes de escribir).
 * Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class MasterModelSplitIntegrationTest {

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

    @Autowired MasterModelManagementService managementService;
    @Autowired MasterModelSplitRepository splitRepository;
    @Autowired UserRepository userRepository;
    @Autowired ModelRepository modelRepository;

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

    private Long persistModelUnderMaster(String nick, String email, Long masterUserId) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x");
        u.setRole(Constants.Roles.MODEL);
        u.setUserType(Constants.UserTypes.FORM_MODEL);
        u.setUiLocale("es");
        User saved = userRepository.save(u);
        Model m = new Model();
        m.setUser(saved); // @MapsId deriva el id del user
        m.setMasterUserId(masterUserId);
        modelRepository.save(m);
        return saved.getId();
    }

    private MasterModelSplit currentSplit(Long masterId, Long modelId) {
        return splitRepository
                .findFirstByMasterUserIdAndModelUserIdAndEffectiveToIsNullOrderByIdDesc(masterId, modelId)
                .orElse(null);
    }

    @Test
    @Transactional
    void setInternalShare_crea_split_vigente() {
        Long masterId = persistMasterUser("ci-split-master", "ci-split-master@example.test");
        Long modelId = persistModelUnderMaster("ci-split-model", "ci-split-model@example.test", masterId);

        MasterModelSplit s = managementService.setInternalShare(
                masterId, modelId, new BigDecimal("60.00"), "pacto inicial");

        assertThat(s.getId()).isNotNull();
        assertThat(s.getInternalSharePct()).isEqualByComparingTo("60.00");
        assertThat(s.getEffectiveFrom()).isNotNull();
        assertThat(s.getEffectiveTo()).isNull(); // vigente

        MasterModelSplit vig = currentSplit(masterId, modelId);
        assertThat(vig).isNotNull();
        assertThat(vig.getId()).isEqualTo(s.getId());
        assertThat(vig.getInternalSharePct()).isEqualByComparingTo("60.00");
    }

    @Test
    @Transactional
    void setInternalShare_versiona_cierra_la_previa_y_deja_una_sola_vigente() {
        Long masterId = persistMasterUser("ci-split-master2", "ci-split-master2@example.test");
        Long modelId = persistModelUnderMaster("ci-split-model2", "ci-split-model2@example.test", masterId);

        managementService.setInternalShare(masterId, modelId, new BigDecimal("50.00"), null);
        managementService.setInternalShare(masterId, modelId, new BigDecimal("60.00"), null);

        // Solo una vigente, y es la nueva (60).
        List<MasterModelSplit> vigentes = splitRepository
                .findAllByMasterUserIdAndEffectiveToIsNullOrderByIdDesc(masterId);
        assertThat(vigentes).hasSize(1);
        assertThat(vigentes.get(0).getInternalSharePct()).isEqualByComparingTo("60.00");

        // Histórico completo preservado (2 filas), y la previa (50) quedó cerrada.
        List<MasterModelSplit> historia = splitRepository
                .findAllByMasterUserIdAndModelUserIdOrderByIdDesc(masterId, modelId);
        assertThat(historia).hasSize(2);
        MasterModelSplit previa = historia.stream()
                .filter(x -> x.getInternalSharePct().compareTo(new BigDecimal("50.00")) == 0)
                .findFirst().orElseThrow();
        assertThat(previa.getEffectiveTo()).isNotNull();
    }

    @Test
    @Transactional
    void setInternalShare_falla_si_la_modelo_no_pertenece_al_master() {
        Long masterId = persistMasterUser("ci-split-owner", "ci-split-owner@example.test");
        Long otroMasterId = persistMasterUser("ci-split-other", "ci-split-other@example.test");
        // Modelo bajo OTRO master.
        Long modelId = persistModelUnderMaster("ci-split-foreign", "ci-split-foreign@example.test", otroMasterId);

        assertThatThrownBy(() ->
                managementService.setInternalShare(masterId, modelId, new BigDecimal("50.00"), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @Transactional
    void setInternalShare_falla_si_el_pct_esta_fuera_de_rango() {
        Long masterId = persistMasterUser("ci-split-range", "ci-split-range@example.test");
        Long modelId = persistModelUnderMaster("ci-split-range-m", "ci-split-range-m@example.test", masterId);

        assertThatThrownBy(() ->
                managementService.setInternalShare(masterId, modelId, new BigDecimal("150.00"), null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
