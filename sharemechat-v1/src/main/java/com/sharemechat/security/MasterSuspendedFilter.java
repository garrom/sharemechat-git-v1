package com.sharemechat.security;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.master.entity.Master;
import com.sharemechat.master.repository.MasterRepository;
import com.sharemechat.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * ADR-056 Fase S7.b (2026-08-02): filtro REST global que bloquea con
 * HTTP 403 + code {@code MASTER_SUSPENDED} las acciones de escritura
 * sensibles bajo {@code /api/masters/me/**} cuando el user autenticado
 * es un Master con {@code suspended_at != NULL}.
 *
 * <p>Whitelist alineada con las 3 decisiones del operador (S7.b, 2026-08-02):
 * <ul>
 *   <li>Puede loguearse y ver su dashboard (todo GET).</li>
 *   <li>Puede solicitar payout final del saldo pre-suspensión
 *       (POST /api/masters/me/payout).</li>
 *   <li>Puede completar onboarding pendiente (POST contract/accept,
 *       kyc/didit) por si la suspensión ocurrió durante el proceso.</li>
 *   <li>NO puede invitar modelos ni editar % pactado ni gestionar
 *       payout-methods ni contratos nuevos: cualquier POST/PATCH/DELETE
 *       fuera del whitelist responde 403 MASTER_SUSPENDED.</li>
 * </ul>
 *
 * <p>Se registra DESPUÉS de {@link EmailVerifiedFilter} (el email gate
 * predomina — un Master no-verificado sigue bloqueado por email; un
 * Master suspendido pero verificado se bloquea aquí).
 *
 * <p>Users no-Master no ven ningún efecto: el filtro pasa directo si
 * {@code role != MASTER}.
 */
public class MasterSuspendedFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(MasterSuspendedFilter.class);
    public static final String CODE = "MASTER_SUSPENDED";

    private final UserRepository userRepository;
    private final MasterRepository masterRepository;

    public MasterSuspendedFilter(UserRepository userRepository, MasterRepository masterRepository) {
        this.userRepository = userRepository;
        this.masterRepository = masterRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || isAnonymous(auth) || isBackoffice(auth)) {
            chain.doFilter(request, response);
            return;
        }

        String method = request.getMethod();
        String path = request.getRequestURI();

        // Fuera de /api/masters/**: no aplica.
        if (path == null || !path.startsWith("/api/masters/")) {
            chain.doFilter(request, response);
            return;
        }

        // OPTIONS + GET siempre pasan (lectura permitida al Master suspendido).
        if ("OPTIONS".equalsIgnoreCase(method) || "GET".equalsIgnoreCase(method)) {
            chain.doFilter(request, response);
            return;
        }

        if (isWhitelistedWrite(path, method)) {
            chain.doFilter(request, response);
            return;
        }

        // Solo consulta BD si es un candidato a bloqueo (POST/PATCH/DELETE
        // no-whitelisted bajo /api/masters/**). Evita I/O en el 99% de
        // requests que no aplican.
        String email = auth.getName();
        User user = (email == null || email.isBlank())
                ? null
                : userRepository.findByEmail(email).orElse(null);

        if (user == null || !Constants.Roles.MASTER.equals(user.getRole())) {
            chain.doFilter(request, response);
            return;
        }

        Master master = masterRepository.findByUserId(user.getId()).orElse(null);
        if (master == null || master.getSuspendedAt() == null) {
            chain.doFilter(request, response);
            return;
        }

        log.warn("[MASTER-SUSPENDED-GATE] block userId={} path={} method={} suspendedAt={}",
                user.getId(), path, method, master.getSuspendedAt());
        writeForbiddenResponse(response, path);
    }

    /**
     * Whitelist de escrituras que un Master suspendido puede seguir
     * ejecutando. Documenta el porqué de cada entrada.
     */
    private boolean isWhitelistedWrite(String path, String method) {
        String m = method == null ? "" : method.toUpperCase();

        // Payout final del saldo pre-suspensión: no bloqueamos el dinero.
        if ("POST".equals(m) && "/api/masters/me/payout".equals(path)) return true;

        // Onboarding pendiente (si la suspensión ocurrió durante el flujo,
        // permitir cerrarlo — el bloqueo real de operación queda garantizado
        // sobre invitar modelos / gestionar splits / etc.).
        if ("POST".equals(m) && "/api/masters/me/contract/accept".equals(path)) return true;
        if ("POST".equals(m) && "/api/masters/me/kyc/didit".equals(path)) return true;

        return false;
    }

    private void writeForbiddenResponse(HttpServletResponse response, String path) throws IOException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        StringBuilder body = new StringBuilder(180);
        body.append('{');
        appendJsonField(body, "status", "403");
        body.append(',');
        appendJsonField(body, "error", "Forbidden");
        body.append(',');
        appendJsonField(body, "message", "Master account suspended; write operations blocked");
        body.append(',');
        appendJsonField(body, "path", path == null ? "" : path);
        body.append(',');
        appendJsonField(body, "code", CODE);
        body.append('}');

        response.getWriter().write(body.toString());
    }

    private boolean isAnonymous(Authentication auth) {
        if (auth == null) return true;
        return "anonymousUser".equals(auth.getName());
    }

    private boolean isBackoffice(Authentication auth) {
        if (auth == null || auth.getAuthorities() == null) return false;
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

    private void appendJsonField(StringBuilder sb, String key, String value) {
        sb.append('"').append(key).append('"').append(':');
        if (value == null) { sb.append("null"); return; }
        sb.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"':  sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        sb.append('"');
    }
}
