package com.sharemechat.controller;

import com.sharemechat.dto.TransactionRequestDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.ProductAccessGuardService;
import com.sharemechat.service.TransactionService;
import com.sharemechat.service.UserService;
import jakarta.validation.Valid;
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

    public TransactionController(TransactionService transactionService,
                                 UserService userService,
                                 ProductAccessGuardService productAccessGuardService) {
        this.transactionService = transactionService;
        this.userService = userService;
        this.productAccessGuardService = productAccessGuardService;
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
        transactionService.requestPayout(user.getId(), request);
        return ResponseEntity.ok("Solicitud de retiro registrada correctamente.");
    }
}
