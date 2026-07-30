package com.sharemechat.master.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.dto.KycStartSessionResponseDTO;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.exception.NicknameAlreadyInUseException;
import com.sharemechat.exception.UnderageModelException;
import com.sharemechat.master.dto.MasterMeDTO;
import com.sharemechat.master.dto.MasterOverviewDTO;
import com.sharemechat.master.dto.MasterPayoutRequestDTO;
import com.sharemechat.master.dto.RegisterMasterRequestDTO;
import com.sharemechat.master.service.MasterContractService;
import com.sharemechat.master.service.MasterOverviewService;
import com.sharemechat.master.service.MasterPayoutService;
import com.sharemechat.master.service.MasterService;
import com.sharemechat.entity.PayoutRequest;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.service.KycSessionService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * ADR-056 Fase S2: endpoints publicos + autenticados del rol MASTER.
 *
 * <ul>
 *   <li>{@code POST /api/masters/register} — publico (analog registro
 *       modelo). Crea User + Master + envia email verificacion.</li>
 *   <li>{@code GET /api/masters/me/contract} — devuelve version vigente
 *       del contrato Master (para mostrarlo antes de firmar).</li>
 *   <li>{@code POST /api/masters/me/contract/accept} — firma contrato
 *       Master (idempotente).</li>
 *   <li>{@code POST /api/masters/me/kyc/didit} — arranca sesion KYC
 *       Didit persona fisica. Requiere contrato Master aceptado.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/masters")
public class MasterController {

    private static final Map<String, String> REGISTER_UNIFORM_BODY = Map.of(
            "message", "Si el email es valido y no esta registrado, recibiras un email de verificacion."
    );

    private final MasterService masterService;
    private final MasterContractService masterContractService;
    private final MasterOverviewService masterOverviewService;
    private final MasterPayoutService masterPayoutService;
    private final KycSessionService kycSessionService;
    private final UserService userService;
    private final TransactionRepository transactionRepository;

    public MasterController(MasterService masterService,
                            MasterContractService masterContractService,
                            MasterOverviewService masterOverviewService,
                            MasterPayoutService masterPayoutService,
                            KycSessionService kycSessionService,
                            UserService userService,
                            TransactionRepository transactionRepository) {
        this.masterService = masterService;
        this.masterContractService = masterContractService;
        this.masterOverviewService = masterOverviewService;
        this.masterPayoutService = masterPayoutService;
        this.kycSessionService = kycSessionService;
        this.userService = userService;
        this.transactionRepository = transactionRepository;
    }

    // ============================================================
    // POST /register — publico
    // ============================================================

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody @Valid RegisterMasterRequestDTO dto,
                                       HttpServletRequest request) {
        String ip = IpConfig.getClientIp(request);
        String acceptLanguage = request.getHeader("Accept-Language");
        try {
            masterService.registerMaster(dto, ip, acceptLanguage);
        } catch (NicknameAlreadyInUseException | UnderageModelException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
        // Body uniforme: no revelamos si el email existia o no (patron
        // simetrico a registerModel/registerClient).
        return ResponseEntity.ok(REGISTER_UNIFORM_BODY);
    }

    // ============================================================
    // Contrato Master
    // ============================================================

    @GetMapping("/me/contract")
    public ResponseEntity<?> currentContract(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        try {
            return ResponseEntity.ok(masterContractService.current());
        } catch (Exception ex) {
            return ResponseEntity.status(503).body(Map.of("error", "Contrato Master no disponible"));
        }
    }

    @PostMapping("/me/contract/accept")
    public ResponseEntity<?> acceptContract(HttpServletRequest request, Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        User user = userService.findByEmail(auth.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        String ip = IpConfig.getClientIp(request);
        String userAgent = request.getHeader("User-Agent");
        Map<String, Object> result = masterContractService.accept(user.getId(), ip, userAgent);
        return ResponseEntity.ok(result);
    }

    // ============================================================
    // GET /me — perfil + saldo del Master autenticado (S5.a.2)
    // ============================================================

    @GetMapping("/me")
    public ResponseEntity<?> getMe(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        User user = userService.findByEmail(auth.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        if (!com.sharemechat.constants.Constants.Roles.MASTER.equals(user.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Requiere rol MASTER"));
        }
        MasterMeDTO dto = masterOverviewService.getMe(user);
        return ResponseEntity.ok(dto);
    }

    // ============================================================
    // GET /me/overview — KPIs consolidados (S5.a.2)
    // ============================================================

    @GetMapping("/me/overview")
    public ResponseEntity<?> getOverview(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        User user = userService.findByEmail(auth.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        if (!com.sharemechat.constants.Constants.Roles.MASTER.equals(user.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Requiere rol MASTER"));
        }
        MasterOverviewDTO dto = masterOverviewService.getOverview(user);
        return ResponseEntity.ok(dto);
    }

    // ============================================================
    // GET /me/transactions — historial paginado (S5.a.3)
    // ============================================================

    @GetMapping("/me/transactions")
    public ResponseEntity<?> getMyTransactions(Authentication auth,
                                                 @RequestParam(required = false) String type,
                                                 @RequestParam(required = false) String types,
                                                 @RequestParam(required = false) String from,
                                                 @RequestParam(required = false) String to,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body("No autenticado");
        }
        User user = userService.findByEmail(auth.getName());
        if (user == null) {
            return ResponseEntity.status(401).body("Usuario no encontrado");
        }
        if (!com.sharemechat.constants.Constants.Roles.MASTER.equals(user.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Requiere rol MASTER"));
        }

        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);

        List<String> typeList = null;
        if (types != null && !types.isBlank()) {
            typeList = Arrays.stream(types.split(","))
                    .map(s -> s.trim().toUpperCase(Locale.ROOT))
                    .filter(s -> !s.isEmpty())
                    .toList();
            if (typeList.isEmpty()) typeList = null;
        } else if (type != null && !type.isBlank()) {
            typeList = List.of(type.trim().toUpperCase(Locale.ROOT));
        }

        LocalDateTime fromDt = null;
        LocalDateTime toDt = null;
        try {
            if (from != null && !from.isBlank()) {
                fromDt = LocalDate.parse(from.trim()).atStartOfDay();
            }
            if (to != null && !to.isBlank()) {
                toDt = LocalDate.parse(to.trim()).plusDays(1).atStartOfDay();
            }
        } catch (DateTimeParseException ex) {
            return ResponseEntity.badRequest().body("Formato de fecha invalido (esperado yyyy-MM-dd)");
        }

        Page<Transaction> pageResult = transactionRepository.findMasterTransactionsFiltered(
                user.getId(), typeList, fromDt, toDt,
                PageRequest.of(safePage, safeSize));

        List<Map<String, Object>> items = pageResult.getContent().stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("operationType", t.getOperationType());
            m.put("amount", t.getAmount());
            m.put("description", t.getDescription());
            m.put("timestamp", t.getTimestamp() != null ? t.getTimestamp().toString() : null);
            m.put("attributedModelUserId", t.getAttributedModelUserId());
            return m;
        }).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("page", pageResult.getNumber());
        out.put("size", pageResult.getSize());
        out.put("totalPages", pageResult.getTotalPages());
        out.put("totalElements", pageResult.getTotalElements());
        return ResponseEntity.ok(out);
    }

    // ============================================================
    // POST /me/payout — solicitud de retiro (S5.a.4)
    // ============================================================

    @PostMapping("/me/payout")
    public ResponseEntity<?> requestPayout(@RequestBody @Valid MasterPayoutRequestDTO body,
                                             Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        User user = userService.findByEmail(auth.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        if (!com.sharemechat.constants.Constants.Roles.MASTER.equals(user.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Requiere rol MASTER"));
        }
        try {
            PayoutRequest pr = masterPayoutService.requestPayout(user, body);
            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "payoutRequestId", pr.getId(),
                    "amount", pr.getAmount(),
                    "status", pr.getStatus()
            ));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ============================================================
    // POST /me/kyc/didit — arranque sesion KYC persona fisica
    // ============================================================

    @PostMapping("/me/kyc/didit")
    public ResponseEntity<?> startDiditKyc(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        User user = userService.findByEmail(auth.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        try {
            KycStartSessionResponseDTO dto = kycSessionService.startDiditMasterSession(user.getId());
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}
