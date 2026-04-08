package com.sharemechat.service;

import com.sharemechat.entity.EmailVerificationToken;
import com.sharemechat.entity.User;
import com.sharemechat.exception.EmailVerificationRequiredException;
import com.sharemechat.repository.EmailVerificationTokenRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class EmailVerificationService {

    private static final String CONTEXT_BACKOFFICE = "BACKOFFICE";
    private static final String CONTEXT_PRODUCT = "PRODUCT";

    private final EmailVerificationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final EmailCopyRenderer emailCopyRenderer;

    @Value("${email-verification.ttl-minutes:1440}")
    private int ttlMinutes;

    @Value("${app.frontend.verify-email-admin-url:https://admin.test.sharemechat.com/verify-email}")
    private String adminVerificationUrlBase;

    @Value("${app.frontend.verify-email-product-url:https://test.sharemechat.com/verify-email}")
    private String productVerificationUrlBase;

    public EmailVerificationService(EmailVerificationTokenRepository tokenRepository,
                                    UserRepository userRepository,
                                    EmailService emailService,
                                    EmailCopyRenderer emailCopyRenderer) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.emailCopyRenderer = emailCopyRenderer;
    }

    @Transactional
    public void issueBackofficeVerification(User user, Long actorUserId) {
        issueVerification(user, actorUserId, CONTEXT_BACKOFFICE);
    }

    @Transactional
    public void issueProductVerification(User user) {
        issueVerification(user, null, CONTEXT_PRODUCT);
    }

    @Transactional
    public void issueProductVerification(User user, Long actorUserId) {
        issueVerification(user, actorUserId, CONTEXT_PRODUCT);
    }

    @Transactional
    public void issueVerification(User user, Long actorUserId, String context) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("Usuario requerido");
        }

        tokenRepository.findTopByUserAndConsumedAtIsNullOrderByCreatedAtDesc(user)
                .ifPresent(prev -> {
                    prev.setConsumedAt(LocalDateTime.now());
                    tokenRepository.save(prev);
                });

        String rawToken = generateUrlSafeToken(32);
        EmailVerificationToken token = new EmailVerificationToken();
        token.setUser(user);
        token.setTokenHash(sha256Hex(rawToken));
        token.setExpiresAt(LocalDateTime.now().plusMinutes(ttlMinutes));
        token.setSentToEmail(user.getEmail());
        token.setCreatedByUserId(actorUserId);
        tokenRepository.save(token);

        String link = buildFrontendLink(rawToken, context);
        String nickname = safeLabel(user.getNickname(), user.getEmail());
        EmailCopyRenderer.EmailContent content =
                emailCopyRenderer.renderVerification(user, context, nickname, link, ttlMinutes);

        emailService.send(new EmailMessage(
                user.getEmail(),
                content.subject(),
                content.body(),
                EmailMessage.Category.EMAIL_VERIFICATION,
                EmailMessage.Priority.CRITICAL
        ));
    }

    @Transactional
    public Map<String, Object> consumeVerificationToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Token requerido");
        }

        String tokenHash = sha256Hex(rawToken);
        EmailVerificationToken token = tokenRepository.findByTokenHashAndConsumedAtIsNull(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Token invalido o ya consumido"));

        if (token.getExpiresAt() != null && token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Token expirado");
        }

        User user = userRepository.findById(token.getUser().getId())
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        LocalDateTime now = LocalDateTime.now();
        token.setConsumedAt(now);
        tokenRepository.save(token);

        if (user.getEmailVerifiedAt() == null) {
            user.setEmailVerifiedAt(now);
            userRepository.save(user);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("userId", user.getId());
        out.put("email", user.getEmail());
        out.put("verifiedAt", user.getEmailVerifiedAt() != null ? user.getEmailVerifiedAt().toString() : now.toString());
        out.put("message", "Email validado correctamente.");
        return out;
    }

    public boolean isEmailVerified(User user) {
        return user != null && user.getEmailVerifiedAt() != null;
    }

    public void assertEmailVerified(User user, String message) {
        assertEmailVerified(user, message, null, null);
    }

    public void assertEmailVerified(User user, String message, String scope, String nextAction) {
        if (!isEmailVerified(user)) {
            throw new EmailVerificationRequiredException(message, scope, nextAction);
        }
    }

    private String buildFrontendLink(String rawToken, String context) {
        String encoded = URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
        String baseUrl = CONTEXT_BACKOFFICE.equalsIgnoreCase(context)
                ? adminVerificationUrlBase
                : productVerificationUrlBase;
        return baseUrl + "?token=" + encoded;
    }

    private static String generateUrlSafeToken(int numBytes) {
        byte[] bytes = new byte[numBytes];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256Hex(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] out = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(out.length * 2);
            for (byte b : out) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo calcular SHA-256", e);
        }
    }

    private String safeLabel(String nickname, String email) {
        if (nickname != null && !nickname.isBlank()) {
            return nickname.trim();
        }
        return email != null ? email.trim() : "usuario";
    }

}
