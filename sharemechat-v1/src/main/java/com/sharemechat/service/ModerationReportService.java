package com.sharemechat.service;

import com.sharemechat.dto.*;
import com.sharemechat.entity.ModerationReport;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModerationReportRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class ModerationReportService {

    private final ModerationReportRepository moderationReportRepository;
    private final UserRepository userRepository;
    private final UserBlockService userBlockService;

    public ModerationReportService(
            ModerationReportRepository moderationReportRepository,
            UserRepository userRepository,
            UserBlockService userBlockService
    ) {
        this.moderationReportRepository = moderationReportRepository;
        this.userRepository = userRepository;
        this.userBlockService = userBlockService;
    }

    public User getCurrentUserOrThrow() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("No autenticado");
        }
        String email = auth.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("Usuario no encontrado para principal=" + email));
    }

    @Transactional
    public ModerationReportDTO createReport(ReportAbuseCreateDTO dto) {
        User me = getCurrentUserOrThrow();
        Long reporterId = me.getId();

        if (dto == null) {
            throw new IllegalArgumentException("Body requerido");
        }
        if (dto.getReportedUserId() == null || dto.getReportedUserId() <= 0) {
            throw new IllegalArgumentException("reportedUserId inválido");
        }
        if (reporterId.equals(dto.getReportedUserId())) {
            throw new IllegalArgumentException("No puedes reportarte a ti mismo");
        }

        userRepository.findById(dto.getReportedUserId())
                .orElseThrow(() -> new IllegalArgumentException("Usuario reportado no existe"));

        String reportType = normalizeReportType(dto.getReportType());
        String description = trimToNull(dto.getDescription(), 1000);
        boolean alsoBlock = dto.getAlsoBlock() == null || dto.getAlsoBlock();

        ModerationReport row = new ModerationReport();
        row.setReporterUserId(reporterId);
        row.setReportedUserId(dto.getReportedUserId());
        row.setStreamRecordId(dto.getStreamRecordId());
        row.setReportType(reportType);
        row.setDescription(description);
        row.setStatus("OPEN");
        row.setAdminAction("NONE");

        // opcional: auto-block del reportado
        if (alsoBlock) {
            try {
                UserBlockDTO blockDto = new UserBlockDTO();
                blockDto.reason = "report_abuse:" + reportType.toLowerCase(Locale.ROOT);
                userBlockService.blockUser(dto.getReportedUserId(), blockDto);
                row.setAutoBlocked(true);
            } catch (Exception ignore) {
                // No rompemos el reporte por fallo de bloqueo; el reporte es lo prioritario
                row.setAutoBlocked(false);
            }
        }

        // Política de escalado mínimo PSP: MINOR => desactivar inmediatamente (suspensión preventiva)
        if ("MINOR".equals(reportType)) {
            User reported = userRepository.findById(dto.getReportedUserId()).orElse(null);
            if (reported != null) {
                reported.setIsActive(false);
                userRepository.save(reported);
                row.setAdminAction("SUSPEND");
                row.setStatus("REVIEWING");
                row.setResolutionNotes("Auto-suspend por reporte tipo MINOR (revisión pendiente).");
            }
        }

        ModerationReport saved = moderationReportRepository.save(row);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<ModerationReportDTO> myReports() {
        User me = getCurrentUserOrThrow();
        return moderationReportRepository.findAllByReporterUserIdOrderByCreatedAtDesc(me.getId())
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ModerationReportDTO> adminList(String status) {
        List<ModerationReport> rows = (status == null || status.isBlank())
                ? moderationReportRepository.findAllByOrderByCreatedAtDesc()
                : moderationReportRepository.findAllByStatusOrderByCreatedAtDesc(status.trim().toUpperCase(Locale.ROOT));

        return rows.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ModerationReportDTO adminGetById(Long id) {
        ModerationReport row = moderationReportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Reporte no encontrado"));
        return toDto(row);
    }

    @Transactional
    public ModerationReportDTO adminReview(Long reportId, Long adminUserId, ModerationReportReviewDTO dto) {
        if (dto == null) throw new IllegalArgumentException("Body requerido");

        ModerationReport row = moderationReportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("Reporte no encontrado"));

        String newStatus = normalizeReviewStatus(dto.getStatus());
        String adminAction = normalizeAdminAction(dto.getAdminAction());
        String notes = trimToNull(dto.getResolutionNotes(), 2000);

        // Acción administrativa sobre el usuario reportado
        if ("SUSPEND".equals(adminAction) || "BAN".equals(adminAction)) {
            User reported = userRepository.findById(row.getReportedUserId())
                    .orElseThrow(() -> new IllegalArgumentException("Usuario reportado no existe"));
            reported.setIsActive(false);
            userRepository.save(reported);
        }
        // WARNING / NONE => sin tocar usuario

        row.setStatus(newStatus);
        row.setAdminAction(adminAction);
        row.setResolutionNotes(notes);
        row.setReviewedByUserId(adminUserId);
        row.setReviewedAt(LocalDateTime.now());

        ModerationReport saved = moderationReportRepository.save(row);
        return toDto(saved);
    }

    private String normalizeReportType(String raw) {
        if (raw == null || raw.isBlank()) throw new IllegalArgumentException("reportType requerido");
        String v = raw.trim().toUpperCase(Locale.ROOT);

        return switch (v) {
            case "ABUSE", "HARASSMENT", "NUDITY", "FRAUD", "MINOR" , "OTHER" -> v;
            default -> throw new IllegalArgumentException("reportType no válido: " + raw);
        };
    }

    private String normalizeReviewStatus(String raw) {
        if (raw == null || raw.isBlank()) throw new IllegalArgumentException("status requerido");
        String v = raw.trim().toUpperCase(Locale.ROOT);

        return switch (v) {
            case "OPEN", "REVIEWING", "RESOLVED", "REJECTED" -> v;
            default -> throw new IllegalArgumentException("status no válido: " + raw);
        };
    }

    private String normalizeAdminAction(String raw) {
        if (raw == null || raw.isBlank()) return "NONE";
        String v = raw.trim().toUpperCase(Locale.ROOT);

        return switch (v) {
            case "NONE", "WARNING", "SUSPEND", "BAN" -> v;
            default -> throw new IllegalArgumentException("adminAction no válida: " + raw);
        };
    }

    private String trimToNull(String s, int max) {
        if (s == null) return null;
        String v = s.trim();
        if (v.isEmpty()) return null;
        return v.length() > max ? v.substring(0, max) : v;
    }

    private ModerationReportDTO toDto(ModerationReport r) {
        ModerationReportDTO dto = new ModerationReportDTO();
        dto.setId(r.getId());
        dto.setReporterUserId(r.getReporterUserId());
        dto.setReportedUserId(r.getReportedUserId());
        dto.setStreamRecordId(r.getStreamRecordId());
        dto.setReportType(r.getReportType());
        dto.setDescription(r.getDescription());
        dto.setStatus(r.getStatus());
        dto.setAdminAction(r.getAdminAction());
        dto.setAutoBlocked(r.isAutoBlocked());
        dto.setResolutionNotes(r.getResolutionNotes());
        dto.setReviewedByUserId(r.getReviewedByUserId());
        dto.setReviewedAt(r.getReviewedAt());
        dto.setCreatedAt(r.getCreatedAt());
        dto.setUpdatedAt(r.getUpdatedAt());
        return dto;
    }
}