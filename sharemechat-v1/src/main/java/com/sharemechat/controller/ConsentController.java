package com.sharemechat.controller;

import com.sharemechat.service.ConsentService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/consent")
public class ConsentController {

    private final ConsentService consentService;

    public ConsentController(ConsentService consentService) {
        this.consentService = consentService;
    }

    // Body opcional: { "path": "/ruta/donde/acepta" }
    @PostMapping("/age-gate")
    public ResponseEntity<Void> ageGate(@RequestBody(required = false) Map<String, Object> body,
                                        HttpServletRequest request) {
        String consentId = readConsentIdCookie(request);
        String path = bodyPath(body, request);
        consentService.recordAgeGate(request, consentId, path);
        return ResponseEntity.noContent().build();
    }

    // Endpoint: POST /api/consent/terms?v=v1
    // Body opcional: { "path": "/ruta/donde/acepta" }
    @PostMapping("/terms")
    public ResponseEntity<Void> terms(@RequestParam(name = "v", required = false) String version,
                                      @RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest request) {
        String consentId = readConsentIdCookie(request);
        String path = bodyPath(body, request);
        consentService.recordTerms(request, consentId, path, version);
        return ResponseEntity.noContent().build();
    }

    private static String readConsentIdCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie c : request.getCookies()) {
            if ("consent_id".equals(c.getName())) {
                return c.getValue();
            }
        }
        return null;
    }

    private static String bodyPath(Map<String, Object> body, HttpServletRequest request) {
        if (body != null) {
            Object p = body.get("path");
            if (p != null && StringUtils.hasText(String.valueOf(p))) {
                return String.valueOf(p);
            }
        }
        return request.getHeader("Referer") != null ? request.getHeader("Referer") : request.getRequestURI();
    }
}
