package com.sharemechat.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.entity.User;
import com.sharemechat.service.ModelContractService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/consent/model-contract")
public class ModelContractController {

    private final ModelContractService modelContractService;
    private final UserService userService;

    public ModelContractController(ModelContractService modelContractService, UserService userService) {
        this.modelContractService = modelContractService;
        this.userService = userService;
    }

    // GET /api/consent/model-contract/current  (público)
    @GetMapping("/current")
    public ResponseEntity<Map<String, String>> current() {
        return ResponseEntity.ok(modelContractService.current());
    }

    // GET /api/consent/model-contract/status  (auth)
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        User u = userService.findByEmail(auth.getName());
        boolean accepted = modelContractService.isAccepted(u != null ? u.getId() : null);

        return ResponseEntity.ok(Map.of(
                "accepted", accepted
        ));
    }

    // POST /api/consent/model-contract/accept (auth)
    @PostMapping("/accept")
    public ResponseEntity<?> accept(Authentication auth, HttpServletRequest req) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        User u = userService.findByEmail(auth.getName());
        if (u == null) {
            return ResponseEntity.status(401).build();
        }

        String ip = IpConfig.getClientIp(req);
        String ua = req.getHeader("User-Agent");

        Map<String, Object> result = modelContractService.accept(u.getId(), ip, ua);

        // Si ya estaba aceptado y coincidía con el contrato vigente → idempotente: 204
        boolean alreadyAccepted = Boolean.TRUE.equals(result.get("alreadyAccepted"));
        boolean matchesCurrent = Boolean.TRUE.equals(result.get("matchesCurrent"));

        if (alreadyAccepted && matchesCurrent) {
            return ResponseEntity.noContent().build();
        }

        // Si acaba de aceptar (o re-aceptar por cambio de versión/hash), devolvemos 200 con info
        return ResponseEntity.ok(result);
    }


}
