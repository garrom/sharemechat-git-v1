package com.sharemechat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@ConditionalOnProperty(prefix = "email", name = "provider", havingValue = "graph")
public class GraphEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(GraphEmailService.class);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${email.default-from:operations@sharemechat.com}")
    private String defaultFrom;

    @Value("${email.graph.tenant-id:}")
    private String tenantId;

    @Value("${email.graph.client-id:}")
    private String clientId;

    @Value("${email.graph.client-secret:}")
    private String clientSecret;

    @Value("${email.graph.base-url:https://graph.microsoft.com}")
    private String graphBaseUrl;

    @Value("${email.graph.authority-base-url:https://login.microsoftonline.com}")
    private String authorityBaseUrl;

    @Value("${email.graph.save-to-sent-items:false}")
    private boolean saveToSentItems;

    private volatile String cachedAccessToken;
    private volatile Instant cachedAccessTokenExpiresAt;

    public GraphEmailService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().build();
    }

    @Override
    public void send(EmailMessage message) {
        validateConfig();

        String sender = resolveSenderMailbox(message);
        String accessToken = getAccessToken();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", buildGraphMessage(message));
        body.put("saveToSentItems", saveToSentItems);

        try {
            String requestBody = objectMapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(normalizeBaseUrl(graphBaseUrl) + "/v1.0/users/" + urlEncode(sender) + "/sendMail"))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new EmailDeliveryException(
                        "graph",
                        message,
                        response.statusCode(),
                        summarizeGraphError(response.body()),
                        null
                );
            }

            log.info("EMAIL_SENT provider=graph category={} priority={} to={} sender={}",
                    message.category(), message.priority(), message.to(), sender);
        } catch (EmailDeliveryException ex) {
            log.warn("EMAIL_SEND_FAIL {}", ex.getMessage());
            throw ex;
        } catch (Exception ex) {
            EmailDeliveryException wrapped = new EmailDeliveryException(
                    "graph",
                    message,
                    "transport_error:" + ex.getMessage(),
                    ex
            );
            log.warn("EMAIL_SEND_FAIL {}", wrapped.getMessage());
            throw wrapped;
        }
    }

    private Map<String, Object> buildGraphMessage(EmailMessage message) {
        Map<String, Object> graphMessage = new LinkedHashMap<>();
        graphMessage.put("subject", message.subject());
        graphMessage.put("body", Map.of(
                "contentType", "HTML",
                "content", message.htmlBody()
        ));
        graphMessage.put("toRecipients", List.of(Map.of(
                "emailAddress", Map.of("address", message.to())
        )));

        if (message.replyTo() != null && !message.replyTo().isBlank()) {
            graphMessage.put("replyTo", List.of(Map.of(
                    "emailAddress", Map.of("address", message.replyTo())
            )));
        }

        return graphMessage;
    }

    private synchronized String getAccessToken() {
        if (cachedAccessToken != null
                && cachedAccessTokenExpiresAt != null
                && Instant.now().isBefore(cachedAccessTokenExpiresAt.minusSeconds(60))) {
            return cachedAccessToken;
        }

        try {
            String form = "client_id=" + urlEncode(clientId)
                    + "&client_secret=" + urlEncode(clientSecret)
                    + "&scope=" + urlEncode("https://graph.microsoft.com/.default")
                    + "&grant_type=client_credentials";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(normalizeBaseUrl(authorityBaseUrl) + "/" + urlEncodePathSegment(tenantId) + "/oauth2/v2.0/token"))
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(form, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("oauth_status=" + response.statusCode() + " error=" + summarizeGraphError(response.body()));
            }

            JsonNode json = objectMapper.readTree(response.body());
            String token = json.path("access_token").asText(null);
            long expiresIn = json.path("expires_in").asLong(0L);
            if (token == null || token.isBlank() || expiresIn <= 0L) {
                throw new IllegalStateException("oauth_response_invalida");
            }

            cachedAccessToken = token;
            cachedAccessTokenExpiresAt = Instant.now().plusSeconds(expiresIn);
            return cachedAccessToken;
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo obtener access token de Microsoft Graph: " + ex.getMessage(), ex);
        }
    }

    private void validateConfig() {
        if (tenantId == null || tenantId.isBlank()
                || clientId == null || clientId.isBlank()
                || clientSecret == null || clientSecret.isBlank()) {
            throw new IllegalStateException("Configuracion incompleta de Microsoft Graph para email");
        }
    }

    private String resolveSenderMailbox(EmailMessage message) {
        if (message.from() != null && !message.from().isBlank()) {
            return message.from().trim();
        }
        return defaultFrom;
    }

    private String summarizeGraphError(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            return "empty_response";
        }
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            JsonNode error = root.path("error");
            if (!error.isMissingNode()) {
                String code = error.path("code").asText("");
                String message = error.path("message").asText("");
                if (!code.isBlank() || !message.isBlank()) {
                    return (code + ":" + message).trim();
                }
            }
        } catch (Exception ignore) {
        }
        return rawBody.length() > 300 ? rawBody.substring(0, 300) : rawBody;
    }

    private String normalizeBaseUrl(String value) {
        String base = value != null ? value.trim() : "";
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base;
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(String.valueOf(value), StandardCharsets.UTF_8);
    }

    private String urlEncodePathSegment(String value) {
        return String.valueOf(value).replace(" ", "%20");
    }
}
