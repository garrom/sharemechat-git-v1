package com.sharemechat.security;

import com.sharemechat.entity.User;
import com.sharemechat.exception.EmailVerificationRequiredException;
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
 * Filtro REST global que bloquea con HTTP 403 + code
 * {@code EMAIL_NOT_VERIFIED} cualquier request autenticada cuyo user no
 * tenga {@code email_verified_at} poblado, salvo whitelist minima de
 * paths necesarios para escapar del bloqueo (consultar identidad,
 * pedir reenvio, confirmar, logout, etc.) o paths del sistema
 * (healthchecks, registro, consent).
 *
 * Frente "Email verification gate total" (2026-06-15). Esta es la
 * fuente UNICA del gate de email en el producto: sustituye al patron
 * de EmailVerificationService.assertEmailVerified inline que habia en
 * pocos endpoints (transactions/first, kyc start, etc.) y extiende la
 * cobertura a TODOS los endpoints autenticados de usuario (recarga,
 * payout, subida documentos, chat, mensajes, favoritos, etc.).
 *
 * Reglas:
 *  - Si la request NO esta autenticada: pasa (no es problema del filtro).
 *  - Si el path esta en isWhitelisted: pasa.
 *  - Si el path NO esta en whitelist Y el user existe Y su
 *    email_verified_at es NULL: rechaza con 403 + JSON body con campos
 *    status, error, message, path, code=EMAIL_NOT_VERIFIED.
 *
 * Se registra DESPUES de CookieJwtAuthenticationFilter (necesita el
 * Authentication ya resuelto) y ANTES de los handlers de las rutas.
 * Coexiste con ProductOperationalModeFilter: ambos pueden rechazar la
 * request; el primero que lo haga gana.
 *
 * Whitelist: cualquier endpoint nuevo del usuario queda
 * automaticamente gateado por email a menos que se anada explicitamente
 * aqui. Esa es la intencion (gate total).
 */
public class EmailVerifiedFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(EmailVerifiedFilter.class);
    private static final String CODE = EmailVerificationRequiredException.CODE;

    private final UserRepository userRepository;

    public EmailVerifiedFilter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // 1) Sin auth o anonimo -> pasa. SecurityConfig se encarga del
        //    rechazo si la ruta lo requiere.
        if (auth == null || !auth.isAuthenticated() || isAnonymous(auth)) {
            chain.doFilter(request, response);
            return;
        }

        String method = request.getMethod();
        String path = request.getRequestURI();

        // 2) Whitelist y rutas de sistema. OPTIONS siempre pasa (CORS preflight).
        if ("OPTIONS".equalsIgnoreCase(method) || isWhitelisted(path)) {
            chain.doFilter(request, response);
            return;
        }

        // 3) Backoffice (ROLE_ADMIN, BO_*) queda fuera del gate de email
        //    de producto. El backoffice tiene su propio flujo de verificacion
        //    (issueBackofficeVerification) y no usa este gate para
        //    bloquear panels admin.
        if (isBackoffice(auth)) {
            chain.doFilter(request, response);
            return;
        }

        // 4) Cargar el user actual y comprobar email_verified_at.
        String email = auth.getName();
        User user = (email == null || email.isBlank())
                ? null
                : userRepository.findByEmail(email).orElse(null);

        if (user != null && user.getEmailVerifiedAt() != null) {
            chain.doFilter(request, response);
            return;
        }

        // 5) Email no verificado: rechazar.
        log.warn("[EMAIL-GATE] block path={} method={} email_verified=false",
                path, method);
        writeForbiddenResponse(response, path);
    }

    /**
     * Whitelist hardcoded. Documenta porque cada entrada esta aqui. Si
     * la suma de paths crece o se reordena, mantener este JavaDoc al dia
     * es mas valioso que extraerlo a config externa.
     */
    private boolean isWhitelisted(String path) {
        if (path == null) return false;

        // Identidad del propio user: tiene que poder consultarse antes
        // de saber si esta o no verificado.
        if (path.equals("/api/users/me")) return true;

        // Reenvio y confirmacion del email de verificacion (la unica
        // forma de salir del estado bloqueado).
        if (path.startsWith("/api/email-verification/")) return true;

        // Login / logout / refresh: la sesion HTTP misma. El user puede
        // necesitar relogin/logout estando bloqueado.
        if (path.equals("/api/auth/login")) return true;
        if (path.equals("/api/auth/logout")) return true;
        if (path.equals("/api/auth/refresh")) return true;
        if (path.equals("/api/admin/auth/login")) return true;

        // Forgot/reset password: forman parte del recovery de cuenta.
        if (path.equals("/api/auth/password/forgot")) return true;
        if (path.equals("/api/auth/password/reset")) return true;

        // Registro: ni siquiera deberia llegar aqui con session, pero
        // por defensa lo declaramos. Cubre los dos paths de producto.
        if (path.startsWith("/api/users/register/")) return true;

        // Consent: puede aceptarse antes de verificar email (el flujo
        // operativo del producto no impone orden estricto entre los dos).
        if (path.startsWith("/api/consent/")) return true;

        // Webhooks externos: NO son user actions, no pasan por este
        // filtro con auth de usuario, pero por defensa los whitelist.
        if (path.equals("/api/kyc/veriff/webhook")) return true;
        if (path.equals("/api/kyc/didit/webhook")) return true;

        // Recursos publicos del producto.
        if (path.startsWith("/api/public/")) return true;
        if (path.startsWith("/api/users/avatars/")) return true;

        // Healthchecks operativos.
        if (path.startsWith("/actuator/")) return true;

        // Assets estaticos servidos por el frontend (no suelen pasar por
        // el backend pero defensa por si la SPA los proxa).
        if (path.equals("/") || path.equals("/favicon.ico")) return true;
        if (path.startsWith("/static/")) return true;

        // SEO publico que sirve el backend.
        if (path.equals("/sitemap.xml") || path.equals("/robots.txt")) return true;

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
        appendJsonField(body, "message", "Email verification required before this operation");
        body.append(',');
        appendJsonField(body, "path", path == null ? "" : path);
        body.append(',');
        appendJsonField(body, "code", CODE);
        body.append('}');

        response.getWriter().write(body.toString());
    }

    private boolean isAnonymous(Authentication auth) {
        if (auth == null) return true;
        // Spring Security usa "anonymousUser" como name para el AnonymousAuthenticationToken
        return "anonymousUser".equals(auth.getName());
    }

    private boolean isBackoffice(Authentication auth) {
        if (auth == null) return false;
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
}
