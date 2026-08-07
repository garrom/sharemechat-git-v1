package com.sharemechat.service.translation;

import com.sharemechat.config.TranslationProperties;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;

/**
 * pending-hardening §5.3: adapter Google Cloud Translation v2.
 *
 * Endpoint: POST {endpoint}?key={apiKey}
 *   body: {"q": "<text>", "target": "<lang>", "format": "text"}
 *   resp: {"data":{"translations":[{"translatedText":"...","detectedSourceLanguage":"..."}]}}
 *
 * Autenticacion: API key en query string (patron v2). Google recomienda
 * restringir la API key por HTTP referrer + API (Cloud Translation API v2)
 * en Google Cloud Console para minimizar riesgo si se filtra.
 *
 * Coste: 500K chars/mes gratis sin caducidad, $20/M chars overage. Google
 * cuenta chars del texto ORIGINAL, no del traducido.
 *
 * Modo degradado: si {@code !enabled || apiKey blank}, {@code translate}
 * lanza {@link TranslationUnavailableException}. El caller HTTP mapea a 503.
 */
@Service
public class GoogleCloudTranslationClient implements TranslationProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleCloudTranslationClient.class);
    private static final String PROVIDER = "google";

    private final TranslationProperties props;
    private final RestTemplate restTemplate;

    public GoogleCloudTranslationClient(TranslationProperties props, RestTemplateBuilder builder) {
        this.props = props;
        this.restTemplate = builder
                .connectTimeout(Duration.ofMillis(props.getTimeoutMs()))
                .readTimeout(Duration.ofMillis(props.getTimeoutMs()))
                .build();
    }

    @Override
    public TranslatedResult translate(String text, String targetLang) {
        if (!props.isConfigured()) {
            throw new TranslationUnavailableException(
                    "Google Cloud Translation no esta configurado (translation.google.enabled=false o apiKey blank).");
        }
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("text is blank");
        }
        if (targetLang == null || targetLang.isBlank()) {
            throw new IllegalArgumentException("targetLang is blank");
        }

        String url = UriComponentsBuilder.fromHttpUrl(props.getEndpoint())
                .queryParam("key", props.getApiKey())
                .toUriString();

        String body = new JSONObject()
                .put("q", text)
                .put("target", targetLang)
                .put("format", "text")
                .toString();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<String> req = new HttpEntity<>(body, headers);

        ResponseEntity<String> resp;
        try {
            resp = restTemplate.exchange(url, HttpMethod.POST, req, String.class);
        } catch (RestClientException e) {
            log.warn("Google Translate call failed: {}", e.getMessage());
            throw new TranslationUnavailableException("Google Translate call failed", e);
        }

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            log.warn("Google Translate non-2xx: status={}, body={}", resp.getStatusCode(), resp.getBody());
            throw new TranslationUnavailableException("Google Translate non-2xx response: " + resp.getStatusCode());
        }

        try {
            JSONObject root = new JSONObject(resp.getBody());
            JSONArray translations = root.getJSONObject("data").getJSONArray("translations");
            if (translations.isEmpty()) {
                throw new TranslationUnavailableException("Google Translate returned empty translations array");
            }
            JSONObject first = translations.getJSONObject(0);
            String translatedText = first.getString("translatedText");
            String detectedSourceLang = first.optString("detectedSourceLanguage", null);
            return new TranslatedResult(translatedText, PROVIDER, detectedSourceLang);
        } catch (Exception e) {
            log.warn("Google Translate response parsing failed: {}", e.getMessage());
            throw new TranslationUnavailableException("Google Translate response parsing failed", e);
        }
    }

    @Override
    public List<TranslatedResult> translateBatch(List<String> texts, String targetLang) {
        if (!props.isConfigured()) {
            throw new TranslationUnavailableException(
                    "Google Cloud Translation no esta configurado (translation.google.enabled=false o apiKey blank).");
        }
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }
        if (targetLang == null || targetLang.isBlank()) {
            throw new IllegalArgumentException("targetLang is blank");
        }

        String url = UriComponentsBuilder.fromHttpUrl(props.getEndpoint())
                .queryParam("key", props.getApiKey())
                .toUriString();

        JSONArray q = new JSONArray();
        for (String t : texts) {
            q.put(t == null ? "" : t);
        }
        String body = new JSONObject()
                .put("q", q)
                .put("target", targetLang)
                .put("format", "text")
                .toString();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<String> req = new HttpEntity<>(body, headers);

        ResponseEntity<String> resp;
        try {
            resp = restTemplate.exchange(url, HttpMethod.POST, req, String.class);
        } catch (RestClientException e) {
            log.warn("Google Translate batch failed: {}", e.getMessage());
            throw new TranslationUnavailableException("Google Translate batch failed", e);
        }

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            log.warn("Google Translate batch non-2xx: status={}, body={}", resp.getStatusCode(), resp.getBody());
            throw new TranslationUnavailableException("Google Translate batch non-2xx response: " + resp.getStatusCode());
        }

        try {
            JSONObject root = new JSONObject(resp.getBody());
            JSONArray translations = root.getJSONObject("data").getJSONArray("translations");
            if (translations.length() != texts.size()) {
                throw new TranslationUnavailableException(
                        "Google Translate batch size mismatch: expected=" + texts.size() + ", got=" + translations.length());
            }
            List<TranslatedResult> out = new ArrayList<>(translations.length());
            for (int i = 0; i < translations.length(); i++) {
                JSONObject t = translations.getJSONObject(i);
                out.add(new TranslatedResult(
                        t.getString("translatedText"),
                        PROVIDER,
                        t.optString("detectedSourceLanguage", null)
                ));
            }
            return out;
        } catch (TranslationUnavailableException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Google Translate batch response parsing failed: {}", e.getMessage());
            throw new TranslationUnavailableException("Google Translate batch response parsing failed", e);
        }
    }

    @Override
    public String providerName() {
        return PROVIDER;
    }

    @Override
    public boolean isConfigured() {
        return props.isConfigured();
    }
}
