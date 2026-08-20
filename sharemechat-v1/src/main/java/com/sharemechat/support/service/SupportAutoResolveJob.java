package com.sharemechat.support.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportMessage;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * ADR-046 hardening: auto-resolucion de conversaciones {@code HUMAN_HANDLING}
 * colgadas por inactividad.
 *
 * <p>Problema: una conversacion en HUMAN_HANDLING bloquea al Agente IA para ese
 * usuario (el bot deja de responder mientras un humano la lleva). Si nadie la
 * atiende ni la resuelve, el usuario queda bloqueado indefinidamente.</p>
 *
 * <p><b>Regla de negocio (clave):</b> SOLO se auto-cierra cuando la inactividad
 * es del USUARIO — es decir, cuando el ULTIMO mensaje NO es suyo (ya le
 * respondimos y no ha vuelto en N dias). Si el ultimo mensaje es del usuario,
 * esta esperando respuesta NUESTRA: es backlog nuestro y NO se cierra (cerrarlo
 * seria tapar un cliente sin atender).</p>
 *
 * <p>Solo actua sobre HUMAN_HANDLING. Las ESCALATED no bloquean al bot (sin
 * agente asignado el bot sigue respondiendo) y son cola de atencion, no de
 * cierre.</p>
 */
@Component
public class SupportAutoResolveJob {

    private static final Logger log = LoggerFactory.getLogger(SupportAutoResolveJob.class);

    private final SupportConversationRepository convRepo;
    private final SupportMessageRepository msgRepo;
    private final UserRepository userRepository;

    // Package-private para poder fijarlos en el test unitario sin reflexion.
    @Value("${support.autoResolve.enabled:true}")
    boolean enabled;

    @Value("${support.autoResolve.inactivityDays:3}")
    int inactivityDays;

    public SupportAutoResolveJob(SupportConversationRepository convRepo,
                                 SupportMessageRepository msgRepo,
                                 UserRepository userRepository) {
        this.convRepo = convRepo;
        this.msgRepo = msgRepo;
        this.userRepository = userRepository;
    }

    /** Diario a las 04:30 (hora del servidor). Cron configurable. */
    @Scheduled(cron = "${support.autoResolve.cron:0 30 4 * * *}")
    @Transactional
    public void run() {
        if (!enabled) {
            return;
        }
        int days = Math.max(1, inactivityDays);
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        List<SupportConversation> candidates = convRepo.findByResolutionStatusAndUpdatedAtBefore(
                Constants.SupportResolutionStatuses.HUMAN_HANDLING, cutoff);

        int closed = 0;
        int skippedUserWaiting = 0;
        for (SupportConversation conv : candidates) {
            SupportMessage last = msgRepo.findFirstByConversationIdOrderByIdDesc(conv.getId());
            // Solo cerrar si la inactividad es del USUARIO (ultimo mensaje no suyo).
            if (last != null && Constants.SupportSenderTypes.USER.equals(last.getSender())) {
                skippedUserWaiting++;
                continue;
            }
            LocalDateTime now = LocalDateTime.now();
            conv.setResolutionStatus(Constants.SupportResolutionStatuses.RESOLVED);
            conv.setEndedAt(now);
            conv.setUpdatedAt(now);
            convRepo.save(conv);
            persistClosingMessage(conv);
            closed++;
        }
        if (closed > 0 || skippedUserWaiting > 0) {
            log.info("[SUPPORT-AUTORESOLVE] inactivityDays={} candidates={} closed={} skipped_user_waiting={}",
                    days, candidates.size(), closed, skippedUserWaiting);
        }
    }

    private void persistClosingMessage(SupportConversation conv) {
        String locale = resolveLocale(conv.getUserId());
        SupportMessage m = new SupportMessage();
        m.setConversationId(conv.getId());
        m.setSender(Constants.SupportSenderTypes.SYSTEM);
        m.setContent(closingMessage(locale));
        msgRepo.save(m);
    }

    private String resolveLocale(Long userId) {
        if (userId == null) {
            return "es";
        }
        return userRepository.findById(userId)
                .map(User::getUiLocale)
                .filter(l -> l != null && !l.isBlank())
                .orElse("es");
    }

    static String closingMessage(String locale) {
        String lang = locale == null ? "es" : locale.toLowerCase();
        if (lang.startsWith("en")) {
            return "We've closed this conversation due to inactivity. "
                    + "If you still need help, just write to us again.";
        }
        return "Hemos cerrado esta conversacion por inactividad. "
                + "Si todavia necesitas ayuda, escribenos de nuevo.";
    }
}
