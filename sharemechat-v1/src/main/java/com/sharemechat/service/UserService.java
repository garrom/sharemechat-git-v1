package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.*;
import com.sharemechat.entity.LoginResponse;
import com.sharemechat.entity.User;
import com.sharemechat.exception.EmailAlreadyInUseException;
import com.sharemechat.exception.InvalidCredentialsException;
import com.sharemechat.exception.UnderageModelException;
import com.sharemechat.exception.UserNotFoundException;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.JwtUtil;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

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


    @Autowired
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public UserDTO registerClient(@Valid UserClientRegisterDTO registerDTO, String registerIp) {
        // --- Sanitización ---
        final String email    = sanitizeEmail(registerDTO.getEmail());      // sin espacios, minúsculas
        final String nickname = sanitizeNickname(registerDTO.getNickname()); // sin espacios en todo el string
        final String password = registerDTO.getPassword();                  // no se altera

        // --- Validaciones extra ---
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

        // --- Construcción entidad ---
        User user = new User();
        user.setEmail(email);
        user.setNickname(nickname);
        user.setPassword(passwordEncoder.encode(password));

        user.setRole(Constants.Roles.USER);
        user.setUserType(Constants.UserTypes.FORM_CLIENT);
        user.setUnsubscribe(false);
        user.setIsActive(true);

        // Consentimientos / auditoría, entidad: acceptTerm = LocalDateTime)
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
        return mapToDTO(savedUser);
    }


    @Transactional
    public UserDTO registerModel(@Valid UserModelRegisterDTO registerDTO, String registerIp) {
        // --- Sanitización y normalización ---
        final String email    = sanitizeEmail(registerDTO.getEmail());       // trim + rechaza espacios internos + minúsculas
        final String nickname = sanitizeNickname(registerDTO.getNickname()); // elimina espacios no deseados
        final String password = registerDTO.getPassword();                   // no se altera

        // --- Validaciones extra (además de Bean Validation) ---
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

        // --- Mayoría de edad ---
        LocalDate dob = registerDTO.getDateOfBirth();
        LocalDate today = LocalDate.now();
        Period age = Period.between(dob, today);
        if (age.getYears() < 18) {
            throw new UnderageModelException("Debes ser mayor de 18 años para registrarte como modelo");
        }

        // --- Construcción de la entidad ---
        User user = new User();
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
        if (profilePicture != null) {
            user.setProfilePic(profilePicture);
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

    /* ================== Helpers privados ================== */

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


    public UserDTO mapToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setNickname(user.getNickname());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole());
        dto.setUserType(user.getUserType());
        dto.setName(user.getName());
        dto.setSurname(user.getSurname());
        dto.setProfilePic(user.getProfilePic());
        dto.setDateOfBirth(user.getDateOfBirth());
        dto.setBiography(user.getBiography());
        dto.setInterests(user.getInterests());
        dto.setVerificationStatus(user.getVerificationStatus());

        dto.setUnsubscribe(user.getUnsubscribe());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setStartDate(user.getStartDate());
        dto.setEndDate(user.getEndDate());
        return dto;
    }


}