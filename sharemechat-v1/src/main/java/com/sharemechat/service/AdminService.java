package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.UserDTO;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.exception.UserNotFoundException;
import com.sharemechat.repository.AdminRepository;
import com.sharemechat.repository.ModelRepository;
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
import java.util.List;
import java.util.Map;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final UserService userService;
    private final ModelRepository modelRepository;
    private final AdminRepository adminRepository;
    private final NamedParameterJdbcTemplate jdbc;
    private static final Map<String, String> TABLE_ORDER = new HashMap<>();
    static {
        // tabla -> columna por la que ordenar DESC
        TABLE_ORDER.put("users", "id");
        TABLE_ORDER.put("clients", "user_id");
        TABLE_ORDER.put("models", "user_id");
        TABLE_ORDER.put("transactions", "id");
        TABLE_ORDER.put("balances", "id");
        TABLE_ORDER.put("platform_transactions", "id");
        TABLE_ORDER.put("platform_balances", "id");
        TABLE_ORDER.put("stream_records", "id");
        TABLE_ORDER.put("favorites_clients", "id");
        TABLE_ORDER.put("favorites_models", "id");
        TABLE_ORDER.put("gifts", "id");
        TABLE_ORDER.put("messages", "id");
        TABLE_ORDER.put("password_reset_tokens", "created_at");
        TABLE_ORDER.put("unsubscribe", "end_date");
    }

    public AdminService(UserRepository userRepository, UserService userService,
                        ModelRepository modelRepository, AdminRepository adminRepository,
                        NamedParameterJdbcTemplate jdbc) {
        this.userRepository = userRepository;
        this.userService = userService;
        this.modelRepository = modelRepository;
        this.adminRepository = adminRepository;
        this.jdbc = jdbc;
    }

    /**
     * Lista candidatos/modelos usando SOLO verificationStatus.
     * - Sin filtro: devuelve todos los usuarios con verificationStatus no nulo.
     * - Con filtro: PENDING | APPROVED | REJECTED.
     */
    @Transactional(readOnly = true)
    public List<UserDTO> getModels(String verification) {
        List<User> list = (verification == null || verification.isBlank())
                ? userRepository.findByVerificationStatusIsNotNull()
                : userRepository.findByVerificationStatus(verification.toUpperCase());
        return list.stream().map(userService::mapToDTO).toList();
    }

    /**
     * Revisión robusta e idempotente:
     * - APPROVE  -> verification=APPROVED; si role != MODEL => role=MODEL; upsert en models.
     * - REJECT   -> verification=REJECTED; no toca role.
     * - PENDING  -> verification=PENDING; no toca role.
     *
     * Importante: nunca degradamos roles (si ya es MODEL/CLIENT, se mantiene).
     */
    @Transactional
    public String reviewModel(Long userId, String action) {
        if (action == null || action.isBlank()) {
            throw new IllegalArgumentException("Acción requerida");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado con ID: " + userId));

        final String previousRole = user.getRole();
        final String a = action.toUpperCase();
        final String currentVerification = user.getVerificationStatus(); // puede ser null

        // Regla 1: REJECT es terminal. Si ya está REJECTED, no permitimos volver a PENDING/APROVED.
        if (Constants.VerificationStatuses.REJECTED.equals(currentVerification)
                && ("APPROVE".equals(a) || "PENDING".equals(a))) {
            throw new IllegalStateException("La modelo fue RECHAZADA definitivamente. No puede volver a PENDING ni APPROVED.");
        }

        switch (a) {
            case "APPROVE" -> {
                // Solo aprobamos si no está REJECTED (ya validado arriba)
                user.setVerificationStatus(Constants.VerificationStatuses.APPROVED);

                // Promoción a MODEL si aún no lo es
                if (!Constants.Roles.MODEL.equals(user.getRole())) {
                    user.setRole(Constants.Roles.MODEL);
                }

                // Asegurar registro en tabla models (idempotente)
                if (!modelRepository.existsById(user.getId())) {
                    Model m = new Model();
                    m.setUser(user); // @MapsId: user_id = user.id
                    modelRepository.save(m);
                }
            }
            case "REJECT" -> {
                // Regla 2: degradar a USER si era MODEL, si ya es USER, se queda igual
                user.setVerificationStatus(Constants.VerificationStatuses.REJECTED);
                if (Constants.Roles.MODEL.equals(user.getRole())) {
                    user.setRole(Constants.Roles.USER);
                }

            }
            case "PENDING" -> {
                // Solo permitimos PENDING si nunca fue REJECTED antes
                if (Constants.VerificationStatuses.REJECTED.equals(currentVerification)) {
                    throw new IllegalStateException("La modelo fue RECHAZADA definitivamente. No puede volver a PENDING.");
                }
                user.setVerificationStatus(Constants.VerificationStatuses.PENDING);
                // No tocamos el role.
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

    /**
     * ESTE METODO REALIZA el ranking de las modelos con mayores ingresos
     * según transacciones tipo STREAM_EARNING, limitado al nº solicitado.
     * Devuelve lista con email/nickname y cantidad formateada en euros.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> financeTopModels(int limit) {
        return adminRepository.topModelsByEarnings(PageRequest.of(0, Math.min(Math.max(limit,1),50)))
                .stream().map(r -> {
                    Map<String,Object> m = new HashMap<>();
                    m.put("modelId", ((Number) r[0]).longValue());
                    m.put("email", (String) r[1]);
                    m.put("name", (String) r[2]);
                    m.put("nickname", (String) r[3]);
                    m.put("totalEarningsEUR", fmtEUR((BigDecimal) r[4]));
                    return m;
                }).toList();
    }

    /**
     * ESTE METODO REALIZA el ranking de clientes según la columna totalPagos
     * de la tabla clients. Devuelve top N con email/nickname y totalPagos formateado en euros.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> financeTopClients(int limit) {
        return adminRepository.topClientsByTotalPagos(PageRequest.of(0, Math.min(Math.max(limit,1),50)))
                .stream().map(r -> {
                    Map<String,Object> m = new HashMap<>();
                    m.put("clientId", ((Number) r[0]).longValue());
                    m.put("email", (String) r[1]);
                    m.put("name", (String) r[2]);
                    m.put("nickname", (String) r[3]);
                    m.put("totalPagosEUR", fmtEUR((BigDecimal) r[4]));
                    return m;
                }).toList();
    }


    /**
     * ESTE METODO REALIZA un resumen global de facturación:
     * - grossBillingEUR: facturación total (STREAM_CHARGE en valor absoluto)
     * - netProfitEUR: margen neto de la plataforma (STREAM_MARGIN)
     * - profitPercent: % beneficio neto respecto a facturación bruta
     * Devuelve todo formateado en euros/porcentaje.
     */
    @Transactional(readOnly = true)
    public Map<String, String> financeSummary() {
        BigDecimal gross = adminRepository.sumGrossBilling();
        BigDecimal net   = adminRepository.sumNetProfit();

        if (gross == null) gross = BigDecimal.ZERO;
        if (net == null)   net   = BigDecimal.ZERO;

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
        s.put("netProfitEUR",    fmtEUR(net));
        s.put("profitPercent",   profitPercentStr);
        return s;
    }

    /**
     * ESTE METODO permite seleccionar tabla de bbdd y despues
     * visualizarlo en el frontal
     */
    @Transactional(readOnly = true)
    public List<Map<String,Object>> viewTable(String table, int limit) {
        if (table == null || !TABLE_ORDER.containsKey(table)) {
            throw new IllegalArgumentException("Tabla no permitida");
        }
        int lim = Math.min(Math.max(limit, 1), 100);
        String orderCol = TABLE_ORDER.get(table);
        String sql = "SELECT * FROM " + table + " ORDER BY " + orderCol + " DESC LIMIT :lim";
        return jdbc.query(sql, new MapSqlParameterSource("lim", lim),
                (rs, rowNum) -> {
                    var md = rs.getMetaData();
                    Map<String,Object> row = new LinkedHashMap<>(); // <-- en vez de HashMap
                    for (int i = 1; i <= md.getColumnCount(); i++) {
                        row.put(md.getColumnLabel(i), rs.getObject(i));
                    }
                    return row;
                });

    }


}
