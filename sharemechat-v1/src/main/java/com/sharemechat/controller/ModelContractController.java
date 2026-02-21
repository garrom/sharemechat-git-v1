package com.sharemechat.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelContractAcceptanceRepository;
import com.sharemechat.service.ModelContractService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
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

    // ==========================
    // Helpers
    // ==========================
    private User requireUser(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        return userService.findByEmail(auth.getName());
    }

    /** Onboarding model: role=USER y userType=FORM_MODEL */
    private boolean isOnboardingModel(User u) {
        return u != null
                && Constants.Roles.USER.equals(u.getRole())
                && Constants.UserTypes.FORM_MODEL.equals(u.getUserType());
    }

    /** Actor válido de contrato de modelo: onboarding o MODEL real */
    private boolean isModelContractActor(User u) {
        return u != null && (
                Constants.Roles.MODEL.equals(u.getRole()) ||
                        isOnboardingModel(u)
        );
    }

    // GET /api/consent/model-contract/current  (público)
    @GetMapping("/current")
    public ResponseEntity<Map<String, String>> current() {
        return ResponseEntity.ok(modelContractService.current());
    }

    // GET /api/consent/model-contract/status  (auth)
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(Authentication auth) {
        User u = requireUser(auth);
        if (u == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (!isModelContractActor(u)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "message", "No autorizado para contrato de modelo"
            ));
        }

        boolean acceptedCurrent = modelContractService.isAccepted(u.getId());
        boolean acceptedEver = (u.getId() != null) && acceptanceRepo.existsByUserId(u.getId());

        // ✅ Caso clave para ROLE_MODEL cuando se publica nueva versión:
        // acceptedEver=true y acceptedCurrent=false => necesita reaceptar
        boolean needsReaccept = acceptedEver && !acceptedCurrent;

        Map<String, String> cur = modelContractService.current();

        Map<String, Object> out = new HashMap<>();
        // Backward compatibility (frontend antiguo)
        out.put("accepted", acceptedCurrent);

        // Campos explícitos (frontend nuevo)
        out.put("acceptedCurrent", acceptedCurrent);
        out.put("acceptedEver", acceptedEver);
        out.put("needsReaccept", needsReaccept);

        // Contexto útil para UX/debug
        out.put("role", u.getRole());
        out.put("userType", u.getUserType());
        out.put("currentVersion", cur.get("version"));
        out.put("currentSha256", cur.get("sha256"));
        out.put("currentUrl", cur.get("url"));

        return ResponseEntity.ok(out);
    }

    // POST /api/consent/model-contract/accept (auth)
    @PostMapping("/accept")
    public ResponseEntity<?> accept(Authentication auth, HttpServletRequest req) {
        User u = requireUser(auth);
        if (u == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (!isModelContractActor(u)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado para contrato de modelo");
        }

        String ip = IpConfig.getClientIp(req);
        String ua = req.getHeader("User-Agent");

        Map<String, Object> result = modelContractService.accept(u.getId(), ip, ua);

        // Idempotente si ya estaba aceptado para versión actual
        boolean alreadyAccepted = Boolean.TRUE.equals(result.get("alreadyAccepted"));
        boolean matchesCurrent = Boolean.TRUE.equals(result.get("matchesCurrent"));

        if (alreadyAccepted && matchesCurrent) {
            return ResponseEntity.noContent().build();
        }

        return ResponseEntity.ok(result);
    }
}