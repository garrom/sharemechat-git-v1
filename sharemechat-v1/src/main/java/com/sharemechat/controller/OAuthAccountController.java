package com.sharemechat.controller;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.sharemechat.dto.OAuthLinkRequestDTO;
import com.sharemechat.dto.SetInitialPasswordRequest;
import com.sharemechat.entity.OAuthAccount;
import com.sharemechat.entity.User;
import com.sharemechat.exception.UserNotFoundException;
import com.sharemechat.repository.OAuthAccountRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.GoogleIdTokenVerifierService;
import com.sharemechat.service.UserService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Gestion de vinculaciones OAuth (Google, futuros Apple/Twitter) del user
 * autenticado y establecimiento de password inicial para users Google-only.
 *
 * <p>Endpoints:
 * <ul>
 *     <li>{@code GET  /api/users/me/oauth}                         — listar vinculaciones activas.</li>
 *     <li>{@code POST /api/users/me/oauth/google/link}             — vincular Google (requiere ID token).</li>
 *     <li>{@code DELETE /api/users/me/oauth/google}                — unlink Google.</li>
 *     <li>{@code POST /api/users/me/password/initial}              — set primera password (solo si password IS NULL).</li>
 * </ul>
 *
 * <p>Todos requieren autenticacion. Cubiertos por el matcher
 * {@code /api/users/**} de {@link com.sharemechat.security.SecurityConfig}.
 */
@RestController
@RequestMapping("/api/users/me")
public class OAuthAccountController {

    private static final Logger log = LoggerFactory.getLogger(OAuthAccountController.class);

    private final UserRepository userRepository;
    private final OAuthAccountRepository oauthRepository;
    private final GoogleIdTokenVerifierService googleVerifier;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public OAuthAccountController(
            UserRepository userRepository,
            OAuthAccountRepository oauthRepository,
            GoogleIdTokenVerifierService googleVerifier,
            UserService userService,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.oauthRepository = oauthRepository;
        this.googleVerifier = googleVerifier;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
    }

    // =========================================================
    // GET /api/users/me/oauth
    // =========================================================
    @GetMapping("/oauth")
    public ResponseEntity<?> listMyLinks(Authentication auth) {
        User u = resolveUser(auth);
        if (u == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        List<OAuthAccount> links = oauthRepository.findByUserIdAndRevokedAtIsNull(u.getId());
        boolean hasPassword = u.getPassword() != null && !u.getPassword().isBlank();

        List<Map<String, Object>> providers = links.stream()
                .map(l -> Map.<String, Object>of(
                        "provider", l.getProvider(),
                        "emailAtSignup", l.getEmailAtSignup(),
                        "createdAt", l.getCreatedAt(),
                        "lastUsedAt", l.getLastUsedAt() == null ? "" : l.getLastUsedAt()
                ))
                .toList();

        return ResponseEntity.ok(Map.of(
                "hasPassword", hasPassword,
                "providers", providers
        ));
    }

    // =========================================================
    // POST /api/users/me/oauth/google/link
    // =========================================================
    @PostMapping("/oauth/google/link")
    @Transactional
    public ResponseEntity<?> linkGoogle(
            @RequestBody @Valid OAuthLinkRequestDTO body,
            Authentication auth
    ) {
        User u = resolveUser(auth);
        if (u == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        if (!googleVerifier.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("code", "GOOGLE_AUTH_UNAVAILABLE"));
        }

        if (oauthRepository.existsByUserIdAndProviderAndRevokedAtIsNull(u.getId(), "google")) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("code", "ALREADY_LINKED"));
        }

        GoogleIdToken.Payload payload = googleVerifier.verify(body.getIdToken());
        if (payload == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", "INVALID_TOKEN"));
        }

        String sub = payload.getSubject();
        String email = payload.getEmail();
        boolean googleEmailVerified = Boolean.TRUE.equals(payload.getEmailVerified());
        if (!StringUtils.hasText(sub) || !StringUtils.hasText(email)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", "INVALID_TOKEN_PAYLOAD"));
        }
        if (!googleEmailVerified) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", "GOOGLE_EMAIL_NOT_VERIFIED"));
        }

        // Buscar cualquier fila existente (activa O revocada) por (provider, sub).
        // Necesario porque la UNIQUE constraint fisica es (provider, provider_user_id)
        // sin considerar revoked_at: si el user desvinculo antes, la fila quedo
        // revocada pero sigue ocupando esa clave. Un INSERT nuevo violaria la
        // constraint. Reactivamos en su lugar.
        Optional<OAuthAccount> existing = oauthRepository
                .findByProviderAndProviderUserId("google", sub);

        if (existing.isPresent() && !existing.get().getUserId().equals(u.getId())) {
            // Sub ya vinculado a OTRO user (activo o revocado). No reactivar entre
            // usuarios: el link es (sub Google → cuenta sharemechat), y el sub
            // pertenece a esa cuenta Google concreta.
            log.warn("[OAUTH] intento de vincular sub ya vinculado a otro user userId={} attempted-sub-owner={} revoked={}",
                    u.getId(), existing.get().getUserId(), existing.get().getRevokedAt() != null);
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("code", "SUB_ALREADY_LINKED_TO_OTHER_USER"));
        }

        OAuthAccount link;
        if (existing.isPresent()) {
            // Mismo user re-vinculando su Google previo → reactivar.
            link = existing.get();
            link.setRevokedAt(null);
            link.setEmailAtSignup(email.trim().toLowerCase());
            link.setGoogleHd((String) payload.get("hd"));
            link.setPictureUrl((String) payload.get("picture"));
            link.setLastUsedAt(LocalDateTime.now());
            log.info("[OAUTH] relink ok (reactivated revoked) userId={} provider=google sub=***{}", u.getId(),
                    sub.length() >= 6 ? sub.substring(sub.length() - 6) : sub);
        } else {
            // Primera vez que este sub aparece en BD → insert nuevo.
            link = new OAuthAccount();
            link.setUserId(u.getId());
            link.setProvider("google");
            link.setProviderUserId(sub);
            link.setEmailAtSignup(email.trim().toLowerCase());
            link.setGoogleHd((String) payload.get("hd"));
            link.setPictureUrl((String) payload.get("picture"));
            link.setLastUsedAt(LocalDateTime.now());
            log.info("[OAUTH] link ok userId={} provider=google sub=***{}", u.getId(),
                    sub.length() >= 6 ? sub.substring(sub.length() - 6) : sub);
        }
        oauthRepository.save(link);

        return ResponseEntity.ok(Map.of("linked", true));
    }

    // =========================================================
    // DELETE /api/users/me/oauth/google
    // =========================================================
    @DeleteMapping("/oauth/google")
    @Transactional
    public ResponseEntity<?> unlinkGoogle(Authentication auth) {
        User u = resolveUser(auth);
        if (u == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        // Impedir unlink si el user no tiene password (quedaria sin metodo de login).
        boolean hasPassword = u.getPassword() != null && !u.getPassword().isBlank();
        if (!hasPassword) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "code", "NEEDS_PASSWORD_FIRST",
                            "message", "Establece una contraseña antes de desvincular Google, o perderás el acceso."
                    ));
        }

        List<OAuthAccount> links = oauthRepository.findByUserIdAndRevokedAtIsNull(u.getId());
        boolean anyRevoked = false;
        for (OAuthAccount l : links) {
            if ("google".equals(l.getProvider())) {
                l.setRevokedAt(LocalDateTime.now());
                oauthRepository.save(l);
                anyRevoked = true;
            }
        }
        if (!anyRevoked) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("code", "NOT_LINKED"));
        }

        log.info("[OAUTH] unlink ok userId={} provider=google", u.getId());
        return ResponseEntity.ok(Map.of("unlinked", true));
    }

    // =========================================================
    // POST /api/users/me/password/initial
    // =========================================================
    @PostMapping("/password/initial")
    @Transactional
    public ResponseEntity<?> setInitialPassword(
            @RequestBody @Valid SetInitialPasswordRequest body,
            Authentication auth
    ) {
        User u = resolveUser(auth);
        if (u == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        // Solo permitido si el user NO tiene password (Google-only).
        boolean hasPassword = u.getPassword() != null && !u.getPassword().isBlank();
        if (hasPassword) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "code", "PASSWORD_ALREADY_SET",
                            "message", "Ya tienes contraseña. Usa el flujo de cambio de contraseña o el de recuperación."
                    ));
        }

        try {
            userService.updatePassword(u.getId(), body.getNewPassword());
        } catch (UserNotFoundException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        log.info("[OAUTH] initial password set userId={}", u.getId());
        return ResponseEntity.ok(Map.of("passwordSet", true));
    }

    // =========================================================
    // HELPERS
    // =========================================================
    private User resolveUser(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        return userService.findByEmail(auth.getName());
    }
}
