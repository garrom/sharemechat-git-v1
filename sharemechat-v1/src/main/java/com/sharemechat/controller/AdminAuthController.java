package com.sharemechat.controller;

import com.sharemechat.entity.RefreshToken;
import com.sharemechat.entity.User;
import com.sharemechat.exception.EmailVerificationRequiredException;
import com.sharemechat.repository.RefreshTokenRepository;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.ApiRateLimitService;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.CountryAccessService;
import com.sharemechat.service.EmailVerificationService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;

@RestController
@RequestMapping("/api/admin/auth")
public class AdminAuthController {

    private final JwtUtil jwtUtil;
    private final UserService userService;
    private final RefreshTokenRepository refreshRepo;
    private final ApiRateLimitService rateLimitService;
    private final CountryAccessService countryAccessService;
    private final BackofficeAccessService backofficeAccessService;
    private final EmailVerificationService emailVerificationService;

    @Value("${auth.cookieDomain}")
    private String cookieDomain;

    @Value("${auth.secureCookies:true}")
    private boolean secureCookies;

    public AdminAuthController(
            JwtUtil jwtUtil,
            UserService userService,
            RefreshTokenRepository refreshRepo,
            ApiRateLimitService rateLimitService,
            CountryAccessService countryAccessService,
            BackofficeAccessService backofficeAccessService,
            EmailVerificationService emailVerificationService
    ) {
        this.jwtUtil = jwtUtil;
        this.userService = userService;
        this.refreshRepo = refreshRepo;
        this.rateLimitService = rateLimitService;
        this.countryAccessService = countryAccessService;
        this.backofficeAccessService = backofficeAccessService;
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody com.sharemechat.dto.UserLoginDTO dto,
            HttpServletRequest req,
            HttpServletResponse res
    ) {
        rateLimitService.checkLoginEmail(dto.getEmail());
        countryAccessService.assertAllowed(req);

        User user = userService.authenticateAndLoadUser(dto);

        BackofficeAccessService.BackofficeAccessProfile profile =
                backofficeAccessService.loadProfile(user.getId(), user.getRole());

        if (!hasInternalBackofficeAccess(profile)) {
            return ResponseEntity.status(401).body("Acceso de backoffice denegado");
        }

        if (!emailVerificationService.isEmailVerified(user)) {
            throw new EmailVerificationRequiredException(
                    "Debes validar tu email antes de acceder al backoffice.",
                    "BACKOFFICE",
                    "VERIFY_EMAIL"
            );
        }

        String access = jwtUtil.generateAccessToken(
                user.getEmail(),
                user.getRole(),
                user.getId()
        );

        String refreshRaw = jwtUtil.generateRefreshToken();
        String hash = sha256(refreshRaw);

        RefreshToken rt = new RefreshToken();
        rt.setUserId(user.getId());
        rt.setTokenHash(hash);
        rt.setExpiresAt(LocalDateTime.now().plusDays(14));
        rt.setIpAddress(com.sharemechat.config.IpConfig.getClientIp(req));
        rt.setUserAgent(req.getHeader("User-Agent"));

        refreshRepo.save(rt);

        setAccessCookie(res, access, 15 * 60);
        setRefreshCookie(res, refreshRaw, 14 * 24 * 3600);

        return ResponseEntity.ok().build();
    }

    private boolean hasInternalBackofficeAccess(BackofficeAccessService.BackofficeAccessProfile profile) {
        if (profile == null || profile.roles() == null) {
            return false;
        }
        return profile.roles().contains(BackofficeAuthorities.ROLE_ADMIN)
                || profile.roles().contains(BackofficeAuthorities.ROLE_SUPPORT)
                || profile.roles().contains(BackofficeAuthorities.ROLE_AUDIT);
    }

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

    private String sha256(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(raw.getBytes()));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
