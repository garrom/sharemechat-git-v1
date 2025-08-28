package com.sharemechat.controller;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@RestController
@RequestMapping("/api/ligoteo")
class LigoteoAliasController {
    @GetMapping("/random")
    public ResponseEntity<Void> redir(HttpServletResponse resp) throws IOException {
        resp.sendRedirect("/api/funnyplace/random");
        return ResponseEntity.status(302).build();
    }
}