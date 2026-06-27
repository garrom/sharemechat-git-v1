package com.sharemechat.streammoderation.service;

import com.sharemechat.config.ModerationThresholdsProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.dto.ModerationCategoryVerdict;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import com.sharemechat.streammoderation.dto.SightengineWorkflowResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de {@link ModerationCategoryMapper} contra los umbrales DEC-1
 * de P2.1.
 */
class ModerationCategoryMapperTest {

    private ModerationCategoryMapper mapper;

    @BeforeEach
    void setUp() {
        ModerationThresholdsProperties t = new ModerationThresholdsProperties();
        mapper = new ModerationCategoryMapper(t);
    }

    private SightengineWorkflowResponse responseWith(Map<String, Object> scoresByModel) {
        SightengineWorkflowResponse r = new SightengineWorkflowResponse();
        r.setRequestId("req-1");
        r.setRawScoresByModel(scoresByModel);
        return r;
    }

    @Test
    @DisplayName("MINORS score > 0.3 -> CRITICAL (DEC-1)")
    void minorsCritical() {
        Map<String, Object> minor = new HashMap<>();
        minor.put("prob", 0.45);
        Map<String, Object> scores = new HashMap<>();
        scores.put("minor", minor);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());

        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
        assertEquals("CUT", v.getSuggestedAction());
        ModerationCategoryVerdict mv = v.getCategoryVerdicts().get(Constants.StreamModerationCategory.MINORS);
        assertNotNull(mv);
        assertEquals(Constants.StreamModerationSeverity.CRITICAL, mv.getSeverity());
    }

    @Test
    @DisplayName("MINORS score = 0.25 -> GREEN (umbral 0.3 estricto)")
    void minorsBelowThreshold() {
        Map<String, Object> minor = new HashMap<>();
        minor.put("prob", 0.25);
        Map<String, Object> scores = new HashMap<>();
        scores.put("minor", minor);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertTrue(v.getCategoryVerdicts().isEmpty());
    }

    @Test
    @DisplayName("GORE score > 0.5 -> CRITICAL (DEC-1)")
    void goreCritical() {
        Map<String, Object> gore = new HashMap<>();
        gore.put("prob", 0.7);
        Map<String, Object> scores = new HashMap<>();
        scores.put("gore", gore);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
    }

    @Test
    @DisplayName("NUDITY sexual_activity > 0.5 -> AMBER; sexual_activity > 0.7 -> RED")
    void nudityAmberRed() {
        Map<String, Object> nud = new HashMap<>();
        nud.put("sexual_activity", 0.55);
        Map<String, Object> scores = new HashMap<>();
        scores.put("nudity", nud);

        ModerationVerdictResult amber = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.AMBER, amber.getSeverityOverall());

        nud.put("sexual_activity", 0.75);
        ModerationVerdictResult red = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.RED, red.getSeverityOverall());
    }

    @Test
    @DisplayName("DEC-1: sub-clases bikini/underwear/cleavage IGNORADAS (NO MODERADA)")
    void ignoredSubclassesNoEvent() {
        Map<String, Object> nud = new HashMap<>();
        nud.put("bikini", 0.95);
        nud.put("underwear", 0.9);
        nud.put("cleavage", 0.85);
        Map<String, Object> scores = new HashMap<>();
        scores.put("nudity", nud);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertTrue(v.getCategoryVerdicts().isEmpty());
    }

    @Test
    @DisplayName("DEC-15: sub-clase no mapeada -> ignorada sin generar review")
    void unknownSubclassIgnored() {
        Map<String, Object> unknown = new HashMap<>();
        unknown.put("aliens", 0.95);
        Map<String, Object> scores = new HashMap<>();
        scores.put("nudity", unknown);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertTrue(v.getCategoryVerdicts().isEmpty());
    }

    @Test
    @DisplayName("severityOverall = max sobre categorias: MINORS CRITICAL prevalece sobre NUDITY AMBER")
    void severityOverallMax() {
        Map<String, Object> minor = new HashMap<>();
        minor.put("prob", 0.6);
        Map<String, Object> nud = new HashMap<>();
        nud.put("sexual_activity", 0.55);
        Map<String, Object> scores = new HashMap<>();
        scores.put("minor", minor);
        scores.put("nudity", nud);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
        // Ambas categorias acumuladas en categoryVerdicts.
        assertEquals(2, v.getCategoryVerdicts().size());
    }

    @Test
    @DisplayName("SELF_HARM solo umbral AMBER (0.4) - red queda como AMBER")
    void selfHarmOnlyAmber() {
        Map<String, Object> sh = new HashMap<>();
        sh.put("prob", 0.95);
        Map<String, Object> scores = new HashMap<>();
        scores.put("self-harm", sh);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.AMBER, v.getSeverityOverall());
    }

    @Test
    @DisplayName("GAMBLING solo umbral AMBER (0.5)")
    void gamblingOnlyAmber() {
        Map<String, Object> g = new HashMap<>();
        g.put("prob", 0.95);
        Map<String, Object> scores = new HashMap<>();
        scores.put("gambling", g);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.AMBER, v.getSeverityOverall());
    }

    @Test
    @DisplayName("scores nulos no truenan; valor null se ignora")
    void nullScoreIgnored() {
        Map<String, Object> g = new HashMap<>();
        g.put("prob", null);
        Map<String, Object> scores = new HashMap<>();
        scores.put("gambling", g);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
    }

    @Test
    @DisplayName("response vacio o sin scores -> verdict GREEN")
    void emptyScoresGreen() {
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(new HashMap<>()), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertEquals("NO_OP", v.getSuggestedAction());
    }

    @Test
    @DisplayName("vendorMetadataJson preserva el body crudo recibido")
    void preservesVendorMetadata() {
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(new HashMap<>()), "{\"raw\":1}", Instant.now());
        assertEquals("{\"raw\":1}", v.getVendorMetadataJson());
    }

    @Test
    @DisplayName("frameTimestamp se propaga del adapter al verdict")
    void framTimestampPropagated() {
        Instant ts = Instant.parse("2026-06-25T12:00:00Z");
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(new HashMap<>()), "{}", ts);
        assertEquals(ts, v.getFrameTimestamp());
    }

    @Test
    @DisplayName("providerEventId se toma del requestId del response")
    void providerEventIdFromRequest() {
        ModerationVerdictResult v = mapper.buildVerdict(
                responseWith(new HashMap<>()), "{}", Instant.now());
        assertEquals("req-1", v.getProviderEventId());
    }

    @Test
    @DisplayName("response null no truena; devuelve verdict GREEN")
    void nullResponseGreen() {
        ModerationVerdictResult v = mapper.buildVerdict(null, "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertNull(v.getProviderEventId());
    }

    @Test
    @DisplayName("computeSeverity: MINORS solo conoce CRITICAL (AMBER nunca)")
    void computeSeverityMinorsOnlyCritical() {
        assertEquals(Constants.StreamModerationSeverity.GREEN,
                mapper.computeSeverity(Constants.StreamModerationCategory.MINORS, new BigDecimal("0.29")));
        assertEquals(Constants.StreamModerationSeverity.CRITICAL,
                mapper.computeSeverity(Constants.StreamModerationCategory.MINORS, new BigDecimal("0.31")));
    }

    @Test
    @DisplayName("IGNORED_SUBCLASSES contiene bikini, underwear, cleavage exactos")
    void ignoredSetExact() {
        assertTrue(ModerationCategoryMapper.ignoredSubclasses().contains("bikini"));
        assertTrue(ModerationCategoryMapper.ignoredSubclasses().contains("underwear"));
        assertTrue(ModerationCategoryMapper.ignoredSubclasses().contains("cleavage"));
        assertFalse(ModerationCategoryMapper.ignoredSubclasses().contains("sexual_activity"));
    }

    @Test
    @DisplayName("Calibracion P2.1: nudity.none/suggestive/mildly_suggestive/very_suggestive son NO MODERADA")
    void nudityRealSubclassesIgnored() {
        Map<String, Object> nud = new HashMap<>();
        nud.put("none", 0.9);
        nud.put("suggestive", 0.85);
        nud.put("mildly_suggestive", 0.8);
        nud.put("very_suggestive", 0.95);
        Map<String, Object> scores = new HashMap<>();
        scores.put("nudity", nud);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertTrue(v.getCategoryVerdicts().isEmpty());
    }

    @Test
    @DisplayName("Calibracion P2.1: weapon flat (post-flatten) firearm/knife escalan a WEAPONS AMBER")
    void weaponFlatScalesToWeapons() {
        Map<String, Object> weapon = new HashMap<>();
        weapon.put("firearm", 0.6);
        Map<String, Object> scores = new HashMap<>();
        scores.put("weapon", weapon);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.AMBER, v.getSeverityOverall());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.WEAPONS));
    }

    @Test
    @DisplayName("Calibracion P2.1: weapon.firearm_toy NO escala (replica)")
    void firearmToyIgnored() {
        Map<String, Object> weapon = new HashMap<>();
        weapon.put("firearm_toy", 0.95);
        Map<String, Object> scores = new HashMap<>();
        scores.put("weapon", weapon);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
    }

    @Test
    @DisplayName("Calibracion P2.1: minor sintetizado por adapter (faces.attributes.age.minor) -> MINORS CRITICAL")
    void minorSynthetizedScalesToMinors() {
        Map<String, Object> minor = new HashMap<>();
        minor.put("prob", 0.45);
        Map<String, Object> scores = new HashMap<>();
        scores.put("minor", minor);

        ModerationVerdictResult v = mapper.buildVerdict(responseWith(scores), "{}", Instant.now());
        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
    }
}
