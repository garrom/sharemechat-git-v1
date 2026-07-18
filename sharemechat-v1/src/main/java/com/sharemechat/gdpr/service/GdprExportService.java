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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GDPR art. 15: servicio que materializa el runbook manual documentado
 * en {@code docs/04-operations/runbooks.md} como export automatizado de
 * datos personales de un usuario.
 *
 * <p>Notas de implementacion tras la primera pasada de smoke en PROD
 * 2026-07-18:
 *
 * <ul>
 *   <li><b>Sin {@code @Transactional}</b>: cada query nativa se ejecuta
 *   en su propio auto-commit. Si tuviéramos {@code @Transactional} y
 *   una query fallara, Spring marca el TX como rollback-only aunque el
 *   codigo capture la excepcion, provocando
 *   {@code UnexpectedRollbackException} al retornar. Como son solo
 *   SELECTs read-only, no necesitamos transaccion.</li>
 *
 *   <li><b>Nombres de columnas alineados al schema real</b>: el runbook
 *   Markdown asumia convenciones tipo {@code client_user_id},
 *   {@code model_user_id}, {@code sender_user_id}. El schema real usa
 *   {@code client_id}, {@code model_id}, etc. porque {@code models.user_id}
 *   y {@code clients.user_id} son la propia PK (no un FK). Este servicio
 *   respeta el schema real.</li>
 *
 *   <li><b>Joins entre tablas con collation distinta</b> (por ejemplo
 *   {@code psp_webhook_events} y {@code payment_sessions}): resueltos con
 *   dos consultas en Java en vez de un JOIN SQL, para evitar
 *   {@code Illegal mix of collations}.</li>
 * </ul>
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

    public GdprExportResponse exportUserData(Long targetUserId, Long requestedByAdminId) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + targetUserId));

        GdprExportResponse resp = new GdprExportResponse(target.getId(), target.getEmail(), requestedByAdminId);
        log.info("[GDPR-EXPORT] start targetUserId={} email={} requestedBy={}",
                targetUserId, target.getEmail(), requestedByAdminId);

        // 4.a Identidad y cuenta
        // users: NUNCA emitir el hash bcrypt de la password (runbook paso 7).
        // Se hace SELECT explicito con todas las columnas menos `password`.
        // Si en el futuro se anade una columna nueva sensible, hay que
        // actualizar esta lista manualmente.
        resp.addToIdentity("users", selectAsMaps(
                "SELECT id, nickname, email, role, ui_locale, country_detected, user_type, name, surname, " +
                "date_of_birth, confir_adult, accept_term, term_version, regist_ip, biography, interests, " +
                "is_active, unsubscribe, created_at, verification_status, updated_at, account_status, " +
                "suspended_until, risk_reason, risk_updated_at, risk_updated_by, email_verified_at, " +
                "client_kyc_status, client_kyc_decided_at, client_kyc_estimated_age, referral_code_owner, " +
                "referred_by_user_id, referred_at " +
                "FROM users WHERE id = :uid", targetUserId));
        resp.addToIdentity("user_languages", selectAsMaps("SELECT * FROM user_languages WHERE user_id = :uid", targetUserId));
        resp.addToIdentity("consent_events", selectAsMaps("SELECT * FROM consent_events WHERE user_id = :uid ORDER BY created_at", targetUserId));
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
        // psp_webhook_events: 2 queries en Java para evitar collation mix con payment_sessions.
        List<Map<String, Object>> pspSessions = selectAsMaps(
                "SELECT provider, psp_transaction_id FROM payment_sessions WHERE user_id = :uid AND psp_transaction_id IS NOT NULL", targetUserId);
        List<Map<String, Object>> pspEvents = new ArrayList<>();
        for (Map<String, Object> row : pspSessions) {
            Object prov = row.get("provider");
            Object pptx = row.get("psp_transaction_id");
            if (prov == null || pptx == null) continue;
            pspEvents.addAll(selectAsMaps(
                    "SELECT * FROM psp_webhook_events WHERE provider = :prov AND provider_payment_id = :pptx",
                    Map.of("prov", prov, "pptx", pptx)));
        }
        resp.addToClient("psp_webhook_events", pspEvents);
        resp.addToClient("client_documents", selectAsMaps("SELECT * FROM client_documents WHERE user_id = :uid", targetUserId));
        resp.addToClient("kyc_sessions", selectAsMaps("SELECT * FROM kyc_sessions WHERE user_id = :uid", targetUserId));
        // kyc_webhook_events: 2 queries por misma razon.
        List<Map<String, Object>> kycSessions = selectAsMaps(
                "SELECT provider, provider_session_id FROM kyc_sessions WHERE user_id = :uid AND provider_session_id IS NOT NULL", targetUserId);
        List<Map<String, Object>> kycEvents = new ArrayList<>();
        for (Map<String, Object> row : kycSessions) {
            Object prov = row.get("provider");
            Object psid = row.get("provider_session_id");
            if (prov == null || psid == null) continue;
            kycEvents.addAll(selectAsMaps(
                    "SELECT * FROM kyc_webhook_events WHERE provider = :prov AND provider_session_id = :psid",
                    Map.of("prov", prov, "psid", psid)));
        }
        resp.addToClient("kyc_webhook_events", kycEvents);
        resp.addToClient("favorites_models", selectAsMaps("SELECT * FROM favorites_models WHERE client_id = :uid", targetUserId));
        resp.addToClient("user_trial_streams", selectAsMaps("SELECT * FROM user_trial_streams WHERE viewer_user_id = :uid", targetUserId));

        // 4.c Modelo
        resp.addToModel("models", selectAsMaps("SELECT * FROM models WHERE user_id = :uid", targetUserId));
        resp.addToModel("model_documents", selectAsMaps("SELECT * FROM model_documents WHERE user_id = :uid", targetUserId));
        resp.addToModel("model_assets", selectAsMaps("SELECT * FROM model_assets WHERE user_id = :uid", targetUserId));
        resp.addToModel("model_asset_reviews", selectAsMaps("SELECT * FROM model_asset_reviews WHERE user_id = :uid", targetUserId));
        resp.addToModel("model_review_checklist", selectAsMaps("SELECT * FROM model_review_checklist WHERE user_id = :uid", targetUserId));
        resp.addToModel("model_contract_acceptances", selectAsMaps("SELECT * FROM model_contract_acceptances WHERE user_id = :uid", targetUserId));
        // model_earning_tiers es catalogo global, no per-user. Se omite.
        resp.addToModel("model_tier_daily_snapshots", selectAsMaps("SELECT * FROM model_tier_daily_snapshots WHERE model_id = :uid", targetUserId));
        resp.addToModel("payout_requests", selectAsMaps("SELECT * FROM payout_requests WHERE model_user_id = :uid", targetUserId));
        resp.addToModel("home_featured_models", selectAsMaps("SELECT * FROM home_featured_models WHERE model_id = :uid", targetUserId));
        resp.addToModel("affiliate_link_tokens", selectAsMaps("SELECT * FROM affiliate_link_tokens WHERE model_user_id = :uid", targetUserId));
        resp.addToModel("affiliate_commissions", selectAsMaps("SELECT * FROM affiliate_commissions WHERE referrer_model_user_id = :uid OR client_user_id = :uid", targetUserId));
        resp.addToModel("affiliate_click_events", selectAsMaps("SELECT * FROM affiliate_click_events WHERE model_user_id = :uid OR client_user_id = :uid", targetUserId));
        resp.addToModel("favorites_clients", selectAsMaps("SELECT * FROM favorites_clients WHERE model_id = :uid", targetUserId));

        // 4.d Streaming
        resp.addToStreaming("stream_records", selectAsMaps(
                "SELECT * FROM stream_records WHERE client_id = :uid OR model_id = :uid ORDER BY start_time", targetUserId));
        resp.addToStreaming("stream_status_events", selectAsMaps(
                "SELECT sse.* FROM stream_status_events sse " +
                "JOIN stream_records sr ON sr.id = sse.stream_record_id " +
                "WHERE sr.client_id = :uid OR sr.model_id = :uid", targetUserId));
        resp.addToStreaming("stream_moderation_sessions", selectAsMaps(
                "SELECT sms.* FROM stream_moderation_sessions sms " +
                "JOIN stream_records sr ON sr.id = sms.stream_record_id " +
                "WHERE sr.client_id = :uid OR sr.model_id = :uid", targetUserId));
        resp.addToStreaming("stream_moderation_reviews", selectAsMaps(
                "SELECT smr.* FROM stream_moderation_reviews smr " +
                "JOIN stream_records sr ON sr.id = smr.stream_record_id " +
                "WHERE sr.client_id = :uid OR sr.model_id = :uid", targetUserId));
        resp.addToStreaming("stream_moderation_events", selectAsMaps(
                "SELECT sme.* FROM stream_moderation_events sme " +
                "JOIN stream_moderation_sessions sms ON sms.id = sme.stream_moderation_session_id " +
                "JOIN stream_records sr ON sr.id = sms.stream_record_id " +
                "WHERE sr.client_id = :uid OR sr.model_id = :uid", targetUserId));
        resp.addToStreaming("stream_moderation_attendance", selectAsMaps("SELECT * FROM stream_moderation_attendance WHERE model_user_id = :uid", targetUserId));
        resp.addToStreaming("liveness_attempts", selectAsMaps("SELECT * FROM liveness_attempts WHERE user_id = :uid", targetUserId));

        // 4.e Comunicaciones
        resp.addToCommunications("messages_sent", selectAsMaps("SELECT * FROM messages WHERE sender_id = :uid ORDER BY created_at", targetUserId));
        resp.addToCommunications("messages_received", selectAsMaps("SELECT * FROM messages WHERE recipient_id = :uid ORDER BY created_at", targetUserId));
        // gifts es catalogo. Los envios se registran en `transactions` con `gift_id` no nulo (cubierto en 4.b).
        // Extraemos un resumen dedicado por comodidad del DPO.
        resp.addToCommunications("gift_transactions", selectAsMaps(
                "SELECT * FROM transactions WHERE user_id = :uid AND gift_id IS NOT NULL ORDER BY timestamp", targetUserId));
        resp.addToCommunications("support_conversations", selectAsMaps("SELECT * FROM support_conversations WHERE user_id = :uid ORDER BY started_at", targetUserId));
        resp.addToCommunications("support_messages", selectAsMaps(
                "SELECT sm.* FROM support_messages sm " +
                "JOIN support_conversations sc ON sc.id = sm.conversation_id " +
                "WHERE sc.user_id = :uid ORDER BY sm.created_at", targetUserId));

        // 4.f Compliance y control
        resp.addToCompliance("complaints_about_me", selectAsMaps("SELECT * FROM complaints WHERE subject_user_id = :uid", targetUserId));
        resp.addToCompliance("complaints_reviewed_by_me", selectAsMaps("SELECT * FROM complaints WHERE reviewed_by_user_id = :uid", targetUserId));
        resp.addToCompliance("complaint_audit_log_by_me", selectAsMaps("SELECT * FROM complaint_audit_log WHERE actor_user_id = :uid", targetUserId));
        resp.addToCompliance("moderation_reports_filed", selectAsMaps("SELECT * FROM moderation_reports WHERE reporter_user_id = :uid", targetUserId));
        resp.addToCompliance("moderation_reports_about", selectAsMaps("SELECT * FROM moderation_reports WHERE reported_user_id = :uid", targetUserId));
        resp.addToCompliance("user_blocks_by_me", selectAsMaps("SELECT * FROM user_blocks WHERE blocker_user_id = :uid", targetUserId));
        resp.addToCompliance("user_blocks_against_me", selectAsMaps("SELECT * FROM user_blocks WHERE blocked_user_id = :uid", targetUserId));
        resp.addToCompliance("refresh_tokens", selectAsMaps(
                "SELECT id, user_id, expires_at, revoked_at, created_at FROM refresh_tokens WHERE user_id = :uid", targetUserId));

        // 4.g Backoffice (solo si aplica)
        List<Map<String, Object>> boRoles = selectAsMaps("SELECT * FROM user_backoffice_roles WHERE user_id = :uid", targetUserId);
        if (!boRoles.isEmpty()) {
            resp.addToBackoffice("user_backoffice_roles", boRoles);
            resp.addToBackoffice("user_permission_overrides", selectAsMaps("SELECT * FROM user_permission_overrides WHERE user_id = :uid", targetUserId));
            resp.addToBackoffice("backoffice_user_access", selectAsMaps("SELECT * FROM backoffice_user_access WHERE user_id = :uid", targetUserId));
            resp.addToBackoffice("backoffice_access_audit_log_target", selectAsMaps("SELECT * FROM backoffice_access_audit_log WHERE target_user_id = :uid", targetUserId));
            resp.addToBackoffice("backoffice_access_audit_log_actor", selectAsMaps("SELECT * FROM backoffice_access_audit_log WHERE actor_user_id = :uid", targetUserId));
            resp.addToBackoffice("backoffice_agent_profile_created", selectAsMaps("SELECT * FROM backoffice_agent_profile WHERE created_by = :uid", targetUserId));
            resp.addToBackoffice("backoffice_agent_profile_grants_received", selectAsMaps("SELECT * FROM backoffice_agent_profile_grant WHERE user_id = :uid", targetUserId));
        }

        log.info("[GDPR-EXPORT] done targetUserId={} backoffice={}",
                targetUserId, boRoles.isEmpty() ? "N/A" : "yes");
        return resp;
    }

    private List<Map<String, Object>> selectAsMaps(String nativeSql, Long userId) {
        return selectAsMaps(nativeSql, Map.of("uid", userId));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> selectAsMaps(String nativeSql, Map<String, Object> params) {
        try {
            Query q = em.createNativeQuery(nativeSql, jakarta.persistence.Tuple.class);
            params.forEach(q::setParameter);
            List<jakarta.persistence.Tuple> rows = q.getResultList();
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
        } catch (Exception ex) {
            log.warn("[GDPR-EXPORT] query fail sql=`{}` err={}", nativeSql, ex.getMessage());
            return List.of();
        }
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
