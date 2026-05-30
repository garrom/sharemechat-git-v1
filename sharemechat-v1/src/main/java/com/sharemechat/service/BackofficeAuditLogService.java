package com.sharemechat.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Servicio de escritura del audit log de backoffice
 * (tabla {@code backoffice_access_audit_log}).
 *
 * <p>Extraido de {@link BackofficeAccessService} en el frente de moderacion
 * de assets para que cualquier service de backoffice pueda registrar
 * decisiones (asset approve/reject, model document review, etc.) sin
 * acoplarse a la logica de altas/permisos de BackofficeAccessService.
 *
 * <p>Schema actual de la tabla (V1 baseline): {@code id, target_user_id,
 * actor_user_id, action, summary, payload_json, created_at}. Las
 * convenciones {@code resource_type} y {@code resource_id} (cuando
 * apliquen) viajan dentro del {@code payload_json} para no romper el
 * schema.
 *
 * <p>Defensa: si la tabla no existe (entornos antiguos, BD parcialmente
 * migrada), el servicio se comporta como no-op y solo deja warning en
 * log. No bloquea el flujo principal.
 */
@Service
public class BackofficeAuditLogService {

    private static final Logger log = LoggerFactory.getLogger(BackofficeAuditLogService.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public BackofficeAuditLogService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Inserta una entry en {@code backoffice_access_audit_log}.
     *
     * @param actorUserId  quien hace la accion (admin/support); puede ser null
     * @param targetUserId sobre quien recae (modelo, cliente, otro);
     *                     NO null
     * @param action       codigo corto en mayusculas (max 60 chars)
     *                     ej. {@code "ASSET_APPROVE"}, {@code "ASSET_REJECT"}
     * @param summary      texto libre breve para lectura humana (opcional)
     * @param payload      mapa serializable a JSON con metadatos
     *                     estructurados; null si no aplica
     */
    public void writeAuditLog(Long actorUserId,
                              Long targetUserId,
                              String action,
                              String summary,
                              Map<String, Object> payload) {
        if (!hasTable()) {
            return;
        }
        String payloadJson = null;
        try {
            if (payload != null) {
                payloadJson = objectMapper.writeValueAsString(payload);
            }
        } catch (JsonProcessingException ex) {
            log.warn("No se pudo serializar el audit payload de backoffice: {}", ex.getMessage());
        }

        try {
            jdbcTemplate.update(
                    "insert into backoffice_access_audit_log (target_user_id, actor_user_id, action, summary, payload_json) values (?, ?, ?, ?, ?)",
                    targetUserId,
                    actorUserId,
                    action,
                    safeText(summary),
                    payloadJson
            );
        } catch (DataAccessException ex) {
            log.warn("No se pudo guardar el audit log de backoffice targetUserId={}: {}", targetUserId, ex.getMessage());
        }
    }

    /**
     * Devuelve true si la tabla existe y es consultable. Util como
     * predicado defensivo en lecturas opcionales del audit log.
     */
    public boolean hasTable() {
        try {
            jdbcTemplate.query("select id from backoffice_access_audit_log limit 1", rs -> null);
            return true;
        } catch (DataAccessException ex) {
            return false;
        }
    }

    private static String safeText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
