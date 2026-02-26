package com.sharemechat.controller;

import com.sharemechat.dto.ModelChecklistUpdateDTO;
import com.sharemechat.dto.UserDTO;
import com.sharemechat.entity.KycProviderConfig;
import com.sharemechat.entity.User;
import com.sharemechat.service.AdminService;
import com.sharemechat.service.KycProviderConfigService;
import com.sharemechat.service.UserService;
import com.sharemechat.dto.ModerationReportDTO;
import com.sharemechat.dto.ModerationReportReviewDTO;
import com.sharemechat.service.ModerationReportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private static final Logger logger = LoggerFactory.getLogger(AdminController.class);

    private final AdminService adminService;
    private final UserService userService;
    private final KycProviderConfigService kycProviderConfigService;
    private final ModerationReportService moderationReportService;

    // constructor
    public AdminController(
            AdminService adminService,
            UserService userService,
            KycProviderConfigService kycProviderConfigService,
            ModerationReportService moderationReportService
    ) {
        this.adminService = adminService;
        this.userService = userService;
        this.kycProviderConfigService = kycProviderConfigService;
        this.moderationReportService = moderationReportService;
    }

    // GET /api/admin/models?verification=PENDING|APPROVED|REJECTED (opcional)
    @GetMapping("/models")
    public ResponseEntity<List<UserDTO>> getModels(@RequestParam(required = false) String verification) {
        logger.info("GET /api/admin/models verification={}", verification);
        return ResponseEntity.ok(adminService.getModels(verification));
    }

    // POST /api/admin/review/{userId}?action=APPROVE|REJECT|PENDING
    @PostMapping("/review/{userId}")
    public ResponseEntity<String> reviewModel(@PathVariable Long userId, @RequestParam String action) {
        logger.info("POST /api/admin/review/{} action={}", userId, action);
        if (userId == null) {
            logger.error("userId es nulo");
            return ResponseEntity.badRequest().body("El userId no puede ser nulo");
        }
        return ResponseEntity.ok(adminService.reviewModel(userId, action));
    }

    // GET /api/admin/finance/top-models?limit=10
    @GetMapping("/finance/top-models")
    public ResponseEntity<List<Map<String, Object>>> topModels(@RequestParam(defaultValue = "10") int limit) {
        logger.info("GET /api/admin/finance/top-models limit={}", limit);
        return ResponseEntity.ok(adminService.financeTopModels(limit));
    }

    // GET /api/admin/finance/top-clients?limit=10
    @GetMapping("/finance/top-clients")
    public ResponseEntity<List<Map<String, Object>>> topClients(@RequestParam(defaultValue = "10") int limit) {
        logger.info("GET /api/admin/finance/top-clients limit={}", limit);
        return ResponseEntity.ok(adminService.financeTopClients(limit));
    }

    // GET /api/admin/finance/summary
    @GetMapping("/finance/summary")
    public ResponseEntity<Map<String, String>> summary() {
        logger.info("GET /api/admin/finance/summary");
        return ResponseEntity.ok(adminService.financeSummary());
    }

    // GET /api/admin/db/view?table=users&limit=10
    @GetMapping("/db/view")
    public ResponseEntity<List<Map<String, Object>>> dbView(
            @RequestParam String table,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(adminService.viewTable(table, limit));
    }

    // GET /api/admin/model-docs/{userId}
    @GetMapping("/model-docs/{userId}")
    public ResponseEntity<Map<String, Object>> getModelDocs(@PathVariable Long userId) {
        return ResponseEntity.ok(adminService.getModelDocsWithChecklist(userId));
    }

    // POST /api/admin/model-checklist/{userId}
    @PostMapping("/model-checklist/{userId}")
    public ResponseEntity<Map<String, Object>> updateChecklist(
            @PathVariable Long userId,
            @RequestBody ModelChecklistUpdateDTO dto,
            Authentication auth
    ) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        User admin = userService.findByEmail(auth.getName());
        Long adminId = admin != null ? admin.getId() : null;

        Map<String, Object> out = adminService.updateModelChecklist(
                userId, adminId, dto.getFrontOk(), dto.getBackOk(), dto.getSelfieOk()
        );
        return ResponseEntity.ok(out);
    }

    //  "VERIFF" | "MANUAL",
    @PostMapping("/kyc/model-onboarding/mode")
    public ResponseEntity<?> setAdminKycModelOnboardingMode(
            @RequestBody Map<String, String> body,
            Authentication auth
    ) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body("No autenticado");
        }

        User admin = userService.findByEmail(auth.getName());
        Long adminId = admin != null ? admin.getId() : null;

        String mode = body.get("mode");
        String note = body.get("note");

        try {
            KycProviderConfig c = kycProviderConfigService.setModelOnboardingMode(mode, adminId, note);

            return ResponseEntity.ok(Map.of(
                    "providerKey", c.getProviderKey(),
                    "activeMode", c.getActiveMode(),
                    "enabled", c.isEnabled(),
                    "updatedByUserId", c.getUpdatedByUserId() == null ? "" : c.getUpdatedByUserId(),
                    "createdAt", c.getCreatedAt() == null ? "" : c.getCreatedAt().toString(),
                    "updatedAt", c.getUpdatedAt() == null ? "" : c.getUpdatedAt().toString(),
                    "note", c.getNote() == null ? "" : c.getNote()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ======================================
    // MODERATION REPORTS (PSP / Compliance)
    // ======================================

    // GET /api/admin/moderation/reports?status=OPEN|REVIEWING|RESOLVED|REJECTED (opcional)
    @GetMapping("/moderation/reports")
    public ResponseEntity<List<ModerationReportDTO>> moderationReports(
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(moderationReportService.adminList(status));
    }

    // GET /api/admin/moderation/reports/{id}
    @GetMapping("/moderation/reports/{id}")
    public ResponseEntity<ModerationReportDTO> moderationReportById(@PathVariable Long id) {
        return ResponseEntity.ok(moderationReportService.adminGetById(id));
    }

    // POST /api/admin/moderation/reports/{id}/review
    @PostMapping("/moderation/reports/{id}/review")
    public ResponseEntity<ModerationReportDTO> reviewModerationReport(
            @PathVariable Long id,
            @RequestBody ModerationReportReviewDTO dto,
            Authentication auth
    ) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        User admin = userService.findByEmail(auth.getName());
        Long adminId = admin != null ? admin.getId() : null;

        return ResponseEntity.ok(moderationReportService.adminReview(id, adminId, dto));
    }

}