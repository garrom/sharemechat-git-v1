package com.sharemechat.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.stream.Collectors;

@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(EmailAlreadyInUseException.class)
    public ResponseEntity<ApiError> handleEmailInUse(EmailAlreadyInUseException ex, HttpServletRequest req) {
        log.warn("Email en uso: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Bad Request", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(UnderageModelException.class)
    public ResponseEntity<ApiError> handleUnderage(UnderageModelException ex, HttpServletRequest req) {
        log.warn("Restricción de edad: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Bad Request", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        String details = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + (fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "inválido"))
                .collect(Collectors.joining("; "));
        log.warn("Validación inválida: {}", details);
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Bad Request", details, req.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuth(AuthenticationException ex, HttpServletRequest req) {
        log.warn("No autenticado: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.UNAUTHORIZED.value(), "Unauthorized", "No autenticado", req.getRequestURI());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, HttpServletRequest req) {
        log.warn("Acceso denegado: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.FORBIDDEN.value(), "Forbidden", "Acceso denegado", req.getRequestURI());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ApiError> handleForbidden(ForbiddenException ex, HttpServletRequest req) {
        log.warn("Forbidden de negocio: {}", ex.getMessage());
        ApiError body = new ApiError(
                HttpStatus.FORBIDDEN.value(),
                "Forbidden",
                ex.getMessage(),
                req.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(ConsentRequiredException.class)
    public ResponseEntity<ConsentRequiredApiError> handleConsentRequired(ConsentRequiredException ex, HttpServletRequest req) {
        String path = req != null ? req.getRequestURI() : null;
        String reasonCode = ex.getConsentState() != null ? ex.getConsentState().reasonCode() : "missing_terms";
        String requiredTermsVersion = ex.getConsentState() != null ? ex.getConsentState().requiredTermsVersion() : null;

        log.warn("Consentimiento requerido: userId={} endpoint={} reason={} path={}",
                ex.getUserId(),
                ex.getEndpointKey(),
                reasonCode,
                path);

        ConsentRequiredApiError body = new ConsentRequiredApiError(
                HttpStatus.FORBIDDEN.value(),
                "Forbidden",
                "Consentimiento obligatorio pendiente",
                path,
                "AGE_GATE_REQUIRED",
                requiredTermsVersion,
                reasonCode
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(EmailVerificationRequiredException.class)
    public ResponseEntity<ApiError> handleEmailVerificationRequired(EmailVerificationRequiredException ex, HttpServletRequest req) {
        log.warn("Email verification requerida: {}", ex.getMessage());
        ApiError body = new ApiError(
                HttpStatus.FORBIDDEN.value(),
                "Forbidden",
                ex.getMessage(),
                req.getRequestURI()
        );
        body.setCode(ex.getCode());
        body.setScope(ex.getScope());
        body.setNextAction(ex.getNextAction());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(CountryBlockedException.class)
    public ResponseEntity<ApiError> handleCountryBlocked(CountryBlockedException ex, HttpServletRequest req) {
        // Log server-side con razón real (path + ex.getMessage() pueden contener
        // detalle de scope/pais para diagnostico). NO se expone al cliente.
        log.warn("Acceso bloqueado por pais: path={} reason={}",
                req != null ? req.getRequestURI() : null,
                ex.getMessage());

        // Respuesta UNIFORME al cliente: body fijo "REGISTRATION_UNAVAILABLE"
        // sin path, sin scope, sin pais. Disena el contrato OPSEC del country
        // gate: todos los flujos bloqueados por pais devuelven la misma respuesta,
        // un atacante no puede distinguir si fallo client-registration,
        // model-registration o login/refresh, ni cual fue el pais rechazado.
        // Justificacion 403 vs 503 vs ProductOperationalMode: divergencia
        // semantica intencional (geo-restriction permanente vs modo operativo
        // temporal). Documentada en known-debt.md 2026-05-27.
        ApiError body = new ApiError(
                HttpStatus.FORBIDDEN.value(),
                "Forbidden",
                "Registro no disponible",
                null
        );
        body.setCode("REGISTRATION_UNAVAILABLE");
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest req) {
        log.warn("Argumento inválido: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Bad Request", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(AlreadyFavoritesException.class)
    public ResponseEntity<ApiError> handleAlreadyFavorites(AlreadyFavoritesException ex, HttpServletRequest req) {
        log.warn("Favoritos ya aceptados: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.CONFLICT.value(), "Conflict", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(InvitationAlreadyPendingException.class)
    public ResponseEntity<ApiError> handleInvitationPending(InvitationAlreadyPendingException ex, HttpServletRequest req) {
        log.warn("Invitación ya pendiente: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.CONFLICT.value(), "Conflict", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(NotMutualFavoritesException.class)
    public ResponseEntity<ApiError> handleNotMutualFavorites(NotMutualFavoritesException ex, HttpServletRequest req) {
        log.warn("Llamada bloqueada por favoritos no aceptados: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.FORBIDDEN.value(), "Forbidden", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(NicknameAlreadyInUseException.class)
    public ResponseEntity<ApiError> handleNicknameInUse(NicknameAlreadyInUseException ex, HttpServletRequest req) {
        log.warn("Nickname en uso: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Bad Request", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(HomeFeaturedEmptyException.class)
    public ResponseEntity<ApiError> handleHomeFeaturedEmpty(HomeFeaturedEmptyException ex, HttpServletRequest req) {
        log.warn("Home sin modelos destacados: {}", ex.getMessage());
        ApiError body = new ApiError(
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                "Service Unavailable",
                ex.getMessage(),
                req.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    @ExceptionHandler(UserBlockedException.class)
    public ResponseEntity<ApiError> handleUserBlocked(UserBlockedException ex, HttpServletRequest req) {
        log.warn("Acción bloqueada por user_block: {}", ex.getMessage());
        ApiError body = new ApiError(
                HttpStatus.FORBIDDEN.value(),
                "Forbidden",
                ex.getMessage(),
                req.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiError> handleInvalidCredentials(InvalidCredentialsException ex, HttpServletRequest req) {
        log.warn("Credenciales inválidas: {}", ex.getMessage());
        ApiError body = new ApiError(
                HttpStatus.UNAUTHORIZED.value(),
                "Unauthorized",
                ex.getMessage() != null ? ex.getMessage() : "Credenciales inválidas",
                req.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<ApiError> handleTooManyRequests(TooManyRequestsException ex, HttpServletRequest req) {
        log.warn("Rate limit: {} uri={}", ex.getMessage(), req.getRequestURI());

        ApiError body = new ApiError(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                "Too Many Requests",
                ex.getMessage() != null ? ex.getMessage() : "Demasiadas solicitudes",
                req.getRequestURI()
        );

        long retryAfterSec = Math.max(1L, ex.getRetryAfterMs() / 1000L);

        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(retryAfterSec))
                .body(body);
    }

    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public ResponseEntity<Void> handleAsyncRequestNotUsable(AsyncRequestNotUsableException ex, HttpServletRequest req) {
        log.debug("Request abortada por el cliente en {}: {}", req.getRequestURI(), ex.getMessage());
        return ResponseEntity.noContent().build();
    }

    // Handlers basados en ResponseStatusException: patron Spring estandar
    // para que un controller indique un codigo HTTP + razon explicitos sin
    // crear una excepcion de negocio dedicada. Antes de este handler la
    // excepcion caia al fallback handleOther y se mapeaba a 500 con mensaje
    // generico, ocultando el codigo HTTP real (p. ej. 400, 404, 409) que el
    // controller habia indicado. Lo capturamos aqui y respetamos el codigo y
    // el reason que vienen dentro.
    //
    // Politica de logging:
    //   - 4xx: log.warn (error esperado del cliente, no del servidor).
    //   - 5xx: log.error (algo se ha roto en el servidor de verdad).
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException ex, HttpServletRequest req) {
        HttpStatusCode status = ex.getStatusCode();
        HttpStatus resolved = HttpStatus.resolve(status.value());
        String reasonPhrase = resolved != null ? resolved.getReasonPhrase() : "Error";
        String message = ex.getReason() != null ? ex.getReason() : reasonPhrase;
        String path = req != null ? req.getRequestURI() : null;

        if (status.is5xxServerError()) {
            log.error("ResponseStatusException 5xx en {}: status={} reason={}", path, status.value(), message, ex);
        } else {
            log.warn("ResponseStatusException {}: status={} reason={} path={}", status.value(), status.value(), message, path);
        }

        ApiError body = new ApiError(status.value(), reasonPhrase, message, path);
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleOther(Exception ex, HttpServletRequest req) {
        if (isClientAbortLike(ex)) {
            log.debug("Request abortada por el cliente en {}: {}", req.getRequestURI(), ex.getMessage());
            return ResponseEntity.noContent().build();
        }

        log.error("Error no controlado en {}: {}", req.getRequestURI(), ex.getMessage(), ex);
        ApiError body = new ApiError(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Internal Server Error",
                "Ha ocurrido un error interno. Inténtalo de nuevo.",
                req.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    private boolean isClientAbortLike(Throwable ex) {
        Throwable current = ex;
        while (current != null) {
            if (current instanceof AsyncRequestNotUsableException) {
                return true;
            }
            if (current instanceof IOException && hasClientAbortMessage(current.getMessage())) {
                return true;
            }
            String simpleName = current.getClass().getSimpleName();
            if ("ClientAbortException".equals(simpleName)) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private boolean hasClientAbortMessage(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        String normalized = message.toLowerCase();
        return normalized.contains("broken pipe")
                || normalized.contains("connection reset by peer");
    }
}
