package com.sharemechat.controller;

import com.sharemechat.dto.UserLoginDTO;
import com.sharemechat.entity.RefreshToken;
import com.sharemechat.entity.User;
import com.sharemechat.repository.RefreshTokenRepository;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtUtil jwtUtil;
    private final UserService userService;
    private final RefreshTokenRepository refreshRepo;

    @Value("${auth.cookieDomain}")
    private String cookieDomain;

    @Value("${auth.secureCookies:true}")
    private boolean secureCookies;

    public AuthController(
            JwtUtil jwtUtil,
            UserService userService,
            RefreshTokenRepository refreshRepo
    ) {
        this.jwtUtil = jwtUtil;
        this.userService = userService;
        this.refreshRepo = refreshRepo;
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

        User u = userService.authenticateAndLoadUser(dto);

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
        rt.setIpAddress(req.getRemoteAddr());
        rt.setUserAgent(req.getHeader("User-Agent"));

        refreshRepo.save(rt);

        setAccessCookie(res, access, 15 * 60);
        setRefreshCookie(res, refreshRaw, 14 * 24 * 3600);

        return ResponseEntity.ok().build();
    }

    // =========================================================
    // REFRESH
    // =========================================================

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletResponse res
    ) {

        if (refreshToken == null) {
            return ResponseEntity.status(401).build();
        }

        String hash = sha256(refreshToken);

        RefreshToken stored = refreshRepo.findByTokenHash(hash)
                .orElse(null);

        if (stored == null ||
                stored.getRevokedAt() != null ||
                stored.getExpiresAt().isBefore(LocalDateTime.now())) {

            return ResponseEntity.status(401).build();
        }

        User u = userService.findById(stored.getUserId());

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
                .path("/api/auth/refresh")
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
}