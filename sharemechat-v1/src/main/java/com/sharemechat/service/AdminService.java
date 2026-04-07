package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.UserDTO;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.ModelDocument;
import com.sharemechat.entity.ModelReviewChecklist;
import com.sharemechat.entity.User;
import com.sharemechat.exception.UserNotFoundException;
import com.sharemechat.repository.AdminRepository;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.ModelReviewChecklistRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class AdminService {

    private static final String HIDDEN_VALUE = "[HIDDEN]";
    private static final Map<String, TableViewConfig> TABLE_CONFIG = new LinkedHashMap<>();

    static {
        register("accounting_anomalies", "id DESC");
        register("audit_runs", "id DESC");
        register("balances", "id DESC");
        register("client_documents", "created_at DESC, user_id DESC");
        register("clients", "user_id DESC");
        register("consent_events", "ts DESC, id DESC", Set.of("sig", "ip_hint"));
        register("favorites_clients", "id DESC");
        register("favorites_models", "id DESC");
        register("gifts", "id DESC");
        register("messages", "id DESC", Set.of("body"));
        register("model_contract_acceptances", "accepted_at DESC, id DESC");
        register("model_documents", "COALESCE(created_at, updated_at) DESC, user_id DESC");
        register("model_earning_tiers", "id DESC");
        register("model_review_checklist", "updated_at DESC, user_id DESC");
        register("model_tier_daily_snapshots", "snapshot_date DESC, id DESC");
        register("moderation_reports", "created_at DESC, id DESC");
        register("models", "user_id DESC");
        register("password_reset_tokens", "created_at DESC, id DESC", Set.of("token_hash"));
        register("payment_sessions", "created_at DESC, id DESC");
        register("payout_requests", "created_at DESC, id DESC");
        register("platform_balances", "id DESC");
        register("platform_transactions", "id DESC");
        register("stream_records", "id DESC");
        register("stream_status_events", "created_at DESC, id DESC");
        register("transactions", "id DESC");
        register("unsubscribe", "end_date DESC, user_id DESC");
        register("user_blocks", "created_at DESC, id DESC");
        register("user_trial_streams", "created_at DESC, id DESC");
        register(
                "users",
                "id DESC",
                Set.of("password", "biography", "interests", "regist_ip", "risk_reason")
        );
    }

    private final UserRepository userRepository;
    private final UserService userService;
    private final ModelRepository modelRepository;
    private final AdminRepository adminRepository;
    private final NamedParameterJdbcTemplate jdbc;
    private final ModelDocumentRepository modelDocumentRepository;
    private final ModelReviewChecklistRepository checklistRepository;
    private final EmailVerificationService emailVerificationService;

    public AdminService(UserRepository userRepository, UserService userService,
                        ModelRepository modelRepository, AdminRepository adminRepository,
                        NamedParameterJdbcTemplate jdbc, ModelDocumentRepository modelDocumentRepository,
                        ModelReviewChecklistRepository checklistRepository,
                        EmailVerificationService emailVerificationService) {
        this.userRepository = userRepository;
        this.userService = userService;
        this.modelRepository = modelRepository;
        this.adminRepository = adminRepository;
        this.jdbc = jdbc;
        this.modelDocumentRepository = modelDocumentRepository;
        this.checklistRepository = checklistRepository;
        this.emailVerificationService = emailVerificationService;
    }

    @Transactional(readOnly = true)
    public List<UserDTO> getModels(String verification) {
        List<User> list = (verification == null || verification.isBlank())
                ? userRepository.findByVerificationStatusIsNotNull()
                : userRepository.findByVerificationStatus(verification.toUpperCase());

        List<Long> userIds = list.stream()
                .map(User::getId)
                .filter(id -> id != null && id > 0)
                .toList();

        Map<Long, ModelReviewChecklist> checklistByUserId = checklistRepository.findAllById(userIds)
                .stream()
                .collect(java.util.stream.Collectors.toMap(ModelReviewChecklist::getUserId, x -> x));

        return list.stream().map(user -> {
            UserDTO dto = userService.mapToDTO(user);
            ModelReviewChecklist checklist = checklistByUserId.get(user.getId());
            dto.setModelChecklistFrontOk(checklist != null && checklist.isFrontOk());
            dto.setModelChecklistBackOk(checklist != null && checklist.isBackOk());
            dto.setModelChecklistSelfieOk(checklist != null && checklist.isSelfieOk());
            return dto;
        }).toList();
    }

    @Transactional
    public String reviewModel(Long userId, String action) {
        if (action == null || action.isBlank()) {
            throw new IllegalArgumentException("Acción requerida");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado con ID: " + userId));

        final String previousRole = user.getRole();
        final String a = action.toUpperCase();
        final String currentVerification = user.getVerificationStatus();

        if (Constants.VerificationStatuses.REJECTED.equals(currentVerification)
                && ("APPROVE".equals(a) || "PENDING".equals(a))) {
            throw new IllegalStateException("La modelo fue RECHAZADA definitivamente. No puede volver a PENDING ni APPROVED.");
        }

        switch (a) {
            case "APPROVE" -> {
                emailVerificationService.assertEmailVerified(
                        user,
                        "La modelo debe validar su email antes de ser aprobada.",
                        "MODEL_APPROVAL",
                        "VERIFY_EMAIL"
                );
                user.setVerificationStatus(Constants.VerificationStatuses.APPROVED);
                if (!Constants.Roles.MODEL.equals(user.getRole())) {
                    user.setRole(Constants.Roles.MODEL);
                }
                if (!modelRepository.existsById(user.getId())) {
                    Model m = new Model();
                    m.setUser(user);
                    modelRepository.save(m);
                }
            }
            case "REJECT" -> {
                user.setVerificationStatus(Constants.VerificationStatuses.REJECTED);
                if (Constants.Roles.MODEL.equals(user.getRole())) {
                    user.setRole(Constants.Roles.USER);
                }
            }
            case "PENDING" -> {
                if (Constants.VerificationStatuses.REJECTED.equals(currentVerification)) {
                    throw new IllegalStateException("La modelo fue RECHAZADA definitivamente. No puede volver a PENDING.");
                }
                user.setVerificationStatus(Constants.VerificationStatuses.PENDING);
            }
            default -> throw new IllegalArgumentException("Acción no válida: " + action);
        }

        userRepository.save(user);

        return "Estado: " + user.getVerificationStatus()
                + " | Rol previo: " + previousRole
                + " | Rol actual: " + user.getRole()
                + " | Model row: " + (modelRepository.existsById(user.getId()) ? "OK" : "NO");
    }

    private String fmtEUR(BigDecimal v) {
        if (v == null) v = BigDecimal.ZERO;
        return "€" + v.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> financeTopModels(int limit) {
        return adminRepository.topModelsByEarnings(PageRequest.of(0, Math.min(Math.max(limit, 1), 50)))
                .stream().map(r -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("modelId", ((Number) r[0]).longValue());
                    m.put("email", (String) r[1]);
                    m.put("name", (String) r[2]);
                    m.put("nickname", (String) r[3]);
                    m.put("totalEarningsEUR", fmtEUR((BigDecimal) r[4]));
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> financeTopClients(int limit) {
        return adminRepository.topClientsByTotalPagos(PageRequest.of(0, Math.min(Math.max(limit, 1), 50)))
                .stream().map(r -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("clientId", ((Number) r[0]).longValue());
                    m.put("email", (String) r[1]);
                    m.put("name", (String) r[2]);
                    m.put("nickname", (String) r[3]);
                    m.put("totalPagosEUR", fmtEUR((BigDecimal) r[4]));
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, String> financeSummary() {
        BigDecimal gross = adminRepository.sumGrossBilling();
        BigDecimal net = adminRepository.sumNetProfit();

        if (gross == null) gross = BigDecimal.ZERO;
        if (net == null) net = BigDecimal.ZERO;

        BigDecimal grossAbs = gross.abs();

        String profitPercentStr;
        if (grossAbs.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal pct = net.divide(grossAbs, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
            profitPercentStr = pct.toPlainString() + "%";
        } else {
            profitPercentStr = "0.00%";
        }

        Map<String, String> s = new HashMap<>();
        s.put("grossBillingEUR", fmtEUR(grossAbs));
        s.put("netProfitEUR", fmtEUR(net));
        s.put("profitPercent", profitPercentStr);
        return s;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> viewTable(String table, int limit) {
        if (table == null) throw new IllegalArgumentException("Tabla no permitida");

        String t = table.trim().toLowerCase();
        TableViewConfig config = TABLE_CONFIG.get(t);
        if (config == null) {
            throw new IllegalArgumentException("Tabla no permitida");
        }

        int lim = Math.min(Math.max(limit, 1), 100);
        String sql = "SELECT * FROM " + t + " ORDER BY " + config.orderBy() + " LIMIT :lim";

        return jdbc.query(sql, new MapSqlParameterSource("lim", lim),
                (rs, rowNum) -> {
                    var md = rs.getMetaData();
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= md.getColumnCount(); i++) {
                        String column = md.getColumnLabel(i);
                        Object value = rs.getObject(i);
                        row.put(column, redactValue(config, column, value));
                    }
                    return row;
                });
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> queryStreamsForInternalData(String q, String streamType, String status, Integer limit) {
        String normalizedQuery = normalizeQuery(q);
        Long numericQueryId = tryParseLong(normalizedQuery);
        String normalizedStreamType = normalizeValue(streamType);
        String normalizedStatus = normalizeValue(status);
        int safeLimit = normalizeLimit(limit, 20, 100);

        StringBuilder sql = new StringBuilder("""
                SELECT
                  sr.id,
                  sr.stream_type,
                  sr.client_id,
                  c.email AS client_email,
                  c.nickname AS client_nickname,
                  sr.model_id,
                  m.email AS model_email,
                  m.nickname AS model_nickname,
                  sr.start_time,
                  sr.confirmed_at,
                  sr.billable_start,
                  sr.end_time,
                  CASE
                    WHEN sr.end_time IS NOT NULL THEN 'closed'
                    WHEN sr.confirmed_at IS NULL THEN 'connecting'
                    ELSE 'active'
                  END AS status
                FROM stream_records sr
                JOIN users c ON c.id = sr.client_id
                JOIN users m ON m.id = sr.model_id
                WHERE 1=1
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();

        if (normalizedQuery != null) {
            if (numericQueryId != null) {
                sql.append("""
                         AND (
                           sr.id = :numericQueryId
                           OR sr.client_id = :numericQueryId
                           OR sr.model_id = :numericQueryId
                         )
                        """);
                params.addValue("numericQueryId", numericQueryId);
            } else {
                sql.append("""
                         AND (
                           LOWER(c.email) LIKE :queryLike
                           OR LOWER(c.nickname) LIKE :queryLike
                           OR LOWER(m.email) LIKE :queryLike
                           OR LOWER(m.nickname) LIKE :queryLike
                         )
                        """);
                params.addValue("queryLike", "%" + normalizedQuery.toLowerCase() + "%");
            }
        }

        if (normalizedStreamType != null) {
            sql.append(" AND sr.stream_type = :streamType ");
            params.addValue("streamType", normalizedStreamType.toUpperCase());
        }

        if (normalizedStatus != null) {
            sql.append("""
                     AND (
                       CASE
                         WHEN sr.end_time IS NOT NULL THEN 'closed'
                         WHEN sr.confirmed_at IS NULL THEN 'connecting'
                         ELSE 'active'
                       END = :status
                     )
                    """);
            params.addValue("status", normalizedStatus.toLowerCase());
        }

        sql.append(" ORDER BY sr.id DESC LIMIT :limit ");
        params.addValue("limit", safeLimit);

        return jdbc.queryForList(sql.toString(), params);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> queryPaymentsForInternalData(String q,
                                                            String operationType,
                                                            String paymentStatus,
                                                            String payoutStatus,
                                                            Integer limit) {
        String normalizedQuery = normalizeQuery(q);
        Long numericQueryId = tryParseLong(normalizedQuery);
        String normalizedOperationType = normalizeValue(operationType);
        String normalizedPaymentStatus = normalizeValue(paymentStatus);
        String normalizedPayoutStatus = normalizeValue(payoutStatus);
        int safeLimit = normalizeLimit(limit, 20, 100);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("transactions", queryInternalTransactions(normalizedQuery, numericQueryId, normalizedOperationType, safeLimit));
        out.put("paymentSessions", queryInternalPaymentSessions(normalizedQuery, numericQueryId, normalizedPaymentStatus, safeLimit));
        out.put("payoutRequests", queryInternalPayoutRequests(normalizedQuery, numericQueryId, normalizedPayoutStatus, safeLimit));
        out.put("balances", queryInternalBalances(normalizedQuery, numericQueryId, normalizedOperationType, safeLimit));
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getModelDocsWithChecklist(Long userId) {
        Map<String, Object> out = new LinkedHashMap<>();
        ModelDocument doc = modelDocumentRepository.findById(userId).orElse(null);
        out.put("userId", userId);
        out.put("urlVerificFront", doc != null ? doc.getUrlVerificFront() : null);
        out.put("urlVerificBack", doc != null ? doc.getUrlVerificBack() : null);
        out.put("urlVerificDoc", doc != null ? doc.getUrlVerificDoc() : null);

        ModelReviewChecklist ck = checklistRepository.findById(userId).orElse(null);
        Map<String, Object> checklist = new LinkedHashMap<>();
        checklist.put("frontOk", ck != null && ck.isFrontOk());
        checklist.put("backOk", ck != null && ck.isBackOk());
        checklist.put("selfieOk", ck != null && ck.isSelfieOk());
        out.put("checklist", checklist);

        return out;
    }

    @Transactional
    public Map<String, Object> updateModelChecklist(Long userId, Long adminId, Boolean frontOk, Boolean backOk, Boolean selfieOk) {
        ModelReviewChecklist ck = checklistRepository.findById(userId).orElseGet(() -> {
            ModelReviewChecklist x = new ModelReviewChecklist();
            x.setUserId(userId);
            return x;
        });

        if (frontOk != null) ck.setFrontOk(frontOk);
        if (backOk != null) ck.setBackOk(backOk);
        if (selfieOk != null) ck.setSelfieOk(selfieOk);

        ck.setLastReviewerId(adminId);
        checklistRepository.save(ck);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("userId", userId);
        resp.put("frontOk", ck.isFrontOk());
        resp.put("backOk", ck.isBackOk());
        resp.put("selfieOk", ck.isSelfieOk());
        return resp;
    }

    private static void register(String tableName, String orderBy) {
        register(tableName, orderBy, Set.of());
    }

    private static void register(String tableName, String orderBy, Set<String> hiddenColumns) {
        TABLE_CONFIG.put(tableName, new TableViewConfig(orderBy, normalizeHiddenColumns(hiddenColumns)));
    }

    private static Set<String> normalizeHiddenColumns(Set<String> hiddenColumns) {
        Set<String> out = new LinkedHashSet<>();
        for (String column : hiddenColumns) {
            if (column != null && !column.isBlank()) {
                out.add(column.trim().toLowerCase());
            }
        }
        return Set.copyOf(out);
    }

    private Object redactValue(TableViewConfig config, String column, Object value) {
        if (config == null || column == null) {
            return value;
        }
        if (config.hiddenColumns().contains(column.trim().toLowerCase())) {
            return HIDDEN_VALUE;
        }
        return value;
    }

    private List<Map<String, Object>> queryInternalTransactions(String normalizedQuery,
                                                                Long numericQueryId,
                                                                String normalizedOperationType,
                                                                int safeLimit) {
        StringBuilder sql = new StringBuilder("""
                SELECT
                  t.id,
                  t.user_id,
                  u.email AS user_email,
                  u.nickname AS user_nickname,
                  t.amount,
                  t.operation_type,
                  t.stream_record_id,
                  t.timestamp,
                  t.description
                FROM transactions t
                JOIN users u ON u.id = t.user_id
                WHERE 1=1
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();
        appendUserQuery(sql, params, normalizedQuery, numericQueryId, "t.id", "t.user_id", "u.email", "u.nickname");

        if (normalizedOperationType != null) {
            sql.append(" AND t.operation_type = :operationType ");
            params.addValue("operationType", normalizedOperationType.toUpperCase());
        }

        sql.append(" ORDER BY t.id DESC LIMIT :limit ");
        params.addValue("limit", safeLimit);
        return jdbc.queryForList(sql.toString(), params);
    }

    private List<Map<String, Object>> queryInternalPaymentSessions(String normalizedQuery,
                                                                   Long numericQueryId,
                                                                   String normalizedPaymentStatus,
                                                                   int safeLimit) {
        StringBuilder sql = new StringBuilder("""
                SELECT
                  ps.id,
                  ps.user_id,
                  u.email AS user_email,
                  u.nickname AS user_nickname,
                  ps.pack_id,
                  ps.amount,
                  ps.currency,
                  ps.first_payment,
                  ps.status,
                  ps.order_id,
                  ps.psp_transaction_id,
                  ps.created_at,
                  ps.updated_at
                FROM payment_sessions ps
                JOIN users u ON u.id = ps.user_id
                WHERE 1=1
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();

        if (normalizedQuery != null) {
            if (numericQueryId != null) {
                sql.append("""
                         AND (
                           ps.id = :numericQueryId
                           OR ps.user_id = :numericQueryId
                         )
                        """);
                params.addValue("numericQueryId", numericQueryId);
            } else {
                sql.append("""
                         AND (
                           LOWER(u.email) LIKE :queryLike
                           OR LOWER(u.nickname) LIKE :queryLike
                           OR LOWER(ps.order_id) LIKE :queryLike
                           OR LOWER(COALESCE(ps.psp_transaction_id, '')) LIKE :queryLike
                         )
                        """);
                params.addValue("queryLike", "%" + normalizedQuery.toLowerCase() + "%");
            }
        }

        if (normalizedPaymentStatus != null) {
            sql.append(" AND ps.status = :paymentStatus ");
            params.addValue("paymentStatus", normalizedPaymentStatus.toUpperCase());
        }

        sql.append(" ORDER BY ps.id DESC LIMIT :limit ");
        params.addValue("limit", safeLimit);
        return jdbc.queryForList(sql.toString(), params);
    }

    private List<Map<String, Object>> queryInternalPayoutRequests(String normalizedQuery,
                                                                  Long numericQueryId,
                                                                  String normalizedPayoutStatus,
                                                                  int safeLimit) {
        StringBuilder sql = new StringBuilder("""
                SELECT
                  pr.id,
                  pr.model_user_id,
                  u.email AS model_email,
                  u.nickname AS model_nickname,
                  pr.amount,
                  pr.currency,
                  pr.status,
                  pr.reason,
                  pr.reviewed_by_user_id,
                  pr.reviewed_at,
                  pr.created_at,
                  pr.updated_at
                FROM payout_requests pr
                JOIN users u ON u.id = pr.model_user_id
                WHERE 1=1
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();

        if (normalizedQuery != null) {
            if (numericQueryId != null) {
                sql.append("""
                         AND (
                           pr.id = :numericQueryId
                           OR pr.model_user_id = :numericQueryId
                         )
                        """);
                params.addValue("numericQueryId", numericQueryId);
            } else {
                sql.append("""
                         AND (
                           LOWER(u.email) LIKE :queryLike
                           OR LOWER(u.nickname) LIKE :queryLike
                         )
                        """);
                params.addValue("queryLike", "%" + normalizedQuery.toLowerCase() + "%");
            }
        }

        if (normalizedPayoutStatus != null) {
            sql.append(" AND pr.status = :payoutStatus ");
            params.addValue("payoutStatus", normalizedPayoutStatus.toUpperCase());
        }

        sql.append(" ORDER BY pr.id DESC LIMIT :limit ");
        params.addValue("limit", safeLimit);
        return jdbc.queryForList(sql.toString(), params);
    }

    private List<Map<String, Object>> queryInternalBalances(String normalizedQuery,
                                                            Long numericQueryId,
                                                            String normalizedOperationType,
                                                            int safeLimit) {
        StringBuilder sql = new StringBuilder("""
                SELECT
                  b.id,
                  b.user_id,
                  u.email AS user_email,
                  u.nickname AS user_nickname,
                  b.transaction_id,
                  b.operation_type,
                  b.amount,
                  b.balance,
                  b.timestamp,
                  b.description
                FROM balances b
                JOIN users u ON u.id = b.user_id
                WHERE 1=1
                """);

        MapSqlParameterSource params = new MapSqlParameterSource();

        if (normalizedQuery != null) {
            if (numericQueryId != null) {
                sql.append("""
                         AND (
                           b.id = :numericQueryId
                           OR b.user_id = :numericQueryId
                           OR b.transaction_id = :numericQueryId
                         )
                        """);
                params.addValue("numericQueryId", numericQueryId);
            } else {
                sql.append("""
                         AND (
                           LOWER(u.email) LIKE :queryLike
                           OR LOWER(u.nickname) LIKE :queryLike
                         )
                        """);
                params.addValue("queryLike", "%" + normalizedQuery.toLowerCase() + "%");
            }
        }

        if (normalizedOperationType != null) {
            sql.append(" AND b.operation_type = :operationType ");
            params.addValue("operationType", normalizedOperationType.toUpperCase());
        }

        sql.append(" ORDER BY b.id DESC LIMIT :limit ");
        params.addValue("limit", safeLimit);
        return jdbc.queryForList(sql.toString(), params);
    }

    private void appendUserQuery(StringBuilder sql,
                                 MapSqlParameterSource params,
                                 String normalizedQuery,
                                 Long numericQueryId,
                                 String idColumn,
                                 String userIdColumn,
                                 String emailColumn,
                                 String nicknameColumn) {
        if (normalizedQuery == null) {
            return;
        }

        if (numericQueryId != null) {
            sql.append(" AND (").append(idColumn).append(" = :numericQueryId OR ")
                    .append(userIdColumn).append(" = :numericQueryId) ");
            params.addValue("numericQueryId", numericQueryId);
            return;
        }

        sql.append(" AND (LOWER(").append(emailColumn).append(") LIKE :queryLike OR LOWER(")
                .append(nicknameColumn).append(") LIKE :queryLike) ");
        params.addValue("queryLike", "%" + normalizedQuery.toLowerCase() + "%");
    }

    private String normalizeQuery(String q) {
        if (q == null) return null;
        String trimmed = q.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeValue(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Long tryParseLong(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private int normalizeLimit(Integer requested, int defaultValue, int maxValue) {
        if (requested == null || requested < 1) {
            return defaultValue;
        }
        return Math.min(requested, maxValue);
    }

    private record TableViewConfig(
            String orderBy,
            Set<String> hiddenColumns
    ) {
    }
}
