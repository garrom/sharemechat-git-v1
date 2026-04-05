package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.*;
import com.sharemechat.entity.KycProviderConfig;
import com.sharemechat.entity.PayoutRequest;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.handler.MessagesWsHandler;
import com.sharemechat.entity.User;
import com.sharemechat.handler.MatchingHandler;
import com.sharemechat.service.AdminService;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.KycProviderConfigService;
import com.sharemechat.service.ModerationReportService;
import com.sharemechat.service.StreamService;
import com.sharemechat.service.TransactionService;
import com.sharemechat.service.UserService;
import com.sharemechat.repository.PayoutRequestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private static final Logger logger = LoggerFactory.getLogger(AdminController.class);

    private final AdminService adminService;
    private final BackofficeAccessService backofficeAccessService;
    private final UserService userService;
    private final KycProviderConfigService kycProviderConfigService;
    private final ModerationReportService moderationReportService;
    private final StreamService streamService;
    private final MatchingHandler matchingHandler;
    private final MessagesWsHandler messagesWsHandler;

    // [NEW] payouts
    private final PayoutRequestRepository payoutRequestRepository;
    private final TransactionService transactionService;

    public AdminController(
            AdminService adminService,
            BackofficeAccessService backofficeAccessService,
            UserService userService,
            KycProviderConfigService kycProviderConfigService,
            ModerationReportService moderationReportService,
            StreamService streamService,
            MatchingHandler matchingHandler,
            MessagesWsHandler messagesWsHandler,
            PayoutRequestRepository payoutRequestRepository,
            TransactionService transactionService
    ) {
        this.adminService = adminService;
        this.backofficeAccessService = backofficeAccessService;
        this.userService = userService;
        this.kycProviderConfigService = kycProviderConfigService;
        this.moderationReportService = moderationReportService;
        this.streamService = streamService;
        this.matchingHandler = matchingHandler;
        this.messagesWsHandler = messagesWsHandler;
        this.payoutRequestRepository = payoutRequestRepository;
        this.transactionService = transactionService;
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

    @GetMapping("/administration/backoffice-users")
    public ResponseEntity<BackofficeAccessService.BackofficeAdminOverview> backofficeUsers() {
        return ResponseEntity.ok(adminServiceBackofficeOverview());
    }

    // GET /api/admin/model-docs/{userId}
    @GetMapping("/model-docs/{userId}")
    public ResponseEntity<Map<String, Object>> getModelDocs(@PathVariable Long userId) {
        return ResponseEntity.ok(adminService.getModelDocsWithChecklist(userId));
    }

    // GET /api/admin/streams/active
    @GetMapping("/streams/active")
    public ResponseEntity<List<StreamActiveAdminRowDto>> activeStreams(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long minDurationSec,
            @RequestParam(required = false) String streamType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(streamService.listActiveStreamsForAdmin(
                q, minDurationSec, streamType, status, limit
        ));
    }

    @GetMapping("/stats/overview")
    public ResponseEntity<Map<String, Object>> statsOverview() {
        Map<String, Object> matching = matchingHandler.adminRuntimeSnapshot();
        Map<String, Object> messages = messagesWsHandler.adminRuntimeSnapshot();
        Map<String, Object> persisted = streamService.getAdminPersistedStats();

        List<?> waitingModels = asList(matching.get("waitingModels"));
        List<?> waitingViewers = asList(matching.get("waitingClients"));
        List<?> randomPairs = asList(matching.get("pairs"));
        List<?> activeCalls = asList(messages.get("activeCalls"));
        List<?> ringingUsers = asList(messages.get("ringingUsers"));

        return ResponseEntity.ok(Map.of(
                "randomWaitingModels", waitingModels.size(),
                "randomWaitingViewers", waitingViewers.size(),
                "randomActivePairs", randomPairs.size(),
                "directRingingUsers", ringingUsers.size(),
                "directActiveCalls", activeCalls.size(),
                "persistedRandomConnecting", persisted.getOrDefault("persistedRandomConnecting", 0L),
                "persistedRandomActive", persisted.getOrDefault("persistedRandomActive", 0L),
                "persistedCallingActive", persisted.getOrDefault("persistedCallingActive", 0L)
        ));
    }

    // GET /api/admin/streams/{id}
    @GetMapping("/streams/{id}")
    public ResponseEntity<StreamAdminDetailDto> streamDetail(
            @PathVariable Long id,
            @RequestParam(required = false) Integer limitEvents
    ) {
        return ResponseEntity.ok(streamService.getAdminStreamDetail(id, limitEvents));
    }

    // POST /api/admin/streams/{id}/kill
    @PostMapping("/streams/{id}/kill")
    public ResponseEntity<Map<String, Object>> killStream(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body
    ) {
        String reason = body != null ? body.get("reason") : null;
        StreamRecord sr = streamService.killStreamAsAdmin(id, reason);
        String wsReason = (reason == null || reason.isBlank()) ? "admin-kill" : "admin-kill:" + reason.trim();
        if (sr != null
                && sr.getStreamType() != null
                && Constants.StreamTypes.RANDOM.equalsIgnoreCase(sr.getStreamType())
                && sr.getClient() != null
                && sr.getModel() != null) {
            matchingHandler.adminKillPair(sr.getClient().getId(), sr.getModel().getId(), "admin-kill");
        } else if (sr != null
                && sr.getStreamType() != null
                && Constants.StreamTypes.CALLING.equalsIgnoreCase(sr.getStreamType())
                && sr.getClient() != null
                && sr.getModel() != null) {
            messagesWsHandler.adminKillCallPair(sr.getClient().getId(), sr.getModel().getId(), wsReason);
        }
        return ResponseEntity.ok(Map.of("ok", true, "streamId", id));
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

    // ======================================
    // PAYOUT REQUESTS (sin PSP)
    // ======================================

    // GET /api/admin/payout/requests?status=REQUESTED|APPROVED|REJECTED|PAID|CANCELED (opcional)
    @GetMapping("/payout/requests")
    public ResponseEntity<List<PayoutRequest>> listPayoutRequests(@RequestParam(required = false) String status) {
        if (status == null || status.isBlank()) {
            return ResponseEntity.ok(payoutRequestRepository.findAllByOrderByCreatedAtDesc());
        }
        String st = status.trim().toUpperCase(Locale.ROOT);
        return ResponseEntity.ok(payoutRequestRepository.findAllByStatusOrderByCreatedAtDesc(st));
    }

    // GET /api/admin/payout/requests/{id}
    @GetMapping("/payout/requests/{id}")
    public ResponseEntity<PayoutRequest> getPayoutRequest(@PathVariable Long id) {
        PayoutRequest pr = payoutRequestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("PayoutRequest no encontrada"));
        return ResponseEntity.ok(pr);
    }

    /**
     * POST /api/admin/payout/requests/{id}/review
     * Body:
     *  - status: APPROVED | REJECTED | PAID | CANCELED
     *  - adminNotes: texto opcional
     *
     * Reglas:
     * - APPROVED/PAID: NO toca ledger (ya se descontó en REQUEST)
     * - REJECTED/CANCELED: revierte el hold PAYOUT_REQUEST en ledger
     */
    @PostMapping("/payout/requests/{id}/review")
    public ResponseEntity<PayoutRequest> reviewPayoutRequest(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth
    ) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        User admin = userService.findByEmail(auth.getName());
        Long adminId = admin != null ? admin.getId() : null;

        String newStatus = body != null ? body.get("status") : null;
        String adminNotes = body != null ? body.get("adminNotes") : null;

        if (newStatus == null || newStatus.isBlank()) {
            throw new IllegalArgumentException("status requerido");
        }
        String st = newStatus.trim().toUpperCase(Locale.ROOT);

        // lock + transición + (si REJECT/CANCELED => reversión ledger)
        PayoutRequest updated = transactionService.adminReviewPayoutRequest(id, adminId, st, adminNotes);

        return ResponseEntity.ok(updated);
    }

    @PostMapping("/finance/refund/{userId}")
    public ResponseEntity<Map<String, Object>> manualRefund(
            @PathVariable Long userId,
            @RequestBody TransactionRequestDTO request,
            Authentication auth
    ) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        User admin = userService.findByEmail(auth.getName());
        Long adminId = admin != null ? admin.getId() : null;

        BigDecimal newBalance = transactionService.manualRefundToClient(userId, adminId, request);

        return ResponseEntity.ok(Map.of(
                "ok", true,
                "userId", userId,
                "operationType", Constants.OperationTypes.MANUAL_REFUND,
                "amount", request.getAmount(),
                "newBalance", newBalance,
                "description", request.getDescription()
        ));
    }

    private List<?> asList(Object value) {
        if (value instanceof List<?> list) {
            return list;
        }
        return new ArrayList<>();
    }

    private BackofficeAccessService.BackofficeAdminOverview adminServiceBackofficeOverview() {
        return backofficeAccessService.listAdminOverview();
    }
}
