package com.sharemechat.controller;

import com.sharemechat.dto.ComplaintDTO;
import com.sharemechat.dto.ComplaintEscalateDTO;
import com.sharemechat.dto.ComplaintReviewDTO;
import com.sharemechat.dto.ComplaintStatsDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.ComplaintService;
import com.sharemechat.service.UserService;
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
import java.util.Map;

/**
 * Endpoints admin del frente Complaints workflow (Opcion B, DEC-14).
 * Protegido por SecurityConfig con permisos
 * {@code PERM_COMPLAINTS_READ_LIST}, {@code PERM_COMPLAINTS_READ_DETAIL},
 * {@code PERM_COMPLAINTS_REVIEW} analogos al patron de
 * {@code PERM_MODERATION_*}.
 */
@RestController
@RequestMapping("/api/admin/complaints")
public class ComplaintAdminController {

    private final ComplaintService complaintService;
    private final UserService userService;

    public ComplaintAdminController(ComplaintService complaintService,
                                    UserService userService) {
        this.complaintService = complaintService;
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<ComplaintDTO>> list(
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "category", required = false) String category) {
        return ResponseEntity.ok(complaintService.adminList(status, category));
    }

    @GetMapping("/stats")
    public ResponseEntity<ComplaintStatsDTO> stats() {
        return ResponseEntity.ok(complaintService.stats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(complaintService.adminGetById(id));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{id}/review")
    public ResponseEntity<?> review(@PathVariable Long id,
                                    @RequestBody ComplaintReviewDTO dto,
                                    Authentication auth) {
        try {
            Long adminUserId = requireAdminUserId(auth);
            return ResponseEntity.ok(complaintService.adminReview(id, dto, adminUserId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{id}/escalate")
    public ResponseEntity<?> escalate(@PathVariable Long id,
                                      @RequestBody(required = false) ComplaintEscalateDTO dto,
                                      Authentication auth) {
        try {
            Long adminUserId = requireAdminUserId(auth);
            return ResponseEntity.ok(complaintService.adminEscalate(id, dto, adminUserId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    private Long requireAdminUserId(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new IllegalArgumentException("No autenticado");
        }
        User u = userService.findByEmail(auth.getName());
        if (u == null) throw new IllegalArgumentException("Admin no encontrado");
        return u.getId();
    }
}
