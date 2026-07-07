package com.sharemechat.support.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.entity.BackofficeAgentProfile;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportMessage;
import com.sharemechat.support.exception.SupportConflictException;
import com.sharemechat.support.exception.SupportNotFoundException;
import com.sharemechat.support.exception.SupportPermissionDeniedException;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Orquestador de las operaciones humanas sobre conversaciones de soporte:
 * claim, release, envio de mensaje, resolucion. Ver ADR-046.
 *
 * <p>Todos los metodos son {@code @Transactional} para acotar los race
 * conditions con el flujo del bot y con otros agentes. El claim usa
 * {@code claimIfUnassigned} (UPDATE condicional con check de rowCount) para
 * garantizar que dos admins no puedan tomar la misma conversacion.</p>
 */
@Service
public class SupportHumanHandlingService {

    private static final Logger log = LoggerFactory.getLogger(SupportHumanHandlingService.class);

    static final int MAX_HUMAN_MESSAGE_LENGTH = 4000;

    private final SupportConversationRepository convRepo;
    private final SupportMessageRepository msgRepo;
    private final BackofficeAgentProfileRepository profileRepo;
    private final BackofficeAgentProfileGrantService grantService;
    private final UserRepository userRepository;

    public SupportHumanHandlingService(
            SupportConversationRepository convRepo,
            SupportMessageRepository msgRepo,
            BackofficeAgentProfileRepository profileRepo,
            BackofficeAgentProfileGrantService grantService,
            UserRepository userRepository) {
        this.convRepo = convRepo;
        this.msgRepo = msgRepo;
        this.profileRepo = profileRepo;
        this.grantService = grantService;
        this.userRepository = userRepository;
    }

    /**
     * Asigna la conversacion al agent con la profile pedida.
     *
     * <p>Contrato:</p>
     * <ul>
     *   <li>404 si la conversacion o la profile no existen.</li>
     *   <li>403 si el agente no tiene grant activo sobre la profile.</li>
     *   <li>400 si la profile esta desactivada o la conv no esta ESCALATED.</li>
     *   <li>409 si otro agente ya hizo claim entre la lectura y el UPDATE
     *       (rowCount=0 del claimIfUnassigned).</li>
     * </ul>
     *
     * <p>Al exito inserta un mensaje SYSTEM en la conversacion informando al
     * user del claim, con i18n segun {@code user.uiLocale}.</p>
     */
    @Transactional
    public SupportConversation claim(Long convId, Long agentId, Long profileId) {
        SupportConversation conv = convRepo.findById(convId)
                .orElseThrow(() -> new SupportNotFoundException("Conversacion no encontrada"));
        BackofficeAgentProfile profile = profileRepo.findById(profileId)
                .orElseThrow(() -> new SupportNotFoundException("Profile no encontrada"));

        if (!profile.isActive()) {
            throw new IllegalArgumentException("Profile no disponible");
        }
        // Mensaje neutro: no distinguimos "no existe" de "no activa" ni de
        // "no autorizada para tu cuenta" para no filtrar oraculo.
        if (!grantService.hasActiveGrant(agentId, profileId)) {
            throw new SupportPermissionDeniedException("Profile no disponible para tu cuenta");
        }
        if (!Constants.SupportResolutionStatuses.ESCALATED.equals(conv.getResolutionStatus())) {
            throw new SupportConflictException("La conversacion no esta en estado ESCALATED");
        }

        LocalDateTime now = LocalDateTime.now();
        int updated = convRepo.claimIfUnassigned(convId, agentId, profileId, now, now);
        if (updated == 0) {
            throw new SupportConflictException("Ya esta atendida por otro agente");
        }

        // Insertar mensaje SYSTEM al user con i18n.
        String userLocale = resolveLocale(conv.getUserId());
        String systemMsg = buildAssignmentMessage(profile.getDisplayName(), userLocale);
        persistSystem(convId, systemMsg);

        log.info("[SUPPORT-HH] claim ok convId={} agentId={} profileId={} displayName={}",
                convId, agentId, profileId, profile.getDisplayName());

        return convRepo.findById(convId).orElseThrow();
    }

    /**
     * Libera el claim. La conversacion vuelve a ESCALATED y queda disponible
     * para que otro agente la tome.
     */
    @Transactional
    public SupportConversation release(Long convId, Long agentId) {
        SupportConversation conv = convRepo.findById(convId)
                .orElseThrow(() -> new SupportNotFoundException("Conversacion no encontrada"));

        if (conv.getAssignedAgentId() == null || !conv.getAssignedAgentId().equals(agentId)) {
            throw new SupportPermissionDeniedException("Solo el agente asignado puede liberar");
        }

        int updated = convRepo.releaseIfOwnedBy(convId, agentId, LocalDateTime.now());
        if (updated == 0) {
            // Race: alguien resolvio o el status cambio entre la lectura y el UPDATE.
            throw new SupportConflictException("La conversacion cambio de estado");
        }

        log.info("[SUPPORT-HH] release ok convId={} agentId={}", convId, agentId);
        return convRepo.findById(convId).orElseThrow();
    }

    /**
     * Cierra la conversacion como RESOLVED. Mantiene {@code assigned_agent_id}
     * y {@code assigned_profile_id} para preservar el historial.
     */
    @Transactional
    public SupportConversation resolve(Long convId, Long agentId) {
        SupportConversation conv = convRepo.findById(convId)
                .orElseThrow(() -> new SupportNotFoundException("Conversacion no encontrada"));

        if (conv.getAssignedAgentId() == null || !conv.getAssignedAgentId().equals(agentId)) {
            throw new SupportPermissionDeniedException("Solo el agente asignado puede resolver");
        }

        conv.setResolutionStatus(Constants.SupportResolutionStatuses.RESOLVED);
        conv.setEndedAt(LocalDateTime.now());
        conv.setUpdatedAt(LocalDateTime.now());
        SupportConversation saved = convRepo.save(conv);

        log.info("[SUPPORT-HH] resolve ok convId={} agentId={}", convId, agentId);
        return saved;
    }

    /**
     * Persiste un mensaje HUMAN en la conversacion. La firma publica al user
     * la aportara el frontend via join con la profile del mensaje.
     */
    @Transactional
    public SupportMessage sendHumanMessage(Long convId, Long agentId, String rawContent) {
        String content = rawContent == null ? "" : rawContent.trim();
        if (content.isEmpty()) {
            throw new IllegalArgumentException("content vacio");
        }
        if (content.length() > MAX_HUMAN_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("content demasiado largo (>" + MAX_HUMAN_MESSAGE_LENGTH + ")");
        }

        SupportConversation conv = convRepo.findById(convId)
                .orElseThrow(() -> new SupportNotFoundException("Conversacion no encontrada"));

        if (conv.getAssignedAgentId() == null || !conv.getAssignedAgentId().equals(agentId)) {
            throw new SupportPermissionDeniedException("Solo el agente asignado puede escribir en esta conversacion");
        }
        if (!Constants.SupportResolutionStatuses.HUMAN_HANDLING.equals(conv.getResolutionStatus())) {
            throw new SupportConflictException("La conversacion no esta en HUMAN_HANDLING");
        }

        SupportMessage m = new SupportMessage();
        m.setConversationId(convId);
        m.setSender(Constants.SupportSenderTypes.HUMAN);
        m.setContent(content);
        m.setSentByUserId(agentId);
        m.setSentByProfileId(conv.getAssignedProfileId());
        SupportMessage saved = msgRepo.save(m);

        conv.setUpdatedAt(LocalDateTime.now());
        convRepo.save(conv);

        log.info("[SUPPORT-HH] human reply convId={} agentId={} profileId={} msgId={}",
                convId, agentId, conv.getAssignedProfileId(), saved.getId());
        return saved;
    }

    // ------------------------------------------------------------------
    // Helpers privados
    // ------------------------------------------------------------------

    private void persistSystem(Long convId, String content) {
        SupportMessage m = new SupportMessage();
        m.setConversationId(convId);
        m.setSender(Constants.SupportSenderTypes.SYSTEM);
        m.setContent(content);
        msgRepo.save(m);
    }

    private String resolveLocale(Long userId) {
        if (userId == null) return "es";
        return userRepository.findById(userId)
                .map(User::getUiLocale)
                .filter(l -> l != null && !l.isBlank())
                .orElse("es");
    }

    /**
     * Mensaje SYSTEM que ve el user al asignarsele un humano. I18n hardcoded
     * ES/EN. No hay MessageSource generico en el backend hoy (verificado en
     * B.3.1 pre-analisis). Fallback ES si el locale es null, blank o no ES/EN.
     */
    static String buildAssignmentMessage(String displayName, String locale) {
        String lang = locale == null ? "es" : locale.toLowerCase();
        if (lang.startsWith("en")) {
            return "Your case has been assigned to " + displayName
                    + " from the support team. They will reply shortly.";
        }
        return "Tu caso ha sido asignado a " + displayName
                + " del equipo de soporte. Te responderá en breve.";
    }
}
