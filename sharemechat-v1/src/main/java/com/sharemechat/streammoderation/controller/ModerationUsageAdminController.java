package com.sharemechat.streammoderation.controller;

import com.sharemechat.entity.User;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.UserService;
import com.sharemechat.streammoderation.dto.ModerationUsageDTO;
import com.sharemechat.streammoderation.service.ModerationUsageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

/**
 * Endpoint admin del consumo Sightengine contra el cupo del plan
 * (ADR-037 Fase 5 Bloque 5, Paso 2).
 *
 * <p>Permisos calcados de {@code StreamModerationAdminController}
 * (READ = ADMIN + SUPPORT + AUDIT). SecurityConfig actua como primera
 * barrera via matcher {@code /api/admin/**}; el gating fino de rol
 * aqui es segunda barrera.
 */
@RestController
@RequestMapping("/api/admin/moderation")
public class ModerationUsageAdminController {

    private static final Set<String> ROLES_CAN_READ = Set.of(
            BackofficeAuthorities.ROLE_ADMIN,
            BackofficeAuthorities.ROLE_SUPPORT,
            BackofficeAuthorities.ROLE_AUDIT
    );

    private final ModerationUsageService usageService;
    private final UserService userService;
    private final BackofficeAccessService backofficeAccessService;

    public ModerationUsageAdminController(ModerationUsageService usageService,
                                          UserService userService,
                                          BackofficeAccessService backofficeAccessService) {
        this.usageService = usageService;
        this.userService = userService;
        this.backofficeAccessService = backofficeAccessService;
    }

    @GetMapping("/usage")
    public ResponseEntity<?> getUsage(Authentication auth) {
        if (!canRead(auth)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("forbidden");
        }
        ModerationUsageDTO snapshot = usageService.snapshot();
        return ResponseEntity.ok(snapshot);
    }

    private boolean canRead(Authentication auth) {
        if (auth == null || auth.getName() == null) return false;
        User user = userService.findByEmail(auth.getName());
        if (user == null) return false;
        BackofficeAccessService.BackofficeAccessProfile profile =
                backofficeAccessService.loadProfile(user.getId(), user.getRole());
        return profile.roles().stream().anyMatch(ROLES_CAN_READ::contains);
    }
}
