package com.sharemechat.security;

import com.sharemechat.config.ProductOperationalProperties.Mode;
import com.sharemechat.util.UserRoleUtils;
import com.sharemechat.constants.ProductOperationalConstants;
import com.sharemechat.entity.User;
import com.sharemechat.service.ProductOperationalModeService;
import com.sharemechat.service.ProductOperationalModeService.Decision;
import com.sharemechat.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * Interceptor de handshake para Product Operational Mode (ADR-009).
 *
 * Se registra en WebSocketConfig para /match y /messages. Decide la admisión
 * antes de abrir el socket. Si bloquea, responde 503 sin abrir conexión y
 * añade el header X-Product-Mode.
 *
 * Resuelve userId leyendo la cookie access_token del request HTTP de upgrade
 * y extrayendo el claim "userId" con JwtUtil. No inspecciona authorities:
 * no hay WebSocket de backoffice hoy.
 *
 * Consume la misma lógica que el filtro REST (ProductOperationalModeService).
 */
@Component
public class ProductOperationalModeWsInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(ProductOperationalModeWsInterceptor.class);

    private static final String COOKIE_ACCESS = "access_token";

    private final ProductOperationalModeService service;
    private final JwtUtil jwtUtil;
    private final UserService userService;

    public ProductOperationalModeWsInterceptor(ProductOperationalModeService service,
                                               JwtUtil jwtUtil,
                                               UserService userService) {
        this.service = service;
        this.jwtUtil = jwtUtil;
        this.userService = userService;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {

        URI uri = request.getURI();
        String endpoint = uri == null || uri.getPath() == null ? "" : uri.getPath();

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // Extraemos userId (para allowlist y para resolver isModel) solo si el
        // modo puede diferir por rol; en OPEN total no aporta nada.
        Long userId = null;
        boolean isModel = false;
        if (service.currentMode() != Mode.OPEN || service.modelMode() != Mode.OPEN) {
            userId = extractUserIdSafe(request);
            isModel = resolveIsModel(userId);
        }

        Decision decision = service.decideForWsHandshake(auth, endpoint, userId, isModel);

        if (decision.isAllow()) {
            return true;
        }

        response.setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
        if (decision.getMode() != null) {
            response.getHeaders().set(ProductOperationalConstants.HEADER_PRODUCT_MODE, decision.getMode());
        }

        log.warn("{} ws-handshake endpoint={} mode={} decision={} reason={}",
                ProductOperationalConstants.LOG_PREFIX,
                endpoint,
                decision.getMode() == null ? "-" : decision.getMode(),
                decision.getCode(),
                decision.getReason());

        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // no-op
    }

    /**
     * Determina si el usuario es MODELO (rol MODEL o candidata USER+FORM_MODEL)
     * cargando el User por id, mismo patron que ModelContractWsInterceptor.
     * Fail-closed: ante cualquier duda devuelve false (modo global).
     */
    private boolean resolveIsModel(Long userId) {
        if (userId == null) return false;
        try {
            User u = userService.findById(userId);
            return UserRoleUtils.isModelOrCandidate(u);
        } catch (Exception ex) {
            return false;
        }
    }

    private Long extractUserIdSafe(ServerHttpRequest request) {
        String token = readAccessCookie(request);
        if (token == null) return null;
        try {
            if (!jwtUtil.isTokenValid(token)) return null;
            return jwtUtil.extractUserId(token);
        } catch (Exception ex) {
            return null;
        }
    }

    private String readAccessCookie(ServerHttpRequest request) {
        // Si el request es servlet, usamos la API estándar.
        if (request instanceof ServletServerHttpRequest) {
            ServletServerHttpRequest servletReq = (ServletServerHttpRequest) request;
            jakarta.servlet.http.Cookie[] cookies = servletReq.getServletRequest().getCookies();
            if (cookies == null) return null;
            for (jakarta.servlet.http.Cookie c : cookies) {
                if (COOKIE_ACCESS.equals(c.getName())) {
                    String v = c.getValue();
                    return (v == null || v.isBlank()) ? null : v;
                }
            }
            return null;
        }
        // Fallback: parsear el header Cookie a mano.
        HttpHeaders headers = request.getHeaders();
        if (headers == null) return null;
        List<String> cookieHeaders = headers.get(HttpHeaders.COOKIE);
        if (cookieHeaders == null) return null;
        for (String header : cookieHeaders) {
            if (header == null) continue;
            for (String part : header.split(";")) {
                String trimmed = part.trim();
                if (trimmed.startsWith(COOKIE_ACCESS + "=")) {
                    String v = trimmed.substring((COOKIE_ACCESS + "=").length());
                    return v.isBlank() ? null : v;
                }
            }
        }
        return null;
    }
}
