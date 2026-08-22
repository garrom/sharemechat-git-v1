package com.sharemechat.controller;

import com.sharemechat.dto.ClientErrorDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Observabilidad #4 (2026-08-22): recibe errores del NAVEGADOR del usuario
 * (ErrorBoundary + window.onerror/unhandledrejection del frontend) y los deja en
 * el log central del backend, trazables por requestId ({@code RequestCorrelationFilter}).
 * Sin herramienta externa (Sentry): el dato queda en el log. Público (los errores
 * también le ocurren a usuarios anónimos). Trunca y sanea los campos (no confiables,
 * vienen del cliente) para acotar coste y evitar inyección de líneas de log.
 */
@RestController
@RequestMapping("/api/observability")
public class ClientErrorController {

    private static final Logger log = LoggerFactory.getLogger("CLIENT-ERROR");

    @PostMapping("/client-error")
    public ResponseEntity<Void> report(@RequestBody(required = false) ClientErrorDTO body) {
        if (body == null) {
            return ResponseEntity.noContent().build();
        }
        log.warn("url={} source={} ua={} msg={} | stack={}",
                oneLine(body.getUrl(), 300),
                oneLine(body.getSource(), 200),
                oneLine(body.getUserAgent(), 200),
                oneLine(body.getMessage(), 500),
                truncate(body.getStack(), 4000));
        return ResponseEntity.noContent().build();
    }

    /** Una sola línea (sin CR/LF/TAB) + truncado: para campos de una línea. Evita
     *  que un cliente forje líneas de log falsas con saltos de línea. */
    private static String oneLine(String s, int max) {
        if (s == null) return "";
        String v = s.replaceAll("[\\r\\n\\t]+", " ").trim();
        return v.length() > max ? v.substring(0, max) + "…" : v;
    }

    /** Solo truncado (conserva el multilínea legítimo del stack). */
    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }
}
