package com.sharemechat.controller;

import com.sharemechat.dto.TransactionRequestDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.TransactionService;
import com.sharemechat.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService transactionService;
    private final UserService userService;

    public TransactionController(TransactionService transactionService, UserService userService) {
        this.transactionService = transactionService;
        this.userService = userService;
    }

    // Primer pago: USER -> CLIENT (incluye premium, clients, tx, balance)
    @PostMapping("/first")
    public ResponseEntity<String> processTransaction(@RequestBody @Valid TransactionRequestDTO request,
                                                     Authentication authentication) {
        User user = userService.findByEmail(authentication.getName());
        transactionService.processFirstTransaction(user.getId(), request);
        return ResponseEntity.ok("Transacción procesada. Usuario promovido a CLIENT y saldo actualizado.");
    }

    // Recargas o gastos posteriores (CLIENT)
    @PostMapping("/add-balance")
    public ResponseEntity<String> addBalance(@RequestBody @Valid TransactionRequestDTO request,
                                             Authentication authentication) {
        User user = userService.findByEmail(authentication.getName());
        transactionService.addBalance(user.getId(), request);
        return ResponseEntity.ok("Saldo actualizado correctamente.");
    }
}
