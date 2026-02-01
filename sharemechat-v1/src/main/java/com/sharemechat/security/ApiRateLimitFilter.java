package com.sharemechat.security;

import com.sharemechat.config.IpConfig;
import com.sharemechat.exception.TooManyRequestsException;
import com.sharemechat.service.ApiRateLimitService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class ApiRateLimitFilter extends OncePerRequestFilter {

    private final ApiRateLimitService rateLimitService;

    public ApiRateLimitFilter(ApiRateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        try {
            String path = request.getRequestURI();
            String method = request.getMethod();
            String ip = IpConfig.getClientIp(request);

            // LOGIN
            if ("POST".equalsIgnoreCase(method) && "/api/auth/login".equals(path)) {
                rateLimitService.checkLoginIp(ip);
            }

            // REFRESH
            if ("POST".equalsIgnoreCase(method) && "/api/auth/refresh".equals(path)) {
                rateLimitService.checkRefreshIp(ip);
            }

            // RESET
            if ("POST".equalsIgnoreCase(method) && "/api/auth/password/forgot".equals(path)) {
                rateLimitService.checkPasswordResetIp(ip);
            }
            if ("POST".equalsIgnoreCase(method) && "/api/auth/password/reset".equals(path)) {
                rateLimitService.checkPasswordResetIp(ip);
            }

            // REGISTER
            if ("POST".equalsIgnoreCase(method) && path.startsWith("/api/users/register/")) {
                rateLimitService.checkRegister(ip);
            }

            chain.doFilter(request, response);

        } catch (TooManyRequestsException ex) {
            long retryAfterSec = Math.max(1L, ex.getRetryAfterMs() / 1000L);

            response.resetBuffer();
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfterSec));
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());

            String msg = (ex.getMessage() != null) ? ex.getMessage() : "Demasiadas solicitudes";
            String path = request.getRequestURI();

            // JSON simple (sin depender de ObjectMapper)
            String body = "{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\""
                    + escapeJson(msg) + "\",\"path\":\"" + escapeJson(path) + "\"}";

            response.getWriter().write(body);
            response.flushBuffer();
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
