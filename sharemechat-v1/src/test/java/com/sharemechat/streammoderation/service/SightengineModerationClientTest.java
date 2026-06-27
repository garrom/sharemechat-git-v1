package com.sharemechat.streammoderation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.config.ModerationThresholdsProperties;
import com.sharemechat.config.SightengineProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.dto.ModerationFrameSubmission;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import com.sharemechat.streammoderation.dto.SightengineWorkflowResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests del adapter {@link SightengineModerationClient}. RestTemplate
 * inyectado para no salir a red.
 */
class SightengineModerationClientTest {

    private SightengineProperties props;
    private ModerationCategoryMapper mapper;
    private RestTemplate rest;
    private SightengineModerationClient client;

    @BeforeEach
    void setUp() {
        props = new SightengineProperties();
        props.setEnabled(true);
        props.setBaseUrl("https://api.sightengine.com");
        props.setApiUser("u");
        props.setApiSecret("s");
        props.setWorkflowId("wfl_test");

        mapper = new ModerationCategoryMapper(new ModerationThresholdsProperties());
        rest = mock(RestTemplate.class);
        client = new SightengineModerationClient(props, mapper, rest, new ObjectMapper());
    }

    private ModerationFrameSubmission jpegSubmission() {
        ModerationFrameSubmission s = new ModerationFrameSubmission();
        s.setFrameBytes(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00, 0x01, 0x02});
        s.setFrameTimestamp(Instant.parse("2026-06-25T12:00:00Z"));
        return s;
    }

    @Test
    @DisplayName("DEC-11: credenciales blank -> IllegalStateException sin llamar al exterior")
    void noCredsThrowsIllegalState() {
        props.setApiSecret("");
        assertThrows(IllegalStateException.class,
                () -> client.submitImage(jpegSubmission()));
    }

    @Test
    @DisplayName("DEC-11: enabled=false -> IllegalStateException sin llamar al exterior")
    void disabledThrowsIllegalState() {
        props.setEnabled(false);
        assertThrows(IllegalStateException.class,
                () -> client.submitImage(jpegSubmission()));
    }

    @Test
    @DisplayName("workflow_id blank -> IllegalStateException")
    void blankWorkflowIdThrows() {
        props.setWorkflowId("");
        assertThrows(IllegalStateException.class,
                () -> client.submitImage(jpegSubmission()));
    }

    @Test
    @DisplayName("Happy path 2xx con response Sightengine -> verdict GREEN (sin scores escalables)")
    void happyPathGreenVerdict() {
        String body = "{\"status\":{\"code\":\"ok\"},\"request\":{\"id\":\"req-abc\"},\"nudity\":{\"bikini\":0.99}}";
        when(rest.exchange(
                eq("https://api.sightengine.com/1.0/check-workflow.json"),
                eq(HttpMethod.POST),
                any(),
                eq(String.class)))
                .thenReturn(ResponseEntity.ok(body));

        ModerationVerdictResult v = client.submitImage(jpegSubmission());
        assertEquals(Constants.StreamModerationSeverity.GREEN, v.getSeverityOverall());
        assertEquals("req-abc", v.getProviderEventId());
        assertEquals(body, v.getVendorMetadataJson());
    }

    @Test
    @DisplayName("Happy path con MINORS prob > 0.3 -> verdict CRITICAL")
    void happyPathCriticalVerdict() {
        String body = "{\"status\":{\"code\":\"ok\"},\"request\":{\"id\":\"req-xyz\"},\"minor\":{\"prob\":0.45}}";
        when(rest.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(body));

        ModerationVerdictResult v = client.submitImage(jpegSubmission());
        assertEquals(Constants.StreamModerationSeverity.CRITICAL, v.getSeverityOverall());
        assertEquals(1, v.getCategoryVerdicts().size());
        assertNotNull(v.getCategoryVerdicts().get(Constants.StreamModerationCategory.MINORS));
    }

    @Test
    @DisplayName("HTTP 4xx (quota / auth) -> exception propagada al caller (fail-closed-soft)")
    void quotaErrorPropagates() {
        when(rest.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body("quota"));

        assertThrows(IllegalStateException.class,
                () -> client.submitImage(jpegSubmission()));
    }

    @Test
    @DisplayName("HTTP 5xx (vendor down) -> exception propagada")
    void vendor5xxPropagates() {
        when(rest.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("bad"));

        assertThrows(IllegalStateException.class,
                () -> client.submitImage(jpegSubmission()));
    }

    @Test
    @DisplayName("Timeout (ResourceAccessException) -> propaga RuntimeException")
    void timeoutPropagates() {
        when(rest.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenThrow(new ResourceAccessException("read timed out"));

        assertThrows(RuntimeException.class,
                () -> client.submitImage(jpegSubmission()));
    }

    @Test
    @DisplayName("Body 2xx no parseable como JSON -> exception")
    void unparseableBodyThrows() {
        when(rest.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok("<html>not json"));

        assertThrows(IllegalStateException.class,
                () -> client.submitImage(jpegSubmission()));
    }

    @Test
    @DisplayName("parseResponse: rawScoresByModel acumula modelos top-level que son objetos JSON")
    void parseResponseExtractsModels() throws Exception {
        String body = "{\"status\":{\"code\":\"ok\"},\"request\":{\"id\":\"r-1\"},\"nudity\":{\"sexual_activity\":0.6},\"violence\":{\"prob\":0.7}}";
        SightengineWorkflowResponse parsed = client.parseResponse(body);
        assertEquals("r-1", parsed.getRequestId());
        assertEquals(2, parsed.getRawScoresByModel().size());
    }

    @Test
    @DisplayName("parseResponse: status string plano se mapea al status.code (resiliencia)")
    void parseResponseStringStatus() throws Exception {
        String body = "{\"status\":\"failure\"}";
        SightengineWorkflowResponse parsed = client.parseResponse(body);
        assertNotNull(parsed.getStatus());
        assertEquals("failure", parsed.getStatus().getCode());
    }

    @Test
    @DisplayName("Calibracion P2.1: parseResponse aplana weapon.classes.{firearm,knife} -> weapon.{firearm,knife}")
    void parseResponseFlattenWeaponClasses() throws Exception {
        String body = "{\"status\":\"success\",\"weapon\":{\"classes\":{\"firearm\":0.7,\"knife\":0.2},\"firearm_action\":{\"aiming_camera\":0.5}}}";
        SightengineWorkflowResponse parsed = client.parseResponse(body);
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> weapon = (java.util.Map<String, Object>) parsed.getRawScoresByModel().get("weapon");
        assertNotNull(weapon);
        assertEquals(0.7, ((Number) weapon.get("firearm")).doubleValue(), 0.001);
        assertEquals(0.2, ((Number) weapon.get("knife")).doubleValue(), 0.001);
    }

    @Test
    @DisplayName("Calibracion P2.1: parseResponse sintetiza minor.prob = max(faces[*].attributes.age.minor)")
    void parseResponseSynthesizeMinorFromFaces() throws Exception {
        String body = "{\"status\":\"success\","
                + "\"faces\":["
                + "  {\"x1\":0.1,\"attributes\":{\"age\":{\"minor\":0.10}}},"
                + "  {\"x1\":0.5,\"attributes\":{\"age\":{\"minor\":0.42}}},"
                + "  {\"x1\":0.7,\"attributes\":{\"age\":{\"minor\":0.31}}}"
                + "]}";
        SightengineWorkflowResponse parsed = client.parseResponse(body);
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> minor = (java.util.Map<String, Object>) parsed.getRawScoresByModel().get("minor");
        assertNotNull(minor);
        assertEquals(0.42, ((Number) minor.get("prob")).doubleValue(), 0.001);
    }

    @Test
    @DisplayName("Calibracion P2.1: faces vacio -> minor NO se sintetiza")
    void parseResponseEmptyFacesNoMinor() throws Exception {
        String body = "{\"status\":\"success\",\"faces\":[]}";
        SightengineWorkflowResponse parsed = client.parseResponse(body);
        assertNull(parsed.getRawScoresByModel().get("minor"));
    }
}
