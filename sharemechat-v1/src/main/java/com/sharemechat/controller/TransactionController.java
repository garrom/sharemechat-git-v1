package com.sharemechat.controller;

import com.sharemechat.dto.TransactionRequestDTO;
import com.sharemechat.entity.User;
import com.sharemechat.security.ModelContractGate;
import com.sharemechat.service.ProductAccessGuardService;
import com.sharemechat.service.TransactionService;
import com.sharemechat.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService transactionService;
    private final UserService userService;
    private final ProductAccessGuardService productAccessGuardService;
    private final ModelContractGate modelContractGate;

    public TransactionController(TransactionService transactionService,
                                 UserService userService,
                                 ProductAccessGuardService productAccessGuardService,
                                 ModelContractGate modelContractGate) {
        this.transactionService = transactionService;
        this.userService = userService;
        this.productAccessGuardService = productAccessGuardService;
        this.modelContractGate = modelContractGate;
    }

    // Primer pago cliente siendo USER -> CLIENT (incluye premium, clients, tx, balance)
    @PostMapping("/first")
    public ResponseEntity<String> processTransaction(@RequestBody @Valid TransactionRequestDTO request,
                                                     Authentication authentication) {
        User user = userService.findByEmail(authentication.getName());
        productAccessGuardService.requireNotSupport(user);
        transactionService.processFirstTransaction(user.getId(), request);
        return ResponseEntity.ok("Transacción procesada. Usuario promovido a CLIENT y saldo actualizado.");
    }

    // Recargar monedero del Cliente
    @PreAuthorize("hasRole('CLIENT')")
    @PostMapping("/add-balance")
    public ResponseEntity<String> addBalance(@RequestBody @Valid TransactionRequestDTO request,
                                             Authentication authentication) {
        User user = userService.findByEmail(authentication.getName());
        productAccessGuardService.requireNotSupport(user);
        transactionService.addBalance(user.getId(), request);
        return ResponseEntity.ok("Saldo actualizado correctamente.");
    }
    // Retirar dinero modelo
    @PreAuthorize("hasRole('MODEL')")
    @PostMapping("/payout")
    public ResponseEntity<String> requestPayout(@RequestBody @Valid TransactionRequestDTO request,
                                                Authentication authentication) {
        User user = userService.findByEmail(authentication.getName());
        productAccessGuardService.requireNotSupport(user);
        // Lote endurecimiento 2026-06-04: la modelo no puede solicitar
        // payout si no tiene la versión vigente del Model Collaboration
        // Agreement aceptada. El bloqueo se aplica en el momento de la
        // SOLICITUD para no acumular requests pendientes de revisión que
        // luego habría que rechazar por falta de contrato.
        if (modelContractGate.isBlocked(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Debes aceptar la versión vigente del contrato de modelo antes de solicitar retiro.");
        }
        transactionService.requestPayout(user.getId(), request);
        return ResponseEntity.ok("Solicitud de retiro registrada correctamente.");
    }
}
