package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.*;
import com.sharemechat.entity.LoginResponse;
import com.sharemechat.entity.Unsubscribe;
import com.sharemechat.entity.User;
import com.sharemechat.entity.UserLanguage;
import com.sharemechat.exception.*;
import com.sharemechat.repository.*;
import com.sharemechat.security.JwtUtil;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.Locale;
import java.util.Optional;

@Service
@Validated
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final TransactionService transactionService;
    private final UnsubscribeRepository unsubscribeRepository;
    private final ClientDocumentRepository clientDocumentRepository;
    private final ModelDocumentRepository modelDocumentRepository;
    private final UserLanguageRepository userLanguageRepository;
    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    @Autowired
    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       TransactionService transactionService,
                       UnsubscribeRepository unsubscribeRepository,
                       ClientDocumentRepository clientDocumentRepository,
                       ModelDocumentRepository modelDocumentRepository,
                       UserLanguageRepository userLanguageRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.transactionService = transactionService;
        this.unsubscribeRepository = unsubscribeRepository;
        this.clientDocumentRepository = clientDocumentRepository;
        this.modelDocumentRepository = modelDocumentRepository;
        this.userLanguageRepository = userLanguageRepository;
    }

    @Transactional
    public UserDTO registerClient(@Valid UserClientRegisterDTO registerDTO,
                                  String registerIp,
                                  String acceptLanguage,
                                  String countryDetected) {
        // --- Sanitización ---
        final String email    = sanitizeEmail(registerDTO.getEmail());       // sin espacios, minúsculas
        final String nickname = sanitizeNickname(registerDTO.getNickname()); // sin espacios en el string
        final String password = registerDTO.getPassword();                   // no se altera


        if (email == null) {
            throw new IllegalArgumentException("El email no puede estar vacío");
        }
        if (nickname == null) {
            throw new IllegalArgumentException("El nickname es obligatorio");
        }
        validatePasswordPolicy(password);

        if (!Boolean.TRUE.equals(registerDTO.getConfirAdult())) {
            throw new IllegalArgumentException("Debes confirmar que eres mayor de 18 años");
        }
        if (!Boolean.TRUE.equals(registerDTO.getAcceptedTerm())) {
            throw new IllegalArgumentException("Debes aceptar los términos y condiciones");
        }
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyInUseException("El email ya está en uso");
        }

        if (userRepository.existsByNickname(nickname)) {
            throw new NicknameAlreadyInUseException("Ese nickname ya existe, debes elegir otro.");
        }

        User user = new User();

        // ===== UI LOCALE (Industrial): DTO -> Accept-Language -> default "es" =====
        String uiLocale = normalize(registerDTO.getUiLocale());
        if (uiLocale == null) {
            uiLocale = resolveUiLocaleFromAcceptLanguage(acceptLanguage);
        }
        user.setUiLocale(uiLocale != null ? uiLocale : "es");

        log.info(
                "REGISTER_CLIENT email={} nick={} uiLocaleDTO={} acceptLanguage={} resolvedUiLocale={} countryDetected={} ip={}",
                registerDTO.getEmail(),
                registerDTO.getNickname(),
                registerDTO.getUiLocale(),
                acceptLanguage,
                user.getUiLocale(),
                countryDetected,
                registerIp
        );

        // ===== Country detected (persistido en users.country_detected) =====
        if (countryDetected != null && !countryDetected.isBlank()) {
            user.setCountryDetected(countryDetected.trim().toUpperCase(Locale.ROOT));
        }

        user.setEmail(email);
        user.setNickname(nickname);
        user.setPassword(passwordEncoder.encode(password));

        user.setRole(Constants.Roles.USER);
        user.setUserType(Constants.UserTypes.FORM_CLIENT);
        user.setUnsubscribe(false);
        user.setIsActive(true);

        // Consentimientos / auditoría, entidad
        user.setConfirAdult(true);                 // el check se usa para validar
        user.setAcceptTerm(LocalDateTime.now());   // evidencia de aceptación

        // Versión de términos (usa normalize)
        String termVersion = normalize(registerDTO.getTermVersion());
        user.setTermVersion(termVersion != null ? termVersion : "v1");

        // IP de registro (desde el controller con IpConfig)
        if (registerIp != null && !registerIp.isBlank()) {
            user.setRegistIp(registerIp.trim());
        }

        User savedUser = userRepository.save(user);
        seedPrimaryLanguageIfMissing(savedUser);
        return mapToDTO(savedUser);
    }

    @Transactional
    public UserDTO registerModel(@Valid UserModelRegisterDTO registerDTO,
                                 String registerIp,
                                 String acceptLanguage,
                                 String countryDetected) {
        // --- Sanitización y normalización ---
        final String email    = sanitizeEmail(registerDTO.getEmail());        // trim + rechaza espacios internos + minúsculas
        final String nickname = sanitizeNickname(registerDTO.getNickname());  // elimina espacios no deseados
        final String password = registerDTO.getPassword();                    // no se altera

        if (email == null) {
            throw new IllegalArgumentException("El email no puede estar vacío");
        }
        if (nickname == null) {
            throw new IllegalArgumentException("El nickname es obligatorio");
        }
        validatePasswordPolicy(password); // longitud y sin espacios

        if (!Boolean.TRUE.equals(registerDTO.getConfirAdult())) {
            throw new IllegalArgumentException("Debes confirmar que eres mayor de 18 años");
        }
        if (!Boolean.TRUE.equals(registerDTO.getAcceptedTerm())) {
            throw new IllegalArgumentException("Debes aceptar los términos y condiciones");
        }

        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyInUseException("El email ya está en uso");
        }

        if (userRepository.existsByNickname(nickname)) {
            throw new NicknameAlreadyInUseException("Ese nickname ya existe, debes elegir otro.");
        }

        // --- Mayoría de edad ---
        LocalDate dob = registerDTO.getDateOfBirth();
        LocalDate today = LocalDate.now();
        Period age = Period.between(dob, today);
        if (age.getYears() < 18) {
            throw new UnderageModelException("Debes ser mayor de 18 años para registrarte como modelo");
        }


        User user = new User();

        // ===== UI LOCALE (Industrial): DTO -> Accept-Language -> default "es" =====
        String uiLocale = normalize(registerDTO.getUiLocale());
        if (uiLocale == null) {
            uiLocale = resolveUiLocaleFromAcceptLanguage(acceptLanguage);
        }
        user.setUiLocale(uiLocale != null ? uiLocale : "es");

        log.info(
                "REGISTER_MODEL email={} nick={} uiLocaleDTO={} acceptLanguage={} resolvedUiLocale={} countryDetected={} ip={}",
                registerDTO.getEmail(),
                registerDTO.getNickname(),
                registerDTO.getUiLocale(),
                acceptLanguage,
                user.getUiLocale(),
                countryDetected,
                registerIp
        );

        // ===== Country detected (persistido en users.country_detected) =====
        if (countryDetected != null && !countryDetected.isBlank()) {
            user.setCountryDetected(countryDetected.trim().toUpperCase(Locale.ROOT));
        }

        user.setEmail(email);
        user.setNickname(nickname);
        user.setPassword(passwordEncoder.encode(password));

        user.setRole(Constants.Roles.USER);
        user.setUserType(Constants.UserTypes.FORM_MODEL);

        user.setDateOfBirth(dob);
        user.setUnsubscribe(false);
        user.setIsActive(true);
        user.setVerificationStatus(Constants.VerificationStatuses.PENDING);


        // Consentimientos / auditoría:
        user.setConfirAdult(true);                 // el check ya fue validado
        user.setAcceptTerm(LocalDateTime.now());   // marca de tiempo de aceptación

        // Versión de términos
        String termVersion = normalize(registerDTO.getTermVersion());
        user.setTermVersion(termVersion != null ? termVersion : "v1");

        // IP de registro (obtenida en el controller con IpConfig)
        if (registerIp != null && !registerIp.isBlank()) {
            user.setRegistIp(registerIp.trim());
        }

        // Persistencia
        User savedUser = userRepository.save(user);
        seedPrimaryLanguageIfMissing(savedUser);
        return mapToDTO(savedUser);
    }

    public Optional<LoginResponse> login(@Valid UserLoginDTO loginDTO) {
        Optional<User> userOpt = userRepository.findByEmail(loginDTO.getEmail());
        if (userOpt.isEmpty()) {
            return Optional.empty();
        }
        User user = userOpt.get();
        if (!passwordEncoder.matches(loginDTO.getPassword(), user.getPassword())) {
            return Optional.empty();
        }
        if (user.getUnsubscribe()) {
            return Optional.empty();
        }
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole(), user.getId());
        return Optional.of(new LoginResponse(token, mapToDTO(user)));
    }

    public UserDTO getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado con ID: " + id));
        return mapToDTO(user);
    }

    public User findByEmail(String email) {

        return userRepository.findByEmail(email).orElse(null);
    }

    public User findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(
                        "Usuario no encontrado con ID: " + id));
    }

    @Transactional
    public UserDTO updateUser(Long id, @Valid UserUpdateDTO userUpdateDTO) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado con ID: " + id));

        // Normalizar: strings en blanco -> null
        String nickname = normalize(userUpdateDTO.getNickname());
        String name = normalize(userUpdateDTO.getName());
        String surname = normalize(userUpdateDTO.getSurname());
        String profilePicture = normalize(userUpdateDTO.getProfilePicture());
        String biography = normalize(userUpdateDTO.getBiography());
        String interests = normalize(userUpdateDTO.getInterests());
        // Nickname: validar unicidad solo si llega y cambia
        if (nickname != null) {
            if (userRepository.existsByNicknameAndIdNot(nickname, id)) {
                throw new EmailAlreadyInUseException("El nickname ya está en uso");
            }
            user.setNickname(nickname);
        }
        if (name != null) {
            user.setName(name);
        }
        if (surname != null) {
            user.setSurname(surname);
        }
        if (userUpdateDTO.getDateOfBirth() != null) {
            user.setDateOfBirth(userUpdateDTO.getDateOfBirth());
        }
        if (biography != null) {
            user.setBiography(biography);
        }
        if (interests != null) {
            user.setInterests(interests);
        }
        User updatedUser = userRepository.save(user);
        return mapToDTO(updatedUser);
    }

    @Transactional
    public void updatePassword(Long userId, String newPlainPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado con ID: " + userId));

        if (newPlainPassword == null || newPlainPassword.length() < 8) {
            throw new IllegalArgumentException("La contraseña debe tener al menos 8 caracteres");
        }

        user.setPassword(passwordEncoder.encode(newPlainPassword));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    @Transactional
    public void changePassword(Long userId, String currentRaw, String newRaw) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        if (!passwordEncoder.matches(currentRaw, user.getPassword())) {
            throw new IllegalArgumentException("La contraseña actual no es correcta");
        }

        // Puedes añadir checks de robustez de newRaw si quieres extra validación
        user.setPassword(passwordEncoder.encode(newRaw));
        userRepository.save(user);
    }

    // Darse de baja como usuario
    @Transactional
    public void unsubscribe(String email, String reason, String ip) {
        // 1) Resolver usuario
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado"));

        if (Boolean.TRUE.equals(user.getUnsubscribe())) {
            // Idempotente: ya estaba de baja, no hacemos nada más
            return;
        }

        final Long userId = user.getId();
        final String currentRole = user.getRole();

        // 2) Forfeit de saldo según rol actual (CLIENT o MODEL)
        //    (registra transactions/balances y contrapartida plataforma; pone saldo agregado a 0)
        //    La lógica vive en TransactionService para no duplicar código financiero.
        String forfeiDesc = "Saldo perdido por baja voluntaria"
                + (reason != null && !reason.isBlank() ? (" | Motivo: " + reason.trim()) : "");
        transactionService.forfeitOnUnsubscribe(userId, currentRole, forfeiDesc);  // [NEW]

        // 3) Marcar baja y degradar rol (CLIENT/MODEL -> USER)
        if (Constants.Roles.CLIENT.equals(currentRole) || Constants.Roles.MODEL.equals(currentRole)) {
            user.setRole(Constants.Roles.USER);
        }
        user.setUnsubscribe(true);
        user.setIsActive(false);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        // 4) Insertar registro en la tabla 'unsubscribe' (1 fila por usuario)
        //    Requiere UnsubscribeRepository y entidad Unsubscribe.
        if (!unsubscribeRepository.existsByUserId(userId)) {                    // [NEW]
            Unsubscribe row = new Unsubscribe(userId, LocalDate.now(),          // [NEW]
                    normalize(reason));                                          // [NEW]
            unsubscribeRepository.save(row);                                     // [NEW]
        }

        // (Opcional) Si luego integras cierre de WS/colas, hazlo fuera para no mezclar capas aquí.
    }


    /* ================== Helpers privados ================== */
    private String resolveUiLocaleFromAcceptLanguage(String acceptLanguage) {
        if (acceptLanguage == null || acceptLanguage.isBlank()) return null;

        // Ej: "es-ES,es;q=0.9,en;q=0.8" -> "es"
        String first = acceptLanguage.split(",")[0].trim();
        if (first.isEmpty()) return null;

        String lang = first.split("-")[0].trim().toLowerCase(Locale.ROOT);
        return lang.isEmpty() ? null : lang;
    }

    /** Devuelve null si el texto es null o está en blanco; en otro caso devuelve trim(). */
    private String normalize(String text) {

        return (text == null || text.trim().isEmpty()) ? null : text.trim();
    }

    /** Elimina cualquier espacio (incluido NBSP) y normaliza a minúsculas. */
    private String sanitizeEmail(String s) {
        // 1) trim + null si queda vacío
        s = normalize(s);
        if (s == null) return null;

        // 2) rechazar cualquier espacio o separador Unicode interno
        boolean hasSpace = s.codePoints()
                .anyMatch(cp -> Character.isWhitespace(cp) || Character.isSpaceChar(cp));
        if (hasSpace) {
            throw new IllegalArgumentException("El email no puede contener espacios en blanco.");
        }

        // 3) normalizar a minúsculas
        return s.toLowerCase(Locale.ROOT);
    }

    /** Elimina cualquier espacio (incluido NBSP) en el nickname. */
    private String sanitizeNickname(String s) {
        if (s == null) return null;
        String noSpaces = s.replaceAll("[\\s\\u00A0]+", "");
        return noSpaces; // si prefieres permitir espacios simples: return s.trim().replaceAll("[\\s\\u00A0]+", " ");
    }

    /** No modificamos la contraseña: validamos política y rechazamos si no cumple. */
    private void validatePasswordPolicy(String pwd) {
        if (pwd == null || pwd.length() < 8) {
            throw new IllegalArgumentException("La contraseña debe tener al menos 8 caracteres.");
        }
        // Rechaza cualquier espacio o separador Unicode (incluye NBSP)
        boolean hasSpace = pwd.codePoints()
                .anyMatch(cp -> Character.isWhitespace(cp) || Character.isSpaceChar(cp));
        if (hasSpace) {
            throw new IllegalArgumentException("La contraseña no puede contener espacios en blanco.");
        }
    }

    private void seedPrimaryLanguageIfMissing(User user) {
        if (user == null || user.getId() == null) return;

        if (!userLanguageRepository.findByUserId(user.getId()).isEmpty()) return;

        String lang = normalize(user.getUiLocale());
        if (lang == null) lang = "es";

        UserLanguage ul = new UserLanguage();
        ul.setUserId(user.getId());
        ul.setLangCode(lang.toLowerCase(Locale.ROOT));
        ul.setPrimary(true);
        ul.setPreferenceWeight(100);

        userLanguageRepository.save(ul);
    }


    public User authenticateAndLoadUser(@Valid UserLoginDTO loginDTO) {

        Optional<User> userOpt = userRepository.findByEmail(loginDTO.getEmail());
        if (userOpt.isEmpty()) {
            throw new InvalidCredentialsException("Credenciales inválidas");
        }

        User user = userOpt.get();

        if (!passwordEncoder.matches(loginDTO.getPassword(), user.getPassword())) {
            throw new InvalidCredentialsException("Credenciales inválidas");
        }

        if (Boolean.TRUE.equals(user.getUnsubscribe())) {
            throw new InvalidCredentialsException("Credenciales inválidas");
        }

        return user;
    }


    public UserDTO mapToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setNickname(user.getNickname());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole());
        dto.setUserType(user.getUserType());
        dto.setName(user.getName());
        dto.setSurname(user.getSurname());
        dto.setDateOfBirth(user.getDateOfBirth());
        dto.setBiography(user.getBiography());
        dto.setInterests(user.getInterests());
        dto.setVerificationStatus(user.getVerificationStatus());
        dto.setUnsubscribe(user.getUnsubscribe());
        dto.setCreatedAt(user.getCreatedAt());

        return dto;
    }

}