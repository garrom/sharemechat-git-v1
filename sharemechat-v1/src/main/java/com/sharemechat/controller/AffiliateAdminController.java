package com.sharemechat.controller;

import com.sharemechat.dto.AffiliateChargebackRequestDTO;
import com.sharemechat.entity.AffiliateCommission;
import com.sharemechat.service.AffiliateCommissionService;
import jakarta.validation.Valid;
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
 * ADR-049 D8 + Subpasada 5 (revisada 2026-07-12): endpoints admin del
 * programa de afiliadas. Fase inicial: solo el endpoint de chargeback.
 *
 * <p>Protegido por catch-all {@code /api/admin/**} en
 * {@link com.sharemechat.security.SecurityConfig} que exige
 * {@code ROLE_ADMIN}. No requiere anotacion adicional por metodo.
 *
 * <p>Sin UI admin en esta pasada. Uso via {@code curl}/postman cuando
 * aparezca el primer chargeback vía NOWPayments (siguiente frente).
 */
@RestController
@RequestMapping("/api/admin/affiliate")
public class AffiliateAdminController {

    private static final Logger log = LoggerFactory.getLogger(AffiliateAdminController.class);

    private final AffiliateCommissionService affiliateCommissionService;

    public AffiliateAdminController(AffiliateCommissionService affiliateCommissionService) {
        this.affiliateCommissionService = affiliateCommissionService;
    }

    /**
     * Registra un chargeback contra una {@code PaymentSession} que
     * previamente devengó comision de afiliada. Genera fila
     * {@code REVERSED_CHARGEBACK} con importes negativos que netean el
     * total del panel modelo.
     *
     * <p>En fase actual (D2 revisado, trigger STREAM_CHARGE) no hay
     * comisiones sobre PaymentSession y este endpoint responde 409 si no
     * encuentra fila previa. Cuando entre PSP tarjeta o si en el futuro
     * se activa un hook al SUCCESS de PaymentSession, este endpoint
     * revertira la comision original.
     */
    @PostMapping("/chargeback")
    public ResponseEntity<?> chargeback(@Valid @RequestBody AffiliateChargebackRequestDTO request) {
        try {
            AffiliateCommission reversal = affiliateCommissionService.reverseChargeback(
                    request.getPaymentSessionId(),
                    request.getRefundedAmountCents(),
                    request.getReason());
            return ResponseEntity.ok(Map.of(
                    "id", reversal.getId(),
                    "status", reversal.getStatus(),
                    "commissionAmountCents", reversal.getCommissionAmountCents(),
                    "referrerModelUserId", reversal.getReferrerModelUserId(),
                    "clientUserId", reversal.getClientUserId(),
                    "periodYyyymm", reversal.getPeriodYyyymm()
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "invalid_request",
                    "message", ex.getMessage()
            ));
        } catch (IllegalStateException ex) {
            log.info("[AFFILIATE-ADMIN] chargeback conflict paymentSessionId={} reason={}",
                    request.getPaymentSessionId(), ex.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "no_previous_commission",
                    "message", ex.getMessage()
            ));
        } catch (Exception ex) {
            log.error("[AFFILIATE-ADMIN] chargeback failed paymentSessionId={}",
                    request.getPaymentSessionId(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "internal_error"
            ));
        }
    }
}
