package com.sharemechat.controller;

import com.sharemechat.dto.KycStartSessionResponseDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.CountryAccessService;
import com.sharemechat.service.ModelKycSessionService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/kyc")
public class KycProviderController {

    private final ModelKycSessionService modelKycSessionService;
    private final UserService userService;
    private final CountryAccessService countryAccessService;

    public KycProviderController(ModelKycSessionService modelKycSessionService,
                                 UserService userService,
                                 CountryAccessService countryAccessService) {
        this.modelKycSessionService = modelKycSessionService;
        this.userService = userService;
        this.countryAccessService = countryAccessService;
    }

    // Onboarding model inicia sesión Veriff.
    //
    // Country gating: antes de crear la sesión Veriff (que tiene coste real
    // cuando se active), se valida que el país del solicitante está en la
    // allowlist de MODELO. Reusa CountryAccessService (mismo flag global
    // country.access.enabled, misma resolución de cabecera CloudFront/CF/AppEngine,
    // mismo bypass por IP/CIDR, mismo block-when-missing). Si el gate global
    // está apagado (caso AUDIT durante onboarding PSP), este check tampoco
    // bloquea — coherente con registro/login.
    //
    // El gating del flujo KYC de CLIENTE (Age Estimation) se aplicará cuando
    // se cree su endpoint (vendor aún por decidir), con el método análogo
    // assertAllowedForClientKyc sobre la allowlist de cliente.
    @PostMapping("/veriff/start")
    public ResponseEntity<KycStartSessionResponseDTO> startVeriff(Authentication authentication,
                                                                  HttpServletRequest request) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }

        // Lanza CountryBlockedException -> 403 uniforme via GlobalExceptionHandler.
        countryAccessService.assertAllowedForModelKyc(request);

        KycStartSessionResponseDTO dto = modelKycSessionService.startVeriffSession(user.getId());
        return ResponseEntity.ok(dto);
    }

    // Webhook proveedor (Veriff).
    // Header de firma: X-HMAC-SIGNATURE (confirmado por soporte Veriff).
    // Body recibido como byte[] para preservar los bytes crudos exactos que
    // Veriff firmó (evita que la decodificación de Spring altere el payload
    // antes de validar el HMAC). Si la firma es inválida/ausente: 401.
    @PostMapping("/veriff/webhook")
    public ResponseEntity<Void> veriffWebhook(
            @RequestHeader(value = "X-HMAC-SIGNATURE", required = false) String signature,
            @RequestBody(required = false) byte[] rawBody
    ) {
        boolean ok = modelKycSessionService.processVeriffWebhook(rawBody, signature);
        if (!ok) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok().build();
    }
}