package com.sharemechat.service;

import com.sharemechat.entity.PasswordResetToken;
import com.sharemechat.entity.User;
import com.sharemechat.repository.PasswordResetTokenRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final EmailService emailService;

    @Value("${password-reset.ttl-minutes:30}")
    private int ttlMinutes;

    @Value("${app.frontend.reset-url:https://test.sharemechat.com/reset-password}")
    private String resetUrlBase;

    public PasswordResetService(UserRepository userRepository,
                                PasswordResetTokenRepository tokenRepository,
                                EmailService emailService) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.emailService = emailService;
    }

    /**
     * Crea token de un solo uso y "envía" email con link (logueado).
     * Responde igual exista o no el email (evita enumeración).
     */
    @Transactional
    public void requestReset(String email, String requestIp, String userAgent) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            // Respuesta homogénea: no filtramos si existe o no
            log.info("Password reset solicitado para email inexistente: {}", email);
            return;
        }

        User user = userOpt.get();

        // Generar token aleatorio URL-safe (32 bytes -> ~43 chars)
        String rawToken = generateUrlSafeToken(32);

        // Hash SHA-256 en hex (64 chars)
        String tokenHash = sha256Hex(rawToken);

        // Opcional: invalidar el último token activo del usuario (si quieres un solo token vivo)
        tokenRepository.findTopByUserAndUsedAtIsNullOrderByCreatedAtDesc(user)
                .ifPresent(prev -> {
                    prev.setUsedAt(LocalDateTime.now());
                    tokenRepository.save(prev);
                });

        PasswordResetToken prt = new PasswordResetToken();
        prt.setUser(user);
        prt.setTokenHash(tokenHash);
        prt.setExpiresAt(LocalDateTime.now().plusMinutes(ttlMinutes));
        prt.setRequestIp(requestIp);
        prt.setUserAgent(userAgent);
        tokenRepository.save(prt);

        // Construir link al frontend
        String link = buildFrontendLink(rawToken);

        // Email (logueado por ahora)
        String subject = "Recuperación de contraseña";
        String body = """
                <p>Has solicitado restablecer tu contraseña.</p>
                <p>Haz clic en el siguiente enlace para continuar:</p>
                <p><a href="%s">%s</a></p>
                <p>Este enlace caduca en %d minutos.</p>
                """.formatted(link, link, ttlMinutes);

        emailService.send(user.getEmail(), subject, body);

        log.info("Password reset token creado para userId={} expira en {} min", user.getId(), ttlMinutes);
    }

    // en com.sharemechat.service.PasswordResetService

    @Transactional
    public void createAndSendToken(String email) {
        // Reutilizamos tu método existente requestReset(...)
        requestReset(email, "0.0.0.0", "password-reset-controller");
    }

    /**
     * Valida el token (raw), comprueba expiración y marca como usado.
     * Devuelve el userId asociado para que el caller actualice la contraseña.
     */
    @Transactional
    public Long consumeToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Token requerido");
        }

        String tokenHash = sha256Hex(rawToken);

        PasswordResetToken prt = tokenRepository
                .findByTokenHashAndUsedAtIsNull(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Token inválido o ya usado"));

        if (prt.getExpiresAt() != null && prt.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Token expirado");
        }

        // Marcar como usado (one-time)
        prt.setUsedAt(LocalDateTime.now());
        tokenRepository.save(prt);

        return prt.getUser().getId();
    }

    private String buildFrontendLink(String rawToken) {
        String t = URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
        // El frontend leerá ?token=... y llamará al endpoint /reset (paso 2)
        return resetUrlBase + "?token=" + t;
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
}
