package com.sharemechat.service;

import com.sharemechat.config.IpConfig;
import com.sharemechat.exception.CountryBlockedException;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Country gate basado en allowlist por flujo (decisión hardening post-PRO 2026-05-27).
 *
 * Sustituye al modelo previo de blocklist (deprecado en application.properties).
 *
 * Tres flujos:
 *  - assertAllowedForClientRegistration: usa client-registration.allowed-countries
 *  - assertAllowedForModelRegistration:  usa model-registration.allowed-countries
 *  - assertAllowed (login, refresh, admin login): usa la UNIÓN de ambas
 *
 * Bypass por IP: si la IP origen coincide con cualquier IP/CIDR de
 * bypass-ips, se salta TODA validación de país (cubre operador y PSPs).
 *
 * Respuesta uniforme: lanza CountryBlockedException con mensaje fijo,
 * sin distinguir scope ni país, para no facilitar fingerprinting. La razón
 * concreta se registra en logs server-side (log.warn) para diagnóstico.
 *
 * Si block-when-missing=true y la resolución de país falla, deny conservador.
 */
@Service
public class CountryAccessService {

    private static final Logger log = LoggerFactory.getLogger(CountryAccessService.class);

    // Mensaje uniforme expuesto al cliente. No distingue scope ni país.
    public static final String UNIFORM_BLOCKED_MESSAGE = "Registro no disponible";

    @Value("${country.access.enabled:true}")
    private boolean enabled;

    @Value("${country.access.block-when-missing:true}")
    private boolean blockWhenMissing;

    @Value("${country.access.client-registration.allowed-countries:}")
    private String clientAllowedRaw;

    @Value("${country.access.model-registration.allowed-countries:}")
    private String modelAllowedRaw;

    @Value("${country.access.bypass-ips:}")
    private String bypassIpsRaw;

    // Resueltos en @PostConstruct para evitar re-parsear cada request.
    private Set<String> clientAllowed;
    private Set<String> modelAllowed;
    private Set<String> unionAllowed;
    private List<IpAddressMatcher> bypassMatchers;

    @PostConstruct
    public void initialize() {
        this.clientAllowed = parseCountries(clientAllowedRaw);
        this.modelAllowed = parseCountries(modelAllowedRaw);

        LinkedHashSet<String> union = new LinkedHashSet<>();
        union.addAll(clientAllowed);
        union.addAll(modelAllowed);
        this.unionAllowed = Set.copyOf(union);

        this.bypassMatchers = parseBypassIps(bypassIpsRaw);

        if (enabled) {
            log.info("CountryAccessService initialized: enabled=true, clientAllowed={}, modelAllowed={}, unionAllowed={}, bypassIps={}",
                    clientAllowed.size(), modelAllowed.size(), unionAllowed.size(), bypassMatchers.size());
        } else {
            log.warn("CountryAccessService initialized: enabled=false (gate DESACTIVADO)");
        }
    }

    /**
     * Usado por login, refresh y admin login. Acepta cualquier país de la
     * unión de las dos allowlists (client + model).
     */
    public void assertAllowed(HttpServletRequest request) {
        assertAllowedInternal(request, unionAllowed, "union");
    }

    /**
     * Usado por POST /api/users/register/client.
     */
    public void assertAllowedForClientRegistration(HttpServletRequest request) {
        assertAllowedInternal(request, clientAllowed, "client_registration");
    }

    /**
     * Usado por POST /api/users/register/model.
     */
    public void assertAllowedForModelRegistration(HttpServletRequest request) {
        assertAllowedInternal(request, modelAllowed, "model_registration");
    }

    /**
     * Usado por POST /api/kyc/veriff/start (inicio de sesión Veriff para
     * onboarding de modelo). Reusa la allowlist de **modelo** porque el
     * flujo KYC del modelo es continuación de su registro: ambos comparten
     * el mismo conjunto de países permitidos.
     *
     * NOTA: cuando se cree el endpoint equivalente para CLIENTE (Age
     * Estimation, vendor aún por decidir), se replicará este mismo patrón
     * añadiendo {@code assertAllowedForClientKyc} que use {@link #clientAllowed}.
     * No se añade ese método ahora porque no hay endpoint que lo consuma
     * (regla de "no introducir API sin caller").
     */
    public void assertAllowedForModelKyc(HttpServletRequest request) {
        assertAllowedInternal(request, modelAllowed, "model_kyc");
    }

    /**
     * Resolución del país desde headers. Mantenida con la misma semántica
     * que el código previo: orden CloudFront-Viewer-Country → CF-IPCountry →
     * X-AppEngine-Country → X-Country-Code. Expuesta como público porque
     * UserController la usa para registrar el país detectado en la BD.
     */
    public String resolveViewerCountry(HttpServletRequest request) {
        if (request == null) {
            return null;
        }

        String[] headers = new String[]{
                "CloudFront-Viewer-Country",
                "CF-IPCountry",
                "X-AppEngine-Country",
                "X-Country-Code"
        };

        for (String header : headers) {
            String value = request.getHeader(header);
            String normalized = normalizeCountry(value);
            if (normalized != null) {
                return normalized;
            }
        }

        return null;
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    private void assertAllowedInternal(HttpServletRequest request, Set<String> allowed, String scope) {
        if (!enabled) {
            return;
        }

        if (isBypassIp(request)) {
            log.debug("Country gate bypass por IP: scope={} ip={}", scope, IpConfig.getClientIp(request));
            return;
        }

        String country = resolveViewerCountry(request);

        if (country == null) {
            if (blockWhenMissing) {
                log.warn("Country gate DENY (sin país resuelto): scope={} ip={}", scope, IpConfig.getClientIp(request));
                throw new CountryBlockedException(UNIFORM_BLOCKED_MESSAGE);
            }
            return;
        }

        if (!allowed.contains(country)) {
            log.warn("Country gate DENY: scope={} country={} ip={}", scope, country, IpConfig.getClientIp(request));
            throw new CountryBlockedException(UNIFORM_BLOCKED_MESSAGE);
        }
    }

    private boolean isBypassIp(HttpServletRequest request) {
        if (bypassMatchers.isEmpty() || request == null) {
            return false;
        }
        String ip = IpConfig.getClientIp(request);
        if (ip == null || ip.isBlank()) {
            return false;
        }
        for (IpAddressMatcher matcher : bypassMatchers) {
            try {
                if (matcher.matches(ip)) {
                    return true;
                }
            } catch (IllegalArgumentException ex) {
                // IP malformada: no es bypass; ignoramos y seguimos.
            }
        }
        return false;
    }

    private static Set<String> parseCountries(String raw) {
        if (raw == null || raw.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(s -> s.toUpperCase(Locale.ROOT))
                .filter(s -> s.length() == 2)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static List<IpAddressMatcher> parseBypassIps(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<IpAddressMatcher> matchers = new ArrayList<>();
        for (String token : raw.split(",")) {
            String trimmed = token.trim();
            if (trimmed.isBlank()) {
                continue;
            }
            try {
                matchers.add(new IpAddressMatcher(trimmed));
            } catch (IllegalArgumentException ex) {
                log.warn("CountryAccessService: ignorando entrada inválida en bypass-ips: '{}' ({})", trimmed, ex.getMessage());
            }
        }
        return List.copyOf(matchers);
    }

    private static String normalizeCountry(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (normalized.length() != 2) {
            return null;
        }
        return normalized;
    }
}
