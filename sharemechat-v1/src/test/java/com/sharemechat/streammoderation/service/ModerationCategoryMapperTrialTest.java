package com.sharemechat.streammoderation.service;

import com.sharemechat.config.ModerationThresholdsProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.config.ModerationTrialThresholdsProperties;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import com.sharemechat.streammoderation.dto.SightengineWorkflowResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * ADR-037 frente trial-sfw Bloque 2 (Via 1): tests de la variante
 * {@code buildVerdict(..., isTrial)} del mapper.
 *
 * <p>Verifica que cuando isTrial=true los umbrales locales estrictos
 * sobre {@code nudity.sexual_activity / erotica / sexual_display}
 * disparan verdict SIN delegar a {@code summary.action}. Y que
 * isTrial=false preserva el comportamiento paid (delegacion).
 * El bypass CRITICAL de MINORS/GORE (paso 1) mantiene prioridad
 * absoluta sobre trial.
 */
class ModerationCategoryMapperTrialTest {

    private ModerationCategoryMapper mapper;

    @BeforeEach
    void setUp() {
        ModerationThresholdsProperties t = new ModerationThresholdsProperties();
        ModerationTrialThresholdsProperties tt = new ModerationTrialThresholdsProperties();
        // Defaults 0.30 / 0.40 / 0.50
        mapper = new ModerationCategoryMapper(t, tt);
    }

    private SightengineWorkflowResponse responseWithNudity(Map<String, Object> nudity,
                                                           String action) {
        SightengineWorkflowResponse r = new SightengineWorkflowResponse();
        r.setRequestId("req-trial");
        Map<String, Object> scores = new HashMap<>();
        scores.put("nudity", nudity);
        r.setRawScoresByModel(scores);
        if (action != null) {
            SightengineWorkflowResponse.Summary s = new SightengineWorkflowResponse.Summary();
            s.setAction(action);
            s.setRejectReasons(List.of());
            r.setSummary(s);
        }
        return r;
    }

    private Map<String, Object> nudityScores(Double sexualActivity, Double erotica, Double sexualDisplay) {
        Map<String, Object> nudity = new HashMap<>();
        if (sexualActivity != null) nudity.put("sexual_activity", sexualActivity);
        if (erotica != null) nudity.put("erotica", erotica);
        if (sexualDisplay != null) nudity.put("sexual_display", sexualDisplay);
        return nudity;
    }

    // =====================================================================
    // Trial: umbrales locales estrictos disparan sin consultar summary.action
    // =====================================================================

    @Test
    @DisplayName("Trial: nudity.sexual_activity > 0.30 -> CRITICAL / CUT (sin consultar summary)")
    void trialSexualActivityCritical() {
        Map<String, Object> nudity = nudityScores(0.35, 0.10, 0.10);
        // summary=accept: si no fuera trial, seria GREEN; en trial debe cortar
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWithNudity(nudity, "accept"), "{}", Instant.now(), true);

        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
        assertEquals("CUT", v.getSuggestedAction());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.NUDITY));
        assertEquals(new BigDecimal("0.35"),
                v.getCategoryVerdicts().get(Constants.StreamModerationCategory.NUDITY).getScore());
    }

    @Test
    @DisplayName("Trial: nudity.erotica > 0.40 sin sexual_activity -> RED / ENQUEUE")
    void trialEroticaRed() {
        Map<String, Object> nudity = nudityScores(0.10, 0.45, 0.10);
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWithNudity(nudity, "accept"), "{}", Instant.now(), true);

        assertEquals(Constants.StreamModerationSeverity.RED, v.getSeverityOverall());
        assertEquals("ENQUEUE", v.getSuggestedAction());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.NUDITY));
    }

    @Test
    @DisplayName("Trial: nudity.sexual_display > 0.50 sin otros -> AMBER / ENQUEUE")
    void trialSexualDisplayAmber() {
        Map<String, Object> nudity = nudityScores(0.10, 0.10, 0.55);
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWithNudity(nudity, "accept"), "{}", Instant.now(), true);

        assertEquals(Constants.StreamModerationSeverity.AMBER, v.getSeverityOverall());
        assertEquals("ENQUEUE", v.getSuggestedAction());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.NUDITY));
    }

    @Test
    @DisplayName("Trial: varios cruzados -> gana el mas grave (CRITICAL)")
    void trialMultipleThresholdsHitCriticalWins() {
        Map<String, Object> nudity = nudityScores(0.40, 0.50, 0.60);
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWithNudity(nudity, "accept"), "{}", Instant.now(), true);

        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
        assertEquals("CUT", v.getSuggestedAction());
    }

    @Test
    @DisplayName("Trial: todos por debajo de umbral -> cae a paso 2 (delega a summary=accept) -> GREEN")
    void trialAllUnderThresholdDelegatesToSummary() {
        Map<String, Object> nudity = nudityScores(0.20, 0.30, 0.40);
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWithNudity(nudity, "accept"), "{}", Instant.now(), true);

        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertEquals("NO_OP", v.getSuggestedAction());
    }

    // =====================================================================
    // isTrial=false: preserva comportamiento paid (delega a summary.action)
    // =====================================================================

    @Test
    @DisplayName("Paid (isTrial=false): mismo score explosivo NO dispara trial-strict -> delega a summary=accept -> GREEN")
    void paidWithHighScoreDelegatesToSummary() {
        Map<String, Object> nudity = nudityScores(0.90, 0.90, 0.90);
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWithNudity(nudity, "accept"), "{}", Instant.now(), false);

        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertEquals("NO_OP", v.getSuggestedAction());
    }

    // =====================================================================
    // Bypass CRITICAL (paso 1) gana sobre trial-strict (paso 1.5)
    // =====================================================================

    @Test
    @DisplayName("Trial + MINORS 0.5 -> paso 1 bypass -> CRITICAL con categoria MINORS (no NUDITY)")
    void trialWithMinorsCriticalWinsOverTrialStrict() {
        // MINORS excede 0.3 (default critical) + nudity trial-hit
        SightengineWorkflowResponse r = new SightengineWorkflowResponse();
        Map<String, Object> scores = new HashMap<>();
        Map<String, Object> minor = new HashMap<>();
        minor.put("prob", 0.50);
        scores.put("minor", minor);
        scores.put("nudity", nudityScores(0.40, 0.10, 0.10));
        r.setRawScoresByModel(scores);
        SightengineWorkflowResponse.Summary s = new SightengineWorkflowResponse.Summary();
        s.setAction("accept");
        r.setSummary(s);

        ModerationVerdictResult v = mapper.buildVerdict(r, "{}", Instant.now(), true);

        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.MINORS));
        // NO debe haber verdict de NUDITY porque paso 1 corta antes de paso 1.5
        assertEquals(1, v.getCategoryVerdicts().size());
    }

    // =====================================================================
    // buildVerdict legacy (3 args) preserva compat (no aplica trial-strict)
    // =====================================================================

    @Test
    @DisplayName("Legacy buildVerdict(3 args): score trial-explosive con summary=accept -> GREEN (isTrial default false)")
    void legacyBuildVerdictBehavesAsPaid() {
        Map<String, Object> nudity = nudityScores(0.90, 0.90, 0.90);
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWithNudity(nudity, "accept"), "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertEquals("NO_OP", v.getSuggestedAction());
    }
}
