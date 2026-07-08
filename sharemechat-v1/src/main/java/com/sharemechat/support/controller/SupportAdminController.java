package com.sharemechat.support.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.UserService;
import com.sharemechat.support.dto.*;
import com.sharemechat.support.entity.BackofficeAgentProfile;
import com.sharemechat.support.entity.BackofficeAgentProfileGrant;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportMessage;
import com.sharemechat.support.exception.SupportConflictException;
import com.sharemechat.support.exception.SupportNotFoundException;
import com.sharemechat.support.exception.SupportPermissionDeniedException;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import com.sharemechat.support.service.BackofficeAgentProfileGrantService;
import com.sharemechat.support.service.BackofficeAgentProfileService;
import com.sharemechat.support.service.SupportHumanHandlingService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * Panel Soporte Humano (frente B.3.1, ADR-046). Endpoints admin para operar
 * conversaciones escaladas y gestionar profiles/grants. El bloqueo del bot
 * cuando hay claim vive en {@link com.sharemechat.support.service.SupportBotService}.
 *
 * <p>Autorizacion: {@code /api/admin/support/**} exige
 * {@code PERM_SUPPORT_CHAT_HANDLE} para las operaciones de conversacion, y
 * {@code PERM_SUPPORT_PROFILE_MANAGE} para el CRUD de profiles y grants. La
 * granularidad se define via matchers en {@code SecurityConfig}.</p>
 */
@RestController
@RequestMapping("/api/admin/support")
public class SupportAdminController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final SupportConversationRepository convRepo;
    private final SupportMessageRepository msgRepo;
    private final BackofficeAgentProfileRepository profileRepo;
    private final BackofficeAgentProfileService profileService;
    private final BackofficeAgentProfileGrantService grantService;
    private final SupportHumanHandlingService humanHandling;

    public SupportAdminController(
            UserService userService,
            UserRepository userRepository,
            SupportConversationRepository convRepo,
            SupportMessageRepository msgRepo,
            BackofficeAgentProfileRepository profileRepo,
            BackofficeAgentProfileService profileService,
            BackofficeAgentProfileGrantService grantService,
            SupportHumanHandlingService humanHandling) {
        this.userService = userService;
        this.userRepository = userRepository;
        this.convRepo = convRepo;
        this.msgRepo = msgRepo;
        this.profileRepo = profileRepo;
        this.profileService = profileService;
        this.grantService = grantService;
        this.humanHandling = humanHandling;
    }

    // ============================================================
    // Conversaciones
    // ============================================================

    @GetMapping("/conversations")
    public ResponseEntity<?> listConversations(
            @RequestParam(required = false) String status,
            @RequestParam(required = false, name = "assignedAgentId") String assignedAgentIdParam,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        return handled(() -> {
            Long currentUserId = requireUserId(auth);
            Long agentFilter = null;
            boolean unassignedOnly = false;
            if ("me".equalsIgnoreCase(assignedAgentIdParam)) {
                agentFilter = currentUserId;
            } else if ("unassigned".equalsIgnoreCase(assignedAgentIdParam)) {
                unassignedOnly = true;
            } else if (assignedAgentIdParam != null && !assignedAgentIdParam.isBlank()) {
                try {
                    agentFilter = Long.parseLong(assignedAgentIdParam);
                } catch (NumberFormatException ex) {
                    throw new IllegalArgumentException("assignedAgentId debe ser 'me', 'unassigned' o un id numerico");
                }
            }
            int safeSize = Math.min(Math.max(size, 1), 100);
            int safePage = Math.max(page, 0);
            Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "updatedAt"));
            Page<SupportConversation> pg = convRepo.findFiltered(status, agentFilter, unassignedOnly, pageable);
            return ResponseEntity.ok(mapPage(pg, this::toSummary));
        });
    }

    @GetMapping("/conversations/{id}")
    public ResponseEntity<?> getConversationDetail(@PathVariable Long id, Authentication auth) {
        return handled(() -> {
            requireUserId(auth);
            SupportConversation conv = convRepo.findById(id)
                    .orElseThrow(() -> new SupportNotFoundException("Conversacion no encontrada"));
            SupportConversationSummaryDTO summary = toSummary(conv);
            List<SupportMessage> rows = msgRepo.findByConversationIdOrderByIdAsc(id);
            Map<Long, String> profileNames = collectProfileNames(rows);
            List<SupportMessageAdminDTO> msgs = rows.stream()
                    .map(m -> toMessageAdmin(m, profileNames))
                    .collect(Collectors.toList());
            SupportConversationDetailDTO out = new SupportConversationDetailDTO();
            out.setConversation(summary);
            out.setMessages(msgs);
            return ResponseEntity.ok(out);
        });
    }

    @GetMapping("/pending-count")
    public ResponseEntity<?> pendingCount(Authentication auth) {
        return handled(() -> {
            Long currentUserId = requireUserId(auth);
            PendingCountDTO out = new PendingCountDTO();
            out.setPendingUnassigned(convRepo.countByResolutionStatusAndAssignedAgentIdIsNull(
                    Constants.SupportResolutionStatuses.ESCALATED));
            out.setMyAssigned(convRepo.countByAssignedAgentIdAndResolutionStatus(
                    currentUserId, Constants.SupportResolutionStatuses.HUMAN_HANDLING));
            out.setOtherAssigned(convRepo.countByStatusAndAssignedToOthers(
                    Constants.SupportResolutionStatuses.HUMAN_HANDLING, currentUserId));
            return ResponseEntity.ok(out);
        });
    }

    @PostMapping("/conversations/{id}/claim")
    public ResponseEntity<?> claim(@PathVariable Long id,
                                    @RequestBody SupportClaimRequest body,
                                    Authentication auth) {
        return handled(() -> {
            Long currentUserId = requireUserId(auth);
            if (body == null || body.getProfileId() == null) {
                throw new IllegalArgumentException("profileId requerido");
            }
            SupportConversation conv = humanHandling.claim(id, currentUserId, body.getProfileId());
            return ResponseEntity.ok(toSummary(conv));
        });
    }

    @PostMapping("/conversations/{id}/release")
    public ResponseEntity<?> release(@PathVariable Long id, Authentication auth) {
        return handled(() -> {
            Long currentUserId = requireUserId(auth);
            SupportConversation conv = humanHandling.release(id, currentUserId);
            return ResponseEntity.ok(toSummary(conv));
        });
    }

    @PostMapping("/conversations/{id}/message")
    public ResponseEntity<?> humanMessage(@PathVariable Long id,
                                          @RequestBody SupportHumanMessageRequest body,
                                          Authentication auth) {
        return handled(() -> {
            Long currentUserId = requireUserId(auth);
            String content = body == null ? null : body.getContent();
            SupportMessage saved = humanHandling.sendHumanMessage(id, currentUserId, content);
            SupportConversation conv = convRepo.findById(id).orElseThrow();
            Map<Long, String> names = collectProfileNames(List.of(saved));
            return ResponseEntity.ok(Map.of(
                    "conversationId", id,
                    "message", toMessageAdmin(saved, names),
                    "conversation", toSummary(conv)
            ));
        });
    }

    @PostMapping("/conversations/{id}/resolve")
    public ResponseEntity<?> resolve(@PathVariable Long id, Authentication auth) {
        return handled(() -> {
            Long currentUserId = requireUserId(auth);
            SupportConversation conv = humanHandling.resolve(id, currentUserId);
            return ResponseEntity.ok(toSummary(conv));
        });
    }

    // ============================================================
    // Profiles
    // ============================================================

    @GetMapping("/profiles/mine")
    public ResponseEntity<?> profilesMine(Authentication auth) {
        return handled(() -> {
            Long currentUserId = requireUserId(auth);
            List<BackofficeAgentProfileGrant> grants = grantService.listActiveByUser(currentUserId);
            List<ProfileMineDTO> out = new ArrayList<>(grants.size());
            for (BackofficeAgentProfileGrant g : grants) {
                Optional<BackofficeAgentProfile> po = profileRepo.findById(g.getProfileId());
                if (po.isEmpty() || !po.get().isActive()) continue;
                BackofficeAgentProfile p = po.get();
                ProfileMineDTO dto = new ProfileMineDTO();
                dto.setId(p.getId());
                dto.setDisplayName(p.getDisplayName());
                dto.setCategory(p.getCategory());
                dto.setActiveConversations(convRepo.countByAssignedProfileIdAndResolutionStatus(
                        p.getId(), Constants.SupportResolutionStatuses.HUMAN_HANDLING));
                out.add(dto);
            }
            return ResponseEntity.ok(out);
        });
    }

    @GetMapping("/profiles")
    public ResponseEntity<?> listProfiles(Authentication auth) {
        return handled(() -> {
            requireUserId(auth);
            List<ProfileDTO> out = profileService.listAll().stream()
                    .map(this::toProfileDTO)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(out);
        });
    }

    @PostMapping("/profiles")
    public ResponseEntity<?> createProfile(@RequestBody ProfileCreateRequest body, Authentication auth) {
        return handled(() -> {
            Long currentUserId = requireUserId(auth);
            if (body == null) throw new IllegalArgumentException("body requerido");
            BackofficeAgentProfile p = profileService.create(
                    body.getDisplayName(), body.getCategory(), currentUserId);
            return ResponseEntity.ok(toProfileDTO(p));
        });
    }

    @PatchMapping("/profiles/{id}")
    public ResponseEntity<?> updateProfile(@PathVariable Long id,
                                            @RequestBody ProfileUpdateRequest body,
                                            Authentication auth) {
        return handled(() -> {
            requireUserId(auth);
            if (body == null) throw new IllegalArgumentException("body requerido");
            BackofficeAgentProfile p = profileService.update(
                    id, body.getDisplayName(), body.getCategory(), body.getActive());
            return ResponseEntity.ok(toProfileDTO(p));
        });
    }

    // ============================================================
    // Grants
    // ============================================================

    @GetMapping("/profiles/{profileId}/grants")
    public ResponseEntity<?> listGrants(@PathVariable Long profileId, Authentication auth) {
        return handled(() -> {
            requireUserId(auth);
            if (!profileRepo.existsById(profileId)) {
                throw new SupportNotFoundException("Profile no encontrada");
            }
            return ResponseEntity.ok(grantService.listGrantsByProfileDetailed(profileId));
        });
    }

    @PostMapping("/profiles/{profileId}/grants")
    public ResponseEntity<?> grant(@PathVariable Long profileId,
                                    @RequestBody GrantCreateRequest body,
                                    Authentication auth) {
        return handled(() -> {
            Long currentUserId = requireUserId(auth);
            if (body == null || body.getUserId() == null) {
                throw new IllegalArgumentException("userId requerido");
            }
            BackofficeAgentProfileGrant g = grantService.grant(body.getUserId(), profileId, currentUserId);
            return ResponseEntity.ok(Map.of(
                    "userId", g.getUserId(),
                    "profileId", g.getProfileId(),
                    "active", g.isActive(),
                    "grantedBy", g.getGrantedBy(),
                    "grantedAt", g.getGrantedAt()
            ));
        });
    }

    @DeleteMapping("/profiles/{profileId}/grants/{userId}")
    public ResponseEntity<?> revoke(@PathVariable Long profileId,
                                     @PathVariable Long userId,
                                     Authentication auth) {
        return handled(() -> {
            requireUserId(auth);
            grantService.revoke(userId, profileId);
            return ResponseEntity.noContent().build();
        });
    }

    // ============================================================
    // Helpers privados
    // ============================================================

    private Long requireUserId(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new IllegalArgumentException("No autenticado");
        }
        User u = userService.findByEmail(auth.getName());
        if (u == null) throw new IllegalArgumentException("Usuario no encontrado");
        return u.getId();
    }

    /**
     * Executor comun con mapeo de excepciones a HTTP status. Reduce boilerplate
     * en cada endpoint. Simetrico al patron try/catch de {@code SupportController}.
     */
    private ResponseEntity<?> handled(Supplier<ResponseEntity<?>> op) {
        try {
            return op.get();
        } catch (SupportNotFoundException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        } catch (SupportPermissionDeniedException ex) {
            return ResponseEntity.status(403).body(Map.of("error", ex.getMessage()));
        } catch (SupportConflictException ex) {
            return ResponseEntity.status(409).body(Map.of("error", ex.getMessage()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(Map.of("error", ex.getMessage()));
        }
    }

    private SupportConversationSummaryDTO toSummary(SupportConversation c) {
        SupportConversationSummaryDTO out = new SupportConversationSummaryDTO();
        out.setId(c.getId());
        out.setUserId(c.getUserId());
        userRepository.findById(c.getUserId()).ifPresent(u -> {
            out.setUserEmail(u.getEmail());
            out.setUserRole(u.getRole());
        });
        out.setResolutionStatus(c.getResolutionStatus());
        out.setEscalatedByLlm(c.isEscalatedByLlm());
        out.setEscalationReason(c.getEscalationReason());
        out.setEscalatedAt(c.getEscalatedAt());
        out.setAssignedAgentId(c.getAssignedAgentId());
        out.setAssignedProfileId(c.getAssignedProfileId());
        out.setAssignedAt(c.getAssignedAt());
        if (c.getAssignedProfileId() != null) {
            profileRepo.findById(c.getAssignedProfileId())
                    .ifPresent(p -> out.setAssignedProfileDisplayName(p.getDisplayName()));
        }
        out.setMessageCount(msgRepo.countByConversationId(c.getId()));
        SupportMessage last = msgRepo.findFirstByConversationIdOrderByIdDesc(c.getId());
        if (last != null) out.setLastMessageAt(last.getCreatedAt());
        out.setStartedAt(c.getStartedAt());
        out.setUpdatedAt(c.getUpdatedAt());
        return out;
    }

    private ProfileDTO toProfileDTO(BackofficeAgentProfile p) {
        ProfileDTO out = new ProfileDTO();
        out.setId(p.getId());
        out.setDisplayName(p.getDisplayName());
        out.setActive(p.isActive());
        out.setCategory(p.getCategory());
        out.setCreatedBy(p.getCreatedBy());
        out.setCreatedAt(p.getCreatedAt());
        out.setUpdatedAt(p.getUpdatedAt());
        return out;
    }

    private Map<Long, String> collectProfileNames(List<SupportMessage> rows) {
        Set<Long> ids = new HashSet<>();
        for (SupportMessage m : rows) {
            if (m.getSentByProfileId() != null) ids.add(m.getSentByProfileId());
        }
        if (ids.isEmpty()) return Collections.emptyMap();
        Map<Long, String> out = new HashMap<>();
        for (Long id : ids) {
            profileRepo.findById(id).ifPresent(p -> out.put(id, p.getDisplayName()));
        }
        return out;
    }

    private SupportMessageAdminDTO toMessageAdmin(SupportMessage m, Map<Long, String> profileNames) {
        SupportMessageAdminDTO out = new SupportMessageAdminDTO();
        out.setId(m.getId());
        out.setConversationId(m.getConversationId());
        out.setSender(m.getSender());
        out.setContent(m.getContent());
        out.setCreatedAt(m.getCreatedAt());
        out.setSentByUserId(m.getSentByUserId());
        out.setSentByProfileId(m.getSentByProfileId());
        if (m.getSentByProfileId() != null) {
            out.setSentByProfileDisplayName(profileNames.get(m.getSentByProfileId()));
        }
        return out;
    }

    private Map<String, Object> mapPage(Page<SupportConversation> pg,
                                        java.util.function.Function<SupportConversation, SupportConversationSummaryDTO> mapper) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("content", pg.getContent().stream().map(mapper).collect(Collectors.toList()));
        out.put("page", pg.getNumber());
        out.put("size", pg.getSize());
        out.put("totalElements", pg.getTotalElements());
        out.put("totalPages", pg.getTotalPages());
        return out;
    }
}
