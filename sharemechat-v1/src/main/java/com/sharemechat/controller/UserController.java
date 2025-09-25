package com.sharemechat.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.*;
import com.sharemechat.entity.ClientDocument;
import com.sharemechat.entity.LoginResponse;
import com.sharemechat.entity.ModelDocument;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ClientDocumentRepository;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;


@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final ModelDocumentRepository modelDocumentRepository;
    private final ClientDocumentRepository clientDocumentRepository;

    public UserController(UserService userService,
                          UserRepository userRepository,
                          ModelDocumentRepository modelDocumentRepository,
                          ClientDocumentRepository clientDocumentRepository) {
        this.userService = userService;
        this.modelDocumentRepository = modelDocumentRepository;
        this.clientDocumentRepository = clientDocumentRepository;
        this.userRepository = userRepository;
    }

    @PostMapping("/register/client")
    public ResponseEntity<UserDTO> registerUser(@RequestBody @Valid UserClientRegisterDTO registerDTO,
                                                HttpServletRequest request) {
        String ip = IpConfig.getClientIp(request);    // <-- capturamos IP
        UserDTO createdUser = userService.registerClient(registerDTO,ip); // <-- pasamos IP
        return ResponseEntity.ok(createdUser);
    }

    @PostMapping("/register/model")
    public ResponseEntity<UserDTO> registerModel(@RequestBody @Valid UserModelRegisterDTO registerDTO,
                                                 HttpServletRequest request) {
        String ip = IpConfig.getClientIp(request);
        UserDTO createdUser = userService.registerModel(registerDTO, ip); // <-- pasar IP
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

    @PostMapping("/change-password")
    public ResponseEntity<String> changePassword(@RequestBody @Valid ChangePasswordRequest req,
                                                 Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body("No autenticado");
        }
        // Recupera el usuario por email y usa su ID
        User u = userService.findByEmail(auth.getName());
        userService.changePassword(u.getId(), req.getCurrentPassword(), req.getNewPassword());
        return ResponseEntity.ok("Contraseña actualizada correctamente");
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<String> unsubscribe(@RequestBody(required = false) UnsubscribeRequestDTO dto,
                                              Authentication auth,
                                              HttpServletRequest request) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body("No autenticado");
        }
        String ip = IpConfig.getClientIp(request);
        String reason = (dto != null ? dto.getReason() : null);
        userService.unsubscribe(auth.getName(), reason, ip);
        return ResponseEntity.ok("Cuenta dada de baja. Se cerrará la sesión.");
    }

    @GetMapping("/avatars")
    public ResponseEntity<Map<Long,String>> getAvatarsBatch(@RequestParam("ids") String idsCsv) {
        if (idsCsv == null || idsCsv.isBlank()) return ResponseEntity.ok(Map.of());

        // Parseo CSV a lista de IDs única y válida
        List<Long> ids = Arrays.stream(idsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try { return Long.valueOf(s); } catch (NumberFormatException ex) { return null; }
                })
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        if (ids.isEmpty()) return ResponseEntity.ok(Map.of());

        // Cargamos usuarios y los separamos por rol
        List<User> users = userRepository.findAllById(ids);
        Set<Long> modelIds  = new HashSet<>();
        Set<Long> clientIds = new HashSet<>();

        Map<Long,String> result = new HashMap<>();
        for (User u : users) {
            result.put(u.getId(), null); // default
            String role = String.valueOf(u.getRole());
            if (Constants.Roles.MODEL.equals(role)) {
                modelIds.add(u.getId());
            } else if (Constants.Roles.CLIENT.equals(role)) {
                clientIds.add(u.getId());
            }
        }

        // Una consulta por tipo para traer urlPic
        if (!modelIds.isEmpty()) {
            for (ModelDocument md : modelDocumentRepository.findAllById(modelIds)) {
                if (md != null) result.put(md.getUserId(), md.getUrlPic());
            }
        }
        if (!clientIds.isEmpty()) {
            for (ClientDocument cd : clientDocumentRepository.findAllById(clientIds)) {
                if (cd != null) result.put(cd.getUserId(), cd.getUrlPic());
            }
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Devuelve el avatar de un usuario concreto.
     * Ejemplo: GET /api/users/123/avatar  -> { "profilePic": "/uploads/..." }
     */
    @GetMapping("/{id}/avatar")
    public ResponseEntity<Map<String,String>> getAvatar(@PathVariable Long id) {
        Optional<User> opt = userRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        User u = opt.get();
        String url = null;
        String role = String.valueOf(u.getRole());

        if (Constants.Roles.MODEL.equals(role)) {
            url = modelDocumentRepository.findById(id).map(ModelDocument::getUrlPic).orElse(null);
        } else if (Constants.Roles.CLIENT.equals(role)) {
            url = clientDocumentRepository.findById(id).map(ClientDocument::getUrlPic).orElse(null);
        }

        return ResponseEntity.ok(Collections.singletonMap("profilePic", url));
    }

}