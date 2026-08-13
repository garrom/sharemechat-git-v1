package com.sharemechat.master.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.master.dto.CreateMasterModelRequestDTO;
import com.sharemechat.master.entity.MasterModelSplit;
import com.sharemechat.master.repository.MasterModelSplitRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.EmailVerificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * ADR-059 / ADR-056 D7: tests del flujo de INVITACIÓN Master → modelo
 * ({@link MasterModelInvitationService#inviteModel}). Es el ENFORCE UPSTREAM del
 * pacto: garantiza que ninguna fila users de una modelo bajo Master nace sin su
 * {@code MasterModelSplit} inicial (evita que emita "a ciegas" sin acuerdo).
 *
 * <p>@SpringBootTest + MySQL real (perfil ci) con {@code @MockBean} de
 * {@link EmailVerificationService}: el token/email no es lo que se prueba y así se
 * evita depender de SMTP; el resto (User + Model + Split) es real. Cubre: (1) alta
 * atómica modelo + split inicial + emisión de token; (2) idempotencia para el mismo
 * Master (no duplica user/model/split, reemite token); (3) email de otra cuenta →
 * IllegalArgumentException; (4) pct inicial fuera de rango → IllegalArgumentException.
 *
 * <p>Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class MasterModelInvitationServiceIntegrationTest {

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

    @MockBean EmailVerificationService emailVerificationService;

    @Autowired MasterModelInvitationService invitationService;
    @Autowired UserRepository userRepository;
    @Autowired ModelRepository modelRepository;
    @Autowired MasterModelSplitRepository splitRepository;

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

    private Long persistMasterUser(String nick, String email) {
        return persistUser(Constants.Roles.MASTER, Constants.UserTypes.FORM_MASTER, nick, email);
    }

    private CreateMasterModelRequestDTO dto(String email, String nickname, String pct) {
        CreateMasterModelRequestDTO d = new CreateMasterModelRequestDTO();
        d.setModelEmail(email);
        d.setModelNickname(nickname);
        d.setInitialInternalSharePct(new BigDecimal(pct));
        return d;
    }

    @Test
    @Transactional
    void inviteModel_crea_modelo_con_split_inicial_y_emite_token() {
        Long masterId = persistMasterUser("ci-inv-master", "ci-inv-master@example.test");

        Long modelId = invitationService.inviteModel(masterId,
                dto("nueva-modelo@example.test", "ci-inv-model", "45.00"));

        assertThat(modelId).isNotNull();

        // User creado en estado invitado (pendiente de activación).
        User mu = userRepository.findById(modelId).orElseThrow();
        assertThat(mu.getRole()).isEqualTo(Constants.Roles.USER);
        assertThat(mu.getUserType()).isEqualTo(Constants.UserTypes.FORM_MODEL);
        assertThat(mu.isPasswordTemporary()).isTrue();
        assertThat(mu.getVerificationStatus()).isEqualTo(Constants.VerificationStatuses.PENDING);

        // Model con master_user_id.
        Model model = modelRepository.findById(modelId).orElseThrow();
        assertThat(model.getMasterUserId()).isEqualTo(masterId);

        // Split inicial obligatorio, vigente, con el pct pactado.
        MasterModelSplit split = splitRepository
                .findFirstByMasterUserIdAndModelUserIdAndEffectiveToIsNullOrderByIdDesc(masterId, modelId)
                .orElseThrow();
        assertThat(split.getInternalSharePct()).isEqualByComparingTo("45.00");
        assertThat(split.getEffectiveTo()).isNull();
        assertThat(split.getNotes()).isEqualTo("Configurado al invitar");

        verify(emailVerificationService).issueVerification(any(User.class), eq(masterId), anyString());
    }

    @Test
    @Transactional
    void inviteModel_es_idempotente_para_el_mismo_master() {
        Long masterId = persistMasterUser("ci-inv-master2", "ci-inv-master2@example.test");

        Long first = invitationService.inviteModel(masterId,
                dto("dup@example.test", "ci-inv-dup", "50.00"));
        // Segunda invitación al MISMO email/master: reemite, no duplica.
        Long second = invitationService.inviteModel(masterId,
                dto("dup@example.test", "ci-inv-dup2", "60.00"));

        assertThat(second).isEqualTo(first);

        // Un solo split (el inicial); el reenvío NO crea otro ni cambia el pct.
        List<MasterModelSplit> historia = splitRepository
                .findAllByMasterUserIdAndModelUserIdOrderByIdDesc(masterId, first);
        assertThat(historia).hasSize(1);
        assertThat(historia.get(0).getInternalSharePct()).isEqualByComparingTo("50.00");

        verify(emailVerificationService, times(2))
                .issueVerification(any(User.class), eq(masterId), anyString());
    }

    @Test
    @Transactional
    void inviteModel_falla_si_el_email_pertenece_a_otra_cuenta() {
        Long masterId = persistMasterUser("ci-inv-owner", "ci-inv-owner@example.test");
        // Email ya ocupado por una cuenta individual (sin Master).
        persistUser(Constants.Roles.CLIENT, Constants.UserTypes.FORM_CLIENT,
                "ci-inv-taken", "taken@example.test");

        assertThatThrownBy(() -> invitationService.inviteModel(masterId,
                dto("taken@example.test", "ci-inv-x", "50.00")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @Transactional
    void inviteModel_falla_si_el_pct_inicial_esta_fuera_de_rango() {
        Long masterId = persistMasterUser("ci-inv-range", "ci-inv-range@example.test");

        assertThatThrownBy(() -> invitationService.inviteModel(masterId,
                dto("range@example.test", "ci-inv-r", "150.00")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
