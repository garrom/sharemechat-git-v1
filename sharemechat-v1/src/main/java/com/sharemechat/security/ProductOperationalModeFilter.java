package com.sharemechat.security;

import com.sharemechat.config.ProductOperationalProperties.Mode;
import com.sharemechat.constants.ProductOperationalConstants;
import com.sharemechat.service.ProductOperationalModeService;
import com.sharemechat.service.ProductOperationalModeService.Decision;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filtro REST de Product Operational Mode (ADR-009).
 *
 * Se registra en SecurityConfig DESPUÉS de CookieJwtAuthenticationFilter para
 * poder leer el Authentication ya resuelto.
 *
 * Resuelve dos datos a partir de la sesión y los pasa al servicio:
 *  - userId: extraído del claim "userId" del JWT en la cookie access_token.
 *  - backofficeSession: detectado por authorities ROLE_ADMIN, BO_ROLE_*
 *    o BO_PERMISSION_*. Solo se usa para mantener vivo /api/auth/refresh
 *    de admin durante modos restrictivos.
 *
 * - Si la decisión es ALLOW, continúa la cadena.
 * - Si la decisión es BLOCK, escribe HTTP 503 con body JSON estable, añade el
 *   header X-Product-Mode cuando aplica y, si el path es /api/auth/refresh y
 *   la sesión NO es backoffice, borra cookies access_token y refresh_token.
 * - Las cookies de backoffice nunca se tocan.
 * - No loguea passwords, emails, tokens ni cookies.
 */
public class ProductOperationalModeFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ProductOperationalModeFilter.class);

    private static final String PATH_REFRESH = "/api/auth/refresh";
    private static final String COOKIE_ACCESS = "access_token";
    private static final String COOKIE_REFRESH = "refresh_token";

    private final ProductOperationalModeService service;
    private final JwtUtil jwtUtil;
    private final String cookieDomain;
    private final boolean secureCookies;

    public ProductOperationalModeFilter(ProductOperationalModeService service,
                                        JwtUtil jwtUtil,
                                        String cookieDomain,
                                        boolean secureCookies) {
        this.service = service;
        this.jwtUtil = jwtUtil;
        this.cookieDomain = cookieDomain;
        this.secureCookies = secureCookies;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String method = request.getMethod();
        String path = request.getRequestURI();

        boolean backofficeSession = isBackoffice(auth);

        // Excepción acotada: refresh de sesión backoffice. Se resuelve aquí
        // y no en el service para que el service quede libre de inspección
        // de authorities. Sin esta excepción, las sesiones admin morirían
        // a los 15 min del access token en cualquier modo restrictivo.
        if (PATH_REFRESH.equals(path) && backofficeSession) {
            chain.doFilter(request, response);
            return;
        }

        // Optimización: solo extraer userId del JWT si la decisión puede
        // depender de él. En modo OPEN, o sin allowlist configurada, el
        // userId no aporta nada y nos ahorramos un parse JWT por request.
        Long userId = null;
        if (service.currentMode() != Mode.OPEN && service.hasAllowlist()) {
            userId = extractUserIdSafe(request);
        }

        Decision decision = service.decideForRequest(auth, method, path, userId);

        if (decision.isAllow()) {
            chain.doFilter(request, response);
            return;
        }

        boolean isRefresh = PATH_REFRESH.equals(path);
        if (isRefresh && !backofficeSession) {
            clearCookie(response, COOKIE_ACCESS);
            clearCookie(response, COOKIE_REFRESH);
        }

        log.warn("{} path={} method={} mode={} decision={} reason={}",
                ProductOperationalConstants.LOG_PREFIX,
                path,
                method,
                decision.getMode() == null ? "-" : decision.getMode(),
                decision.getCode(),
                decision.getReason());

        writeBlockedResponse(response, decision);
    }

    private void writeBlockedResponse(HttpServletResponse response, Decision decision) throws IOException {
        response.setStatus(HttpStatus.SERVICE_UNAVAILABLE.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        if (decision.getMode() != null) {
            response.setHeader(ProductOperationalConstants.HEADER_PRODUCT_MODE, decision.getMode());
        }

        StringBuilder body = new StringBuilder(160);
        body.append('{');
        appendJsonField(body, "code", decision.getCode());
        body.append(',');
        appendJsonField(body, "scope", decision.getScope());
        if (decision.getMode() != null) {
            body.append(',');
            appendJsonField(body, "mode", decision.getMode());
        }
        body.append(',');
        appendJsonField(body, "message", decision.getMessage());
        body.append('}');

        response.getWriter().write(body.toString());
    }

    private void appendJsonField(StringBuilder sb, String key, String value) {
        sb.append('"').append(key).append('"').append(':');
        if (value == null) {
            sb.append("null");
            return;
        }
        sb.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
    }

    private void clearCookie(HttpServletResponse response, String name) {
        ResponseCookie cookie = ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("None")
                .path("/")
                .domain(cookieDomain)
                .maxAge(0)
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    /**
     * Sesión backoffice: ROLE_ADMIN o cualquier authority de prefijo
     * backoffice (cubre ADMIN, SUPPORT y AUDIT vía BO_ROLE_* y BO_PERMISSION_*).
     * Usado únicamente para la excepción de /api/auth/refresh.
     */
    private boolean isBackoffice(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return false;
        if (auth.getAuthorities() == null) return false;
        for (GrantedAuthority a : auth.getAuthorities()) {
            if (a == null) continue;
            String s = a.getAuthority();
            if (s == null) continue;
            if (s.equals("ROLE_ADMIN")) return true;
            if (s.startsWith(BackofficeAuthorities.BO_ROLE_PREFIX)) return true;
            if (s.startsWith(BackofficeAuthorities.BO_PERMISSION_PREFIX)) return true;
        }
        return false;
    }

    /**
     * Extrae userId del JWT en la cookie access_token. Si no hay cookie, está
     * vacía o el token es inválido o expirado, devuelve null. No propaga
     * excepciones: el gate funciona aunque el token no sea legible.
     */
    private Long extractUserIdSafe(HttpServletRequest request) {
        String token = readCookie(request, COOKIE_ACCESS);
        if (token == null) return null;
        try {
            if (!jwtUtil.isTokenValid(token)) return null;
            return jwtUtil.extractUserId(token);
        } catch (Exception ex) {
            return null;
        }
    }

    private String readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) {
                String v = c.getValue();
                return (v == null || v.isBlank()) ? null : v;
            }
        }
        return null;
    }
}
