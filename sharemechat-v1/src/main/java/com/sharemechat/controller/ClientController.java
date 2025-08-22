package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ClientDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.ClientService;
import com.sharemechat.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    private final ClientService clientService;
    private final UserService userService;

    public ClientController(ClientService clientService, UserService userService) {
        this.clientService = clientService;
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyClientInfo(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        // Solo clientes “definitivos” pueden consultar este endpoint
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            // Si prefieres 200 con saldo 0, cambia por clientService.emptyDTO(user.getId()).
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
        }

        ClientDTO dto = clientService.getClientDTO(user);
        return ResponseEntity.ok(dto);
    }
}
