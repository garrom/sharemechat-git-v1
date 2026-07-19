package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelDTO;
import com.sharemechat.entity.ModelDocument;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.exception.EmailVerificationRequiredException;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.security.ModelContractGate;
import com.sharemechat.service.EmailVerificationService;
import com.sharemechat.service.ModelService;
import com.sharemechat.service.ModelStatsService;
import com.sharemechat.service.UserService;
import com.sharemechat.storage.StorageService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/models")
public class ModelController {

    private final ModelService modelService;
    private final UserService userService;
    private final ModelDocumentRepository modelDocumentRepository;
    private final StorageService storageService;
    private final ModelStatsService modelStatsService;
    private final ModelContractGate modelContractGate;
    private final EmailVerificationService emailVerificationService;
    private final TransactionRepository transactionRepository;
    private static final Logger log = LoggerFactory.getLogger(ModelController.class);

    public ModelController(ModelService modelService,
                           UserService userService,
                           ModelDocumentRepository modelDocumentRepository,
                           StorageService storageService,
                           ModelStatsService modelStatsService,
                           ModelContractGate modelContractGate,
                           EmailVerificationService emailVerificationService,
                           TransactionRepository transactionRepository) {
        this.modelService = modelService;
        this.userService = userService;
        this.modelDocumentRepository = modelDocumentRepository;
        this.storageService = storageService;
        this.modelStatsService = modelStatsService;
        this.modelContractGate = modelContractGate;
        this.emailVerificationService = emailVerificationService;
        this.transactionRepository = transactionRepository;
    }

    // ==========================
    // Helpers
    // ==========================
    private ResponseEntity<?> unauth() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) return null;
        return userService.findByEmail(authentication.getName());
    }

    /** Onboarding model: role=USER y userType=FORM_MODEL */
    private boolean isOnboardingModel(User u) {
        return u != null
                && Constants.Roles.USER.equals(u.getRole())
                && Constants.UserTypes.FORM_MODEL.equals(u.getUserType());
    }

    /** Actor válido para endpoints de modelo en onboarding o ya en MODEL */
    private boolean isModelActor(User u) {
        return u != null && (Constants.Roles.MODEL.equals(u.getRole()) || isOnboardingModel(u));
    }

    /**
     * Lote endurecimiento 2026-06-04: el gate de contrato aplica a
     * cualquier actor modelo (onboarding USER+FORM_MODEL y role=MODEL),
     * no solo onboarding. Delegado en {@link ModelContractGate}.
     */
    private boolean mustHaveAcceptedContract(User u) {
        return modelContractGate.requiresAcceptance(u);
    }

    private boolean hasAcceptedContract(Long userId) {
        return modelContractGate.hasAcceptedCurrent(userId);
    }

    private ResponseEntity<?> requireVerifiedOnboardingModel(User user) {
        if (isOnboardingModel(user) && !emailVerificationService.isEmailVerified(user)) {
            throw new EmailVerificationRequiredException(
                    "Debes validar tu email antes de continuar el onboarding de modelo",
                    "MODEL_ONBOARDING",
                    "VERIFY_EMAIL"
            );
        }
        return null;
    }

    // ==========================
    // API: /me (dual)
    // ==========================
    @GetMapping("/me")
    public ResponseEntity<?> getMyModelInfo(Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();

        if (Constants.Roles.MODEL.equals(user.getRole())) {
            ModelDTO dto = modelService.getModelDTO(user);
            return ResponseEntity.ok(dto);
        }

        if (isOnboardingModel(user)) {
            ModelDTO dto = new ModelDTO();
            dto.setUserId(user.getId());
            dto.setStreamingHours(java.math.BigDecimal.ZERO);
            dto.setSaldoActual(java.math.BigDecimal.ZERO);
            dto.setTotalIngresos(java.math.BigDecimal.ZERO);
            return ResponseEntity.ok(dto);
        }

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol MODEL");
    }

    // ==========================
    // Facturacion / Billing (2026-07-19 Fase 2 Estadistica)
    // Reutiliza el mismo TransactionRepository que el historial cliente
    // — la tabla `transactions` es user_id-based sin distincion de rol,
    // basta filtrar por el userId autenticado.
    // ==========================
    @GetMapping("/me/transactions")
    public ResponseEntity<?> getMyModelTransactions(Authentication authentication,
                                                    @RequestParam(required = false) String type,
                                                    @RequestParam(required = false) String types,
                                                    @RequestParam(required = false) String from,
                                                    @RequestParam(required = false) String to,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "20") int size) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol MODEL");
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
            if (from != null && !from.isBlank()) fromDt = LocalDate.parse(from.trim()).atStartOfDay();
            if (to != null && !to.isBlank()) toDt = LocalDate.parse(to.trim()).plusDays(1).atStartOfDay();
        } catch (DateTimeParseException ex) {
            return ResponseEntity.badRequest().body("Formato de fecha invalido (esperado yyyy-MM-dd)");
        }

        Page<Transaction> pageResult = transactionRepository.findClientTransactionsFiltered(
                user.getId(), typeList, fromDt, toDt, PageRequest.of(safePage, safeSize));

        List<Map<String, Object>> items = pageResult.getContent().stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("operationType", t.getOperationType());
            m.put("amount", t.getAmount());
            m.put("description", t.getDescription());
            m.put("timestamp", t.getTimestamp() != null ? t.getTimestamp().toString() : null);
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

    @GetMapping("/me/transactions/export")
    public ResponseEntity<?> exportMyModelTransactionsCsv(Authentication authentication,
                                                          @RequestParam(required = false) String types,
                                                          @RequestParam(required = false) String from,
                                                          @RequestParam(required = false) String to) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol MODEL");
        }

        List<String> typeList = null;
        if (types != null && !types.isBlank()) {
            typeList = Arrays.stream(types.split(","))
                    .map(s -> s.trim().toUpperCase(Locale.ROOT))
                    .filter(s -> !s.isEmpty())
                    .toList();
            if (typeList.isEmpty()) typeList = null;
        }

        LocalDateTime fromDt = null;
        LocalDateTime toDt = null;
        try {
            if (from != null && !from.isBlank()) fromDt = LocalDate.parse(from.trim()).atStartOfDay();
            if (to != null && !to.isBlank()) toDt = LocalDate.parse(to.trim()).plusDays(1).atStartOfDay();
        } catch (DateTimeParseException ex) {
            return ResponseEntity.badRequest().body("Formato de fecha invalido (esperado yyyy-MM-dd)");
        }

        List<Transaction> rows = transactionRepository.findClientTransactionsForExport(
                user.getId(), typeList, fromDt, toDt, PageRequest.of(0, 10_000));

        StringBuilder sb = new StringBuilder(rows.size() * 128);
        // BOM UTF-8 para compatibilidad Excel.
        sb.append('﻿');
        sb.append("id,timestamp,operation_type,amount_eur,description\r\n");
        DateTimeFormatter dtFmt = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        for (Transaction t : rows) {
            sb.append(t.getId()).append(',');
            sb.append(t.getTimestamp() != null ? t.getTimestamp().format(dtFmt) : "").append(',');
            sb.append(csvQuote(t.getOperationType())).append(',');
            BigDecimal a = t.getAmount();
            sb.append(a != null ? a.toPlainString() : "").append(',');
            sb.append(csvQuote(t.getDescription())).append("\r\n");
        }

        String filename = String.format("sharemechat-facturacion-%s.csv",
                LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setCacheControl("no-cache, no-store");

        return new ResponseEntity<>(sb.toString().getBytes(StandardCharsets.UTF_8),
                headers, HttpStatus.OK);
    }

    private static String csvQuote(String s) {
        if (s == null) return "";
        boolean needsQuote = s.indexOf(',') >= 0 || s.indexOf('"') >= 0
                || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0;
        if (!needsQuote) return s;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }

    // ==========================
    // Documents
    // ==========================
    @GetMapping("/documents/me")
    public ResponseEntity<?> getMyDocuments(Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();

        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }

        ResponseEntity<?> emailDenied = requireVerifiedOnboardingModel(user);
        if (emailDenied != null) {
            return emailDenied;
        }

        // ✅ SOLO ONBOARDING necesita contrato
        if (mustHaveAcceptedContract(user) && !hasAcceptedContract(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        var doc = modelDocumentRepository.findById(user.getId()).orElse(null);

        var body = new java.util.HashMap<String, Object>();
        body.put("userId", user.getId());
        body.put("role", user.getRole());
        body.put("userType", user.getUserType());
        body.put("verificationStatus", user.getVerificationStatus());

        if (doc != null) {
            body.put("urlVerificFront", doc.getUrlVerificFront());
            body.put("urlVerificBack", doc.getUrlVerificBack());
            body.put("urlVerificDoc", doc.getUrlVerificDoc());
            body.put("urlConsent", doc.getUrlConsent());
            body.put("createdAt", doc.getCreatedAt());
            body.put("updatedAt", doc.getUpdatedAt());
        }

        return ResponseEntity.ok(body);
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadDocuments(
            Authentication authentication,
            @RequestPart(value = "idFront", required = false) MultipartFile idFront,
            @RequestPart(value = "idBack", required = false) MultipartFile idBack,
            @RequestPart(value = "verificDoc", required = false) MultipartFile verificDoc,
            @RequestPart(value = "consent", required = false) MultipartFile consent
    ) throws java.io.IOException {

        User user = requireUser(authentication);
        if (user == null) return unauth();

        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }

        ResponseEntity<?> emailDenied = requireVerifiedOnboardingModel(user);
        if (emailDenied != null) {
            return emailDenied;
        }

        // ✅ SOLO ONBOARDING necesita contrato
        if (mustHaveAcceptedContract(user) && !hasAcceptedContract(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        ModelDocument doc = modelDocumentRepository.findById(user.getId()).orElseGet(() -> {
            var x = new ModelDocument();
            x.setUserId(user.getId());
            return x;
        });

        String base = "models/" + user.getId();

        // Capa 2: este endpoint solo maneja KYC docs (idFront/Back/verificDoc/consent).
        // Los assets de perfil (pic/video) viven ahora en `model_assets` y se
        // suben vía POST /api/me/assets (ModelAssetController), con su propio
        // catálogo multi-asset y flujo de review independiente.
        if (idFront != null && !idFront.isEmpty()) {
            String url = storageService.store(idFront, base + "/verification");
            doc.setUrlVerificFront(url);
        }
        if (idBack != null && !idBack.isEmpty()) {
            String url = storageService.store(idBack, base + "/verification");
            doc.setUrlVerificBack(url);
        }
        if (verificDoc != null && !verificDoc.isEmpty()) {
            String url = storageService.store(verificDoc, base + "/verification");
            doc.setUrlVerificDoc(url);
        }
        if (consent != null && !consent.isEmpty()) {
            String url = storageService.store(consent, base + "/verification");
            doc.setUrlConsent(url);
        }

        modelDocumentRepository.save(doc);

        var body = new java.util.HashMap<String, Object>();
        body.put("userId", user.getId());
        body.put("role", user.getRole());
        body.put("userType", user.getUserType());
        body.put("verificationStatus", user.getVerificationStatus());
        body.put("urlVerificFront", doc.getUrlVerificFront());
        body.put("urlVerificBack", doc.getUrlVerificBack());
        body.put("urlVerificDoc", doc.getUrlVerificDoc());
        body.put("urlConsent", doc.getUrlConsent());
        body.put("createdAt", doc.getCreatedAt());
        body.put("updatedAt", doc.getUpdatedAt());
        return ResponseEntity.ok(body);
    }

    @DeleteMapping("/documents")
    public ResponseEntity<?> deleteModelDocument(Authentication authentication,
                                                 @RequestParam(name = "field") String field) {
        User user = requireUser(authentication);
        if (user == null) return unauth();

        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }

        ResponseEntity<?> emailDenied = requireVerifiedOnboardingModel(user);
        if (emailDenied != null) {
            return emailDenied;
        }

        // ✅ SOLO ONBOARDING necesita contrato
        if (mustHaveAcceptedContract(user) && !hasAcceptedContract(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        ModelDocument doc = modelDocumentRepository.findById(user.getId()).orElse(null);
        if (doc == null) {
            return ResponseEntity.noContent().build();
        }

        String toDelete = null;
        switch (field) {
            case "idFront" -> { toDelete = doc.getUrlVerificFront(); doc.setUrlVerificFront(null); }
            case "idBack" -> { toDelete = doc.getUrlVerificBack(); doc.setUrlVerificBack(null); }
            case "verificDoc" -> { toDelete = doc.getUrlVerificDoc(); doc.setUrlVerificDoc(null); }
            default -> { return ResponseEntity.badRequest().body("Campo no soportado: " + field); }
        }

        modelDocumentRepository.save(doc);

        if (toDelete != null) {
            try { storageService.deleteByPublicUrl(toDelete); } catch (Exception ignore) {}
        }

        return ResponseEntity.noContent().build();
    }

    // Teasers (sin cambios)
    @GetMapping("/teasers")
    public ResponseEntity<?> getModelTeasers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {

        User user = requireUser(authentication);
        if (user == null) return unauth();

        String role = user.getRole();
        boolean allowed =
                Constants.Roles.USER.equals(role) ||
                        Constants.Roles.CLIENT.equals(role) ||
                        Constants.Roles.MODEL.equals(role) ||
                        Constants.Roles.ADMIN.equals(role);

        if (!allowed) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }

        var teasers = modelService.listTeasers(page, size);
        return ResponseEntity.ok(teasers);
    }

    // Stats (solo MODEL real)
    @GetMapping("/stats/summary")
    public ResponseEntity<?> getMyStatsSummary(Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol MODEL");
        }
        return ResponseEntity.ok(modelStatsService.getMySummary(user.getId()));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getMyStats(Authentication authentication,
                                        @RequestParam(name = "days", defaultValue = "30") int days) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol MODEL");
        }
        return ResponseEntity.ok(modelStatsService.getMyStats(user.getId(), days));
    }
}
