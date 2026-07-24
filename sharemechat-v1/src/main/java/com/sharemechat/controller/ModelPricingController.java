package com.sharemechat.controller;

import com.sharemechat.dto.ModelEconomicsDTO;
import com.sharemechat.dto.UpdateChosenRateRequestDTO;
import com.sharemechat.dto.UpdateProStatusRequestDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.PricingService;
import com.sharemechat.service.UserService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * ADR-052 Frente 3 sub-frente 3.B: endpoints REST del panel de la modelo
 * para el nuevo regimen de reparto autoservicio.
 *
 * <ul>
 *   <li>{@code GET /api/models/me/economics}: dashboard agregado.</li>
 *   <li>{@code PUT /api/models/me/pricing}: cambia la tarifa por minuto
 *       dentro del rango vigente.</li>
 *   <li>{@code PUT /api/models/me/pro-status}: activa/desactiva la
 *       aceptacion de clientes trial (solo efectivo si Pro elegible).</li>
 * </ul>
 *
 * <p>Todos requieren rol MODEL (gate en SecurityConfig antes del
 * catch-all {@code /api/models/**}).
 */
@RestController
@RequestMapping("/api/models/me")
public class ModelPricingController {

    private static final Logger log = LoggerFactory.getLogger(ModelPricingController.class);

    private final PricingService pricingService;
    private final UserService userService;

    public ModelPricingController(PricingService pricingService, UserService userService) {
        this.pricingService = pricingService;
        this.userService = userService;
    }

    @GetMapping("/economics")
    public ResponseEntity<?> getEconomics(Authentication auth) {
        User me = resolveCurrentUser(auth);
        if (me == null) return ResponseEntity.status(401).build();
        ModelEconomicsDTO dto = pricingService.getEconomics(me.getId());
        return ResponseEntity.ok(dto);
    }

    @PutMapping("/pricing")
    public ResponseEntity<?> updatePricing(@RequestBody @Valid UpdateChosenRateRequestDTO body,
                                            Authentication auth) {
        User me = resolveCurrentUser(auth);
        if (me == null) return ResponseEntity.status(401).build();
        try {
            ModelEconomicsDTO dto = pricingService.updateChosenRate(me.getId(), body.getRateEurPerMin());
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException ex) {
            log.info("PUT /pricing invalido userId={} err={}", me.getId(), ex.getMessage());
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @PutMapping("/pro-status")
    public ResponseEntity<?> updateProStatus(@RequestBody @Valid UpdateProStatusRequestDTO body,
                                              Authentication auth) {
        User me = resolveCurrentUser(auth);
        if (me == null) return ResponseEntity.status(401).build();
        try {
            ModelEconomicsDTO dto = pricingService.updateProAcceptsTrial(me.getId(), body.getAcceptsTrial());
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException ex) {
            log.info("PUT /pro-status invalido userId={} err={}", me.getId(), ex.getMessage());
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    private User resolveCurrentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        return userService.findByEmail(auth.getName());
    }
}
