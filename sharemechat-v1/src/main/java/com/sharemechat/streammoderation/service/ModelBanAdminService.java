package com.sharemechat.streammoderation.service;

import com.sharemechat.compliance.dto.EvidenceSignedUrlDTO;
import com.sharemechat.compliance.service.ComplianceEvidenceService;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.EmailCopyRenderer;
import com.sharemechat.service.EmailMessage;
import com.sharemechat.service.EmailService;
import com.sharemechat.streammoderation.config.ModelBanProperties;
import com.sharemechat.streammoderation.dto.ModelBanDetailDTO;
import com.sharemechat.streammoderation.dto.ModelBanListItemDTO;
import com.sharemechat.streammoderation.entity.ModelModerationBan;
import com.sharemechat.streammoderation.entity.ModelModerationStrike;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.repository.ModelModerationBanRepository;
import com.sharemechat.streammoderation.repository.ModelModerationStrikeRepository;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * ADR-037 frente trial-sfw Bloque 4: capa admin sobre el motor de bans.
 * Expone list/detail/lift/keep al panel del backoffice. Los verdicts
 * automaticos siguen viviendo en {@link ModelBanService}; este servicio
 * gestiona la revision humana de los casos que llegan al 5o+ strike
 * (requires_manual_review) o las apelaciones puntuales de bans menores.
 */
@Service
public class ModelBanAdminService {

    private static final Logger log = LoggerFactory.getLogger(ModelBanAdminService.class);

    private static final int DEFAULT_PAGE_SIZE = 100;

    private final ModelModerationBanRepository banRepository;
    private final ModelModerationStrikeRepository strikeRepository;
    private final StreamModerationReviewRepository reviewRepository;
    private final ModelBanProperties banProperties;
    private final UserRepository userRepository;
    private final ModelRepository modelRepository;
    private final ComplianceEvidenceService evidenceService;
    private final EmailCopyRenderer emailCopyRenderer;
    private final EmailService emailService;

    public ModelBanAdminService(ModelModerationBanRepository banRepository,
                                ModelModerationStrikeRepository strikeRepository,
                                StreamModerationReviewRepository reviewRepository,
                                ModelBanProperties banProperties,
                                UserRepository userRepository,
                                ModelRepository modelRepository,
                                ComplianceEvidenceService evidenceService,
                                EmailCopyRenderer emailCopyRenderer,
                                EmailService emailService) {
        this.banRepository = banRepository;
        this.strikeRepository = strikeRepository;
        this.reviewRepository = reviewRepository;
        this.banProperties = banProperties;
        this.userRepository = userRepository;
        this.modelRepository = modelRepository;
        this.evidenceService = evidenceService;
        this.emailCopyRenderer = emailCopyRenderer;
        this.emailService = emailService;
    }

    // ========================================================================
    // Listado
    // ========================================================================

    /**
     * Filtros soportados:
     * <ul>
     *   <li>{@code pending_review} (default UI): requires_manual_review=true AND reviewed=false</li>
     *   <li>{@code active}: ban_ends_at &gt; NOW</li>
     *   <li>{@code all}: todos ordenados por ban_started_at DESC</li>
     * </ul>
     */
    @Transactional(readOnly = true)
    public List<ModelBanListItemDTO> listBans(String filter) {
        PageRequest page = PageRequest.of(0, DEFAULT_PAGE_SIZE);
        String f = filter == null ? "pending_review" : filter.trim().toLowerCase();
        List<ModelModerationBan> bans;
        switch (f) {
            case "active":
                bans = banRepository.findActive(LocalDateTime.now(), page);
                break;
            case "all":
                bans = banRepository.findAllByOrderByBanStartedAtDesc(page);
                break;
            case "pending_review":
            default:
                bans = banRepository.findByRequiresManualReviewTrueAndReviewedFalseOrderByBanStartedAtDesc(page);
        }
        if (bans.isEmpty()) return Collections.emptyList();

        Map<Long, User> usersById = loadUsers(bans);
        LocalDateTime now = LocalDateTime.now();
        return bans.stream()
                .map(b -> toListItem(b, usersById.get(b.getModelUserId()), now))
                .toList();
    }

    // ========================================================================
    // Detalle
    // ========================================================================

    @Transactional(readOnly = true)
    public ModelBanDetailDTO getBanDetail(Long banId) {
        ModelModerationBan ban = banRepository.findById(banId)
                .orElseThrow(() -> new IllegalArgumentException("Ban no encontrado: " + banId));

        User model = userRepository.findById(ban.getModelUserId()).orElse(null);
        LocalDateTime windowStart = LocalDateTime.now()
                .minusDays(banProperties.getStrikeWindowDays());
        List<ModelModerationStrike> strikes = strikeRepository
                .findByModelUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
                        ban.getModelUserId(), windowStart);

        List<ModelBanDetailDTO.StrikeSummary> strikeSummaries = strikes.stream()
                .map(s -> new ModelBanDetailDTO.StrikeSummary(
                        s.getId(),
                        s.getStreamModerationSessionId(),
                        s.getSeverity(),
                        s.getCategory(),
                        s.getCreatedAt()))
                .toList();

        // Evidencia S3: busca la review CRITICAL con evidenceRef en la
        // sesion del strike origen. Best-effort; si no hay evidencia
        // subida (bucket blank en config o severity insuficiente para
        // upload), devuelve url=null y el frontend muestra "sin evidencia".
        String evidenceUrl = null;
        LocalDateTime evidenceExpiresAt = null;
        try {
            ModelModerationStrike source = strikeRepository.findById(ban.getSourceStrikeId()).orElse(null);
            if (source != null) {
                List<StreamModerationReview> reviews = reviewRepository
                        .findByStreamModerationSessionIdOrderByIdAsc(source.getStreamModerationSessionId());
                for (int i = reviews.size() - 1; i >= 0; i--) {
                    StreamModerationReview r = reviews.get(i);
                    if ("CRITICAL".equals(r.getSeverity())
                            && r.getEvidenceRef() != null && !r.getEvidenceRef().isBlank()) {
                        EvidenceSignedUrlDTO signed = evidenceService.generateSignedUrlByRef(r.getEvidenceRef());
                        if (signed != null && signed.getUrl() != null) {
                            evidenceUrl = signed.getUrl();
                            evidenceExpiresAt = signed.getExpiresAt();
                        }
                        break;
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[MODEL-BAN-ADMIN] evidence lookup FAIL banId={}: {}", banId, ex.getMessage());
        }

        boolean active = ban.getBanEndsAt() != null && ban.getBanEndsAt().isAfter(LocalDateTime.now());
        return new ModelBanDetailDTO(
                ban.getId(),
                ban.getModelUserId(),
                model != null ? model.getNickname() : null,
                model != null ? model.getEmail() : null,
                ban.getStrikeCountAtBan(),
                ban.getBanStartedAt(),
                ban.getBanEndsAt(),
                ban.getReason(),
                ban.isRequiresManualReview(),
                ban.isReviewed(),
                ban.getReviewedAt(),
                ban.getReviewedBy(),
                active,
                evidenceUrl,
                evidenceExpiresAt,
                strikeSummaries
        );
    }

    // ========================================================================
    // Acciones
    // ========================================================================

    /**
     * Levanta el ban: marca reviewed=true, endsAt=NOW-1s (para invalidarlo
     * al gate), models.streaming_banned_until=NULL. Envia email a la
     * modelo notificando el levantamiento (best-effort).
     */
    @Transactional
    public ModelBanListItemDTO liftBan(Long banId, Long adminUserId, String note) {
        ModelModerationBan ban = banRepository.findById(banId)
                .orElseThrow(() -> new IllegalArgumentException("Ban no encontrado: " + banId));
        LocalDateTime now = LocalDateTime.now();
        ban.setReviewed(true);
        ban.setReviewedAt(now);
        ban.setReviewedBy(adminUserId);
        ban.setBanEndsAt(now.minusSeconds(1));
        banRepository.save(ban);

        // Limpiar streaming_banned_until en el perfil del modelo. Si hay
        // un ban futuro superpuesto de otro modelUserId, respetarlo. En
        // la practica solo hay un modelo por ban, asi que basta con set
        // a null (o al pasado).
        modelRepository.findById(ban.getModelUserId()).ifPresent(m -> {
            m.setStreamingBannedUntil(null);
            modelRepository.save(m);
        });

        // Email best-effort
        sendLiftEmailBestEffort(ban.getModelUserId());

        log.warn("[MODEL-BAN-ADMIN] LIFT banId={} adminUserId={} modelUserId={} note={}",
                banId, adminUserId, ban.getModelUserId(), note);

        User user = userRepository.findById(ban.getModelUserId()).orElse(null);
        return toListItem(ban, user, LocalDateTime.now());
    }

    /**
     * Confirma el ban tras revision manual: marca reviewed=true sin
     * cambiar endsAt. NO envia email (decision operador Bloque 4: no
     * aporta valor, la modelo ya recibio el aviso del ban original).
     */
    @Transactional
    public ModelBanListItemDTO keepBan(Long banId, Long adminUserId, String note) {
        ModelModerationBan ban = banRepository.findById(banId)
                .orElseThrow(() -> new IllegalArgumentException("Ban no encontrado: " + banId));
        ban.setReviewed(true);
        ban.setReviewedAt(LocalDateTime.now());
        ban.setReviewedBy(adminUserId);
        banRepository.save(ban);

        log.info("[MODEL-BAN-ADMIN] KEEP banId={} adminUserId={} modelUserId={} note={}",
                banId, adminUserId, ban.getModelUserId(), note);

        User user = userRepository.findById(ban.getModelUserId()).orElse(null);
        return toListItem(ban, user, LocalDateTime.now());
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private void sendLiftEmailBestEffort(Long modelUserId) {
        try {
            User user = userRepository.findById(modelUserId).orElse(null);
            if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
                log.info("[MODEL-BAN-ADMIN] lift email skip: user/email vacio modelUserId={}", modelUserId);
                return;
            }
            EmailCopyRenderer.EmailContent content =
                    emailCopyRenderer.renderModelStreamingBanLifted(user);
            emailService.send(new EmailMessage(
                    user.getEmail(),
                    content.subject(),
                    content.body(),
                    EmailMessage.Category.MODEL_STREAMING_BAN_LIFTED,
                    EmailMessage.Priority.BEST_EFFORT
            ));
        } catch (Exception ex) {
            log.warn("[MODEL-BAN-ADMIN] lift email FAIL modelUserId={}: {}",
                    modelUserId, ex.getMessage());
        }
    }

    private Map<Long, User> loadUsers(List<ModelModerationBan> bans) {
        List<Long> ids = bans.stream().map(ModelModerationBan::getModelUserId).toList();
        return userRepository.findAllById(ids).stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, u -> u));
    }

    private ModelBanListItemDTO toListItem(ModelModerationBan b, User user, LocalDateTime now) {
        boolean active = b.getBanEndsAt() != null && b.getBanEndsAt().isAfter(now);
        return new ModelBanListItemDTO(
                b.getId(),
                b.getModelUserId(),
                user != null ? user.getNickname() : null,
                user != null ? user.getEmail() : null,
                b.getStrikeCountAtBan(),
                b.getBanStartedAt(),
                b.getBanEndsAt(),
                b.getReason(),
                b.isRequiresManualReview(),
                b.isReviewed(),
                active
        );
    }
}
