package com.sharemechat.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.constants.AuthRiskConstants;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.UserLoginDTO;
import com.sharemechat.entity.RefreshToken;
import com.sharemechat.entity.User;
import com.sharemechat.exception.CountryBlockedException;
import com.sharemechat.exception.InvalidCredentialsException;
import com.sharemechat.repository.RefreshTokenRepository;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.ApiRateLimitService;
import com.sharemechat.service.AuthRiskContext;
import com.sharemechat.service.AuthRiskService;
import com.sharemechat.service.ConsentService;
import com.sharemechat.service.CountryAccessService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtUtil jwtUtil;
    private final UserService userService;
    private final RefreshTokenRepository refreshRepo;
    private final ApiRateLimitService rateLimitService;
    private final CountryAccessService countryAccessService;
    private final ConsentService consentService;
    private final AuthRiskService authRiskService;

    @Value("${auth.cookieDomain}")
    private String cookieDomain;

    @Value("${auth.secureCookies:true}")
    private boolean secureCookies;

    public AuthController(
            JwtUtil jwtUtil,
            UserService userService,
            RefreshTokenRepository refreshRepo,
            ApiRateLimitService rateLimitService,
            CountryAccessService countryAccessService,
            ConsentService consentService,
            AuthRiskService authRiskService
    ) {
        this.jwtUtil = jwtUtil;
        this.userService = userService;
        this.refreshRepo = refreshRepo;
        this.rateLimitService = rateLimitService;
        this.countryAccessService = countryAccessService;
        this.consentService = consentService;
        this.authRiskService = authRiskService;
    }

    // =========================================================
    // LOGIN
    // =========================================================

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody UserLoginDTO dto,
            HttpServletRequest req,
            HttpServletResponse res
    ) {
        String consentId = readConsentIdCookie(req);
        if (!consentService.hasGuestAgeGate(consentId)) {
            return ResponseEntity.status(403).body("Debes confirmar antes que eres mayor de 18 años");
        }

        rateLimitService.checkLoginEmail(dto.getEmail());
        countryAccessService.assertAllowed(req);

        String ip = IpConfig.getClientIp(req);
        String userAgent = req.getHeader("User-Agent");
        AuthRiskContext riskCtx = authRiskService.buildContext(
                ip,
                userAgent,
                dto.getEmail(),
                null,
                AuthRiskConstants.Channels.PRODUCT
        );
        authRiskService.record(AuthRiskConstants.Events.LOGIN_ATTEMPT, riskCtx);

        if (authRiskService.isEmailBlocked(riskCtx)) {
            authRiskService.record(AuthRiskConstants.Events.LOGIN_FAILURE, riskCtx);
            throw new InvalidCredentialsException("Credenciales inválidas");
        }

        User u;
        try {
            u = userService.authenticateAndLoadUser(dto);
        } catch (InvalidCredentialsException ex) {
            authRiskService.record(AuthRiskConstants.Events.LOGIN_FAILURE, riskCtx);
            throw ex;
        }

        String access = jwtUtil.generateAccessToken(
                u.getEmail(),
                u.getRole(),
                u.getId()
        );

        String refreshRaw = jwtUtil.generateRefreshToken();
        String hash = sha256(refreshRaw);

        RefreshToken rt = new RefreshToken();
        rt.setUserId(u.getId());
        rt.setTokenHash(hash);
        rt.setExpiresAt(LocalDateTime.now().plusDays(14));
        rt.setIpAddress(ip);
        rt.setUserAgent(userAgent);

        refreshRepo.save(rt);

        authRiskService.record(AuthRiskConstants.Events.LOGIN_SUCCESS, riskCtx.withUserId(u.getId()));

        setAccessCookie(res, access, 15 * 60);
        setRefreshCookie(res, refreshRaw, 14 * 24 * 3600);
        consentService.recordGuestConsentLink(req, consentId, u.getId(), "age_gate_link_login", "/api/auth/login");

        return ResponseEntity.ok().build();
    }

    // =========================================================
    // REFRESH
    // =========================================================

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletRequest req,
            HttpServletResponse res
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            deleteCookie(res, "access_token");
            deleteCookie(res, "refresh_token");
            return ResponseEntity.status(401).build();
        }

        String hash = sha256(refreshToken);

        RefreshToken stored = refreshRepo.findByTokenHash(hash).orElse(null);

        if (stored == null ||
                stored.getRevokedAt() != null ||
                stored.getExpiresAt().isBefore(LocalDateTime.now())) {

            deleteCookie(res, "access_token");
            deleteCookie(res, "refresh_token");
            return ResponseEntity.status(401).build();
        }

        rateLimitService.checkRefreshUser(stored.getUserId());

        try {
            countryAccessService.assertAllowed(req);
        } catch (CountryBlockedException ex) {
            refreshRepo.deleteByUserId(stored.getUserId());
            deleteCookie(res, "access_token");
            deleteCookie(res, "refresh_token");
            throw ex;
        }

        User u = userService.findById(stored.getUserId());

        String accountStatus = u.getAccountStatus();
        if (accountStatus == null || accountStatus.isBlank()) {
            accountStatus = Constants.AccountStatuses.ACTIVE;
        } else {
            accountStatus = accountStatus.trim().toUpperCase(Locale.ROOT);
        }

        if (u == null ||
                Boolean.TRUE.equals(u.getUnsubscribe()) ||
                !Constants.AccountStatuses.ACTIVE.equals(accountStatus)) {

            refreshRepo.deleteByUserId(stored.getUserId());
            deleteCookie(res, "access_token");
            deleteCookie(res, "refresh_token");
            return ResponseEntity.status(401).build();
        }

        String newAccess = jwtUtil.generateAccessToken(
                u.getEmail(),
                u.getRole(),
                u.getId()
        );

        String newRefreshRaw = jwtUtil.generateRefreshToken();
        String newHash = sha256(newRefreshRaw);

        RefreshToken next = new RefreshToken();
        next.setUserId(u.getId());
        next.setTokenHash(newHash);
        next.setExpiresAt(LocalDateTime.now().plusDays(14));
        next.setIpAddress(stored.getIpAddress());
        next.setUserAgent(stored.getUserAgent());

        refreshRepo.save(next);

        stored.setRevokedAt(LocalDateTime.now());
        stored.setReplacedBy(next);
        refreshRepo.save(stored);

        setAccessCookie(res, newAccess, 15 * 60);
        setRefreshCookie(res, newRefreshRaw, 14 * 24 * 3600);

        return ResponseEntity.ok().build();
    }

    // =========================================================
    // LOGOUT
    // =========================================================

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @CookieValue(name = "refresh_token", required = false) String refresh,
            HttpServletResponse res
    ) {

        if (refresh != null) {
            refreshRepo.findByTokenHash(sha256(refresh))
                    .ifPresent(rt -> {
                        rt.setRevokedAt(LocalDateTime.now());
                        refreshRepo.save(rt);
                    });
        }

        deleteCookie(res, "access_token");
        deleteCookie(res, "refresh_token");

        return ResponseEntity.ok().build();
    }

    // =========================================================
    // COOKIE HELPERS
    // =========================================================

    private void setAccessCookie(HttpServletResponse res, String value, int seconds) {
        ResponseCookie cookie = ResponseCookie.from("access_token", value)
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("None")
                .path("/")
                .domain(cookieDomain)
                .maxAge(seconds)
                .build();

        res.addHeader("Set-Cookie", cookie.toString());
    }

    private void setRefreshCookie(HttpServletResponse res, String value, int seconds) {
        ResponseCookie cookie = ResponseCookie.from("refresh_token", value)
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("None")
                .path("/")
                .domain(cookieDomain)
                .maxAge(seconds)
                .build();

        res.addHeader("Set-Cookie", cookie.toString());
    }

    private void deleteCookie(HttpServletResponse res, String name) {
        ResponseCookie cookie = ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("None")
                .path("/")
                .domain(cookieDomain)
                .maxAge(0)
                .build();

        res.addHeader("Set-Cookie", cookie.toString());
    }

    // =========================================================
    // HASH
    // =========================================================

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
}