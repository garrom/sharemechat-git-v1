package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.ModelService;
import com.sharemechat.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/models")
public class ModelController {

    private final ModelService modelService;
    private final UserService userService;

    public ModelController(ModelService modelService, UserService userService) {
        this.modelService = modelService;
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyModelInfo(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol MODEL");
        }

        ModelDTO dto = modelService.getModelDTO(user);
        return ResponseEntity.ok(dto);
    }
}
