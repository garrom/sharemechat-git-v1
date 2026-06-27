package com.sharemechat.streammoderation.service;

import com.sharemechat.config.ModerationThresholdsProperties;
import com.sharemechat.constants.Constants;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de {@link ModerationCategoryMapper} con el algoritmo P2.2:
 *
 * <ul>
 *   <li>Bypass CRITICAL para MINORS y GORE (innegociable, no delegado).</li>
 *   <li>Delegacion a {@code summary.action} para el resto.</li>
 *   <li>Fail-safe permisivo GREEN si {@code summary.action} ausente.</li>
 * </ul>
 */
class ModerationCategoryMapperTest {

    private ModerationCategoryMapper mapper;

    @BeforeEach
    void setUp() {
        ModerationThresholdsProperties t = new ModerationThresholdsProperties();
        mapper = new ModerationCategoryMapper(t);
    }

    private SightengineWorkflowResponse responseWith(Map<String, Object> scoresByModel,
                                                    String action,
                                                    List<String> rejectReasons) {
        SightengineWorkflowResponse r = new SightengineWorkflowResponse();
        r.setRequestId("req-1");
        r.setRawScoresByModel(scoresByModel);
        if (action != null || rejectReasons != null) {
            SightengineWorkflowResponse.Summary s = new SightengineWorkflowResponse.Summary();
            s.setAction(action);
            if (rejectReasons != null) s.setRejectReasons(rejectReasons);
            r.setSummary(s);
        }
        return r;
    }

    private Map<String, Object> singleScore(String model, String sub, double v) {
        Map<String, Object> inner = new HashMap<>();
        inner.put(sub, v);
        Map<String, Object> scores = new HashMap<>();
        scores.put(model, inner);
        return scores;
    }

    // ========================================================================
    // Paso 1: bypass CRITICAL (MINORS / GORE) — innegociable
    // ========================================================================

    @Test
    @DisplayName("CRITICAL: MINORS prob > 0.3 bypassa summary.action -> CRITICAL incluso si Sightengine ACCEPT")
    void minorsCriticalBypassesAccept() {
        Map<String, Object> scores = singleScore("minor", "prob", 0.45);
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(scores, "accept", List.of()), "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
        assertEquals("CUT", v.getSuggestedAction());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.MINORS));
    }

    @Test
    @DisplayName("CRITICAL: MINORS prob <= 0.3 NO triggers critical (umbral estricto)")
    void minorsBelowThresholdNoCritical() {
        Map<String, Object> scores = singleScore("minor", "prob", 0.25);
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(scores, "accept", List.of()), "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
    }

    @Test
    @DisplayName("CRITICAL: GORE prob > 0.5 bypassa summary.action -> CRITICAL incluso si Sightengine ACCEPT")
    void goreCriticalBypassesAccept() {
        Map<String, Object> scores = singleScore("gore", "prob", 0.7);
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(scores, "accept", List.of()), "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.GORE));
    }

    @Test
    @DisplayName("CRITICAL: MINORS Y GORE simultaneos -> CRITICAL con ambas categorias acumuladas")
    void minorsAndGoreCritical() {
        Map<String, Object> minor = new HashMap<>();
        minor.put("prob", 0.45);
        Map<String, Object> gore = new HashMap<>();
        gore.put("prob", 0.7);
        Map<String, Object> scores = new HashMap<>();
        scores.put("minor", minor);
        scores.put("gore", gore);

        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(scores, "reject", List.of("nudity-2.1.sexual_activity")),
                "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
        assertEquals(2, v.getCategoryVerdicts().size());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.MINORS));
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.GORE));
    }

    // ========================================================================
    // Paso 2: delegacion a summary.action
    // ========================================================================

    @Test
    @DisplayName("ACCEPT: summary.action='accept' con scores nudity altos -> GREEN, categoryVerdicts vacio")
    void acceptKeepsGreenEvenWithHighScores() {
        Map<String, Object> nud = new HashMap<>();
        nud.put("sexual_activity", 0.95);
        nud.put("erotica", 0.85);
        Map<String, Object> scores = new HashMap<>();
        scores.put("nudity", nud);

        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(scores, "accept", List.of()), "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertEquals("NO_OP", v.getSuggestedAction());
        assertTrue(v.getCategoryVerdicts().isEmpty());
    }

    @Test
    @DisplayName("REJECT: reject_reason='nudity-2.1.sexual_display' -> AMBER con NUDITY")
    void rejectNudityScalesToAmber() {
        Map<String, Object> nud = new HashMap<>();
        nud.put("sexual_display", 0.9);
        Map<String, Object> scores = new HashMap<>();
        scores.put("nudity", nud);

        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(scores, "reject", List.of("nudity-2.1.sexual_display")),
                "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.AMBER, v.getSeverityOverall());
        assertEquals("ENQUEUE", v.getSuggestedAction());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.NUDITY));
    }

    @Test
    @DisplayName("REJECT: reject_reason='weapon-1.classes.knife' -> AMBER con WEAPONS")
    void rejectWeaponsScalesToAmber() {
        Map<String, Object> weapon = new HashMap<>();
        weapon.put("knife", 0.85);
        Map<String, Object> scores = new HashMap<>();
        scores.put("weapon", weapon);

        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(scores, "reject", List.of("weapon-1.classes.knife")),
                "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.AMBER, v.getSeverityOverall());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.WEAPONS));
    }

    @Test
    @DisplayName("REJECT: reasons que mapean a 2 categorias acumulan ambas en categoryVerdicts")
    void rejectMultipleReasonsAccumulate() {
        Map<String, Object> nud = new HashMap<>();
        nud.put("sexual_activity", 0.95);
        Map<String, Object> weapon = new HashMap<>();
        weapon.put("knife", 0.8);
        Map<String, Object> scores = new HashMap<>();
        scores.put("nudity", nud);
        scores.put("weapon", weapon);

        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(scores, "reject", List.of("sexual_activity", "knife")),
                "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.AMBER, v.getSeverityOverall());
        assertEquals(2, v.getCategoryVerdicts().size());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.NUDITY));
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.WEAPONS));
    }

    @Test
    @DisplayName("REJECT: reasons vacias o no reconocidas -> AMBER sobre categoria OTHER (fail-safe)")
    void rejectWithoutMappedReasonsFallsBackToOther() {
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(new HashMap<>(), "reject", List.of("totally_unknown")),
                "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.AMBER, v.getSeverityOverall());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.OTHER));
    }

    @Test
    @DisplayName("ACCEPT con scores nudity altos NO crea review (severity GREEN)")
    void acceptWithHighNudityNoReview() {
        Map<String, Object> nud = new HashMap<>();
        nud.put("sexual_activity", 0.95);
        Map<String, Object> scores = new HashMap<>();
        scores.put("nudity", nud);

        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(scores, "accept", List.of()), "{}", Instant.now());

        // categoryVerdicts vacio cuando ACCEPT -> ActionService no crea review
        // (la trazabilidad granular vive en vendorMetadataJson).
        assertTrue(v.getCategoryVerdicts().isEmpty());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
    }

    // ========================================================================
    // Fail-safe permisivo
    // ========================================================================

    @Test
    @DisplayName("summary.action ausente -> GREEN (fail-safe permisivo, postura adult dating)")
    void missingSummaryActionFailsSafeGreen() {
        SightengineWorkflowResponse r = new SightengineWorkflowResponse();
        r.setRequestId("req-1");
        ModerationVerdictResult v = mapper.buildVerdict(r, "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertEquals("NO_OP", v.getSuggestedAction());
    }

    @Test
    @DisplayName("summary.action='maybe' (desconocido) -> GREEN con log warn")
    void unknownActionFailsSafeGreen() {
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(new HashMap<>(), "maybe", List.of()), "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
    }

    @Test
    @DisplayName("summary null sin scores -> GREEN")
    void nullSummaryGreen() {
        SightengineWorkflowResponse r = new SightengineWorkflowResponse();
        ModerationVerdictResult v = mapper.buildVerdict(r, "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
    }

    @Test
    @DisplayName("response null no truena -> GREEN")
    void nullResponseGreen() {
        ModerationVerdictResult v = mapper.buildVerdict(null, "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertNull(v.getProviderEventId());
    }

    // ========================================================================
    // Trazabilidad
    // ========================================================================

    @Test
    @DisplayName("vendorMetadataJson preserva el body crudo recibido")
    void preservesVendorMetadata() {
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(new HashMap<>(), "accept", List.of()), "{\"raw\":1}", Instant.now());
        assertEquals("{\"raw\":1}", v.getVendorMetadataJson());
    }

    @Test
    @DisplayName("frameTimestamp se propaga al verdict")
    void framTimestampPropagated() {
        Instant ts = Instant.parse("2026-06-25T12:00:00Z");
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(new HashMap<>(), "accept", List.of()), "{}", ts);
        assertEquals(ts, v.getFrameTimestamp());
    }

    @Test
    @DisplayName("providerEventId se toma del requestId del response")
    void providerEventIdFromRequest() {
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(new HashMap<>(), "accept", List.of()), "{}", Instant.now());
        assertEquals("req-1", v.getProviderEventId());
    }

    // ========================================================================
    // resolveCanonicalFromReason — heuristicas
    // ========================================================================

    @Test
    @DisplayName("resolveCanonicalFromReason: 'nudity-2.1.sexual_activity' -> NUDITY")
    void resolveNudityVersioned() {
        assertEquals(Constants.StreamModerationCategory.NUDITY,
                mapper.resolveCanonicalFromReason("nudity-2.1.sexual_activity"));
    }

    @Test
    @DisplayName("resolveCanonicalFromReason: 'sexual_activity' plano -> NUDITY")
    void resolvePlainSubclass() {
        assertEquals(Constants.StreamModerationCategory.NUDITY,
                mapper.resolveCanonicalFromReason("sexual_activity"));
    }

    @Test
    @DisplayName("resolveCanonicalFromReason: 'weapon-1.classes.knife' -> WEAPONS")
    void resolveWeaponVersioned() {
        assertEquals(Constants.StreamModerationCategory.WEAPONS,
                mapper.resolveCanonicalFromReason("weapon-1.classes.knife"));
    }

    @Test
    @DisplayName("resolveCanonicalFromReason: heuristica por prefijo modelo desconocido")
    void resolvePrefixHeuristic() {
        assertEquals(Constants.StreamModerationCategory.OFFENSIVE_SYMBOLS,
                mapper.resolveCanonicalFromReason("offensive-foobar.something"));
        assertEquals(Constants.StreamModerationCategory.SELF_HARM,
                mapper.resolveCanonicalFromReason("self-harm-2.severity"));
        assertEquals(Constants.StreamModerationCategory.DRUGS,
                mapper.resolveCanonicalFromReason("recreational_drug-1.unknown"));
    }

    @Test
    @DisplayName("resolveCanonicalFromReason: reason completamente desconocida -> null")
    void resolveUnknownReturnsNull() {
        assertNull(mapper.resolveCanonicalFromReason("xyz_unmapped_blob"));
    }

    // ========================================================================
    // Helpers / utilidades existentes
    // ========================================================================

    @Test
    @DisplayName("computeSeverity: MINORS solo conoce CRITICAL (helper sigue activo)")
    void computeSeverityMinorsOnlyCritical() {
        assertEquals(Constants.StreamModerationSeverity.GREEN,
                mapper.computeSeverity(Constants.StreamModerationCategory.MINORS, new BigDecimal("0.29")));
        assertEquals(Constants.StreamModerationSeverity.CRITICAL,
                mapper.computeSeverity(Constants.StreamModerationCategory.MINORS, new BigDecimal("0.31")));
    }

    @Test
    @DisplayName("IGNORED_SUBCLASSES contiene bikini/underwear/cleavage exactos")
    void ignoredSetExact() {
        assertTrue(ModerationCategoryMapper.ignoredSubclasses().contains("bikini"));
        assertTrue(ModerationCategoryMapper.ignoredSubclasses().contains("underwear"));
        assertTrue(ModerationCategoryMapper.ignoredSubclasses().contains("cleavage"));
        assertFalse(ModerationCategoryMapper.ignoredSubclasses().contains("sexual_activity"));
    }

    @Test
    @DisplayName("extractScore: max sobre sub-claves de la misma canonica")
    void extractScoreMaxAcrossSubclasses() {
        Map<String, Object> nud = new HashMap<>();
        nud.put("sexual_activity", 0.55);
        nud.put("erotica", 0.78);
        nud.put("sexual_display", 0.62);
        Map<String, Object> scores = new HashMap<>();
        scores.put("nudity", nud);

        BigDecimal max = mapper.extractScore(
                responseWith(scores, "accept", List.of()),
                Constants.StreamModerationCategory.NUDITY);
        assertNotNull(max);
        assertEquals(0, max.compareTo(new BigDecimal("0.78")));
    }
}
