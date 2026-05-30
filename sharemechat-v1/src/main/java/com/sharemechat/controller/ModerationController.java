package com.sharemechat.controller;

import com.sharemechat.dto.ModelAssetRejectRequest;
import com.sharemechat.dto.ModelAssetReviewDTO;
import com.sharemechat.dto.ModelAssetReviewStatsDTO;
import com.sharemechat.entity.ModelAssetReview;
import com.sharemechat.entity.User;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.ModelAssetReviewService;
import com.sharemechat.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

/**
 * Endpoints admin para moderación de assets de perfil de modelo (Capa 1).
 *
 * <p>Permisos:
 * <ul>
 *   <li>ADMIN: lee y modera.</li>
 *   <li>SUPPORT: lee y modera (mismo perfil que ADMIN en esta feature).</li>
 *   <li>AUDIT: solo lectura.</li>
 * </ul>
 *
 * <p>El gating se realiza dentro del controller cargando el
 * {@link BackofficeAccessService.BackofficeAccessProfile} del usuario
 * autenticado. SecurityConfig sigue siendo la primera barrera para el
 * path {@code /api/admin/**}.
 */
@RestController
@RequestMapping("/api/admin/model-assets")
public class ModerationController {

    private static final Logger logger = LoggerFactory.getLogger(ModerationController.class);

    private static final Set<String> ROLES_CAN_MODERATE = Set.of(
            BackofficeAuthorities.ROLE_ADMIN,
            BackofficeAuthorities.ROLE_SUPPORT
    );

    private static final Set<String> ROLES_CAN_READ = Set.of(
            BackofficeAuthorities.ROLE_ADMIN,
            BackofficeAuthorities.ROLE_SUPPORT,
            BackofficeAuthorities.ROLE_AUDIT
    );

    private final ModelAssetReviewService reviewService;
    private final UserService userService;
    private final BackofficeAccessService backofficeAccessService;

    public ModerationController(ModelAssetReviewService reviewService,
                                UserService userService,
                                BackofficeAccessService backofficeAccessService) {
        this.reviewService = reviewService;
        this.userService = userService;
        this.backofficeAccessService = backofficeAccessService;
    }

    // ============================================================
    // Endpoints
    // ============================================================

    /**
     * Listado de reviews para la tabla del panel. Por defecto devuelve la
     * cola FIFO de PENDING_REVIEW; con {@code ?status=APPROVED|REJECTED}
     * devuelve el conjunto del estado pedido, también ordenado por
     * {@code uploaded_at asc}.
     */
    @GetMapping("/queue")
    public ResponseEntity<?> getQueue(@RequestParam(required = false) String status,
                                       Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canRead) {
            return forbidden();
        }
        try {
            List<ModelAssetReviewDTO> rows = (status == null || status.isBlank())
                    ? reviewService.getReviewQueue()
                    : reviewService.getReviewsByStatus(status);
            return ResponseEntity.ok(rows);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    /** Conteo por estado para las stat cards. */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canRead) {
            return forbidden();
        }
        ModelAssetReviewStatsDTO stats = reviewService.getStats();
        return ResponseEntity.ok(stats);
    }

    /** Aprueba una review pendiente (ADMIN o SUPPORT). */
    @PostMapping("/{reviewId}/approve")
    public ResponseEntity<?> approve(@PathVariable Long reviewId, Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canModerate) {
            return forbidden();
        }
        try {
            ModelAssetReview r = reviewService.approveReview(reviewId, access.userId);
            return ResponseEntity.ok(r);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
        }
    }

    /**
     * Rechaza una review pendiente (ADMIN o SUPPORT). Body con
     * {@code reasonCode} obligatorio y {@code reasonText} obligatorio
     * solo cuando {@code reasonCode == "OTHER"}.
     */
    @PostMapping("/{reviewId}/reject")
    public ResponseEntity<?> reject(@PathVariable Long reviewId,
                                     @RequestBody ModelAssetRejectRequest request,
                                     Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canModerate) {
            return forbidden();
        }
        try {
            ModelAssetReview r = reviewService.rejectReview(
                    reviewId,
                    access.userId,
                    request != null ? request.reasonCode() : null,
                    request != null ? request.reasonText() : null
            );
            return ResponseEntity.ok(r);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
        }
    }

    // ============================================================
    // Helpers de autorización
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
        out.canModerate = roles.stream().anyMatch(ROLES_CAN_MODERATE::contains);
        out.canRead = roles.stream().anyMatch(ROLES_CAN_READ::contains);
        return out;
    }

    private static ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Sin permiso para esta operación");
    }

    private static final class Access {
        Long userId;
        boolean canRead;
        boolean canModerate;
    }
}
