package com.sharemechat.content.controller;

import com.sharemechat.content.dto.ApplyBilingualRequest;
import com.sharemechat.content.dto.ApplyBilingualResultDTO;
import com.sharemechat.content.dto.CreateRunRequest;
import com.sharemechat.content.dto.RunDetailDTO;
import com.sharemechat.content.dto.RunSummaryDTO;
import com.sharemechat.content.service.ContentRunService;
import com.sharemechat.entity.User;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Endpoints admin para runs IA bajo modelo bilingue ADR-025.
 *
 * Reactivados completamente en paquete 3:
 *  - POST /articles/{id}/runs                                  crear run
 *  - POST /articles/{articleId}/runs/{runId}/apply-bilingual   apply atomico
 *  - GET  /articles/{id}/runs                                  listado de runs
 *  - GET  /runs/{runId}                                        detalle de un run
 *
 * Eliminados respecto al paquete 0 (flujo viejo padre/hijo y monolingue):
 *  - POST /articles/{articleId}/runs/{runId}/output
 *  - POST /articles/{articleId}/runs/{runId}/output-bilingual
 *  - POST /articles/{articleId}/runs/{runId}/apply-draft
 */
@RestController
@RequestMapping("/api/admin/content")
public class ContentRunAdminController {

    private final ContentRunService runService;
    private final UserService userService;

    public ContentRunAdminController(ContentRunService runService, UserService userService) {
        this.runService = runService;
        this.userService = userService;
    }

    @PostMapping("/articles/{id}/runs")
    public ResponseEntity<RunDetailDTO> createRun(
            @PathVariable("id") Long articleId,
            @RequestBody CreateRunRequest request,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_EDIT);
        Long actorUserId = resolveUserId(authentication);
        String runType = request == null ? null : request.getRunType();
        RunDetailDTO created = runService.createRun(articleId, runType, actorUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/articles/{articleId}/runs/{runId}/apply-bilingual")
    public ApplyBilingualResultDTO applyBilingual(
            @PathVariable("articleId") Long articleId,
            @PathVariable("runId") Long runId,
            @RequestBody ApplyBilingualRequest request,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_EDIT);
        Long actorUserId = resolveUserId(authentication);
        boolean adminFlag = isAdmin(authentication);
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request requerida");
        }
        return runService.applyBilingual(
                articleId,
                runId,
                request.getRawJson(),
                request.getModelId(),
                request.getModelVersion(),
                actorUserId,
                adminFlag);
    }

    @GetMapping("/articles/{id}/runs")
    public List<RunSummaryDTO> listByArticle(
            @PathVariable("id") Long articleId,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_VIEW);
        return runService.listByArticle(articleId);
    }

    @GetMapping("/runs/{runId}")
    public RunDetailDTO getRun(
            @PathVariable("runId") Long runId,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_VIEW);
        return runService.findById(runId);
    }

    // ================================================================
    // Helpers de seguridad
    // ================================================================

    private Long resolveUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no resuelto");
        }
        return user.getId();
    }

    private void requirePermission(Authentication authentication, String permissionCode) {
        if (authentication == null || authentication.getAuthorities() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Permiso requerido: " + permissionCode);
        }
        String roleAdmin = "ROLE_ADMIN";
        String boRoleAdmin = BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN);
        String permAuthority = BackofficeAuthorities.permissionAuthority(permissionCode);
        boolean ok = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> roleAdmin.equals(a) || boRoleAdmin.equals(a) || permAuthority.equals(a));
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Permiso requerido: " + permissionCode);
        }
    }

    private boolean isAdmin(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null) return false;
        String boRoleAdmin = BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN);
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> "ROLE_ADMIN".equals(a) || boRoleAdmin.equals(a));
    }
}
