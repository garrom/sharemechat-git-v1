package com.sharemechat.gdpr.controller;

import com.sharemechat.entity.User;
import com.sharemechat.gdpr.dto.GdprExportResponse;
import com.sharemechat.gdpr.service.GdprExportService;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * GDPR art. 15: endpoint admin para materializar el derecho de acceso
 * del interesado como descarga JSON estructurada.
 *
 * <p>Protegido por catch-all {@code /api/admin/**} en
 * {@link com.sharemechat.security.SecurityConfig} que exige
 * {@code ROLE_ADMIN}. No requiere anotacion adicional por metodo.
 *
 * <p>Uso operativo: el DPO recibe la peticion GDPR por
 * {@code contact+dpo@sharemechat.com}, verifica identidad segun runbook
 * (paso 2), invoca este endpoint con el {@code userId} del interesado,
 * empaqueta el JSON devuelto para el envio (paso 6 del runbook con
 * tratamiento de datos de terceros + PDF indice legible).
 *
 * <p>Runbook completo en {@code docs/04-operations/runbooks.md} seccion
 * "Runbook de peticion GDPR art. 15 (derecho de acceso del interesado)".
 */
@RestController
@RequestMapping("/api/admin/gdpr")
public class GdprAdminController {

    private static final Logger log = LoggerFactory.getLogger(GdprAdminController.class);
    private static final DateTimeFormatter FILENAME_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final GdprExportService gdprExportService;
    private final UserRepository userRepository;

    public GdprAdminController(GdprExportService gdprExportService, UserRepository userRepository) {
        this.gdprExportService = gdprExportService;
        this.userRepository = userRepository;
    }

    /**
     * Devuelve el JSON completo con los datos personales del usuario
     * {@code userId} organizados en 7 secciones (identity, client, model,
     * streaming, communications, compliance, backoffice). Header
     * {@code Content-Disposition: attachment} para forzar descarga.
     */
    @GetMapping("/export/{userId}")
    public ResponseEntity<GdprExportResponse> exportUserData(
            @PathVariable Long userId, Authentication auth) {

        Long adminUserId = resolveAdminUserId(auth);
        log.info("[GDPR-EXPORT] endpoint hit adminUserId={} targetUserId={}", adminUserId, userId);

        try {
            GdprExportResponse resp = gdprExportService.exportUserData(userId, adminUserId);
            String filename = "gdpr-export-user-" + userId + "-"
                    + FILENAME_TS.format(resp.getExportedAt().atZone(java.time.ZoneOffset.UTC)) + ".json";
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .body(resp);
        } catch (IllegalArgumentException iae) {
            log.warn("[GDPR-EXPORT] targetUser no encontrado userId={} err={}", userId, iae.getMessage());
            return ResponseEntity.notFound().build();
        } catch (Exception ex) {
            log.error("[GDPR-EXPORT] error interno userId={}: {}", userId, ex.getMessage(), ex);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Devuelve datos minimos del usuario objetivo (id, email, role,
     * verificationStatus) para la confirmacion previa a la descarga en
     * la UI admin. NO devuelve datos sensibles - eso solo pasa a traves
     * del endpoint /export/{userId}.
     */
    @GetMapping("/user-lookup/{userId}")
    public ResponseEntity<Map<String, Object>> lookupUser(@PathVariable Long userId) {
        return userRepository.findById(userId)
                .<ResponseEntity<Map<String, Object>>>map(u -> {
                    Map<String, Object> body = new java.util.LinkedHashMap<>();
                    body.put("id", u.getId());
                    body.put("email", u.getEmail());
                    body.put("role", u.getRole());
                    body.put("verificationStatus", u.getVerificationStatus());
                    body.put("nickname", u.getNickname());
                    return ResponseEntity.ok(body);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private Long resolveAdminUserId(Authentication auth) {
        if (auth == null) return null;
        try {
            String email = auth.getName();
            return userRepository.findByEmail(email).map(User::getId).orElse(null);
        } catch (Exception ex) {
            return null;
        }
    }
}
