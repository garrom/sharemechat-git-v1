package com.sharemechat.content.controller;

import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.BilingualSubmitResultDTO;
import com.sharemechat.content.dto.CreateRunRequest;
import com.sharemechat.content.dto.RunDetailDTO;
import com.sharemechat.content.dto.RunSummaryDTO;
import com.sharemechat.content.dto.SubmitOutputBilingualRequest;
import com.sharemechat.content.dto.SubmitOutputRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Endpoints admin para runs IA.
 *
 * --------------------------------------------------------------------
 * PAQUETE 1 (ADR-025): NEUTRALIZADO.
 *
 * Endpoints declarados con paths originales. Cuerpos arrojan
 * UnsupportedOperationException. Reescritura completa en paquete 2-4
 * (incluye nuevo contrato JSON bilingue schema 2.0, ver ADR-025).
 * --------------------------------------------------------------------
 */
@RestController
@RequestMapping("/api/admin/content")
public class ContentRunAdminController {

    private static final String MSG =
            "Pendiente paquete 2 — rediseño CMS bilingüe (ADR-025)";

    @PostMapping("/articles/{id}/runs")
    public ResponseEntity<RunDetailDTO> createRun(
            @PathVariable("id") Long articleId,
            @RequestBody CreateRunRequest request,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @PostMapping("/articles/{articleId}/runs/{runId}/output")
    public RunDetailDTO submitOutput(
            @PathVariable("articleId") Long articleId,
            @PathVariable("runId") Long runId,
            @RequestBody SubmitOutputRequest request,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @PostMapping("/articles/{articleId}/runs/{runId}/output-bilingual")
    public BilingualSubmitResultDTO submitOutputBilingual(
            @PathVariable("articleId") Long articleId,
            @PathVariable("runId") Long runId,
            @RequestBody SubmitOutputBilingualRequest request,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @GetMapping("/articles/{id}/runs")
    public List<RunSummaryDTO> listByArticle(
            @PathVariable("id") Long articleId,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @GetMapping("/runs/{runId}")
    public RunDetailDTO getRun(
            @PathVariable("runId") Long runId,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @PostMapping("/articles/{articleId}/runs/{runId}/apply-draft")
    public ArticleDetailDTO applyDraft(
            @PathVariable("articleId") Long articleId,
            @PathVariable("runId") Long runId,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }
}
