package com.sharemechat.support.service;

import com.sharemechat.support.config.ClaudeApiProperties;
import com.sharemechat.support.dto.ClaudeApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ClaudeApiClientTest {

    private ClaudeApiProperties props;
    private ClaudeApiClient client;

    @BeforeEach
    void setUp() {
        props = mock(ClaudeApiProperties.class);
        when(props.getModel()).thenReturn("claude-haiku-4-5");
        when(props.getMaxOutputTokens()).thenReturn(800);
        when(props.getTimeoutSeconds()).thenReturn(30);
        when(props.getBaseUrl()).thenReturn("https://api.anthropic.com");
        when(props.getApiKey()).thenReturn("test-key");
        when(props.isPromptCachingEnabled()).thenReturn(true);
        client = new ClaudeApiClient(props);
    }

    @Test
    @DisplayName("parseResponse -> text content extraido correctamente")
    void parseText() throws Exception {
        String json = "{\"model\":\"claude-haiku-4-5\",\"stop_reason\":\"end_turn\","
                + "\"usage\":{\"input_tokens\":100,\"output_tokens\":50},"
                + "\"content\":[{\"type\":\"text\",\"text\":\"Hola, en que puedo ayudarte?\"}]}";
        ClaudeApiResponse r = client.parseResponse(json);
        assertEquals("Hola, en que puedo ayudarte?", r.getTextContent());
        assertEquals(100, r.getTokensInput());
        assertEquals(50, r.getTokensOutput());
        assertEquals("end_turn", r.getFinishReason());
        assertEquals("claude-haiku-4-5", r.getModelId());
        assertFalse(r.isEscalationToolCalled());
    }

    @Test
    @DisplayName("parseResponse con tool_use escalate_to_human -> flag activado y reason")
    void parseToolUseEscalation() throws Exception {
        String json = "{\"model\":\"claude-haiku-4-5\",\"stop_reason\":\"tool_use\","
                + "\"usage\":{\"input_tokens\":150,\"output_tokens\":40},"
                + "\"content\":["
                + "{\"type\":\"text\",\"text\":\"Te derivo con un humano\"},"
                + "{\"type\":\"tool_use\",\"name\":\"escalate_to_human\",\"input\":{\"reason\":\"cargo duplicado\"}}"
                + "]}";
        ClaudeApiResponse r = client.parseResponse(json);
        assertTrue(r.isEscalationToolCalled());
        assertEquals("cargo duplicado", r.getEscalationReason());
        assertEquals("Te derivo con un humano", r.getTextContent());
    }

    @Test
    @DisplayName("parseResponse suma cache_read + cache_creation + input tokens")
    void parseCacheTokens() throws Exception {
        String json = "{\"model\":\"claude-haiku-4-5\",\"stop_reason\":\"end_turn\","
                + "\"usage\":{\"input_tokens\":10,\"cache_read_input_tokens\":6000,\"cache_creation_input_tokens\":0,\"output_tokens\":30},"
                + "\"content\":[{\"type\":\"text\",\"text\":\"ok\"}]}";
        ClaudeApiResponse r = client.parseResponse(json);
        assertEquals(6010, r.getTokensInput());
        assertEquals(30, r.getTokensOutput());
    }

    @Test
    @DisplayName("estimateCostMicros calcula input*1USD + output*5USD por millon")
    void costEstimate() {
        long micros = client.estimateCostMicros(1_000_000, 200_000);
        assertEquals((long) Math.round((1.0 + 1.0) * 1_000_000.0), micros);
    }

    @Test
    @DisplayName("estimateCostMicros tokens pequenos -> valor > 0")
    void costEstimateSmall() {
        long micros = client.estimateCostMicros(6000, 300);
        assertTrue(micros > 0);
    }

    @Test
    @DisplayName("parseResponse tool_use con text vacio -> textContent es cadena vacia")
    void parseToolUseOnly() throws Exception {
        String json = "{\"model\":\"claude-haiku-4-5\",\"stop_reason\":\"tool_use\","
                + "\"usage\":{\"input_tokens\":10,\"output_tokens\":5},"
                + "\"content\":[{\"type\":\"tool_use\",\"name\":\"escalate_to_human\",\"input\":{\"reason\":\"refund\"}}]}";
        ClaudeApiResponse r = client.parseResponse(json);
        assertTrue(r.isEscalationToolCalled());
        assertEquals("", r.getTextContent());
    }
}
