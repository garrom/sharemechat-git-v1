package com.sharemechat.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.constants.Constants;
import com.sharemechat.consent.ConsentState;
import com.sharemechat.dto.*;
import com.sharemechat.entity.ClientDocument;
import com.sharemechat.entity.ModelAsset;
import com.sharemechat.service.CountryAccessService;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ClientDocumentRepository;
import com.sharemechat.repository.ModelAssetRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.AgeGatePolicyService;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.ConsentService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;


@RestController
@RequestMapping("/api/users")
public class UserController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(UserController.class);

    private final UserService userService;
    private final UserRepository userRepository;
    private final ModelAssetRepository modelAssetRepository;
    private final ClientDocumentRepository clientDocumentRepository;
    private final CountryAccessService countryAccessService;
    private final ConsentService consentService;
    private final AgeGatePolicyService ageGatePolicyService;
    private final BackofficeAccessService backofficeAccessService;

    public UserController(UserService userService,
                          UserRepository userRepository,
                          ModelAssetRepository modelAssetRepository,
                          ClientDocumentRepository clientDocumentRepository,
                          CountryAccessService countryAccessService,
                          ConsentService consentService,
                          AgeGatePolicyService ageGatePolicyService,
                          BackofficeAccessService backofficeAccessService) {
        this.userService = userService;
        this.modelAssetRepository = modelAssetRepository;
        this.clientDocumentRepository = clientDocumentRepository;
        this.userRepository = userRepository;
        this.countryAccessService = countryAccessService;
        this.consentService = consentService;
        this.ageGatePolicyService = ageGatePolicyService;
        this.backofficeAccessService = backofficeAccessService;
    }


    @PostMapping("/register/client")
    public ResponseEntity<?> registerClient(@RequestBody @Valid UserClientRegisterDTO registerDTO,
                                           HttpServletRequest request) {
        String consentId = readConsentIdCookie(request);
        if (!consentService.hasGuestAgeGate(consentId)) {
            return ResponseEntity.status(403).body("Debes confirmar antes que eres mayor de 18 años");
        }
        countryAccessService.assertAllowedForClientRegistration(request);

        String ip = IpConfig.getClientIp(request);
        String acceptLanguage = request.getHeader("Accept-Language");
        String countryDetected = countryAccessService.resolveViewerCountry(request);

        UserDTO createdUser = userService.registerClient(registerDTO, ip, acceptLanguage, countryDetected);
        consentService.recordGuestConsentLink(
                request,
                consentId,
                createdUser != null ? createdUser.getId() : null,
                "age_gate_link_register_client",
                "/api/users/register/client"
        );
        return ResponseEntity.ok(createdUser);
    }


    @PostMapping("/register/model")
    public ResponseEntity<?> registerModel(@RequestBody @Valid UserModelRegisterDTO registerDTO,
                                          HttpServletRequest request) {
        String consentId = readConsentIdCookie(request);
        if (!consentService.hasGuestAgeGate(consentId)) {
            return ResponseEntity.status(403).body("Debes confirmar antes que eres mayor de 18 años");
        }
        countryAccessService.assertAllowedForModelRegistration(request);

        String ip = IpConfig.getClientIp(request);
        String acceptLanguage = request.getHeader("Accept-Language");
        String countryDetected = countryAccessService.resolveViewerCountry(request);

        UserDTO createdUser = userService.registerModel(registerDTO, ip, acceptLanguage, countryDetected);
        consentService.recordGuestConsentLink(
                request,
                consentId,
                createdUser != null ? createdUser.getId() : null,
                "age_gate_link_register_model",
                "/api/users/register/model"
        );
        return ResponseEntity.ok(createdUser);
    }


    /**
     * GET /api/users/{id} — vista de un usuario adaptada a quién pregunta.
     *
     * <p>Tres niveles de detalle según el viewer:
     * <ol>
     *   <li><b>Self</b> (viewer == target): payload completo
     *       {@code UserDTO} con todos los datos propios.</li>
     *   <li><b>Backoffice viewer</b> (cualquier rol BO no vacío:
     *       ADMIN, SUPPORT, AUDIT, EDITOR): payload completo
     *       {@code BackofficeUserViewDTO} con todos los campos del
     *       entity {@code User} salvo la password.</li>
     *   <li><b>Otro viewer</b> (USER, CLIENT, MODEL sin roles BO):
     *       payload sanitizado {@code PublicUserDTO} sin datos
     *       legales/PII (sin name, surname, email, dateOfBirth,
     *       countryDetected, verificationStatus, etc.).</li>
     * </ol>
     *
     * <p>La detección backoffice se hace consultando
     * {@code BackofficeAccessService.loadProfile} y verificando si el
     * set de roles BO del viewer está vacío. Esto cubre tanto el rol
     * principal ADMIN (que recibe el rol implícito) como los roles
     * granulares SUPPORT/AUDIT/EDITOR asignados via
     * {@code user_backoffice_roles}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id, Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        User currentUser = userService.findByEmail(authentication.getName());
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }

        User targetUser = userService.findById(id);
        if (currentUser.getId().equals(targetUser.getId())) {
            return ResponseEntity.ok(userService.mapToDTO(targetUser));
        }

        BackofficeAccessService.BackofficeAccessProfile viewerProfile =
                backofficeAccessService.loadProfile(currentUser.getId(), currentUser.getRole());
        boolean viewerIsBackoffice = viewerProfile != null && !viewerProfile.roles().isEmpty();

        if (viewerIsBackoffice) {
            return ResponseEntity.ok(userService.mapToBackofficeUserViewDTO(targetUser));
        }
        return ResponseEntity.ok(userService.mapToPublicUserDTO(targetUser));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDTO> updateUser(@PathVariable Long id,
                                              @RequestBody UserUpdateDTO userUpdateDTO,
                                              Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).body(null);
        }

        User currentUser = userService.findByEmail(authentication.getName());
        if (currentUser == null) {
            return ResponseEntity.status(401).body(null);
        }

        if (!currentUser.getId().equals(id)) {
            return ResponseEntity.status(403).body(null);
        }

        UserDTO updatedUser = userService.updateUser(id, userUpdateDTO);
        return ResponseEntity.ok(updatedUser);
    }

    @PutMapping("/me/ui-locale")
    public ResponseEntity<UserDTO> updateMyUiLocale(@RequestBody Map<String, String> body,
                                                    Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).body(null);
        }

        String uiLocale = body != null ? body.get("uiLocale") : null;
        UserDTO updatedUser = userService.updateUiLocale(authentication.getName(), uiLocale);
        return ResponseEntity.ok(updatedUser);
    }

    // Usamos /me usa para referirse al usuario en curso en el frontal
    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser(Authentication authentication) {
        // Imprimir el email para depuración
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(404).body(null);
        }
        ConsentState consentState = ageGatePolicyService.resolve(user);
        if (!consentState.compliant()) {
            log.info("[CONSENT][NON_COMPLIANT] userId={} endpoint=/api/users/me reason={}",
                    user.getId(),
                    consentState.reasonCode());
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

        // Avatar del modelo (Capa 2): URL del asset PIC principal aprobado
        // en model_assets. Se ignora a quien aún no tenga foto aprobada.
        if (!modelIds.isEmpty()) {
            for (Object[] row : modelAssetRepository.findApprovedPrincipalUrlsForUsers(
                    new ArrayList<>(modelIds), ModelAsset.AssetType.PIC)) {
                Long uid = ((Number) row[0]).longValue();
                String url = (String) row[1];
                result.put(uid, url);
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
            url = modelAssetRepository.findApprovedPrincipalUrl(id, ModelAsset.AssetType.PIC).orElse(null);
        } else if (Constants.Roles.CLIENT.equals(role)) {
            url = clientDocumentRepository.findById(id).map(ClientDocument::getUrlPic).orElse(null);
        }

        return ResponseEntity.ok(Collections.singletonMap("profilePic", url));
    }

    private static String readConsentIdCookie(HttpServletRequest request) {
        if (request == null || request.getCookies() == null) return null;
        for (Cookie c : request.getCookies()) {
            if ("consent_id".equals(c.getName()) && StringUtils.hasText(c.getValue())) {
                return c.getValue();
            }
        }
        return null;
    }

}
