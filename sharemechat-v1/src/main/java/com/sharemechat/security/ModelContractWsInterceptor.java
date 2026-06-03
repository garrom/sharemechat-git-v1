package com.sharemechat.security;

import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * Interceptor de handshake WebSocket que bloquea a actores modelo
 * (USER+FORM_MODEL u role=MODEL) sin la versión vigente del Model
 * Collaboration Agreement aceptada.
 *
 * <p>Se registra en {@link com.sharemechat.config.WebSocketConfig} para
 * los endpoints {@code /match} y {@code /messages}. Sigue el patrón de
 * {@link ProductOperationalModeWsInterceptor}:
 * <ul>
 *   <li>Extrae el userId del JWT en cookie {@code access_token} (mismo
 *       mecanismo).</li>
 *   <li>Si no es actor modelo o no se puede resolver, deja pasar (la
 *       capa de autenticación gestionará su propio rechazo si procede).</li>
 *   <li>Si es actor modelo y no ha aceptado la versión vigente, responde
 *       403 Forbidden con header informativo y aborta el handshake.</li>
 * </ul>
 *
 * <p>El estado se reevalúa en cada handshake (no se cachea por sesión).
 * En cuanto la modelo acepta la nueva versión, el siguiente handshake
 * pasa.
 */
@Component
public class ModelContractWsInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(ModelContractWsInterceptor.class);

    private static final String COOKIE_ACCESS = "access_token";
    private static final String HEADER_CONTRACT_STATUS = "X-Model-Contract";
    private static final String LOG_PREFIX = "[MODEL-CONTRACT]";

    private final ModelContractGate gate;
    private final UserService userService;
    private final JwtUtil jwtUtil;

    public ModelContractWsInterceptor(ModelContractGate gate,
                                      UserService userService,
                                      JwtUtil jwtUtil) {
        this.gate = gate;
        this.userService = userService;
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {

        URI uri = request.getURI();
        String endpoint = uri == null || uri.getPath() == null ? "" : uri.getPath();

        Long userId = extractUserIdSafe(request);
        if (userId == null) {
            // No identificable: no es responsabilidad de este interceptor
            // bloquear por falta de auth; deja que el resto del pipeline
            // (Product Operational Mode, handler) decida.
            return true;
        }

        User user = userService.findById(userId);
        if (user == null) {
            // El token apuntaba a un user inexistente; pase y que falle
            // donde corresponda.
            return true;
        }

        if (!gate.requiresAcceptance(user)) {
            // No es actor modelo (probable CLIENT u otro): no aplica el gate.
            return true;
        }

        if (gate.hasAcceptedCurrent(userId)) {
            return true;
        }

        // Actor modelo sin contrato vigente: bloquear el handshake.
        response.setStatusCode(HttpStatus.FORBIDDEN);
        response.getHeaders().set(HEADER_CONTRACT_STATUS, "REACCEPT_REQUIRED");

        log.warn("{} ws-handshake bloqueado endpoint={} userId={} role={} userType={}",
                LOG_PREFIX, endpoint, userId, user.getRole(), user.getUserType());

        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // no-op
    }

    // ============================================================
    // Helpers (replican el patrón de ProductOperationalModeWsInterceptor)
    // ============================================================

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
