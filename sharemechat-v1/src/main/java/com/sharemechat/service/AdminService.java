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

    public AdminService(UserRepository userRepository, UserService userService,
                        ModelRepository modelRepository, AdminRepository adminRepository,
                        NamedParameterJdbcTemplate jdbc, ModelDocumentRepository modelDocumentRepository,
                        ModelReviewChecklistRepository checklistRepository) {
        this.userRepository = userRepository;
        this.userService = userService;
        this.modelRepository = modelRepository;
        this.adminRepository = adminRepository;
        this.jdbc = jdbc;
        this.modelDocumentRepository = modelDocumentRepository;
        this.checklistRepository = checklistRepository;
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

    private record TableViewConfig(
            String orderBy,
            Set<String> hiddenColumns
    ) {
    }
}
