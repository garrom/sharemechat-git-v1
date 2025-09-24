package com.sharemechat.controller;

import com.sharemechat.dto.ModelChecklistUpdateDTO;
import com.sharemechat.dto.UserDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.AdminService;
import com.sharemechat.service.UserService;
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

    public AdminController(AdminService adminService,UserService userService) {
        this.adminService = adminService;
        this.userService = userService;
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
    public ResponseEntity<List<Map<String,Object>>> topModels(@RequestParam(defaultValue = "10") int limit) {
        logger.info("GET /api/admin/finance/top-models limit={}", limit);
        return ResponseEntity.ok(adminService.financeTopModels(limit));
    }

    // GET /api/admin/finance/top-clients?limit=10
    @GetMapping("/finance/top-clients")
    public ResponseEntity<List<Map<String,Object>>> topClients(@RequestParam(defaultValue = "10") int limit) {
        logger.info("GET /api/admin/finance/top-clients limit={}", limit);
        return ResponseEntity.ok(adminService.financeTopClients(limit));
    }

    // GET /api/admin/finance/summary
    @GetMapping("/finance/summary")
    public ResponseEntity<Map<String,String>> summary() {
        logger.info("GET /api/admin/finance/summary");
        return ResponseEntity.ok(adminService.financeSummary());
    }

    // GET /api/admin/db/view?table=users&limit=10
    @GetMapping("/db/view")
    public ResponseEntity<List<Map<String,Object>>> dbView(
            @RequestParam String table,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(adminService.viewTable(table, limit));
    }

    // GET /api/admin/model-docs/{userId}
    @GetMapping("/model-docs/{userId}")
    public ResponseEntity<Map<String,Object>> getModelDocs(@PathVariable Long userId) {
        return ResponseEntity.ok(adminService.getModelDocsWithChecklist(userId));
    }

    // POST /api/admin/model-checklist/{userId}
    @PostMapping("/model-checklist/{userId}")
    public ResponseEntity<Map<String,Object>> updateChecklist(@PathVariable Long userId,
                                                              @RequestBody ModelChecklistUpdateDTO dto,
                                                              Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        User admin = userService.findByEmail(auth.getName());
        Long adminId = admin != null ? admin.getId() : null;

        Map<String,Object> out = adminService.updateModelChecklist(
                userId, adminId, dto.getFrontOk(), dto.getBackOk(), dto.getSelfieOk()
        );
        return ResponseEntity.ok(out);
    }

}
