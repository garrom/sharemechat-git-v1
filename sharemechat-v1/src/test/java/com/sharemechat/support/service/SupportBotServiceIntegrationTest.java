package com.sharemechat.support.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.dto.ClaudeApiResponse;
import com.sharemechat.support.dto.SupportMessageResponseDTO;
import com.sharemechat.support.entity.BackofficeAgentProfile;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportMessage;
import com.sharemechat.support.entity.SupportRateLimitDaily;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import com.sharemechat.support.repository.SupportRateLimitDailyRepository;
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

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-059: tests de ORQUESTACIÓN del agente IA de soporte
 * ({@link SupportBotService#handleUserMessage}, capa 3 del frente bot).
 *
 * <p>@SpringBootTest + MySQL real (perfil ci) con el BORDE HTTP a Claude
 * ({@link ClaudeApiClient}) sustituido por {@code @MockBean}: la orquestación y la
 * persistencia son reales, solo la llamada al LLM es simulada. Así se prueban las
 * ramas del pipeline de forma determinista y SIN gastar tokens ni red.
 *
 * <p>Cubre: (1) happy path (persiste USER+LLM, cuenta tokens en rate-limit, reply
 * del LLM, no escalado); (2) rate-limited → responde canónico y NO llama a Claude
 * (cortafuegos de coste, DEC-CS-11); (3) escalado por tool {@code escalate_to_human}
 * → conversación ESCALATED; (4) fallo del LLM → mensaje SYSTEM de indisponibilidad
 * y NO cuenta rate-limit; (5) human-handling (conv con {@code assignedAgentId}) →
 * salta el LLM y marca humanHandling (ADR-046).
 *
 * <p>Requiere Docker (CI).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("ci")
@Testcontainers
class SupportBotServiceIntegrationTest {

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

    @MockBean ClaudeApiClient claudeClient;

    @Autowired SupportBotService supportBotService;
    @Autowired SupportRateLimitService rateLimitService;
    @Autowired SupportConversationRepository conversationRepo;
    @Autowired SupportMessageRepository messageRepo;
    @Autowired SupportRateLimitDailyRepository rateLimitRepo;
    @Autowired BackofficeAgentProfileRepository profileRepo;
    @Autowired UserRepository userRepository;

    private Long persistUser(String nick, String email) {
        User u = new User();
        u.setNickname(nick);
        u.setEmail(email);
        u.setPassword("x");
        u.setRole(Constants.Roles.USER);
        u.setUserType(Constants.UserTypes.FORM_CLIENT);
        u.setUiLocale("es");
        return userRepository.save(u).getId();
    }

    private ClaudeApiResponse llmReply(String text, int tokensIn, int tokensOut) {
        ClaudeApiResponse r = new ClaudeApiResponse();
        r.setTextContent(text);
        r.setTokensInput(tokensIn);
        r.setTokensOutput(tokensOut);
        r.setModelId("claude-haiku-4-5");
        r.setFinishReason("end_turn");
        r.setEscalationToolCalled(false);
        return r;
    }

    private static LocalDate todayUtc() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    @Test
    @Transactional
    void happy_path_persiste_user_y_llm_cuenta_tokens_y_devuelve_reply() throws Exception {
        Long userId = persistUser("ci-bot-happy", "ci-bot-happy@example.test");
        when(claudeClient.callMessages(anyString(), anyList(), anyString()))
                .thenReturn(llmReply("¿En qué puedo ayudarte?", 100, 50));
        when(claudeClient.estimateCostMicros(anyInt(), anyInt())).thenReturn(150L);

        SupportMessageResponseDTO out = supportBotService.handleUserMessage(userId, "tengo una duda", "1.2.3.4");

        assertThat(out.getReply()).isEqualTo("¿En qué puedo ayudarte?");
        assertThat(out.getEscalated()).isFalse();

        List<SupportMessage> msgs = messageRepo.findByConversationIdOrderByIdAsc(out.getConversationId());
        assertThat(msgs).extracting(SupportMessage::getSender)
                .containsExactly(Constants.SupportSenderTypes.USER, Constants.SupportSenderTypes.LLM);
        assertThat(msgs.get(1).getContent()).isEqualTo("¿En qué puedo ayudarte?");

        SupportRateLimitDaily rl = rateLimitRepo.findByUserIdAndUsageDate(userId, todayUtc()).orElseThrow();
        assertThat(rl.getMessagesCount()).isEqualTo(1);
        assertThat(rl.getTokensCount()).isEqualTo(150L); // 100 in + 50 out
        verify(claudeClient).callMessages(anyString(), anyList(), eq("tengo una duda"));
    }

    @Test
    @Transactional
    void rate_limited_responde_canonico_y_no_llama_a_claude() throws Exception {
        Long userId = persistUser("ci-bot-rl", "ci-bot-rl@example.test");
        int cap = rateLimitService.remainingMessages(userId); // = cap configurado (sin uso previo)
        for (int i = 0; i < cap; i++) {
            rateLimitService.registerUsage(userId, 0);
        }

        SupportMessageResponseDTO out = supportBotService.handleUserMessage(userId, "hola", null);

        assertThat(out.getReply()).isEqualTo(SupportBotService.RATE_LIMIT_MESSAGE_ES);
        assertThat(out.getResolutionStatus()).isEqualTo(Constants.SupportResolutionStatuses.RATE_LIMITED);
        assertThat(out.getRateLimited()).isTrue();
        verify(claudeClient, never()).callMessages(anyString(), anyList(), anyString());
    }

    @Test
    @Transactional
    void escalado_por_tool_marca_conversacion_ESCALATED() throws Exception {
        Long userId = persistUser("ci-bot-esc", "ci-bot-esc@example.test");
        ClaudeApiResponse resp = llmReply("Te derivo con el equipo humano.", 80, 40);
        resp.setEscalationToolCalled(true);
        resp.setEscalationReason("no puedo resolver el pago del usuario");
        when(claudeClient.callMessages(anyString(), anyList(), anyString())).thenReturn(resp);
        when(claudeClient.estimateCostMicros(anyInt(), anyInt())).thenReturn(120L);

        SupportMessageResponseDTO out = supportBotService.handleUserMessage(
                userId, "mi pago no llegó y llevo días esperando", null);

        assertThat(out.getEscalated()).isTrue();
        assertThat(out.getResolutionStatus()).isEqualTo(Constants.SupportResolutionStatuses.ESCALATED);
        assertThat(out.getEscalationReason()).isEqualTo("no puedo resolver el pago del usuario");

        SupportConversation conv = conversationRepo.findById(out.getConversationId()).orElseThrow();
        assertThat(conv.getResolutionStatus()).isEqualTo(Constants.SupportResolutionStatuses.ESCALATED);
    }

    @Test
    @Transactional
    void fallo_del_llm_persiste_system_unavailable_y_no_cuenta_rate_limit() throws Exception {
        Long userId = persistUser("ci-bot-fail", "ci-bot-fail@example.test");
        when(claudeClient.callMessages(anyString(), anyList(), anyString()))
                .thenThrow(new RuntimeException("timeout hacia Claude"));

        SupportMessageResponseDTO out = supportBotService.handleUserMessage(userId, "hola", null);

        assertThat(out.getReply()).isEqualTo(SupportBotService.LLM_UNAVAILABLE_MESSAGE_ES);

        List<SupportMessage> msgs = messageRepo.findByConversationIdOrderByIdAsc(out.getConversationId());
        assertThat(msgs).extracting(SupportMessage::getSender)
                .containsExactly(Constants.SupportSenderTypes.USER, Constants.SupportSenderTypes.SYSTEM);

        // El fallo ocurre ANTES de registerUsage -> no se crea fila de rate-limit.
        assertThat(rateLimitRepo.findByUserIdAndUsageDate(userId, todayUtc())).isEmpty();
    }

    @Test
    @Transactional
    void human_handling_salta_el_llm_cuando_hay_claim_activo() throws Exception {
        Long userId = persistUser("ci-bot-human", "ci-bot-human@example.test");
        Long agentId = persistUser("ci-bot-agent", "ci-bot-agent@example.test");

        // Perfil de agente real: la CHECK `chk_support_conv_assign_bicolumn` exige
        // que assigned_agent_id y assigned_profile_id sean ambos NOT NULL (o ambos
        // NULL); assigned_profile_id además es FK a backoffice_agent_profile.
        BackofficeAgentProfile profile = new BackofficeAgentProfile();
        profile.setDisplayName("CI Agente Soporte");
        Long profileId = profileRepo.saveAndFlush(profile).getId();

        // Conversación activa ya reclamada por un agente humano (ADR-046).
        SupportConversation conv = new SupportConversation();
        conv.setUserId(userId);
        conv.setResolutionStatus(Constants.SupportResolutionStatuses.HUMAN_HANDLING);
        conv.setAssignedAgentId(agentId);
        conv.setAssignedProfileId(profileId);
        Long convId = conversationRepo.saveAndFlush(conv).getId();

        SupportMessageResponseDTO out = supportBotService.handleUserMessage(userId, "sigo esperando", null);

        assertThat(out.getConversationId()).isEqualTo(convId); // reutiliza la conv activa
        assertThat(out.getHumanHandling()).isTrue();
        assertThat(out.getReply()).isNull();
        assertThat(out.getResolutionStatus()).isEqualTo(Constants.SupportResolutionStatuses.HUMAN_HANDLING);
        verify(claudeClient, never()).callMessages(anyString(), anyList(), anyString());
    }
}
