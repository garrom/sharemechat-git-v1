package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.CcbillInitResponseDTO;
import com.sharemechat.dto.CcbillSessionRequestDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.CcbillService;
import com.sharemechat.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final CcbillService ccbillService;
    private final UserService userService;

    public BillingController(CcbillService ccbillService, UserService userService) {
        this.ccbillService = ccbillService;
        this.userService = userService;
    }

    /**
     * Inicia una sesión de pago CCBill para un pack concreto.
     *
     * - Si el usuario tiene rol USER → se marcará como primer pago (firstPayment = true).
     * - Si el usuario tiene rol CLIENT → se marcará como recarga (firstPayment = false).
     *
     * NOTA: todavía no llamamos a TransactionService; solo creamos PaymentSession (PENDING)
     * y devolvemos datos para redirigir a CCBill.
     */
    @PostMapping("/ccbill/session")
    @PreAuthorize("hasAnyRole('USER','CLIENT')")
    public ResponseEntity<CcbillInitResponseDTO> createCcbillSession(
            @RequestBody @Valid CcbillSessionRequestDTO request,
            Authentication authentication
    ) {
        User user = userService.findByEmail(authentication.getName());

        boolean firstPayment = Constants.Roles.USER.equals(user.getRole());

        CcbillInitResponseDTO response =
                ccbillService.createSessionForPack(user, request.getPackId(), firstPayment);

        return ResponseEntity.ok(response);
    }

    /**
     * Endpoint de notificación de la pasarela.
     *
     * En el futuro:
     *  - Se validará la firma/HMAC de CCBill.
     *  - Se ajustarán los nombres de parámetros a los reales.
     *
     * De momento:
     *  - status = "APPROVED" se considera pago correcto.
     *  - cualquier otro valor se considera fallo.
     */
    @PostMapping("/ccbill/notify")
    public ResponseEntity<String> handleCcbillNotify(
            @RequestBody @Valid com.sharemechat.dto.CcbillNotifyRequestDTO request
    ) {
        boolean approved = "APPROVED".equalsIgnoreCase(request.getStatus());

        ccbillService.completeSession(
                request.getOrderId(),
                request.getPspTransactionId(),
                approved
        );

        return ResponseEntity.ok("Notificación procesada");
    }

}
