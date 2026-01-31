package com.sharemechat.security;

import com.sharemechat.config.IpConfig;
import com.sharemechat.service.ApiRateLimitService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class ApiRateLimitFilter extends OncePerRequestFilter {

    private final ApiRateLimitService rateLimitService;

    public ApiRateLimitFilter(ApiRateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        String ip = IpConfig.getClientIp(request);

        // LOGIN
        if ("POST".equalsIgnoreCase(method) && "/api/auth/login".equals(path)) {
            // No intentamos parsear JSON aquí para no consumir el body.
            // Protegemos por IP y también por email si lo pasas por header (opcional en el futuro).
            String emailMaybe = request.getHeader("X-Login-Email");
            rateLimitService.checkLogin(ip, emailMaybe);
        }

        // REFRESH (abuso típico)
        if ("POST".equalsIgnoreCase(method) && "/api/auth/refresh".equals(path)) {
            rateLimitService.checkLogin(ip, null);
        }

        // RESET: forgot y reset
        if ("POST".equalsIgnoreCase(method) && "/api/auth/password/forgot".equals(path)) {
            String emailMaybe = request.getHeader("X-Reset-Email");
            rateLimitService.checkPasswordReset(ip, emailMaybe);
        }

        if ("POST".equalsIgnoreCase(method) && "/api/auth/password/reset".equals(path)) {
            rateLimitService.checkPasswordReset(ip, null);
        }

        // REGISTER
        if ("POST".equalsIgnoreCase(method) && path.startsWith("/api/users/register/")) {
            rateLimitService.checkRegister(ip);
        }

        chain.doFilter(request, response);
    }
}
