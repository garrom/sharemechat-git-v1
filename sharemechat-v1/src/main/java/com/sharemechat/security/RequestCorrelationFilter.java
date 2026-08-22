package com.sharemechat.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Observabilidad (2026-08-22): pone un {@code requestId} en el MDC de SLF4J para
 * CADA petición HTTP, de modo que todas las líneas de log de una misma request
 * comparten el mismo id (inyectado en el patrón vía
 * {@code logging.pattern.level=%5p [%X{requestId:-}]}). Así se puede reconstruir
 * "qué pasó en esta llamada" grepeando por el id.
 *
 * <p>Reutiliza el {@code X-Request-Id} entrante si viene y es seguro; si no,
 * genera uno. Lo devuelve en la respuesta para que cliente/soporte lo referencien.
 * Se ejecuta lo antes posible (HIGHEST_PRECEDENCE) para cubrir también los filtros
 * de seguridad. El id entrante se valida contra una whitelist estricta para evitar
 * inyección de logs (saltos de línea forjando líneas falsas).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String MDC_KEY = "requestId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || !requestId.matches("[A-Za-z0-9._-]{1,64}")) {
            requestId = UUID.randomUUID().toString().substring(0, 8);
        }
        MDC.put(MDC_KEY, requestId);
        response.setHeader(REQUEST_ID_HEADER, requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
