package com.sharemechat.controller;

import com.sharemechat.dto.*;
import com.sharemechat.entity.LoginResponse;
import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;


@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register/client")
    public ResponseEntity<UserDTO> registerUser(@RequestBody UserRegisterDTO registerDTO) {
        UserDTO createdUser = userService.registerClient(registerDTO);
        return ResponseEntity.ok(createdUser);
    }


    @PostMapping("/register/model")
    public ResponseEntity<UserDTO> registerModel(@RequestBody @Valid UserModelRegisterDTO registerDTO) {
        UserDTO createdUser = userService.registerModel(registerDTO);
        return ResponseEntity.ok(createdUser);
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody @Valid UserLoginDTO loginDTO) {
        Optional<LoginResponse> loginResponse = userService.login(loginDTO);
        if (loginResponse.isPresent()) {
            return ResponseEntity.ok()
                    .header("Authorization", "Bearer " + loginResponse.get().getToken())
                    .body(loginResponse.get());
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Error: Email o contraseña incorrectos, o cuenta deshabilitada");
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUserById(@PathVariable Long id) {
        UserDTO user = userService.getUserById(id);
        return ResponseEntity.ok(user);
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDTO> updateUser(@PathVariable Long id, @RequestBody UserUpdateDTO userUpdateDTO) {
        UserDTO updatedUser = userService.updateUser(id, userUpdateDTO);
        return ResponseEntity.ok(updatedUser);
    }

    // Usamos /me usa para referirse al usuario en curso en el frontal
    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser(Authentication authentication) {
        // Imprimir el email para depuración
        System.out.println("Buscando usuario con email: " + authentication.getName());

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(404).body(null);
        }

        UserDTO userDTO = userService.mapToDTO(user);
        return ResponseEntity.ok(userDTO);
    }
}