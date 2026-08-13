package com.sharemechat.support.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.entity.BackofficeAgentProfile;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportMessage;
import com.sharemechat.support.exception.SupportConflictException;
import com.sharemechat.support.exception.SupportPermissionDeniedException;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * ADR-059 / ADR-046: tests del soporte HUMANO ({@link SupportHumanHandlingService}):
 * claim / release / resolve / sendHumanMessage. Complementa el bot IA (cuando un
 * agente hace claim, el bot deja de responder).
 *
 * <p>@SpringBootTest + MySQL real (perfil ci) con {@code @MockBean} de
 * {@link BackofficeAgentProfileGrantService} (los grants agente↔profile son un
 * subsistema aparte; se mockea `hasActiveGrant`). Tests SIN {@code @Transactional}
 * y con RELECTURA FRESCA: `claimIfUnassigned`/`releaseIfOwnedBy` son UPDATE masivos
 * `@Modifying` que dejan la entidad en caché stale, así que el estado se verifica
 * releyendo de BD tras el commit del servicio. Cada test usa usuarios/conv únicos.
 *
 * <p>Cubre: claim (ok→HUMAN_HANDLING+SYSTEM msg, conflict si no ESCALATED, 403 sin
 * grant), release (ok→ESCALATED, 403 por agente ajeno), resolve (ok→RESOLVED
 * preservando asignación), sendHumanMessage (ok→HUMAN msg, conflict si no
 * HUMAN_HANDLING). Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class SupportHumanHandlingServiceIntegrationTest {

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

    @MockBean BackofficeAgentProfileGrantService grantService;

    @Autowired SupportHumanHandlingService hhService;
    @Autowired SupportConversationRepository convRepo;
    @Autowired SupportMessageRepository msgRepo;
    @Autowired BackofficeAgentProfileRepository profileRepo;
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

    private Long persistCustomer(String tag) {
        return persistUser(Constants.Roles.USER, Constants.UserTypes.FORM_CLIENT,
                "ci-hh-cust-" + tag, "ci-hh-cust-" + tag + "@example.test");
    }

    private Long persistAgent(String tag) {
        return persistUser(Constants.Roles.ADMIN, Constants.UserTypes.INTERNAL,
                "ci-hh-agent-" + tag, "ci-hh-agent-" + tag + "@example.test");
    }

    private Long persistProfile(String name) {
        BackofficeAgentProfile p = new BackofficeAgentProfile();
        p.setDisplayName(name);
        p.setActive(true);
        return profileRepo.saveAndFlush(p).getId();
    }

    private Long persistConv(Long userId, String status, Long agentId, Long profileId) {
        SupportConversation c = new SupportConversation();
        c.setUserId(userId);
        c.setResolutionStatus(status);
        c.setAssignedAgentId(agentId);
        c.setAssignedProfileId(profileId);
        return convRepo.saveAndFlush(c).getId();
    }

    private SupportConversation reload(Long convId) {
        return convRepo.findById(convId).orElseThrow();
    }

    // --- claim ---

    @Test
    void claim_asigna_la_conversacion_y_deja_mensaje_SYSTEM() {
        Long customer = persistCustomer("ok");
        Long agent = persistAgent("ok");
        Long profile = persistProfile("Ana Soporte");
        Long convId = persistConv(customer, Constants.SupportResolutionStatuses.ESCALATED, null, null);
        when(grantService.hasActiveGrant(agent, profile)).thenReturn(true);

        hhService.claim(convId, agent, profile);

        SupportConversation fresh = reload(convId);
        assertThat(fresh.getResolutionStatus()).isEqualTo(Constants.SupportResolutionStatuses.HUMAN_HANDLING);
        assertThat(fresh.getAssignedAgentId()).isEqualTo(agent);
        assertThat(fresh.getAssignedProfileId()).isEqualTo(profile);

        List<SupportMessage> msgs = msgRepo.findByConversationIdOrderByIdAsc(convId);
        assertThat(msgs).extracting(SupportMessage::getSender)
                .contains(Constants.SupportSenderTypes.SYSTEM);
    }

    @Test
    void claim_falla_si_la_conversacion_no_esta_ESCALATED() {
        Long customer = persistCustomer("noesc");
        Long agent = persistAgent("noesc");
        Long profile = persistProfile("Ben Soporte");
        Long convId = persistConv(customer, Constants.SupportResolutionStatuses.OPEN, null, null);
        when(grantService.hasActiveGrant(anyLong(), anyLong())).thenReturn(true);

        assertThatThrownBy(() -> hhService.claim(convId, agent, profile))
                .isInstanceOf(SupportConflictException.class);
    }

    @Test
    void claim_falla_sin_grant_activo() {
        Long customer = persistCustomer("nogrant");
        Long agent = persistAgent("nogrant");
        Long profile = persistProfile("Cid Soporte");
        Long convId = persistConv(customer, Constants.SupportResolutionStatuses.ESCALATED, null, null);
        when(grantService.hasActiveGrant(anyLong(), anyLong())).thenReturn(false);

        assertThatThrownBy(() -> hhService.claim(convId, agent, profile))
                .isInstanceOf(SupportPermissionDeniedException.class);
    }

    // --- release ---

    @Test
    void release_devuelve_la_conversacion_a_ESCALATED() {
        Long customer = persistCustomer("rel");
        Long agent = persistAgent("rel");
        Long profile = persistProfile("Dan Soporte");
        Long convId = persistConv(customer, Constants.SupportResolutionStatuses.HUMAN_HANDLING, agent, profile);

        hhService.release(convId, agent);

        SupportConversation fresh = reload(convId);
        assertThat(fresh.getResolutionStatus()).isEqualTo(Constants.SupportResolutionStatuses.ESCALATED);
        assertThat(fresh.getAssignedAgentId()).isNull();
    }

    @Test
    void release_falla_si_lo_intenta_otro_agente() {
        Long customer = persistCustomer("relx");
        Long agent = persistAgent("relx");
        Long otherAgent = persistAgent("relx-other");
        Long profile = persistProfile("Eva Soporte");
        Long convId = persistConv(customer, Constants.SupportResolutionStatuses.HUMAN_HANDLING, agent, profile);

        assertThatThrownBy(() -> hhService.release(convId, otherAgent))
                .isInstanceOf(SupportPermissionDeniedException.class);
    }

    // --- resolve ---

    @Test
    void resolve_cierra_como_RESOLVED_preservando_la_asignacion() {
        Long customer = persistCustomer("res");
        Long agent = persistAgent("res");
        Long profile = persistProfile("Fay Soporte");
        Long convId = persistConv(customer, Constants.SupportResolutionStatuses.HUMAN_HANDLING, agent, profile);

        hhService.resolve(convId, agent);

        SupportConversation fresh = reload(convId);
        assertThat(fresh.getResolutionStatus()).isEqualTo(Constants.SupportResolutionStatuses.RESOLVED);
        assertThat(fresh.getEndedAt()).isNotNull();
        assertThat(fresh.getAssignedAgentId()).isEqualTo(agent); // se preserva el historial
    }

    // --- sendHumanMessage ---

    @Test
    void sendHumanMessage_persiste_mensaje_HUMAN_del_agente() {
        Long customer = persistCustomer("msg");
        Long agent = persistAgent("msg");
        Long profile = persistProfile("Gil Soporte");
        Long convId = persistConv(customer, Constants.SupportResolutionStatuses.HUMAN_HANDLING, agent, profile);

        SupportMessage saved = hhService.sendHumanMessage(convId, agent, "Hola, te ayudo con esto.");

        assertThat(saved.getSender()).isEqualTo(Constants.SupportSenderTypes.HUMAN);
        assertThat(saved.getContent()).isEqualTo("Hola, te ayudo con esto.");
        assertThat(saved.getSentByUserId()).isEqualTo(agent);
        assertThat(saved.getSentByProfileId()).isEqualTo(profile);
    }

    @Test
    void sendHumanMessage_falla_si_la_conversacion_no_esta_en_HUMAN_HANDLING() {
        Long customer = persistCustomer("msgx");
        Long agent = persistAgent("msgx");
        Long profile = persistProfile("Hal Soporte");
        // Asignada al agente pero aún ESCALATED (no claimed): el guard de estado corta.
        Long convId = persistConv(customer, Constants.SupportResolutionStatuses.ESCALATED, agent, profile);

        assertThatThrownBy(() -> hhService.sendHumanMessage(convId, agent, "hola"))
                .isInstanceOf(SupportConflictException.class);
    }
}
