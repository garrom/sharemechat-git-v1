package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.BackofficeAdministrationDTOs;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
public class InternalUserProvisioningService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationService emailVerificationService;

    public InternalUserProvisioningService(UserRepository userRepository,
                                           PasswordEncoder passwordEncoder,
                                           EmailVerificationService emailVerificationService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailVerificationService = emailVerificationService;
    }

    @Transactional
    public User provisionInternalUser(BackofficeAdministrationDTOs.BackofficeUserUpsertRequest request, Long actorUserId) {
        if (request == null) {
            throw new IllegalArgumentException("Peticion invalida");
        }

        String email = normalizeEmail(request.getEmail());
        String nickname = normalizeNickname(request.getNickname());
        String password = request.getPassword();

        if (email == null) {
            throw new IllegalArgumentException("El email es obligatorio");
        }
        if (nickname == null) {
            throw new IllegalArgumentException("El nickname es obligatorio");
        }
        if (password == null || password.length() < 10) {
            throw new IllegalArgumentException("La contrasena inicial debe tener al menos 10 caracteres");
        }
        if (containsWhitespace(password)) {
            throw new IllegalArgumentException("La contrasena inicial no puede contener espacios en blanco");
        }
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("El email ya esta en uso");
        }
        if (userRepository.existsByNickname(nickname)) {
            throw new IllegalArgumentException("El nickname ya esta en uso");
        }

        User user = new User();
        user.setEmail(email);
        user.setNickname(nickname);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(Constants.Roles.USER);
        user.setUserType(Constants.UserTypes.INTERNAL);
        user.setUiLocale("en");
        user.setIsActive(true);
        user.setUnsubscribe(false);
        user.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        user.setRiskUpdatedAt(LocalDateTime.now());
        user.setRiskUpdatedBy(null);
        user.setEmailVerifiedAt(null);

        User savedUser = userRepository.save(user);
        emailVerificationService.issueBackofficeVerification(savedUser, actorUserId);
        return savedUser;
    }

    private String normalizeEmail(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim().toLowerCase(Locale.ROOT);
        if (trimmed.isBlank() || containsWhitespace(trimmed)) {
            return null;
        }
        return trimmed;
    }

    private String normalizeNickname(String raw) {
        if (raw == null) {
            return null;
        }
        String compact = raw.replaceAll("[\\s\\u00A0]+", "");
        return compact.isBlank() ? null : compact;
    }

    private boolean containsWhitespace(String raw) {
        if (raw == null) {
            return false;
        }
        return raw.codePoints().anyMatch(cp -> Character.isWhitespace(cp) || Character.isSpaceChar(cp));
    }
}
