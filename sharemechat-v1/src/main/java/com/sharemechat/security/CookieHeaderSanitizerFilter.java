package com.sharemechat.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Sanea el header Cookie eliminando cookies de terceros con valores que
 * no cumplen RFC 6265, ANTES de que Tomcat 10 (Rfc6265CookieProcessor) las
 * parsee y potencialmente ignore el resto del header.
 *
 * Cookie problematica principal: {@code g_state} que Google Identity Services
 * setea con JSON — comillas, comas, dos puntos — en el dominio del sitio
 * cliente. Ejemplo real observado:
 *
 * <pre>
 * g_state={"i_l":1,"i_ll":1786041857684,"i_e":{"enable_itp_optimization":24}}
 * </pre>
 *
 * Sintoma pre-fix: tras registro/login con Google, la request inmediata
 * a /users/me llegaba con las cookies "borradas" por el parser (aunque
 * el navegador SI las enviaba) y devolvia 401 → el frontend no navegaba
 * al dashboard aunque el registro/login era exitoso.
 *
 * Ordered.HIGHEST_PRECEDENCE para correr antes que cualquier filter que
 * pueda leer cookies (JwtFilter, Spring Security, etc.).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CookieHeaderSanitizerFilter extends OncePerRequestFilter {

    // Match "g_state=<hasta ; o fin>" con separadores adyacentes opcionales.
    // Grupos: 1=separador antes (o "^"), 2=cookie completa, 3=separador despues (o "$")
    private static final Pattern G_STATE_PATTERN = Pattern.compile(
            "(^|;\\s*)g_state=[^;]*"
    );

    @Override
    protected void doFilterInternal(
            HttpServletRequest req,
            HttpServletResponse res,
            FilterChain chain
    ) throws ServletException, IOException {
        String cookieHeader = req.getHeader("Cookie");
        if (cookieHeader == null || !cookieHeader.contains("g_state=")) {
            chain.doFilter(req, res);
            return;
        }
        String cleaned = G_STATE_PATTERN.matcher(cookieHeader).replaceAll("");
        // Cleanup borde: si g_state estaba al principio, queda "; foo=bar";
        // si al final, queda "foo=bar;". Normalizar.
        cleaned = cleaned.replaceAll("^\\s*;\\s*", "").replaceAll("\\s*;\\s*$", "");
        chain.doFilter(new SanitizedCookieRequest(req, cleaned), res);
    }

    private static final class SanitizedCookieRequest extends HttpServletRequestWrapper {
        private final String cleanCookie;

        SanitizedCookieRequest(HttpServletRequest req, String cleanCookie) {
            super(req);
            this.cleanCookie = cleanCookie;
        }

        @Override
        public String getHeader(String name) {
            if ("Cookie".equalsIgnoreCase(name)) {
                return cleanCookie.isEmpty() ? null : cleanCookie;
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if ("Cookie".equalsIgnoreCase(name)) {
                if (cleanCookie.isEmpty()) return Collections.emptyEnumeration();
                return Collections.enumeration(List.of(cleanCookie));
            }
            return super.getHeaders(name);
        }
    }
}
