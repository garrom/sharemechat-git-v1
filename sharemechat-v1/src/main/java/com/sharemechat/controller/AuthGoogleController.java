package com.sharemechat.controller;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.sharemechat.config.IpConfig;
import com.sharemechat.constants.AuthRiskConstants;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.GoogleAuthRequestDTO;
import com.sharemechat.entity.OAuthAccount;
import com.sharemechat.entity.RefreshToken;
import com.sharemechat.entity.User;
import com.sharemechat.exception.InvalidCredentialsException;
import com.sharemechat.repository.OAuthAccountRepository;
import com.sharemechat.repository.RefreshTokenRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.AccountDormancyService;
import com.sharemechat.service.ApiRateLimitService;
import com.sharemechat.service.AuthRiskContext;
import com.sharemechat.service.AuthRiskService;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.ConsentService;
import com.sharemechat.service.CountryAccessService;
import com.sharemechat.service.GoogleIdTokenVerifierService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Login federado con Sign in with Google (Google Identity Services).
 *
 * <p>Simetrico a {@link AuthController#login}: replica el pipeline completo
 * (consent age-gate, rate-limit, country-access, auth-risk, backoffice
 * allowlist, dormancy tracking, cookies JWT) pero autenticando via ID
 * token de Google en vez de email+password.
 *
 * <p>Fase 1 (soft-launch): scope acotado al rol CLIENT unicamente. Los
 * roles MODEL y MASTER siguen usando email+password + KYC pesado
 * (patron fan/creator de OnlyFans, ver estudio de login Google 2026-08-05).
 * Extension a MODEL en fase futura si los datos de adopcion justifican.
 *
 * <p>Politica de account linking hibrida (P2/P3) para email colision:
 * auto-link SOLO cuando el {@code email_verified=true} en Google Y el
 * user existente tenia {@code email_verified_at} poblado. Si el user
 * existente no habia verificado su email, se rechaza con 409 y el usuario
 * debe primero loguearse por password y vincular Google desde su perfil.
 * Previene account takeover documentado por Clerk/Ory/WorkOS.
 */
@RestController
@RequestMapping("/api/auth/google")
public class AuthGoogleController {

    private static final Logger log = LoggerFactory.getLogger(AuthGoogleController.class);

    // Intents soportados en Fase 1
    private static final String INTENT_LOGIN = "login";
    private static final String INTENT_REGISTER_CLIENT = "register-client";

    private final GoogleIdTokenVerifierService googleVerifier;
    private final UserRepository userRepository;
    private final OAuthAccountRepository oauthRepository;
    private final RefreshTokenRepository refreshRepo;
    private final JwtUtil jwtUtil;
    private final ApiRateLimitService rateLimitService;
    private final CountryAccessService countryAccessService;
    private final ConsentService consentService;
    private final AuthRiskService authRiskService;
    private final BackofficeAccessService backofficeAccessService;
    private final AccountDormancyService dormancyService;

    @Value("${auth.cookieDomain}")
    private String cookieDomain;

    @Value("${auth.secureCookies:true}")
    private boolean secureCookies;

    public AuthGoogleController(
            GoogleIdTokenVerifierService googleVerifier,
            UserRepository userRepository,
            OAuthAccountRepository oauthRepository,
            RefreshTokenRepository refreshRepo,
            JwtUtil jwtUtil,
            ApiRateLimitService rateLimitService,
            CountryAccessService countryAccessService,
            ConsentService consentService,
            AuthRiskService authRiskService,
            BackofficeAccessService backofficeAccessService,
            AccountDormancyService dormancyService
    ) {
        this.googleVerifier = googleVerifier;
        this.userRepository = userRepository;
        this.oauthRepository = oauthRepository;
        this.refreshRepo = refreshRepo;
        this.jwtUtil = jwtUtil;
        this.rateLimitService = rateLimitService;
        this.countryAccessService = countryAccessService;
        this.consentService = consentService;
        this.authRiskService = authRiskService;
        this.backofficeAccessService = backofficeAccessService;
        this.dormancyService = dormancyService;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> googleAuth(
            @RequestBody @Valid GoogleAuthRequestDTO body,
            @CookieValue(name = "consent_id", required = false) String consentIdCookie,
            HttpServletRequest req,
            HttpServletResponse res
    ) {
        // 0) Verificar que el servicio esta configurado (client-id poblado).
        if (!googleVerifier.isConfigured()) {
            log.warn("[AUTH-GOOGLE] endpoint invocado con auth.google.client-id vacio.");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("code", "GOOGLE_AUTH_UNAVAILABLE"));
        }

        // 1) Age gate (mismo que login clasico).
        String consentId = readConsentIdCookie(req);
        if (!consentService.hasGuestAgeGate(consentId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Debes confirmar antes que eres mayor de 18 años");
        }

        // 2) Rate-limit por IP (misma politica que login clasico).
        String ip = IpConfig.getClientIp(req);
        rateLimitService.checkLoginIp(ip);

        // 3) Country access.
        countryAccessService.assertAllowed(req);

        String userAgent = req.getHeader("User-Agent");

        // 4) Verificar el ID token de Google (JWKS + iss + aud + exp).
        GoogleIdToken.Payload payload = googleVerifier.verify(body.getIdToken());
        if (payload == null) {
            AuthRiskContext preRiskCtx = authRiskService.buildContext(
                    ip, userAgent, null, null, AuthRiskConstants.Channels.PRODUCT_GOOGLE);
            authRiskService.record(AuthRiskConstants.Events.LOGIN_ATTEMPT, preRiskCtx);
            authRiskService.record(AuthRiskConstants.Events.LOGIN_FAILURE, preRiskCtx);
            throw new InvalidCredentialsException("ID token invalido");
        }

        String sub = payload.getSubject();
        String email = normalizeEmail(payload.getEmail());
        Boolean emailVerifiedClaim = payload.getEmailVerified();
        boolean googleEmailVerified = Boolean.TRUE.equals(emailVerifiedClaim);
        String pictureUrl = (String) payload.get("picture");
        String hd = (String) payload.get("hd");

        if (!StringUtils.hasText(sub) || !StringUtils.hasText(email)) {
            log.warn("[AUTH-GOOGLE] payload sin sub o email; sub={} emailPresent={}", sub, email != null);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // 5) AuthRisk context ahora con email conocido.
        AuthRiskContext riskCtx = authRiskService.buildContext(
                ip, userAgent, email, null, AuthRiskConstants.Channels.PRODUCT_GOOGLE);
        authRiskService.record(AuthRiskConstants.Events.LOGIN_ATTEMPT, riskCtx);

        String intent = body.getIntent() == null ? "" : body.getIntent().trim().toLowerCase(Locale.ROOT);
        if (!INTENT_LOGIN.equals(intent) && !INTENT_REGISTER_CLIENT.equals(intent)) {
            return ResponseEntity.badRequest().body(Map.of("code", "INVALID_INTENT"));
        }

        // 6) Resolver o crear User + OAuthAccount.
        User user;
        Optional<OAuthAccount> linked = oauthRepository
                .findByProviderAndProviderUserIdAndRevokedAtIsNull("google", sub);

        if (linked.isPresent()) {
            // Camino A: usuario ya vinculado con Google. Login directo.
            user = userRepository.findById(linked.get().getUserId()).orElse(null);
            if (user == null) {
                log.error("[AUTH-GOOGLE] oauth_account huerfano id={} userId={}",
                        linked.get().getId(), linked.get().getUserId());
                authRiskService.record(AuthRiskConstants.Events.LOGIN_FAILURE, riskCtx);
                throw new InvalidCredentialsException("Cuenta invalida");
            }
            // Validar user antes de tocar el oauth_account (rol, backoffice,
            // status/unsubscribe). Devuelve response explicita si esta inactivo.
            Optional<ResponseEntity<?>> block = validateAndBlockIfInactive(user, riskCtx);
            if (block.isPresent()) return block.get();
            // Actualiza last_used_at (best-effort).
            linked.get().setLastUsedAt(LocalDateTime.now());
            oauthRepository.save(linked.get());
        } else {
            Optional<User> byEmail = userRepository.findByEmail(email);
            if (byEmail.isPresent()) {
                // Camino B: user existente por email. Politica linking hibrida P2/P3.
                user = byEmail.get();
                boolean userEmailVerified = user.getEmailVerifiedAt() != null;
                if (googleEmailVerified && userEmailVerified) {
                    // Validar ANTES del save para no dejar oauth_accounts
                    // huerfanos si el user esta inactivo/unsubscribed. Antes
                    // el rollback transaccional los limpiaba, pero fiar la
                    // integridad al rollback es fragil (basta con capturar
                    // la excepcion aguas arriba para dejar huella).
                    Optional<ResponseEntity<?>> block = validateAndBlockIfInactive(user, riskCtx);
                    if (block.isPresent()) return block.get();
                    // Auto-link seguro.
                    OAuthAccount link = newLink(user.getId(), sub, email, hd, pictureUrl);
                    oauthRepository.save(link);
                    log.info("[AUTH-GOOGLE] auto-link userId={} sub=***{}", user.getId(), lastChars(sub, 6));
                } else {
                    // Sin auto-link: exige login previo con password para vincular.
                    log.info("[AUTH-GOOGLE] email colision sin auto-link userId={} googleEmailVerified={} userEmailVerified={}",
                            user.getId(), googleEmailVerified, userEmailVerified);
                    authRiskService.record(AuthRiskConstants.Events.LOGIN_FAILURE, riskCtx.withUserId(user.getId()));
                    return ResponseEntity.status(HttpStatus.CONFLICT)
                            .body(Map.of(
                                    "code", "EMAIL_COLLISION_NEEDS_PASSWORD",
                                    "message", "Ya existe una cuenta con este email. Entra con tu contraseña y vincula Google desde tu perfil."
                            ));
                }
            } else {
                // Camino C: user nuevo. Solo permitido en register-client.
                if (!INTENT_REGISTER_CLIENT.equals(intent)) {
                    log.info("[AUTH-GOOGLE] intent=login sin user existente para email=***{}", lastCharsSafe(email, 4));
                    authRiskService.record(AuthRiskConstants.Events.LOGIN_FAILURE, riskCtx);
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(Map.of(
                                    "code", "NO_ACCOUNT_FOR_EMAIL",
                                    "message", "No tienes cuenta. Regístrate con Google desde el formulario de registro."
                            ));
                }
                if (!googleEmailVerified) {
                    // Poco probable con Google (siempre verifica email) pero defensa.
                    log.warn("[AUTH-GOOGLE] Google reporta email_verified=false; rechazo registro.");
                    authRiskService.record(AuthRiskConstants.Events.LOGIN_FAILURE, riskCtx);
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("code", "GOOGLE_EMAIL_NOT_VERIFIED"));
                }
                user = createClientUser(email, sub, body.getLocale(), req);
                OAuthAccount link = newLink(user.getId(), sub, email, hd, pictureUrl);
                oauthRepository.save(link);
                log.info("[AUTH-GOOGLE] user CLIENT creado userId={} via google sub=***{}",
                        user.getId(), lastChars(sub, 6));
            }
        }

        // 7) Validaciones post-carga.
        // Camino A y B ya validaron ANTES de tocar oauth_account. Camino C
        // (user recien creado) no puede fallar aqui — es ACTIVE por defecto.
        // Se llama defensivamente para consistencia y por si alguien reordena
        // el flujo en el futuro. Es idempotente y barato.
        Optional<ResponseEntity<?>> finalBlock = validateAndBlockIfInactive(user, riskCtx);
        if (finalBlock.isPresent()) return finalBlock.get();

        // 8) Emitir cookies JWT.
        String access = jwtUtil.generateAccessToken(user.getEmail(), user.getRole(), user.getId());
        String refreshRaw = jwtUtil.generateRefreshToken();
        String hash = sha256(refreshRaw);

        RefreshToken rt = new RefreshToken();
        rt.setUserId(user.getId());
        rt.setTokenHash(hash);
        rt.setExpiresAt(LocalDateTime.now().plusDays(14));
        rt.setIpAddress(ip);
        rt.setUserAgent(userAgent);
        refreshRepo.save(rt);

        authRiskService.record(AuthRiskConstants.Events.LOGIN_SUCCESS, riskCtx.withUserId(user.getId()));
        dormancyService.recordActivity(user.getId());

        setAccessCookie(res, access, 15 * 60);
        setRefreshCookie(res, refreshRaw, 14 * 24 * 3600);
        consentService.recordGuestConsentLink(req, consentId, user.getId(),
                "age_gate_link_google_auth", "/api/auth/google");

        return ResponseEntity.ok().build();
    }

    // =========================================================
    // HELPERS
    // =========================================================

    /**
     * Valida que el usuario cargado pueda autenticarse por el endpoint publico
     * de Google. Se llama ANTES de tocar oauth_account para no dejar links
     * huerfanos si el user esta inactivo/unsubscribed.
     *
     * Devuelve:
     * - Optional.empty() si el usuario esta OK para continuar.
     * - Optional.of(response) con codigo ACCOUNT_INACTIVE si esta unsubscribed
     *   o su account_status no es ACTIVE. El frontend distingue este caso del
     *   401 generico "token invalido".
     *
     * Lanza InvalidCredentialsException (401) para casos de seguridad donde
     * NO queremos filtrar info al cliente (rol invalido, backoffice intentando
     * login publico).
     */
    private Optional<ResponseEntity<?>> validateAndBlockIfInactive(
            User user,
            AuthRiskContext riskCtx
    ) {
        String role = user.getRole();
        if (!Constants.Roles.USER.equals(role)
                && !Constants.Roles.CLIENT.equals(role)
                && !Constants.Roles.MODEL.equals(role)
                && !Constants.Roles.MASTER.equals(role)) {
            log.warn("[AUTH-GOOGLE] rol no permitido en endpoint publico userId={} role={}",
                    user.getId(), role);
            authRiskService.record(AuthRiskConstants.Events.LOGIN_FAILURE, riskCtx.withUserId(user.getId()));
            throw new InvalidCredentialsException("Credenciales inválidas");
        }

        BackofficeAccessService.BackofficeAccessProfile profile =
                backofficeAccessService.loadProfile(user.getId(), user.getRole());
        if (!profile.roles().isEmpty()) {
            log.warn("[AUTH-GOOGLE] user con roles backoffice intentando login publico userId={}", user.getId());
            authRiskService.record(AuthRiskConstants.Events.LOGIN_FAILURE, riskCtx.withUserId(user.getId()));
            throw new InvalidCredentialsException("Credenciales inválidas");
        }

        String accountStatus = user.getAccountStatus();
        if (accountStatus == null || accountStatus.isBlank()) {
            accountStatus = Constants.AccountStatuses.ACTIVE;
        } else {
            accountStatus = accountStatus.trim().toUpperCase(Locale.ROOT);
        }
        if (Boolean.TRUE.equals(user.getUnsubscribe())
                || !Constants.AccountStatuses.ACTIVE.equals(accountStatus)) {
            log.info("[AUTH-GOOGLE] usuario inactivo/unsubscribed userId={} status={} unsubscribe={}",
                    user.getId(), accountStatus, user.getUnsubscribe());
            authRiskService.record(AuthRiskConstants.Events.LOGIN_FAILURE, riskCtx.withUserId(user.getId()));
            return Optional.of(ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                            "code", "ACCOUNT_INACTIVE",
                            "message", "Esta cuenta no está activa. Contacta con soporte."
                    )));
        }
        return Optional.empty();
    }

    private User createClientUser(String email, String sub, String locale, HttpServletRequest req) {
        User u = new User();
        u.setEmail(email);
        // Nickname derivado del email + sufijo del sub Google (probabilisticamente
        // unico, evita query O(N) sobre users). Formato: "juan-abc123".
        // El usuario puede editarlo desde su perfil despues.
        String baseNick = email.substring(0, email.indexOf('@')).toLowerCase(Locale.ROOT);
        String tail = sub.length() >= 6 ? sub.substring(sub.length() - 6) : sub;
        u.setNickname(baseNick + "-" + tail);
        u.setPassword(null); // Google-only por ahora.
        u.setRole(Constants.Roles.USER);
        u.setUserType(Constants.UserTypes.FORM_CLIENT);
        u.setUiLocale(sanitizeLocale(locale));
        u.setConfirAdult(true); // el consent age-gate lo garantiza en la ruta anterior
        u.setEmailVerifiedAt(LocalDateTime.now()); // Google ya verifica email
        u.setRegistIp(IpConfig.getClientIp(req));
        u.setIsActive(true);
        u.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        return userRepository.save(u);
    }

    private OAuthAccount newLink(Long userId, String sub, String email, String hd, String pictureUrl) {
        OAuthAccount link = new OAuthAccount();
        link.setUserId(userId);
        link.setProvider("google");
        link.setProviderUserId(sub);
        link.setEmailAtSignup(email);
        link.setGoogleHd(hd);
        link.setPictureUrl(pictureUrl);
        link.setLastUsedAt(LocalDateTime.now());
        return link;
    }

    private String sanitizeLocale(String locale) {
        if (!StringUtils.hasText(locale)) return "es";
        String trimmed = locale.trim().toLowerCase(Locale.ROOT);
        if (trimmed.length() > 5) trimmed = trimmed.substring(0, 5);
        return trimmed;
    }

    private String normalizeEmail(String email) {
        if (email == null) return null;
        return email.trim().toLowerCase(Locale.ROOT);
    }

    // =========================================================
    // COOKIE HELPERS (identicos a AuthController)
    // =========================================================
    private void setAccessCookie(HttpServletResponse res, String value, int seconds) {
        ResponseCookie cookie = ResponseCookie.from("access_token", value)
                .httpOnly(true).secure(secureCookies).sameSite("None").path("/")
                .domain(cookieDomain).maxAge(seconds).build();
        res.addHeader("Set-Cookie", cookie.toString());
    }

    private void setRefreshCookie(HttpServletResponse res, String value, int seconds) {
        ResponseCookie cookie = ResponseCookie.from("refresh_token", value)
                .httpOnly(true).secure(secureCookies).sameSite("None").path("/")
                .domain(cookieDomain).maxAge(seconds).build();
        res.addHeader("Set-Cookie", cookie.toString());
    }

    private String sha256(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(raw.getBytes()));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
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

    private static String lastChars(String s, int n) {
        if (s == null) return "";
        if (s.length() <= n) return s;
        return s.substring(s.length() - n);
    }

    private static String lastCharsSafe(String s, int n) {
        return lastChars(s, n);
    }
}
