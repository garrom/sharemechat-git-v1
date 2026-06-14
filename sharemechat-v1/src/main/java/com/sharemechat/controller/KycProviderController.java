package com.sharemechat.controller;

import com.sharemechat.dto.KycStartSessionResponseDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.CountryAccessService;
import com.sharemechat.service.KycSessionService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/kyc")
public class KycProviderController {

    private final KycSessionService kycSessionService;
    private final UserService userService;
    private final CountryAccessService countryAccessService;

    public KycProviderController(KycSessionService kycSessionService,
                                 UserService userService,
                                 CountryAccessService countryAccessService) {
        this.kycSessionService = kycSessionService;
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

        KycStartSessionResponseDTO dto = kycSessionService.startVeriffSession(user.getId());
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
        boolean ok = kycSessionService.processVeriffWebhook(rawBody, signature);
        if (!ok) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok().build();
    }

    // =========================================================================
    // DIDIT — flujos KYC (ADR-035, vendor unico Plan A).
    // Mismo contrato que /veriff/* pero con las divergencias documentadas en
    // KycSessionService#processDiditWebhook: replay protection con
    // X-Timestamp (300s) ANTES de la verificacion HMAC. Hay dos endpoints
    // /start (model y client) por simetria; el webhook es UNICO compartido
    // entre ambos flujos (la consola Didit configura un solo destino y el
    // codigo discrimina por workflow_id + session_type).
    // =========================================================================
    @PostMapping("/didit/model/start")
    public ResponseEntity<KycStartSessionResponseDTO> startDiditModel(Authentication authentication,
                                                                      HttpServletRequest request) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }

        // Country gating del MODELO: la allowlist es por flujo, independiente
        // del vendor concreto que firme la sesion.
        countryAccessService.assertAllowedForModelKyc(request);

        KycStartSessionResponseDTO dto = kycSessionService.startDiditModelSession(user.getId());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/didit/client/start")
    public ResponseEntity<KycStartSessionResponseDTO> startDiditClient(Authentication authentication,
                                                                       HttpServletRequest request) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }

        // Country gating del CLIENTE: usa la allowlist mas restrictiva (28
        // paises segun ADR-029, hardening post-PRO 2026-05-27).
        countryAccessService.assertAllowedForClientKyc(request);

        KycStartSessionResponseDTO dto = kycSessionService.startDiditClientSession(user.getId());
        return ResponseEntity.ok(dto);
    }

    // Webhook proveedor (Didit) - variante "Standard" de firma:
    //  - X-Signature: HMAC-SHA256 hex sobre el raw body, usando el
    //    secret_shared_key del destino webhook (kyc.didit.api-secret).
    //  - X-Timestamp: Unix epoch seconds. Si difiere del reloj por mas de
    //    300s, se rechaza ANTES de verificar HMAC (proteccion anti-replay
    //    nativa de Didit, no existe en Veriff).
    // Si firma o timestamp son invalidos/ausentes: 401.
    @PostMapping("/didit/webhook")
    public ResponseEntity<Void> diditWebhook(
            @RequestHeader(value = "X-Signature", required = false) String signature,
            @RequestHeader(value = "X-Timestamp", required = false) String timestamp,
            @RequestBody(required = false) byte[] rawBody
    ) {
        boolean ok = kycSessionService.processDiditWebhook(rawBody, signature, timestamp);
        if (!ok) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok().build();
    }
}