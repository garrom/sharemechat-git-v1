package com.sharemechat.controller;

import com.sharemechat.dto.UserDTO;
import com.sharemechat.service.AdminService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private static final Logger logger = LoggerFactory.getLogger(AdminController.class);
    private final AdminService adminService;

    public AdminController(AdminService adminService) { this.adminService = adminService; }

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
        return ResponseEntity.ok(adminService.reviewModel(userId, action));
    }
}
