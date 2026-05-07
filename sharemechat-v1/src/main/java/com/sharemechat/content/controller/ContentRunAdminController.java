package com.sharemechat.content.controller;

import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.CreateRunRequest;
import com.sharemechat.content.dto.RunDetailDTO;
import com.sharemechat.content.dto.RunSummaryDTO;
import com.sharemechat.content.dto.SubmitOutputRequest;
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
 * Endpoints admin para runs IA (Fase 3A, ADR-010).
 * Acceso cubierto por la regla generica /api/admin/** de SecurityConfig
 * (ROLE_ADMIN o BO_ROLE_ADMIN). La validacion fina por permiso CONTENT.* se
 * verifica aqui inspeccionando authorities, dejando la base preparada para
 * futuros usuarios EDITOR/REVIEWER.
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
        Long actorUserId = resolveUserId(authentication);
        String runType = request == null ? null : request.getRunType();
        // CONTENT.EDIT siempre. CONTENT.REVIEW adicional para run_type REVIEW.
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_EDIT);
        if (runType != null && ContentConstants.RUN_TYPE_REVIEW.equalsIgnoreCase(runType.trim())) {
            requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_REVIEW);
        }
        RunDetailDTO created = runService.createRun(articleId, runType, actorUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/articles/{articleId}/runs/{runId}/output")
    public RunDetailDTO submitOutput(
            @PathVariable("articleId") Long articleId,
            @PathVariable("runId") Long runId,
            @RequestBody SubmitOutputRequest request,
            Authentication authentication
    ) {
        Long actorUserId = resolveUserId(authentication);
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_EDIT);
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request requerida");
        }
        return runService.submitOutput(
                articleId,
                runId,
                request.getRawOutput(),
                request.getModelId(),
                request.getModelVersion(),
                request.getTokensInput(),
                request.getTokensOutput(),
                actorUserId);
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

    /**
     * Fase 4A: aplica draft_markdown del output validado del run al cuerpo
     * del articulo. Requiere CONTENT.EDIT y que el run este VALIDATED.
     * No publica, no cambia estado, no crea version.
     */
    @PostMapping("/articles/{articleId}/runs/{runId}/apply-draft")
    public ArticleDetailDTO applyDraft(
            @PathVariable("articleId") Long articleId,
            @PathVariable("runId") Long runId,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_EDIT);
        Long actorUserId = resolveUserId(authentication);
        boolean adminFlag = isAdmin(authentication);
        return runService.applyValidatedDraftToArticle(articleId, runId, actorUserId, adminFlag);
    }

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
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Permiso requerido: " + permissionCode);
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
