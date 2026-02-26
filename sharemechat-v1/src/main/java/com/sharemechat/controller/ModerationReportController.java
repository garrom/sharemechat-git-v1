package com.sharemechat.controller;

import com.sharemechat.dto.ModerationReportDTO;
import com.sharemechat.dto.ReportAbuseCreateDTO;
import com.sharemechat.service.ModerationReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ModerationReportController {

    private final ModerationReportService moderationReportService;

    public ModerationReportController(ModerationReportService moderationReportService) {
        this.moderationReportService = moderationReportService;
    }

    // POST /api/reports/abuse
    @PostMapping("/abuse")
    public ResponseEntity<ModerationReportDTO> createAbuseReport(@RequestBody ReportAbuseCreateDTO dto) {
        return ResponseEntity.ok(moderationReportService.createReport(dto));
    }

    // GET /api/reports/mine
    @GetMapping("/mine")
    public ResponseEntity<List<ModerationReportDTO>> myReports() {
        return ResponseEntity.ok(moderationReportService.myReports());
    }
}