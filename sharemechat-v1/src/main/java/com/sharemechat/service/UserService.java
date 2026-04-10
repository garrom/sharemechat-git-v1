package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.consent.ConsentState;
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
    private final EmailService emailService;
    private final EmailVerificationService emailVerificationService;
    private final EmailCopyRenderer emailCopyRenderer;
    private final AgeGatePolicyService ageGatePolicyService;
    private final BackofficeAccessService backofficeAccessService;
    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    @Autowired
    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       TransactionService transactionService,
                       UnsubscribeRepository unsubscribeRepository,
                       ClientDocumentRepository clientDocumentRepository,
                       ModelDocumentRepository modelDocumentRepository,
                       UserLanguageRepository userLanguageRepository,
                       EmailService emailService,
                       EmailVerificationService emailVerificationService,
                       EmailCopyRenderer emailCopyRenderer,
                       AgeGatePolicyService ageGatePolicyService,
                       BackofficeAccessService backofficeAccessService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.transactionService = transactionService;
        this.unsubscribeRepository = unsubscribeRepository;
        this.clientDocumentRepository = clientDocumentRepository;
        this.modelDocumentRepository = modelDocumentRepository;
        this.userLanguageRepository = userLanguageRepository;
        this.emailService = emailService;
        this.emailVerificationService = emailVerificationService;
        this.emailCopyRenderer = emailCopyRenderer;
        this.ageGatePolicyService = ageGatePolicyService;
        this.backofficeAccessService = backofficeAccessService;
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

        // ===== UI LOCALE (Industrial): DTO -> Accept-Language -> default "en" =====
        String uiLocale = normalizeUiLocale(registerDTO.getUiLocale());
        if (uiLocale == null) {
            uiLocale = resolveUiLocaleFromAcceptLanguage(acceptLanguage);
        }
        user.setUiLocale(uiLocale != null ? uiLocale : "en");

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
        user.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        user.setSuspendedUntil(null);
        user.setRiskReason(null);
        user.setRiskUpdatedAt(LocalDateTime.now());
        user.setRiskUpdatedBy(null);

        // Consentimientos / auditoría, entidad
        user.setConfirAdult(true);
        user.setAcceptTerm(LocalDateTime.now());

        // Versión de términos
        String termVersion = normalize(registerDTO.getTermVersion());
        user.setTermVersion(termVersion != null ? termVersion : "v1");

        // IP de registro
        if (registerIp != null && !registerIp.isBlank()) {
            user.setRegistIp(registerIp.trim());
        }

        User savedUser = userRepository.save(user);

        seedPrimaryLanguageIfMissing(savedUser);
        emailVerificationService.issueProductVerification(savedUser);

        try {
            sendWelcomeEmail(savedUser);
        } catch (Exception ex) {
            log.warn(
                    "REGISTER_CLIENT welcome email failed userId={} email={} nickname={} err={}",
                    savedUser.getId(),
                    savedUser.getEmail(),
                    savedUser.getNickname(),
                    ex.getMessage(),
                    ex
            );
        }

        return mapToDTO(savedUser);
    }

    @Transactional
    public UserDTO registerModel(@Valid UserModelRegisterDTO registerDTO,
                                 String registerIp,
                                 String acceptLanguage,
                                 String countryDetected) {
        // --- Sanitización y normalización ---
        final String email    = sanitizeEmail(registerDTO.getEmail());
        final String nickname = sanitizeNickname(registerDTO.getNickname());
        final String password = registerDTO.getPassword();

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

        // --- Mayoría de edad ---
        LocalDate dob = registerDTO.getDateOfBirth();
        LocalDate today = LocalDate.now();
        Period age = Period.between(dob, today);
        if (age.getYears() < 18) {
            throw new UnderageModelException("Debes ser mayor de 18 años para registrarte como modelo");
        }

        User user = new User();

        // ===== UI LOCALE =====
        String uiLocale = normalizeUiLocale(registerDTO.getUiLocale());
        if (uiLocale == null) {
            uiLocale = resolveUiLocaleFromAcceptLanguage(acceptLanguage);
        }
        user.setUiLocale(uiLocale != null ? uiLocale : "en");

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
        user.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        user.setSuspendedUntil(null);
        user.setRiskReason(null);
        user.setRiskUpdatedAt(LocalDateTime.now());
        user.setRiskUpdatedBy(null);
        user.setVerificationStatus(Constants.VerificationStatuses.PENDING);

        // Consentimientos
        user.setConfirAdult(true);
        user.setAcceptTerm(LocalDateTime.now());

        String termVersion = normalize(registerDTO.getTermVersion());
        user.setTermVersion(termVersion != null ? termVersion : "v1");

        if (registerIp != null && !registerIp.isBlank()) {
            user.setRegistIp(registerIp.trim());
        }

        User savedUser = userRepository.save(user);

        seedPrimaryLanguageIfMissing(savedUser);
        emailVerificationService.issueProductVerification(savedUser);

        try {
            sendWelcomeEmail(savedUser);
        } catch (Exception ex) {
            log.warn(
                    "REGISTER_MODEL welcome email failed userId={} email={} nickname={} err={}",
                    savedUser.getId(),
                    savedUser.getEmail(),
                    savedUser.getNickname(),
                    ex.getMessage(),
                    ex
            );
        }

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

        if (isBlockedForGlobalAccess(user)) {
            return Optional.empty();
        }

        String token = jwtUtil.generateAccessToken(user.getEmail(), user.getRole(), user.getId());
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
    public UserDTO updateUiLocale(String email, String uiLocale) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado"));

        String normalizedUiLocale = normalizeUiLocale(uiLocale);
        if (normalizedUiLocale == null) {
            throw new IllegalArgumentException("uiLocale no válido");
        }

        user.setUiLocale(normalizedUiLocale);
        user.setUpdatedAt(LocalDateTime.now());

        User updatedUser = userRepository.save(user);
        return mapToDTO(updatedUser);
    }

    @Transactional
    public void updatePassword(Long userId, String newPlainPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado con ID: " + userId));

        validatePasswordPolicy(newPlainPassword);

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

        validatePasswordPolicy(newRaw);
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

        // 2) Forfeit según rol actual
        //    - CLIENT: no pierde saldo al instante; queda para forfeit diferido.
        //    - MODEL: solo pierde saldo si el pendiente es > 0 y < 100 EUR.
        String forfeitDesc = "Saldo perdido por baja voluntaria"
                + (reason != null && !reason.isBlank() ? (" | Motivo: " + reason.trim()) : "");
        transactionService.forfeitOnUnsubscribe(userId, currentRole, forfeitDesc);

        // 3) Marcar baja y degradar rol (CLIENT/MODEL -> USER)
        if (Constants.Roles.CLIENT.equals(currentRole) || Constants.Roles.MODEL.equals(currentRole)) {
            user.setRole(Constants.Roles.USER);
        }
        user.setUnsubscribe(true);
        user.setIsActive(false);
        user.setUpdatedAt(LocalDateTime.now());
        user.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        user.setSuspendedUntil(null);
        user.setRiskReason("UNSUBSCRIBE");
        user.setRiskUpdatedAt(LocalDateTime.now());
        user.setRiskUpdatedBy(null);
        userRepository.save(user);

        // 4) Insertar registro en la tabla 'unsubscribe' (1 fila por usuario)
        if (!unsubscribeRepository.existsByUserId(userId)) {
            Unsubscribe row = new Unsubscribe(
                    userId,
                    LocalDate.now(),
                    normalize(reason)
            );

            // CLIENT: saldo en standby 3 meses antes de posible forfeit diferido
            if (Constants.Roles.CLIENT.equals(currentRole)) {
                row.setForfeitAfter(LocalDate.now().plusMonths(3));
            } else {
                row.setForfeitAfter(null);
            }

            unsubscribeRepository.save(row);
            try {
                sendUnsubscribeEmail(user);
            } catch (Exception ex) {
                log.warn(
                        "UNSUBSCRIBE email failed userId={} email={} reason={} ip={} err={}",
                        userId,
                        user.getEmail(),
                        normalize(reason),
                        ip,
                        ex.getMessage(),
                        ex
                );
            }
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
        return normalizeUiLocale(lang);
    }

    /** Devuelve null si el texto es null o está en blanco; en otro caso devuelve trim(). */
    private String normalize(String text) {

        return (text == null || text.trim().isEmpty()) ? null : text.trim();
    }

    private String normalizeUiLocale(String uiLocale) {
        String normalized = normalize(uiLocale);
        if (normalized == null) {
            return null;
        }

        normalized = normalized.toLowerCase(Locale.ROOT);

        if (normalized.contains("-")) {
            normalized = normalized.split("-")[0];
        } else if (normalized.contains("_")) {
            normalized = normalized.split("_")[0];
        }

        if ("es".equals(normalized) || "en".equals(normalized)) {
            return normalized;
        }

        return null;
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
        if (pwd == null || pwd.length() < 10) {
            throw new IllegalArgumentException("La contraseña debe tener al menos 10 caracteres.");
        }
        // Rechaza cualquier espacio o separador Unicode (incluye NBSP)
        boolean hasSpace = pwd.codePoints()
                .anyMatch(cp -> Character.isWhitespace(cp) || Character.isSpaceChar(cp));
        if (hasSpace) {
            throw new IllegalArgumentException("La contraseña no puede contener espacios en blanco.");
        }
    }

    //EMAIL
    private void sendWelcomeEmail(User user) {
        EmailCopyRenderer.EmailContent content = emailCopyRenderer.renderWelcome(user);

        emailService.send(new EmailMessage(
                user.getEmail(),
                content.subject(),
                content.body(),
                EmailMessage.Category.WELCOME,
                EmailMessage.Priority.BEST_EFFORT
        ));
    }

    //EMAIL
    private void sendUnsubscribeEmail(User user) {

        EmailCopyRenderer.EmailContent content = emailCopyRenderer.renderUnsubscribe(user);

        emailService.send(new EmailMessage(
                user.getEmail(),
                content.subject(),
                content.body(),
                EmailMessage.Category.UNSUBSCRIBE_CONFIRMATION,
                EmailMessage.Priority.BEST_EFFORT
        ));
    }

    private void seedPrimaryLanguageIfMissing(User user) {
        if (user == null || user.getId() == null) return;

        if (!userLanguageRepository.findByUserId(user.getId()).isEmpty()) return;

        String lang = normalizeUiLocale(user.getUiLocale());
        if (lang == null) lang = "en";

        UserLanguage ul = new UserLanguage();
        ul.setUserId(user.getId());
        ul.setLangCode(lang.toLowerCase(Locale.ROOT));
        ul.setPrimary(true);
        ul.setPreferenceWeight(100);

        userLanguageRepository.save(ul);
    }

    private boolean isBlockedForGlobalAccess(User user) {
        if (user == null) {
            return true;
        }

        if (Boolean.TRUE.equals(user.getUnsubscribe())) {
            return true;
        }

        String accountStatus = normalize(user.getAccountStatus());
        if (accountStatus == null) {
            accountStatus = Constants.AccountStatuses.ACTIVE;
        } else {
            accountStatus = accountStatus.toUpperCase(Locale.ROOT);
        }

        return !Constants.AccountStatuses.ACTIVE.equals(accountStatus);
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

        if (isBlockedForGlobalAccess(user)) {
            throw new InvalidCredentialsException("Cuenta suspendida, baneada o no disponible");
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
        dto.setActive(user.getIsActive());
        dto.setUnsubscribe(user.getUnsubscribe());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUiLocale(user.getUiLocale());

        dto.setAccountStatus(user.getAccountStatus());
        dto.setSuspendedUntil(user.getSuspendedUntil());
        dto.setRiskReason(user.getRiskReason());
        dto.setRiskUpdatedAt(user.getRiskUpdatedAt());
        dto.setRiskUpdatedBy(user.getRiskUpdatedBy());
        dto.setEmailVerifiedAt(user.getEmailVerifiedAt());

        ConsentState consentState = ageGatePolicyService.resolve(user);
        dto.setConsentCompliant(consentState.compliant());
        dto.setConsentRequired(consentState.consentRequired());
        dto.setMissingAdultConfirmation(consentState.missingAdultConfirmation());
        dto.setMissingTermsAcceptance(consentState.missingTermsAcceptance());
        dto.setOutdatedTerms(consentState.outdatedTerms());
        dto.setRequiredTermsVersion(consentState.requiredTermsVersion());

        BackofficeAccessService.BackofficeAccessProfile profile =
                backofficeAccessService.loadProfile(user.getId(), user.getRole());
        dto.setBackofficeRoles(profile.roles().stream().sorted().toList());
        dto.setBackofficePermissions(profile.permissions().stream().sorted().toList());

        return dto;
    }

    public PublicUserDTO mapToPublicUserDTO(User user) {
        PublicUserDTO dto = new PublicUserDTO();
        dto.setId(user.getId());
        dto.setNickname(user.getNickname());
        dto.setName(user.getName());
        dto.setSurname(user.getSurname());
        dto.setBiography(user.getBiography());
        dto.setInterests(user.getInterests());
        dto.setRole(user.getRole());
        dto.setVerificationStatus(user.getVerificationStatus());
        return dto;
    }

}
