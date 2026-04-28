package com.sharemechat.service;

import com.sharemechat.config.ProductOperationalProperties;
import com.sharemechat.config.ProductOperationalProperties.Mode;
import com.sharemechat.constants.ProductOperationalConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Fuente única de decisión de Product Operational Mode (ADR-009).
 *
 * Consumido por ProductOperationalModeFilter (REST) y por
 * ProductOperationalModeWsInterceptor (WebSocket handshake). Esta clase es
 * deliberadamente "pura": no inspecciona Authentication ni authorities.
 * El filtro y el interceptor son los responsables de resolver userId y de
 * resolver si la sesión es backoffice; pasan ambos como inputs.
 *
 * Reglas de evaluación REST, en orden:
 *  1) whitelist permanente por path (incluye /api/admin/** y webhooks)
 *  2) en /api/auth/refresh, si la sesión es backoffice → ALLOW (mantiene
 *     viva la sesión admin durante PRELAUNCH/MAINTENANCE/CLOSED)
 *  3) en modos restrictivos, allowlist por userId → ALLOW
 *  4) registro: depende del path, de la flag y del modo CLOSED
 *  5) modo: OPEN deja pasar; PRELAUNCH/MAINTENANCE/CLOSED bloquean rutas de producto
 *
 * Reglas WS handshake:
 *  - OPEN deja pasar
 *  - allowlist por userId → ALLOW
 *  - resto → BLOCK con código según modo
 *
 * No realiza I/O. No mantiene estado mutable. No accede a BD ni Redis.
 */
@Service
public class ProductOperationalModeService {

    private static final Logger log = LoggerFactory.getLogger(ProductOperationalModeService.class);

    public enum DecisionType {
        ALLOW,
        BLOCK_PRODUCT_UNAVAILABLE,
        BLOCK_PRODUCT_MAINTENANCE,
        BLOCK_REGISTRATION_CLOSED
    }

    public static final class Decision {
        private final DecisionType type;
        private final String code;
        private final String scope;
        private final String mode;
        private final String message;
        private final String reason;

        private Decision(DecisionType type, String code, String scope, String mode, String message, String reason) {
            this.type = type;
            this.code = code;
            this.scope = scope;
            this.mode = mode;
            this.message = message;
            this.reason = reason;
        }

        public static Decision allow(String reason) {
            return new Decision(DecisionType.ALLOW, null, null, null, null, reason);
        }

        public static Decision blockProductUnavailable(String mode, String reason) {
            return new Decision(
                    DecisionType.BLOCK_PRODUCT_UNAVAILABLE,
                    ProductOperationalConstants.CODE_PRODUCT_UNAVAILABLE,
                    ProductOperationalConstants.SCOPE_PRODUCT,
                    mode,
                    ProductOperationalConstants.MSG_PRODUCT_UNAVAILABLE,
                    reason);
        }

        public static Decision blockMaintenance(String reason) {
            return new Decision(
                    DecisionType.BLOCK_PRODUCT_MAINTENANCE,
                    ProductOperationalConstants.CODE_PRODUCT_MAINTENANCE,
                    ProductOperationalConstants.SCOPE_PRODUCT,
                    Mode.MAINTENANCE.name(),
                    ProductOperationalConstants.MSG_PRODUCT_MAINTENANCE,
                    reason);
        }

        public static Decision blockRegistrationClosed(String scope, String message, String reason) {
            return new Decision(
                    DecisionType.BLOCK_REGISTRATION_CLOSED,
                    ProductOperationalConstants.CODE_REGISTRATION_CLOSED,
                    scope,
                    null,
                    message,
                    reason);
        }

        public boolean isAllow() {
            return type == DecisionType.ALLOW;
        }

        public DecisionType getType() {
            return type;
        }

        public String getCode() {
            return code;
        }

        public String getScope() {
            return scope;
        }

        public String getMode() {
            return mode;
        }

        public String getMessage() {
            return message;
        }

        public String getReason() {
            return reason;
        }
    }

    private final ProductOperationalProperties props;
    private final Set<Long> allowlistUserIds;

    public ProductOperationalModeService(ProductOperationalProperties props) {
        this.props = props;
        List<Long> ids = props.getAccess().getAllowlist().getUserIds();
        this.allowlistUserIds = ids == null || ids.isEmpty()
                ? Collections.emptySet()
                : new HashSet<>(ids);

        if (!this.allowlistUserIds.isEmpty()) {
            log.info("{} access allowlist active with {} userIds",
                    ProductOperationalConstants.LOG_PREFIX, this.allowlistUserIds.size());
        }
    }

    public Mode currentMode() {
        Mode m = props.getAccess().getMode();
        return m == null ? Mode.OPEN : m;
    }

    public boolean hasAllowlist() {
        return !allowlistUserIds.isEmpty();
    }

    /**
     * @param auth    Authentication actual. El service no lo consume: las
     *                excepciones que dependen de authorities (p. ej. refresh
     *                de admin) son responsabilidad del filtro, que las
     *                resuelve antes de invocar este método.
     * @param userId  userId autenticado, o null si no hay sesión válida o si
     *                el filtro decidió no extraerlo por optimización.
     */
    public Decision decideForRequest(Authentication auth, String method, String path, Long userId) {
        String safePath = path == null ? "" : path;
        String safeMethod = method == null ? "" : method;

        if (isAlwaysAllowed(safeMethod, safePath)) {
            return Decision.allow("whitelist_path");
        }

        Mode mode = currentMode();

        if (mode != Mode.OPEN && isAllowlistedUser(userId)) {
            return Decision.allow("allowlist_user");
        }

        if (isClientRegistrationPath(safeMethod, safePath)) {
            if (mode == Mode.CLOSED || !props.getRegistration().getClient().isEnabled()) {
                return Decision.blockRegistrationClosed(
                        ProductOperationalConstants.SCOPE_CLIENT,
                        ProductOperationalConstants.MSG_REGISTRATION_CLIENT_CLOSED,
                        mode == Mode.CLOSED ? "mode_closed" : "client_registration_disabled");
            }
            return Decision.allow("client_registration_enabled");
        }
        if (isModelRegistrationPath(safeMethod, safePath)) {
            if (mode == Mode.CLOSED || !props.getRegistration().getModel().isEnabled()) {
                return Decision.blockRegistrationClosed(
                        ProductOperationalConstants.SCOPE_MODEL,
                        ProductOperationalConstants.MSG_REGISTRATION_MODEL_CLOSED,
                        mode == Mode.CLOSED ? "mode_closed" : "model_registration_disabled");
            }
            return Decision.allow("model_registration_enabled");
        }

        switch (mode) {
            case OPEN:
                return Decision.allow("mode_open");
            case MAINTENANCE:
                return isProductPath(safeMethod, safePath)
                        ? Decision.blockMaintenance("mode_maintenance")
                        : Decision.allow("not_product_path");
            case PRELAUNCH:
                return isProductPath(safeMethod, safePath)
                        ? Decision.blockProductUnavailable(Mode.PRELAUNCH.name(), "mode_prelaunch")
                        : Decision.allow("not_product_path");
            case CLOSED:
                return isProductPath(safeMethod, safePath)
                        ? Decision.blockProductUnavailable(Mode.CLOSED.name(), "mode_closed")
                        : Decision.allow("not_product_path");
            default:
                // Fail-open: modo desconocido por error de configuración → trata como OPEN.
                return Decision.allow("unknown_mode_fail_open");
        }
    }

    /**
     * @param auth     Authentication actual. El service no lo consume.
     * @param endpoint path del handshake (p. ej. "/match", "/messages").
     * @param userId   userId autenticado, o null.
     */
    public Decision decideForWsHandshake(Authentication auth, String endpoint, Long userId) {
        Mode mode = currentMode();
        if (mode == Mode.OPEN) {
            return Decision.allow("mode_open");
        }
        if (isAllowlistedUser(userId)) {
            return Decision.allow("allowlist_user");
        }
        if (mode == Mode.MAINTENANCE) {
            return Decision.blockMaintenance("mode_maintenance_ws");
        }
        return Decision.blockProductUnavailable(mode.name(), "mode_" + mode.name().toLowerCase() + "_ws");
    }

    // -----------------------------------------------------------------
    // Path classifiers
    // -----------------------------------------------------------------

    private boolean isAlwaysAllowed(String method, String path) {
        if ("OPTIONS".equalsIgnoreCase(method)) return true;

        // Backoffice: login admin y todo /api/admin/**
        if (path.equals("/api/admin/auth/login")) return true;
        if (path.startsWith("/api/admin/")) return true;

        // Recursos públicos del producto
        if (path.startsWith("/api/public/home/")) return true;
        if ("GET".equalsIgnoreCase(method) && path.startsWith("/api/users/avatars/")) return true;

        // Sesión común producto/admin
        if (path.equals("/api/users/me")) return true;

        // Logout siempre permitido (limpieza de sesión)
        if (path.equals("/api/auth/logout")) return true;

        // Email verification (incluye confirm)
        if (path.startsWith("/api/email-verification/")) return true;

        // Forgot / reset password
        if (path.equals("/api/auth/password/forgot")) return true;
        if (path.equals("/api/auth/password/reset")) return true;

        // Consent (incluye accept; no se gatea aquí)
        if (path.startsWith("/api/consent/")) return true;

        // Webhooks externos
        if (path.equals("/api/billing/ccbill/notify")) return true;
        if (path.equals("/api/kyc/veriff/webhook")) return true;

        return false;
    }

    private boolean isClientRegistrationPath(String method, String path) {
        return "POST".equalsIgnoreCase(method) && path.equals("/api/users/register/client");
    }

    private boolean isModelRegistrationPath(String method, String path) {
        return "POST".equalsIgnoreCase(method) && path.equals("/api/users/register/model");
    }

    /**
     * Paths que se consideran "superficie de producto" y se bloquean en modos
     * restrictivos. La whitelist de {@link #isAlwaysAllowed} se evalúa antes,
     * así que rutas como /api/users/me, logout, email-verification, password
     * reset o /api/admin/** nunca llegan aquí.
     */
    private boolean isProductPath(String method, String path) {
        if (path.equals("/api/auth/login")) return true;
        if (path.equals("/api/auth/refresh")) return true;
        if (path.startsWith("/api/clients/")) return true;
        if (path.startsWith("/api/models/")) return true;
        if (path.startsWith("/api/favorites/")) return true;
        if (path.startsWith("/api/transactions/")) return true;
        if (path.startsWith("/api/messages/")) return true;
        if (path.startsWith("/api/streams/")) return true;
        if (path.startsWith("/api/funnyplace/")) return true;
        if (path.equals("/api/webrtc/config")) return true;
        if (path.startsWith("/api/reports/")) return true;
        return false;
    }

    private boolean isAllowlistedUser(Long userId) {
        if (userId == null) return false;
        if (allowlistUserIds.isEmpty()) return false;
        return allowlistUserIds.contains(userId);
    }
}
