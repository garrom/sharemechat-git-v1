package com.sharemechat.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.stream.Collectors;

@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // 400 – Email en uso
    @ExceptionHandler(EmailAlreadyInUseException.class)
    public ResponseEntity<ApiError> handleEmailInUse(EmailAlreadyInUseException ex, HttpServletRequest req) {
        log.warn("Email en uso: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Bad Request", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // 400 – Edad mínima modelo
    @ExceptionHandler(UnderageModelException.class)
    public ResponseEntity<ApiError> handleUnderage(UnderageModelException ex, HttpServletRequest req) {
        log.warn("Restricción de edad: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Bad Request", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // 400 – Validaciones @Valid
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        String details = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + (fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "inválido"))
                .collect(Collectors.joining("; "));
        log.warn("Validación inválida: {}", details);
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Bad Request", details, req.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // 401 – No autenticado
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuth(AuthenticationException ex, HttpServletRequest req) {
        log.warn("No autenticado: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.UNAUTHORIZED.value(), "Unauthorized", "No autenticado", req.getRequestURI());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    // 403 – Sin permisos
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, HttpServletRequest req) {
        log.warn("Acceso denegado: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.FORBIDDEN.value(), "Forbidden", "Acceso denegado", req.getRequestURI());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    // 400 – IllegalArgument en lógica de negocio conocida
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest req) {
        log.warn("Argumento inválido: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Bad Request", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // 409 – Ya son favoritos mutuos
    @ExceptionHandler(AlreadyFavoritesException.class)
    public ResponseEntity<ApiError> handleAlreadyFavorites(AlreadyFavoritesException ex, HttpServletRequest req) {
        log.warn("Favoritos ya aceptados: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.CONFLICT.value(), "Conflict", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    // 409 – Invitación ya existente en estado pending
    @ExceptionHandler(InvitationAlreadyPendingException.class)
    public ResponseEntity<ApiError> handleInvitationPending(InvitationAlreadyPendingException ex, HttpServletRequest req) {
        log.warn("Invitación ya pendiente: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.CONFLICT.value(), "Conflict", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    // 403 – No son favoritos mutuos
    @ExceptionHandler(NotMutualFavoritesException.class)
    public ResponseEntity<ApiError> handleNotMutualFavorites(NotMutualFavoritesException ex, HttpServletRequest req) {
        log.warn("Llamada bloqueada por favoritos no aceptados: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.FORBIDDEN.value(), "Forbidden", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    // 400 – Nickname en uso
    @ExceptionHandler(NicknameAlreadyInUseException.class)
    public ResponseEntity<ApiError> handleNicknameInUse(NicknameAlreadyInUseException ex, HttpServletRequest req) {
        log.warn("Nickname en uso: {}", ex.getMessage());
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Bad Request", ex.getMessage(), req.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // 503 – Home sin featured models precargadas
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

    // 500 – Cualquier otro error no controlado
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleOther(Exception ex, HttpServletRequest req) {
        log.error("Error no controlado en {}: {}", req.getRequestURI(), ex.getMessage(), ex);
        ApiError body = new ApiError(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Internal Server Error",
                "Ha ocurrido un error interno. Inténtalo de nuevo.",
                req.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    // 403 – Bloqueo entre usuarios
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


}
