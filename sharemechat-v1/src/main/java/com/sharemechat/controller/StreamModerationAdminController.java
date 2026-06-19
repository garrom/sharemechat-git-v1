package com.sharemechat.controller;

import com.sharemechat.entity.User;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.UserService;
import com.sharemechat.streammoderation.dto.StreamModerationApproveRequest;
import com.sharemechat.streammoderation.dto.StreamModerationConfigDTO;
import com.sharemechat.streammoderation.dto.StreamModerationConfigUpdateRequest;
import com.sharemechat.streammoderation.dto.StreamModerationRejectRequest;
import com.sharemechat.streammoderation.dto.StreamModerationReviewDetailDTO;
import com.sharemechat.streammoderation.dto.StreamModerationReviewListItemDTO;
import com.sharemechat.streammoderation.dto.StreamModerationSessionDetailDTO;
import com.sharemechat.streammoderation.dto.StreamModerationSessionListItemDTO;
import com.sharemechat.streammoderation.dto.StreamModerationStatsDTO;
import com.sharemechat.streammoderation.service.StreamModerationAdminService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

/**
 * Endpoints admin del frente Moderacion IA del streaming (ADR-030 /
 * ADR-036 / ADR-037).
 *
 * <p>Permisos (decision K5 de Fase A):
 * <ul>
 *   <li>READ ({@code /queue}, {@code /queue/{id}}, {@code /stats},
 *       {@code /sessions}, {@code /sessions/{id}}): ADMIN + SUPPORT + AUDIT.</li>
 *   <li>MODERATE ({@code /queue/{id}/approve|reject}): ADMIN + SUPPORT.</li>
 *   <li>CONFIG ({@code /config}, {@code /config/mode}): ADMIN solo. Sin
 *       matcher especifico en SecurityConfig: cae al catch-all
 *       {@code /api/admin/**} que exige ROLE_ADMIN.</li>
 * </ul>
 *
 * <p>SecurityConfig es primera barrera. El gating fino dentro del
 * controller (helper {@link #resolveAccess}) actua como segunda
 * barrera, calcando {@code ModerationController} de model-assets.
 */
@RestController
@RequestMapping("/api/admin/stream-moderation")
public class StreamModerationAdminController {

    private static final Logger log = LoggerFactory.getLogger(StreamModerationAdminController.class);

    private static final Set<String> ROLES_CAN_READ = Set.of(
            BackofficeAuthorities.ROLE_ADMIN,
            BackofficeAuthorities.ROLE_SUPPORT,
            BackofficeAuthorities.ROLE_AUDIT
    );
    private static final Set<String> ROLES_CAN_MODERATE = Set.of(
            BackofficeAuthorities.ROLE_ADMIN,
            BackofficeAuthorities.ROLE_SUPPORT
    );
    private static final Set<String> ROLES_CAN_CHANGE_CONFIG = Set.of(
            BackofficeAuthorities.ROLE_ADMIN
    );

    private final StreamModerationAdminService adminService;
    private final UserService userService;
    private final BackofficeAccessService backofficeAccessService;

    public StreamModerationAdminController(StreamModerationAdminService adminService,
                                           UserService userService,
                                           BackofficeAccessService backofficeAccessService) {
        this.adminService = adminService;
        this.userService = userService;
        this.backofficeAccessService = backofficeAccessService;
    }

    // ============================================================
    // Cola humana
    // ============================================================

    @GetMapping("/queue")
    public ResponseEntity<?> getQueue(@RequestParam(required = false) String status,
                                       @RequestParam(required = false) String severity,
                                       @RequestParam(required = false) String category,
                                       Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canRead) {
            return forbidden();
        }
        try {
            List<StreamModerationReviewListItemDTO> rows = adminService.listQueue(status, severity, category);
            return ResponseEntity.ok(rows);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @GetMapping("/queue/{reviewId}")
    public ResponseEntity<?> getReviewDetail(@PathVariable Long reviewId, Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canRead) {
            return forbidden();
        }
        try {
            StreamModerationReviewDetailDTO detail = adminService.getReviewDetail(reviewId);
            return ResponseEntity.ok(detail);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canRead) {
            return forbidden();
        }
        StreamModerationStatsDTO stats = adminService.getStats();
        return ResponseEntity.ok(stats);
    }

    @PostMapping("/queue/{reviewId}/approve")
    public ResponseEntity<?> approve(@PathVariable Long reviewId,
                                      @RequestBody(required = false) StreamModerationApproveRequest request,
                                      Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canModerate) {
            return forbidden();
        }
        try {
            StreamModerationReviewListItemDTO updated = adminService.approveReview(
                    reviewId,
                    access.userId,
                    request != null ? request.note() : null
            );
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
        }
    }

    @PostMapping("/queue/{reviewId}/reject")
    public ResponseEntity<?> reject(@PathVariable Long reviewId,
                                     @RequestBody(required = false) StreamModerationRejectRequest request,
                                     Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canModerate) {
            return forbidden();
        }
        if (request == null) {
            return ResponseEntity.badRequest().body("body requerido");
        }
        try {
            StreamModerationReviewListItemDTO updated = adminService.rejectReview(
                    reviewId,
                    access.userId,
                    request.decisionCode(),
                    request.note(),
                    request.killStreamIfActive()
            );
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
        }
    }

    // ============================================================
    // Sesiones
    // ============================================================

    @GetMapping("/sessions")
    public ResponseEntity<?> getSessions(@RequestParam(required = false) String status,
                                          Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canRead) {
            return forbidden();
        }
        List<StreamModerationSessionListItemDTO> rows = adminService.listSessions(status);
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<?> getSessionDetail(@PathVariable Long sessionId, Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canRead) {
            return forbidden();
        }
        try {
            StreamModerationSessionDetailDTO detail = adminService.getSessionDetail(sessionId);
            return ResponseEntity.ok(detail);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }

    // ============================================================
    // Config
    // ============================================================

    @GetMapping("/config")
    public ResponseEntity<?> getConfig(Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canChangeConfig) {
            return forbidden();
        }
        StreamModerationConfigDTO dto = adminService.getConfig();
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/config/mode")
    public ResponseEntity<?> updateMode(@RequestBody(required = false) StreamModerationConfigUpdateRequest request,
                                        Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canChangeConfig) {
            return forbidden();
        }
        if (request == null) {
            return ResponseEntity.badRequest().body("body requerido");
        }
        try {
            StreamModerationConfigDTO updated = adminService.updateMode(
                    request.mode(),
                    access.userId,
                    request.note()
            );
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    // ============================================================
    // Helpers de autorizacion
    // ============================================================

    private Access resolveAccess(Authentication auth) {
        Access out = new Access();
        if (auth == null || auth.getName() == null) {
            return out;
        }
        User user = userService.findByEmail(auth.getName());
        if (user == null) {
            return out;
        }
        out.userId = user.getId();
        BackofficeAccessService.BackofficeAccessProfile profile =
                backofficeAccessService.loadProfile(user.getId(), user.getRole());
        Set<String> roles = profile.roles();
        out.canRead = roles.stream().anyMatch(ROLES_CAN_READ::contains);
        out.canModerate = roles.stream().anyMatch(ROLES_CAN_MODERATE::contains);
        out.canChangeConfig = roles.stream().anyMatch(ROLES_CAN_CHANGE_CONFIG::contains);
        return out;
    }

    private static ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("forbidden");
    }

    private static final class Access {
        Long userId;
        boolean canRead;
        boolean canModerate;
        boolean canChangeConfig;
    }
}
