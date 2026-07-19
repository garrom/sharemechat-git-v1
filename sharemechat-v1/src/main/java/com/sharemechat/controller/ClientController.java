package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ClientDTO;
import com.sharemechat.entity.ClientDocument;
import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ClientDocumentRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.service.ClientService;
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

import java.io.IOException;
import java.math.BigDecimal;
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
@RequestMapping("/api/clients")
public class ClientController {

    private final ClientService clientService;
    private final UserService userService;
    private final ClientDocumentRepository clientDocumentRepository;
    private final StorageService storageService;
    private final TransactionRepository transactionRepository;

    public ClientController(ClientService clientService,
                            UserService userService,
                            ClientDocumentRepository clientDocumentRepository,
                            StorageService storageService,
                            TransactionRepository transactionRepository) {
        this.clientService = clientService;
        this.userService = userService;
        this.clientDocumentRepository = clientDocumentRepository;
        this.storageService = storageService;
        this.transactionRepository = transactionRepository;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyClientInfo(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        // Solo clientes “definitivos” pueden consultar este endpoint
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            // Si prefieres 200 con saldo 0, cambia por clientService.emptyDTO(user.getId()).
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
        }

        ClientDTO dto = clientService.getClientDTO(user);
        return ResponseEntity.ok(dto);
    }

    /**
     * Historial de transacciones del cliente logueado. Fase 1 (2026-07-19)
     * solo aceptaba {@code type} single = INGRESO; Fase 2 (2026-07-19)
     * anade filtro por lista de tipos ({@code types} CSV) + rango de
     * fechas opcional ({@code from} y {@code to}, ISO {@code yyyy-MM-dd}).
     * Retrocompatible: si viene {@code type} single (sin {@code types}),
     * lo trata como lista de un elemento.
     *
     * <p>Restringido a role CLIENT (misma politica que {@code /me}) —
     * los usuarios FORM_CLIENT sin pagos no tienen historial que ver.
     */
    @GetMapping("/me/transactions")
    public ResponseEntity<?> getMyTransactions(Authentication authentication,
                                               @RequestParam(required = false) String type,
                                               @RequestParam(required = false) String types,
                                               @RequestParam(required = false) String from,
                                               @RequestParam(required = false) String to,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
        }

        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);

        // Normalizar types: primero CSV nuevo, si no viene fallback a
        // single type (retrocompat Fase 1).
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

        // Parseo de fechas ISO yyyy-MM-dd. from inclusivo (00:00:00);
        // to exclusivo (+1 dia 00:00:00) para incluir el dia completo.
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

        Page<Transaction> pageResult = transactionRepository.findClientTransactionsFiltered(
                user.getId(), typeList, fromDt, toDt,
                PageRequest.of(safePage, safeSize));

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

    /**
     * Fase 3 (2026-07-19): descarga CSV del historial del cliente.
     * Mismos filtros que {@link #getMyTransactions} ({@code types},
     * {@code from}, {@code to}) sin paginacion — dump completo (LIMIT
     * defensivo 10.000 filas para prevenir OOM). El navegador dispara
     * la descarga por el header {@code Content-Disposition: attachment}.
     *
     * <p>CSV RFC 4180: separador coma, quoted strings, escape de comillas
     * dobles duplicandolas. Codificado UTF-8 con BOM para que Excel
     * abra correctamente los caracteres acentuados.
     *
     * <p>Restringido a role CLIENT (misma politica que /me).
     */
    @GetMapping("/me/transactions/export")
    public ResponseEntity<?> exportMyTransactionsCsv(Authentication authentication,
                                                     @RequestParam(required = false) String types,
                                                     @RequestParam(required = false) String from,
                                                     @RequestParam(required = false) String to) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
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
            if (from != null && !from.isBlank()) {
                fromDt = LocalDate.parse(from.trim()).atStartOfDay();
            }
            if (to != null && !to.isBlank()) {
                toDt = LocalDate.parse(to.trim()).plusDays(1).atStartOfDay();
            }
        } catch (DateTimeParseException ex) {
            return ResponseEntity.badRequest().body("Formato de fecha invalido (esperado yyyy-MM-dd)");
        }

        // Cap defensivo 10.000 filas. Usuario tipico tiene <500.
        List<Transaction> rows = transactionRepository.findClientTransactionsForExport(
                user.getId(), typeList, fromDt, toDt, PageRequest.of(0, 10_000));

        StringBuilder sb = new StringBuilder(rows.size() * 128);
        // BOM UTF-8 para que Excel abra los acentos correctamente.
        sb.append('﻿');
        // Cabecera RFC 4180.
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

        String filename = String.format("sharemechat-historial-%s.csv",
                LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setCacheControl("no-cache, no-store");

        return new ResponseEntity<>(sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),
                headers, HttpStatus.OK);
    }

    /**
     * Escapa un valor CSV segun RFC 4180: si contiene coma, comillas o
     * salto de linea, envuelve entre comillas dobles y duplica las
     * comillas internas.
     */
    private static String csvQuote(String s) {
        if (s == null) return "";
        boolean needsQuote = s.indexOf(',') >= 0 || s.indexOf('"') >= 0
                || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0;
        if (!needsQuote) return s;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }


    @GetMapping("/documents/me")
    public ResponseEntity<?> getMyClientDocuments(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
        }

        ClientDocument doc = clientDocumentRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    ClientDocument d = new ClientDocument();
                    d.setUserId(user.getId());
                    d.setUrlPic(null);
                    return d;
                });

        return ResponseEntity.ok(new ClientDocResponse(doc.getUrlPic()));
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadMyClientPicture(
            Authentication authentication,
            @RequestPart(name = "pic", required = true) MultipartFile pic
    ) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
        }
        if (pic == null || pic.isEmpty()) {
            return ResponseEntity.badRequest().body("Archivo 'pic' vacío");
        }
        if (pic.getContentType() != null && !pic.getContentType().startsWith("image/")) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body("Solo se aceptan imágenes");
        }

        try {
            // 1) Subir nuevo archivo
            String keyPrefix = "clients/" + user.getId() + "/profile";
            String newUrl = storageService.store(pic, keyPrefix);

            // 2) Persistir/crear doc y capturar la URL anterior
            ClientDocument doc = clientDocumentRepository.findByUserId(user.getId())
                    .orElseGet(() -> {
                        ClientDocument d = new ClientDocument();
                        d.setUserId(user.getId());
                        return d;
                    });
            String oldUrl = doc.getUrlPic();
            doc.setUrlPic(newUrl);
            clientDocumentRepository.save(doc);

            // 3) Borrar la imagen anterior (best-effort)
            try {
                storageService.deleteByPublicUrl(oldUrl);
            } catch (Exception ignore) {}

            return ResponseEntity.ok(new ClientDocResponse(doc.getUrlPic()));
        } catch (IOException io) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error almacenando el archivo");
        }
    }

    @DeleteMapping("/documents/pic")
    public ResponseEntity<?> deleteMyClientPicture(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
        }

        ClientDocument doc = clientDocumentRepository.findByUserId(user.getId()).orElse(null);
        if (doc == null || doc.getUrlPic() == null) {
            return ResponseEntity.noContent().build();
        }

        String oldUrl = doc.getUrlPic();
        doc.setUrlPic(null);
        clientDocumentRepository.save(doc);

        try {
            storageService.deleteByPublicUrl(oldUrl);
        } catch (Exception ignore) {}

        return ResponseEntity.noContent().build();
    }

    // Alias para soportar DELETE /api/clients/documents (frontend legacy)
    @DeleteMapping("/documents")
    public ResponseEntity<?> deleteMyClientDocumentsAlias(org.springframework.security.core.Authentication authentication) {
        return deleteMyClientPicture(authentication);
    }


    private record ClientDocResponse(String urlPic) {}
}
