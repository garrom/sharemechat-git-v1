package com.sharemechat.streammoderation.controller;

import com.sharemechat.entity.User;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.UserService;
import com.sharemechat.streammoderation.dto.ModelBanDetailDTO;
import com.sharemechat.streammoderation.dto.ModelBanListItemDTO;
import com.sharemechat.streammoderation.dto.ModelBanReviewRequest;
import com.sharemechat.streammoderation.service.ModelBanAdminService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

/**
 * ADR-037 frente trial-sfw Bloque 4: endpoints admin del panel de bans
 * automaticos. Patron calcado de {@code StreamModerationAdminController}:
 * lectura ADMIN+SUPPORT+AUDIT; moderacion (lift/keep) ADMIN+SUPPORT.
 */
@RestController
@RequestMapping("/api/admin/model-bans")
public class ModelBanAdminController {

    private static final Logger log = LoggerFactory.getLogger(ModelBanAdminController.class);

    private static final Set<String> ROLES_CAN_READ = Set.of(
            BackofficeAuthorities.ROLE_ADMIN,
            BackofficeAuthorities.ROLE_SUPPORT,
            BackofficeAuthorities.ROLE_AUDIT
    );
    private static final Set<String> ROLES_CAN_MODERATE = Set.of(
            BackofficeAuthorities.ROLE_ADMIN,
            BackofficeAuthorities.ROLE_SUPPORT
    );

    private final ModelBanAdminService adminService;
    private final UserService userService;
    private final BackofficeAccessService backofficeAccessService;

    public ModelBanAdminController(ModelBanAdminService adminService,
                                    UserService userService,
                                    BackofficeAccessService backofficeAccessService) {
        this.adminService = adminService;
        this.userService = userService;
        this.backofficeAccessService = backofficeAccessService;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String filter,
                                    Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canRead) return forbidden();
        List<ModelBanListItemDTO> rows = adminService.listBans(filter);
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/{banId}")
    public ResponseEntity<?> detail(@PathVariable Long banId, Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canRead) return forbidden();
        try {
            ModelBanDetailDTO detail = adminService.getBanDetail(banId);
            return ResponseEntity.ok(detail);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }

    @PostMapping("/{banId}/lift")
    public ResponseEntity<?> lift(@PathVariable Long banId,
                                    @RequestBody(required = false) ModelBanReviewRequest request,
                                    Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canModerate) return forbidden();
        try {
            ModelBanListItemDTO updated = adminService.liftBan(
                    banId,
                    access.userId,
                    request != null ? request.note() : null);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }

    @PostMapping("/{banId}/keep")
    public ResponseEntity<?> keep(@PathVariable Long banId,
                                    @RequestBody(required = false) ModelBanReviewRequest request,
                                    Authentication auth) {
        Access access = resolveAccess(auth);
        if (!access.canModerate) return forbidden();
        try {
            ModelBanListItemDTO updated = adminService.keepBan(
                    banId,
                    access.userId,
                    request != null ? request.note() : null);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }

    private Access resolveAccess(Authentication auth) {
        Access out = new Access();
        if (auth == null || auth.getName() == null) return out;
        User user = userService.findByEmail(auth.getName());
        if (user == null) return out;
        out.userId = user.getId();
        BackofficeAccessService.BackofficeAccessProfile profile =
                backofficeAccessService.loadProfile(user.getId(), user.getRole());
        Set<String> roles = profile.roles();
        out.canRead = roles.stream().anyMatch(ROLES_CAN_READ::contains);
        out.canModerate = roles.stream().anyMatch(ROLES_CAN_MODERATE::contains);
        return out;
    }

    private static ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("forbidden");
    }

    private static final class Access {
        Long userId;
        boolean canRead;
        boolean canModerate;
    }
}
