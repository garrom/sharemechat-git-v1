package com.sharemechat.support.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sharemechat.support.config.ClaudeApiProperties;
import com.sharemechat.support.dto.ClaudeApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * Cliente REST para Anthropic Messages API (DEC-CS-1). Modelo por defecto
 * {@code claude-haiku-4-5}. Incluye:
 *
 * <ul>
 *   <li>Prompt caching activo en system prompt (DEC-CS-13): reduce coste
 *       90% en hits subsecuentes.</li>
 *   <li>Tool declaration {@code escalate_to_human(reason)} para que el
 *       modelo decida escalar (DEC-CS-2).</li>
 *   <li>Ventana N=10 ultimos mensajes de la conversacion (DEC-CS-14).</li>
 *   <li>Retry 1 en 5xx. Timeout 30s por defecto.</li>
 * </ul>
 *
 * <p>Coste estimado: input ~$1/1M tokens, output ~$5/1M tokens (Haiku 4.5
 * de referencia; el numero real se guarda en la BD por si Anthropic ajusta
 * pricing y hay que re-calcular).
 */
@Service
public class ClaudeApiClient {

    private static final Logger log = LoggerFactory.getLogger(ClaudeApiClient.class);

    // Precios de referencia Haiku 4.5 (USD por 1M tokens) usados para
    // cost_estimate_micros en support_messages. Ajustar si Anthropic
    // publica nuevos precios; los valores historicos ya persistidos
    // no se re-calculan.
    private static final double COST_PER_1M_INPUT_USD = 1.00;
    private static final double COST_PER_1M_OUTPUT_USD = 5.00;

    private final ClaudeApiProperties props;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http;

    public ClaudeApiClient(ClaudeApiProperties props) {
        this.props = props;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public ClaudeApiResponse callMessages(String systemPromptWithKb,
                                           List<HistoryMessage> history,
                                           String userMessage) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", props.getModel());
        body.put("max_tokens", props.getMaxOutputTokens());

        // system prompt como array-of-blocks para poder aplicar cache_control
        ArrayNode systemArr = mapper.createArrayNode();
        ObjectNode systemBlock = mapper.createObjectNode();
        systemBlock.put("type", "text");
        systemBlock.put("text", systemPromptWithKb);
        if (props.isPromptCachingEnabled()) {
            ObjectNode cc = mapper.createObjectNode();
            cc.put("type", "ephemeral");
            systemBlock.set("cache_control", cc);
        }
        systemArr.add(systemBlock);
        body.set("system", systemArr);

        // tool escalate_to_human (DEC-CS-2)
        ArrayNode tools = mapper.createArrayNode();
        ObjectNode tool = mapper.createObjectNode();
        tool.put("name", "escalate_to_human");
        tool.put("description", "Call this when you cannot resolve the user's issue and need to hand off to a human operator.");
        ObjectNode inputSchema = mapper.createObjectNode();
        inputSchema.put("type", "object");
        ObjectNode properties = mapper.createObjectNode();
        ObjectNode reason = mapper.createObjectNode();
        reason.put("type", "string");
        reason.put("description", "Short reason why escalation is needed (max 300 chars).");
        properties.set("reason", reason);
        inputSchema.set("properties", properties);
        ArrayNode required = mapper.createArrayNode();
        required.add("reason");
        inputSchema.set("required", required);
        tool.set("input_schema", inputSchema);
        tools.add(tool);
        body.set("tools", tools);

        // messages: historia + mensaje actual
        ArrayNode messages = mapper.createArrayNode();
        if (history != null) {
            for (HistoryMessage h : history) {
                ObjectNode m = mapper.createObjectNode();
                m.put("role", h.role);
                m.put("content", h.content);
                messages.add(m);
            }
        }
        ObjectNode userMsg = mapper.createObjectNode();
        userMsg.put("role", "user");
        userMsg.put("content", userMessage);
        messages.add(userMsg);
        body.set("messages", messages);

        String payload = mapper.writeValueAsString(body);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(props.getBaseUrl() + "/v1/messages"))
                .timeout(Duration.ofSeconds(props.getTimeoutSeconds()))
                .header("content-type", "application/json")
                .header("x-api-key", props.getApiKey())
                .header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpResponse<String> resp = null;
        Exception lastError = null;
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                resp = http.send(req, HttpResponse.BodyHandlers.ofString());
                int code = resp.statusCode();
                if (code >= 500 && attempt == 0) {
                    log.warn("[SUPPORT-CLAUDE] 5xx attempt=1 code={}, retrying", code);
                    continue;
                }
                if (code >= 400) {
                    throw new RuntimeException("Claude API " + code + ": " + safeTrim(resp.body(), 400));
                }
                break;
            } catch (Exception ex) {
                lastError = ex;
                if (attempt == 0) {
                    log.warn("[SUPPORT-CLAUDE] attempt=1 failure: {}, retrying", ex.getMessage());
                    continue;
                }
                throw ex;
            }
        }
        if (resp == null) throw new RuntimeException("Claude call failed: " + lastError);

        return parseResponse(resp.body());
    }

    ClaudeApiResponse parseResponse(String json) throws Exception {
        JsonNode root = mapper.readTree(json);
        ClaudeApiResponse out = new ClaudeApiResponse();
        out.setModelId(root.path("model").asText(null));
        out.setFinishReason(root.path("stop_reason").asText(null));

        JsonNode usage = root.path("usage");
        int in = usage.path("input_tokens").asInt(0)
                + usage.path("cache_read_input_tokens").asInt(0)
                + usage.path("cache_creation_input_tokens").asInt(0);
        int outTok = usage.path("output_tokens").asInt(0);
        out.setTokensInput(in);
        out.setTokensOutput(outTok);

        JsonNode content = root.path("content");
        StringBuilder textBuf = new StringBuilder();
        if (content.isArray()) {
            for (JsonNode block : content) {
                String type = block.path("type").asText("");
                if ("text".equals(type)) {
                    textBuf.append(block.path("text").asText(""));
                } else if ("tool_use".equals(type)
                        && "escalate_to_human".equals(block.path("name").asText(""))) {
                    out.setEscalationToolCalled(true);
                    JsonNode input = block.path("input");
                    if (input != null) {
                        out.setEscalationReason(input.path("reason").asText(null));
                    }
                }
            }
        }
        out.setTextContent(textBuf.toString());
        return out;
    }

    public long estimateCostMicros(int tokensInput, int tokensOutput) {
        double usd = (tokensInput / 1_000_000.0) * COST_PER_1M_INPUT_USD
                + (tokensOutput / 1_000_000.0) * COST_PER_1M_OUTPUT_USD;
        return Math.round(usd * 1_000_000.0);
    }

    private static String safeTrim(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) : s;
    }

    /** Tuple simple para history messages (role: user|assistant, content). */
    public static class HistoryMessage {
        public final String role;
        public final String content;
        public HistoryMessage(String role, String content) {
            this.role = role;
            this.content = content;
        }
    }
}
