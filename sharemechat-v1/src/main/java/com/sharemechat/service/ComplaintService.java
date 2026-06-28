package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ComplaintAuditLogDTO;
import com.sharemechat.dto.ComplaintDTO;
import com.sharemechat.dto.ComplaintEscalateDTO;
import com.sharemechat.dto.ComplaintReviewDTO;
import com.sharemechat.dto.ComplaintStatsDTO;
import com.sharemechat.dto.PublicComplaintCreateDTO;
import com.sharemechat.entity.Complaint;
import com.sharemechat.entity.ComplaintAuditLog;
import com.sharemechat.repository.ComplaintAuditLogRepository;
import com.sharemechat.repository.ComplaintRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Orquestador del frente Complaints workflow (Opcion B). Persiste,
 * calcula SLA (5 business days saltando sabado/domingo), persiste
 * audit log per-row, dispara emails (ack al denunciante + alerta admin
 * para categorias graves) y expone el listado/detalle/transiciones
 * para el panel admin.
 */
@Service
public class ComplaintService {

    private static final Logger log = LoggerFactory.getLogger(ComplaintService.class);

    /**
     * Categorias publicas del set Segpay-aligned (DEC-2). Validado al
     * crear; rechazo si no esta en este set.
     */
    private static final Set<String> PUBLIC_CATEGORIES = Set.of(
            Constants.ComplaintCategories.CSAM,
            Constants.ComplaintCategories.NON_CONSENSUAL,
            Constants.ComplaintCategories.MINOR_AT_RISK,
            Constants.ComplaintCategories.HATE_SYMBOLS,
            Constants.ComplaintCategories.COPYRIGHT,
            Constants.ComplaintCategories.ILLEGAL,
            Constants.ComplaintCategories.HARASSMENT,
            Constants.ComplaintCategories.IMPERSONATION,
            Constants.ComplaintCategories.FRAUD,
            Constants.ComplaintCategories.OTHER
    );

    private static final Set<String> VALID_STATUSES = Set.of(
            Constants.ComplaintStatuses.OPEN,
            Constants.ComplaintStatuses.ACKNOWLEDGED,
            Constants.ComplaintStatuses.REVIEWING,
            Constants.ComplaintStatuses.RESOLVED,
            Constants.ComplaintStatuses.REJECTED,
            Constants.ComplaintStatuses.ESCALATED
    );

    private static final Set<String> VALID_DECISIONS = Set.of(
            Constants.ComplaintDecisionCodes.CONTENT_REMOVED,
            Constants.ComplaintDecisionCodes.USER_SUSPENDED,
            Constants.ComplaintDecisionCodes.USER_BANNED,
            Constants.ComplaintDecisionCodes.NO_ACTION,
            Constants.ComplaintDecisionCodes.INSUFFICIENT_INFO,
            Constants.ComplaintDecisionCodes.ESCALATED_TO_AUTHORITIES,
            Constants.ComplaintDecisionCodes.FORWARDED_TO_NCMEC
    );

    private final ComplaintRepository complaintRepository;
    private final ComplaintAuditLogRepository auditLogRepository;
    private final ComplaintMailService complaintMailService;

    public ComplaintService(ComplaintRepository complaintRepository,
                            ComplaintAuditLogRepository auditLogRepository,
                            ComplaintMailService complaintMailService) {
        this.complaintRepository = complaintRepository;
        this.auditLogRepository = auditLogRepository;
        this.complaintMailService = complaintMailService;
    }

    // ========================================================================
    // CREATE
    // ========================================================================

    @Transactional
    public Complaint createPublic(PublicComplaintCreateDTO dto, String clientIp) {
        if (dto == null) throw new IllegalArgumentException("Body requerido");

        String category = normalizeCategory(dto.getCategory());
        String description = trimToNull(dto.getDescription(), 2000);
        if (description == null) {
            throw new IllegalArgumentException("description requerido");
        }
        if (description.contains("<") || description.contains(">")) {
            throw new IllegalArgumentException("description contiene caracteres no permitidos");
        }

        Complaint c = new Complaint();
        c.setReporterEmail(trimToNull(dto.getReporterEmail(), 255));
        c.setReporterName(trimToNull(dto.getReporterName(), 255));
        c.setReporterIpHash(sha256HexOrNull(clientIp));
        c.setCategory(category);
        c.setDescription(description);
        c.setSubjectEmail(trimToNull(dto.getSubjectEmail(), 255));
        c.setSubjectUrl(trimToNull(dto.getSubjectUrl(), 2000));
        c.setSubjectStreamRecordId(dto.getSubjectStreamRecordId());
        c.setStatus(Constants.ComplaintStatuses.OPEN);
        c.setChannel(Constants.ComplaintChannels.WEB);

        LocalDateTime now = LocalDateTime.now();
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        c.setExpectedResolutionAt(computeExpectedResolutionAt(now));

        Complaint saved = complaintRepository.save(c);

        writeAuditLog(saved.getId(), null, Constants.ComplaintAuditActions.CREATED,
                null, Constants.ComplaintStatuses.OPEN,
                "Complaint creada por canal " + Constants.ComplaintChannels.WEB);

        // DEC-7: ack al denunciante si dio email.
        complaintMailService.sendAckToReporter(saved);
        if (saved.getReporterEmail() != null && !saved.getReporterEmail().isBlank()) {
            saved.setAcknowledgedAt(LocalDateTime.now());
            complaintRepository.save(saved);
            writeAuditLog(saved.getId(), null, Constants.ComplaintAuditActions.ACK_SENT,
                    Constants.ComplaintStatuses.OPEN, Constants.ComplaintStatuses.OPEN,
                    "Ack enviado al denunciante");
        }

        // DEC-8: alerta interna si categoria critica.
        boolean alertSent = complaintMailService.sendAdminAlertForCritical(saved);
        if (alertSent) {
            writeAuditLog(saved.getId(), null, Constants.ComplaintAuditActions.ADMIN_ALERT_SENT,
                    saved.getStatus(), saved.getStatus(),
                    "Alerta interna enviada (categoria critica)");
        }

        log.info("[COMPLAINT] created id={} category={} channel=WEB", saved.getId(), category);
        return saved;
    }

    // ========================================================================
    // READ
    // ========================================================================

    @Transactional(readOnly = true)
    public List<ComplaintDTO> adminList(String status, String category) {
        boolean hasStatus = status != null && !status.isBlank();
        boolean hasCategory = category != null && !category.isBlank();

        List<Complaint> rows;
        if (hasStatus && hasCategory) {
            rows = complaintRepository.findAllByStatusAndCategoryOrderByCreatedAtDesc(
                    normalizeStatus(status), normalizeCategory(category));
        } else if (hasStatus) {
            rows = complaintRepository.findAllByStatusOrderByCreatedAtDesc(normalizeStatus(status));
        } else if (hasCategory) {
            rows = complaintRepository.findAllByCategoryOrderByCreatedAtDesc(normalizeCategory(category));
        } else {
            rows = complaintRepository.findAllByOrderByCreatedAtDesc();
        }

        LocalDateTime now = LocalDateTime.now();
        return rows.stream().map(r -> toDto(r, now, false)).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ComplaintDTO adminGetById(Long id) {
        Complaint c = complaintRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Complaint no encontrada"));
        ComplaintDTO dto = toDto(c, LocalDateTime.now(), true);
        return dto;
    }

    @Transactional(readOnly = true)
    public ComplaintStatsDTO stats() {
        ComplaintStatsDTO s = new ComplaintStatsDTO();
        LocalDateTime now = LocalDateTime.now();
        s.setTotal(complaintRepository.count());
        s.setOpen(complaintRepository.countByStatus(Constants.ComplaintStatuses.OPEN));
        s.setAcknowledged(complaintRepository.countByStatus(Constants.ComplaintStatuses.ACKNOWLEDGED));
        s.setReviewing(complaintRepository.countByStatus(Constants.ComplaintStatuses.REVIEWING));
        s.setResolved(complaintRepository.countByStatus(Constants.ComplaintStatuses.RESOLVED));
        s.setRejected(complaintRepository.countByStatus(Constants.ComplaintStatuses.REJECTED));
        s.setEscalated(complaintRepository.countByStatus(Constants.ComplaintStatuses.ESCALATED));
        s.setSlaBreached(complaintRepository.countSlaBreached(now));
        s.setSlaNear(complaintRepository.countSlaNear(now, now.plusHours(24)));
        return s;
    }

    // ========================================================================
    // UPDATE
    // ========================================================================

    @Transactional
    public ComplaintDTO adminReview(Long complaintId, ComplaintReviewDTO dto, Long adminUserId) {
        if (dto == null) throw new IllegalArgumentException("Body requerido");
        Complaint c = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new IllegalArgumentException("Complaint no encontrada"));

        String newStatus = normalizeStatus(dto.getNewStatus());
        String decisionCode = dto.getDecisionCode();
        if (decisionCode != null && !decisionCode.isBlank()) {
            decisionCode = decisionCode.trim().toUpperCase(Locale.ROOT);
            if (!VALID_DECISIONS.contains(decisionCode)) {
                throw new IllegalArgumentException("decisionCode no valido: " + dto.getDecisionCode());
            }
        } else {
            decisionCode = null;
        }
        String notes = trimToNull(dto.getNotes(), 2000);
        if (notes != null && (notes.contains("<") || notes.contains(">"))) {
            throw new IllegalArgumentException("notes contiene caracteres no permitidos");
        }

        boolean finalState = Constants.ComplaintStatuses.RESOLVED.equals(newStatus)
                || Constants.ComplaintStatuses.REJECTED.equals(newStatus);
        if (finalState && decisionCode == null) {
            throw new IllegalArgumentException("decisionCode requerido al pasar a RESOLVED o REJECTED");
        }

        String fromStatus = c.getStatus();
        c.setStatus(newStatus);
        if (decisionCode != null) c.setDecisionCode(decisionCode);
        if (notes != null) c.setDecisionNotes(notes);
        c.setReviewedByUserId(adminUserId);
        if (finalState) {
            c.setResolvedAt(LocalDateTime.now());
        }
        c.setUpdatedAt(LocalDateTime.now());

        Complaint saved = complaintRepository.save(c);

        writeAuditLog(saved.getId(), adminUserId, Constants.ComplaintAuditActions.STATUS_CHANGED,
                fromStatus, newStatus, notes);
        if (decisionCode != null) {
            writeAuditLog(saved.getId(), adminUserId, Constants.ComplaintAuditActions.DECISION,
                    fromStatus, newStatus, "decisionCode=" + decisionCode);
        }

        log.info("[COMPLAINT] reviewed id={} actor={} {} -> {} decision={}",
                saved.getId(), adminUserId, fromStatus, newStatus, decisionCode);
        return toDto(saved, LocalDateTime.now(), true);
    }

    @Transactional
    public ComplaintDTO adminEscalate(Long complaintId, ComplaintEscalateDTO dto, Long adminUserId) {
        Complaint c = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new IllegalArgumentException("Complaint no encontrada"));
        String notes = dto == null ? null : trimToNull(dto.getNotes(), 1000);
        if (notes != null && (notes.contains("<") || notes.contains(">"))) {
            throw new IllegalArgumentException("notes contiene caracteres no permitidos");
        }

        String fromStatus = c.getStatus();
        c.setStatus(Constants.ComplaintStatuses.ESCALATED);
        c.setReviewedByUserId(adminUserId);
        c.setUpdatedAt(LocalDateTime.now());
        Complaint saved = complaintRepository.save(c);

        writeAuditLog(saved.getId(), adminUserId, Constants.ComplaintAuditActions.ESCALATED,
                fromStatus, Constants.ComplaintStatuses.ESCALATED, notes);

        log.warn("[COMPLAINT] escalated id={} actor={} category={} fromStatus={}",
                saved.getId(), adminUserId, saved.getCategory(), fromStatus);
        return toDto(saved, LocalDateTime.now(), true);
    }

    // ========================================================================
    // SLA / utilidades
    // ========================================================================

    /**
     * 5 business days saltando sabado/domingo. No considera festivos
     * (decision deliberada Opcion B: cobertura suficiente para AN 5196
     * que solo exige "business days").
     */
    public static LocalDateTime computeExpectedResolutionAt(LocalDateTime createdAt) {
        if (createdAt == null) return null;
        LocalDateTime t = createdAt;
        int added = 0;
        while (added < 5) {
            t = t.plusDays(1);
            DayOfWeek dow = t.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                added++;
            }
        }
        return t;
    }

    static String computeSlaState(LocalDateTime expectedResolutionAt, String status, LocalDateTime now) {
        if (expectedResolutionAt == null) return "OK";
        Set<String> finalStates = Set.of(Constants.ComplaintStatuses.RESOLVED,
                Constants.ComplaintStatuses.REJECTED,
                Constants.ComplaintStatuses.ESCALATED);
        if (finalStates.contains(status)) return "OK";
        if (now.isAfter(expectedResolutionAt)) return "BREACH";
        if (now.isAfter(expectedResolutionAt.minusHours(24))) return "NEAR";
        return "OK";
    }

    // ========================================================================
    // helpers privados
    // ========================================================================

    private String normalizeCategory(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("category requerido");
        }
        String v = raw.trim().toUpperCase(Locale.ROOT);
        if (!PUBLIC_CATEGORIES.contains(v)) {
            throw new IllegalArgumentException("category no valida: " + raw);
        }
        return v;
    }

    private String normalizeStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("status requerido");
        }
        String v = raw.trim().toUpperCase(Locale.ROOT);
        if (!VALID_STATUSES.contains(v)) {
            throw new IllegalArgumentException("status no valido: " + raw);
        }
        return v;
    }

    private String trimToNull(String s, int max) {
        if (s == null) return null;
        String v = s.trim();
        if (v.isEmpty()) return null;
        return v.length() > max ? v.substring(0, max) : v;
    }

    private void writeAuditLog(Long complaintId, Long actorUserId, String action,
                                String fromStatus, String toStatus, String notes) {
        ComplaintAuditLog log = new ComplaintAuditLog();
        log.setComplaintId(complaintId);
        log.setActorUserId(actorUserId);
        log.setAction(action);
        log.setFromStatus(fromStatus);
        log.setToStatus(toStatus);
        log.setNotes(notes != null && notes.length() > 1000 ? notes.substring(0, 1000) : notes);
        auditLogRepository.save(log);
    }

    private String sha256HexOrNull(String ip) {
        if (ip == null || ip.isBlank()) return null;
        // Salt fijo per-entorno via env var; defecto literal documenta
        // que no hay configuracion separada (data minimization GDPR; no
        // pretende ser secreto, solo no-reversible facilmente).
        String salted = ip + "|sharemechat-complaints-salt";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(salted.getBytes());
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            return null;
        }
    }

    private ComplaintDTO toDto(Complaint c, LocalDateTime now, boolean withAuditLog) {
        ComplaintDTO d = new ComplaintDTO();
        d.setId(c.getId());
        d.setReporterEmail(c.getReporterEmail());
        d.setReporterName(c.getReporterName());
        d.setCategory(c.getCategory());
        d.setDescription(c.getDescription());
        d.setSubjectEmail(c.getSubjectEmail());
        d.setSubjectUrl(c.getSubjectUrl());
        d.setSubjectUserId(c.getSubjectUserId());
        d.setSubjectStreamRecordId(c.getSubjectStreamRecordId());
        d.setStatus(c.getStatus());
        d.setChannel(c.getChannel());
        d.setCreatedAt(c.getCreatedAt());
        d.setAcknowledgedAt(c.getAcknowledgedAt());
        d.setExpectedResolutionAt(c.getExpectedResolutionAt());
        d.setResolvedAt(c.getResolvedAt());
        d.setSlaBreachAt(c.getSlaBreachAt());
        d.setDecisionCode(c.getDecisionCode());
        d.setDecisionNotes(c.getDecisionNotes());
        d.setReviewedByUserId(c.getReviewedByUserId());
        d.setRelatedModerationReportId(c.getRelatedModerationReportId());
        d.setRelatedStreamReviewId(c.getRelatedStreamReviewId());
        d.setUpdatedAt(c.getUpdatedAt());
        d.setSlaState(computeSlaState(c.getExpectedResolutionAt(), c.getStatus(), now));
        if (withAuditLog) {
            List<ComplaintAuditLog> rows = auditLogRepository.findAllByComplaintIdOrderByCreatedAtAsc(c.getId());
            List<ComplaintAuditLogDTO> dtos = new java.util.ArrayList<>();
            for (ComplaintAuditLog r : rows) {
                ComplaintAuditLogDTO x = new ComplaintAuditLogDTO();
                x.setId(r.getId());
                x.setComplaintId(r.getComplaintId());
                x.setActorUserId(r.getActorUserId());
                x.setAction(r.getAction());
                x.setFromStatus(r.getFromStatus());
                x.setToStatus(r.getToStatus());
                x.setNotes(r.getNotes());
                x.setCreatedAt(r.getCreatedAt());
                dtos.add(x);
            }
            d.setAuditLog(dtos);
        }
        return d;
    }
}
