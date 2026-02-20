package com.sharemechat.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelContractAcceptanceRepository;
import com.sharemechat.service.ModelContractService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/consent/model-contract")
public class ModelContractController {

    private final ModelContractService modelContractService;
    private final UserService userService;
    private final ModelContractAcceptanceRepository acceptanceRepo;

    public ModelContractController(
            ModelContractService modelContractService,
            UserService userService,
            ModelContractAcceptanceRepository acceptanceRepo
    ) {
        this.modelContractService = modelContractService;
        this.userService = userService;
        this.acceptanceRepo = acceptanceRepo;
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
        if (u == null) {
            return ResponseEntity.status(401).build();
        }

        boolean acceptedCurrent = modelContractService.isAccepted(u.getId());
        boolean acceptedEver = (u.getId() != null) && acceptanceRepo.existsByUserId(u.getId());

        Map<String, String> cur = modelContractService.current();

        // ✅ Backward compatibility:
        // - "accepted" MUST exist for older frontend (ModelDocuments.ensureContractAccepted)
        // - Keep richer fields for future UX/debug
        Map<String, Object> out = new HashMap<>();
        out.put("accepted", acceptedCurrent);          // <--- IMPORTANT (compat)
        out.put("acceptedCurrent", acceptedCurrent);
        out.put("acceptedEver", acceptedEver);

        out.put("currentVersion", cur.get("version"));
        out.put("currentSha256", cur.get("sha256"));

        return ResponseEntity.ok(out);
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

        return ResponseEntity.ok(result);
    }
}
