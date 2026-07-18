package com.sharemechat.gdpr.service;

import com.sharemechat.entity.User;
import com.sharemechat.gdpr.dto.GdprExportResponse;
import com.sharemechat.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GDPR art. 15: servicio que materializa el runbook manual documentado
 * en {@code docs/04-operations/runbooks.md} como export automatizado
 * de datos personales de un usuario.
 *
 * <p>Usa {@link EntityManager} con SQL nativo (no JPQL) para dos razones:
 * (a) evita tocar los 40+ repositorios existentes anadiendo finders
 * ad-hoc que no se reutilizan; (b) permite iterar sobre columnas
 * heterogeneas sin acoplar el DTO al modelo JPA. La salida es
 * {@code List<Map<String, Object>>} por tabla, tal cual se lee del
 * ResultSet, para maxima flexibilidad al empaquetar el JSON.
 *
 * <p>El {@code @Transactional(readOnly = true)} garantiza que ninguna
 * consulta pueda alterar datos por error. Todas las queries son
 * {@code SELECT * FROM ... WHERE user_id = :userId} (o similar segun
 * la tabla), respetando el patron del runbook 4.a-g.
 *
 * <p>Ownership del dato ajeno: cuando una tabla contiene peer id
 * (mensajes recibidos, gifts entrantes, etc.) el service SI lo emite
 * — la anonimizacion final es decision del DPO al empaquetar el
 * fichero de respuesta (paso 6 del runbook, seccion "Tratamiento de
 * datos de terceros").
 */
@Service
public class GdprExportService {

    private static final Logger log = LoggerFactory.getLogger(GdprExportService.class);

    @PersistenceContext
    private EntityManager em;

    private final UserRepository userRepository;

    public GdprExportService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public GdprExportResponse exportUserData(Long targetUserId, Long requestedByAdminId) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + targetUserId));

        GdprExportResponse resp = new GdprExportResponse(target.getId(), target.getEmail(), requestedByAdminId);
        log.info("[GDPR-EXPORT] start targetUserId={} email={} requestedBy={}",
                targetUserId, target.getEmail(), requestedByAdminId);

        // 4.a Identidad y cuenta
        resp.addToIdentity("users", selectAsMaps("SELECT * FROM users WHERE id = :uid", targetUserId));
        resp.addToIdentity("user_languages", selectAsMaps("SELECT * FROM user_languages WHERE user_id = :uid", targetUserId));
        resp.addToIdentity("consent_events", selectAsMaps("SELECT * FROM consent_events WHERE user_id = :uid ORDER BY created_at", targetUserId));
        // password/tokens: NO devolvemos el hash, solo indicador de existencia + timestamps
        resp.addToIdentity("email_verification_tokens", selectAsMaps(
                "SELECT id, user_id, expires_at, verified_at, created_at FROM email_verification_tokens WHERE user_id = :uid", targetUserId));
        resp.addToIdentity("password_reset_tokens", selectAsMaps(
                "SELECT id, user_id, expires_at, used_at, created_at FROM password_reset_tokens WHERE user_id = :uid", targetUserId));
        resp.addToIdentity("unsubscribe", selectAsMaps(
                "SELECT * FROM unsubscribe WHERE user_id = :uid OR email = :email",
                Map.of("uid", targetUserId, "email", target.getEmail())));

        // 4.b Cliente
        resp.addToClient("clients", selectAsMaps("SELECT * FROM clients WHERE user_id = :uid", targetUserId));
        resp.addToClient("balances", selectAsMaps("SELECT * FROM balances WHERE user_id = :uid ORDER BY created_at", targetUserId));
        resp.addToClient("transactions", selectAsMaps("SELECT * FROM transactions WHERE user_id = :uid ORDER BY timestamp", targetUserId));
        resp.addToClient("payment_sessions", selectAsMaps("SELECT * FROM payment_sessions WHERE user_id = :uid ORDER BY created_at", targetUserId));
        resp.addToClient("psp_webhook_events", selectAsMaps(
                "SELECT p.* FROM psp_webhook_events p " +
                "JOIN payment_sessions ps ON ps.psp_transaction_id = p.provider_payment_id AND ps.provider = p.provider " +
                "WHERE ps.user_id = :uid", targetUserId));
        resp.addToClient("client_documents", selectAsMaps("SELECT * FROM client_documents WHERE user_id = :uid", targetUserId));
        resp.addToClient("kyc_sessions", selectAsMaps("SELECT * FROM kyc_sessions WHERE user_id = :uid", targetUserId));
        resp.addToClient("kyc_webhook_events", selectAsMaps(
                "SELECT k.* FROM kyc_webhook_events k JOIN kyc_sessions ks ON ks.id = k.session_id WHERE ks.user_id = :uid", targetUserId));
        resp.addToClient("favorites_models", selectAsMaps("SELECT * FROM favorites_models WHERE client_user_id = :uid", targetUserId));
        resp.addToClient("user_trial_streams", selectAsMaps("SELECT * FROM user_trial_streams WHERE user_id = :uid", targetUserId));

        // 4.c Modelo
        resp.addToModel("models", selectAsMaps("SELECT * FROM models WHERE user_id = :uid", targetUserId));
        resp.addToModel("model_documents", selectAsMaps("SELECT * FROM model_documents WHERE user_id = :uid", targetUserId));
        resp.addToModel("model_assets", selectAsMaps("SELECT * FROM model_assets WHERE user_id = :uid", targetUserId));
        resp.addToModel("model_asset_reviews", selectAsMaps("SELECT * FROM model_asset_reviews WHERE model_user_id = :uid", targetUserId));
        resp.addToModel("model_review_checklist", selectAsMaps("SELECT * FROM model_review_checklist WHERE model_user_id = :uid", targetUserId));
        resp.addToModel("model_contract_acceptances", selectAsMaps("SELECT * FROM model_contract_acceptances WHERE user_id = :uid", targetUserId));
        resp.addToModel("model_earning_tiers", selectAsMaps("SELECT * FROM model_earning_tiers WHERE model_user_id = :uid", targetUserId));
        resp.addToModel("model_tier_daily_snapshots", selectAsMaps("SELECT * FROM model_tier_daily_snapshots WHERE model_user_id = :uid", targetUserId));
        resp.addToModel("payout_requests", selectAsMaps("SELECT * FROM payout_requests WHERE model_user_id = :uid", targetUserId));
        resp.addToModel("home_featured_models", selectAsMaps("SELECT * FROM home_featured_models WHERE model_user_id = :uid", targetUserId));
        resp.addToModel("affiliate_link_tokens", selectAsMaps("SELECT * FROM affiliate_link_tokens WHERE model_user_id = :uid", targetUserId));
        resp.addToModel("affiliate_commissions", selectAsMaps("SELECT * FROM affiliate_commissions WHERE affiliate_user_id = :uid", targetUserId));
        resp.addToModel("affiliate_click_events", selectAsMaps("SELECT * FROM affiliate_click_events WHERE affiliate_user_id = :uid", targetUserId));
        resp.addToModel("favorites_clients", selectAsMaps("SELECT * FROM favorites_clients WHERE model_user_id = :uid", targetUserId));

        // 4.d Streaming
        resp.addToStreaming("stream_records", selectAsMaps(
                "SELECT * FROM stream_records WHERE client_user_id = :uid OR model_user_id = :uid ORDER BY start_time", targetUserId));
        resp.addToStreaming("stream_status_events", selectAsMaps(
                "SELECT sse.* FROM stream_status_events sse " +
                "JOIN stream_records sr ON sr.id = sse.stream_record_id " +
                "WHERE sr.client_user_id = :uid OR sr.model_user_id = :uid", targetUserId));
        resp.addToStreaming("stream_moderation_sessions", selectAsMaps(
                "SELECT sms.* FROM stream_moderation_sessions sms " +
                "JOIN stream_records sr ON sr.id = sms.stream_record_id " +
                "WHERE sr.client_user_id = :uid OR sr.model_user_id = :uid", targetUserId));
        resp.addToStreaming("stream_moderation_reviews", selectAsMaps(
                "SELECT smr.* FROM stream_moderation_reviews smr " +
                "JOIN stream_records sr ON sr.id = smr.stream_record_id " +
                "WHERE sr.client_user_id = :uid OR sr.model_user_id = :uid", targetUserId));
        resp.addToStreaming("stream_moderation_events", selectAsMaps("SELECT * FROM stream_moderation_events WHERE user_id = :uid", targetUserId));
        resp.addToStreaming("stream_moderation_attendance", selectAsMaps("SELECT * FROM stream_moderation_attendance WHERE user_id = :uid", targetUserId));
        resp.addToStreaming("liveness_attempts", selectAsMaps("SELECT * FROM liveness_attempts WHERE user_id = :uid", targetUserId));

        // 4.e Comunicaciones
        resp.addToCommunications("messages_sent", selectAsMaps("SELECT * FROM messages WHERE sender_id = :uid ORDER BY created_at", targetUserId));
        resp.addToCommunications("messages_received", selectAsMaps("SELECT * FROM messages WHERE recipient_id = :uid ORDER BY created_at", targetUserId));
        resp.addToCommunications("gifts_sent", selectAsMaps("SELECT * FROM gifts WHERE sender_user_id = :uid ORDER BY created_at", targetUserId));
        resp.addToCommunications("gifts_received", selectAsMaps("SELECT * FROM gifts WHERE recipient_user_id = :uid ORDER BY created_at", targetUserId));
        resp.addToCommunications("support_conversations", selectAsMaps("SELECT * FROM support_conversations WHERE user_id = :uid ORDER BY created_at", targetUserId));
        resp.addToCommunications("support_messages", selectAsMaps(
                "SELECT sm.* FROM support_messages sm " +
                "JOIN support_conversations sc ON sc.id = sm.conversation_id " +
                "WHERE sc.user_id = :uid ORDER BY sm.created_at", targetUserId));

        // 4.f Compliance y control
        resp.addToCompliance("complaints", selectAsMaps("SELECT * FROM complaints WHERE user_id = :uid", targetUserId));
        resp.addToCompliance("complaint_audit_log", selectAsMaps("SELECT * FROM complaint_audit_log WHERE user_id = :uid", targetUserId));
        resp.addToCompliance("moderation_reports_filed", selectAsMaps("SELECT * FROM moderation_reports WHERE reporter_user_id = :uid", targetUserId));
        resp.addToCompliance("moderation_reports_about", selectAsMaps("SELECT * FROM moderation_reports WHERE reported_user_id = :uid", targetUserId));
        resp.addToCompliance("user_blocks_by_me", selectAsMaps("SELECT * FROM user_blocks WHERE blocker_user_id = :uid", targetUserId));
        resp.addToCompliance("user_blocks_against_me", selectAsMaps("SELECT * FROM user_blocks WHERE blocked_user_id = :uid", targetUserId));
        // refresh_tokens: solo count + timestamps, jamas el hash
        resp.addToCompliance("refresh_tokens", selectAsMaps(
                "SELECT id, user_id, expires_at, revoked_at, created_at FROM refresh_tokens WHERE user_id = :uid", targetUserId));

        // 4.g Backoffice (solo si aplica)
        List<Map<String, Object>> boRoles = selectAsMaps("SELECT * FROM user_backoffice_roles WHERE user_id = :uid", targetUserId);
        if (!boRoles.isEmpty()) {
            resp.addToBackoffice("user_backoffice_roles", boRoles);
            resp.addToBackoffice("user_permission_overrides", selectAsMaps("SELECT * FROM user_permission_overrides WHERE user_id = :uid", targetUserId));
            resp.addToBackoffice("backoffice_user_access", selectAsMaps("SELECT * FROM backoffice_user_access WHERE user_id = :uid", targetUserId));
            resp.addToBackoffice("backoffice_access_audit_log", selectAsMaps("SELECT * FROM backoffice_access_audit_log WHERE user_id = :uid", targetUserId));
            resp.addToBackoffice("backoffice_agent_profile_created", selectAsMaps("SELECT * FROM backoffice_agent_profile WHERE created_by_user_id = :uid", targetUserId));
            resp.addToBackoffice("backoffice_agent_profile_grants_received", selectAsMaps("SELECT * FROM backoffice_agent_profile_grant WHERE granted_user_id = :uid", targetUserId));
        }

        log.info("[GDPR-EXPORT] done targetUserId={} sections=identity,client,model,streaming,communications,compliance,backoffice={}",
                targetUserId, boRoles.isEmpty() ? "N/A" : "yes");
        return resp;
    }

    private List<Map<String, Object>> selectAsMaps(String nativeSql, Long userId) {
        return selectAsMaps(nativeSql, Map.of("uid", userId));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> selectAsMaps(String nativeSql, Map<String, Object> params) {
        Query q = em.createNativeQuery(nativeSql, jakarta.persistence.Tuple.class);
        params.forEach(q::setParameter);
        List<jakarta.persistence.Tuple> rows;
        try {
            rows = q.getResultList();
        } catch (Exception ex) {
            log.warn("[GDPR-EXPORT] query fail sql=`{}` err={}", nativeSql, ex.getMessage());
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (jakarta.persistence.Tuple t : rows) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (jakarta.persistence.TupleElement<?> el : t.getElements()) {
                String alias = el.getAlias();
                Object value = t.get(alias);
                row.put(alias, normalize(value));
            }
            out.add(row);
        }
        return out;
    }

    /**
     * Convierte tipos JDBC en representaciones serializables por Jackson
     * sin timezone-shift accidental. LocalDateTime/Instant se dejan tal
     * cual, BigDecimal se emite como string para no perder precision,
     * los blobs se marcan como "&lt;binary&gt;" con el tamano.
     */
    private Object normalize(Object v) {
        if (v == null) return null;
        if (v instanceof byte[] b) return "<binary:" + b.length + "b>";
        if (v instanceof BigDecimal bd) return bd.toPlainString();
        if (v instanceof java.sql.Timestamp ts) return ts.toLocalDateTime();
        if (v instanceof java.sql.Date d) return d.toLocalDate();
        if (v instanceof LocalDateTime || v instanceof LocalDate) return v;
        return v;
    }
}
