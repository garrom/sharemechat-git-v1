package com.sharemechat.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.dto.PublicComplaintCreateDTO;
import com.sharemechat.entity.Complaint;
import com.sharemechat.service.ApiRateLimitService;
import com.sharemechat.service.ComplaintService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Endpoint publico del frente Complaints (Opcion B, DEC-1). NO requiere
 * autenticacion. Rate limit por IP via {@link ApiRateLimitService#checkComplaintIp}
 * (cap 5/hora/IP por defecto, configurable via
 * {@code security.ratelimit.complaint.limit} y {@code .window-seconds}).
 *
 * <p>El SecurityConfig marca este path como {@code permitAll}.
 */
@RestController
@RequestMapping("/api/public/complaints")
public class PublicComplaintController {

    private static final Logger log = LoggerFactory.getLogger(PublicComplaintController.class);

    private final ComplaintService complaintService;
    private final ApiRateLimitService rateLimitService;

    public PublicComplaintController(ComplaintService complaintService,
                                     ApiRateLimitService rateLimitService) {
        this.complaintService = complaintService;
        this.rateLimitService = rateLimitService;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody PublicComplaintCreateDTO dto,
                                    HttpServletRequest req) {
        String ip = IpConfig.getClientIp(req);
        rateLimitService.checkComplaintIp(ip);

        try {
            Complaint c = complaintService.createPublic(dto, ip);
            log.info("[COMPLAINT] received public complaintId={} category={}",
                    c.getId(), c.getCategory());
            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(Map.of(
                            "id", c.getId(),
                            "status", c.getStatus(),
                            "category", c.getCategory(),
                            "expectedResolutionAt", c.getExpectedResolutionAt()
                    ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}
