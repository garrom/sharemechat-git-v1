package com.sharemechat.service;

import com.sharemechat.config.DiditProperties;
import com.sharemechat.dto.DiditCreateSessionResult;
import org.json.JSONObject;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.UUID;

/**
 * Cliente Didit para crear sesiones de verificacion (flujo KYC modelo,
 * Document+Selfie via Workflow Builder).
 *
 * Endpoint: POST {baseUrl}/v3/session/  (verificado en docs.didit.me/sessions-api,
 * 2026-06-13). Header de autenticacion: {@code x-api-key} (NO Bearer, NO
 * Authorization).
 *
 * Divergencias clave respecto a {@link VeriffClientImpl}:
 *  - NO se firma el body de salida (Didit autentica solo con header x-api-key).
 *    El equivalente "secret" del flujo (apiSecret) se usa SOLO para verificar
 *    webhooks ENTRANTES en {@link ModelKycSessionService}, no aqui.
 *  - El payload obligatorio lleva {@code workflow_id} (identifica el flujo
 *    en el Workflow Builder de Didit).
 *  - El campo de respuesta es {@code url} (no {@code verification_url}).
 *
 * Modo MOCK identico al de Veriff: cuando {@code !enabled || apiKey blank}
 * se devuelve un sessionId estable {@code didit_mock_<UUID>} sin llamar al
 * exterior. Permite arrancar TEST/dev sin credenciales.
 */
@Service
public class DiditClientImpl implements DiditClient {

    private final DiditProperties props;
    private final RestTemplate restTemplate = new RestTemplate();

    public DiditClientImpl(DiditProperties props) {
        this.props = props;
    }

    @Override
    public DiditCreateSessionResult createSession(Long userId, String email,
                                                  String givenName, String lastName) {
        // Modo sin coste / sin credenciales: devolvemos mock estable.
        if (!props.isEnabled() || props.getApiKey() == null || props.getApiKey().isBlank()) {
            String fakeSessionId = "didit_mock_" + UUID.randomUUID();
            String vendorData = props.getVendorDataPrefix() + ":" + userId;
            String fakeUrl = "https://verification.test.sharemechat.com/mock/didit/" + fakeSessionId;

            JSONObject raw = new JSONObject()
                    .put("mock", true)
                    .put("session_id", fakeSessionId)
                    .put("url", fakeUrl)
                    .put("vendor_data", vendorData)
                    .put("status", "Not Started");

            return new DiditCreateSessionResult(fakeSessionId, fakeUrl, vendorData, null, raw.toString());
        }

        // Modo real: workflow_id obligatorio. Sin el, Didit responde 400.
        if (props.getWorkflowId() == null || props.getWorkflowId().isBlank()) {
            throw new IllegalStateException(
                    "kyc.didit.workflow-id es obligatorio cuando kyc.didit.enabled=true.");
        }

        String vendorData = props.getVendorDataPrefix() + ":" + userId;
        String rawBody = buildCreateSessionPayloadJson(
                props.getWorkflowId(), props.getCallbackUrl(), vendorData, email, givenName, lastName);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", props.getApiKey());

        HttpEntity<String> req = new HttpEntity<>(rawBody, headers);

        ResponseEntity<String> resp = restTemplate.exchange(
                props.getBaseUrl() + "/v3/session/",
                HttpMethod.POST,
                req,
                String.class
        );

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            throw new IllegalStateException("Error creando sesion Didit");
        }

        JSONObject json = new JSONObject(resp.getBody());

        // En Didit, el JSON de respuesta es plano (no anidado bajo "verification").
        String sessionId = json.optString("session_id", null);
        String url = json.optString("url", null);
        Integer sessionNumber = json.has("session_number") && !json.isNull("session_number")
                ? json.optInt("session_number")
                : null;

        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalStateException("Didit no devolvio session_id");
        }

        return new DiditCreateSessionResult(sessionId, url, vendorData, sessionNumber, resp.getBody());
    }

    /**
     * Construye el body JSON crudo de POST /v3/session/ con campos opcionales
     * condicionales.
     *
     * Politica: dentro de {@code contact_details} y {@code expected_details}
     * solo se incluye una clave si tiene valor real (no null, no string vacio
     * tras {@code trim}). Mismo principio que en el payload Veriff (paso 5,
     * 2026-06-11) para no enviar strings vacios en campos de identidad.
     * {@code identification_number} se omite siempre: lo aporta Didit al leer
     * el documento.
     *
     * Package-private para permitir test del JSON exacto sin tocar la capa HTTP.
     */
    String buildCreateSessionPayloadJson(String workflowId,
                                         String callbackUrl,
                                         String vendorData,
                                         String email,
                                         String givenName,
                                         String lastName) {
        JSONObject body = new JSONObject()
                .put("workflow_id", workflowId)
                .put("vendor_data", vendorData);

        if (hasText(callbackUrl)) {
            body.put("callback", callbackUrl.trim());
        }

        if (hasText(email)) {
            JSONObject contact = new JSONObject().put("email", email.trim());
            body.put("contact_details", contact);
        }

        JSONObject expected = new JSONObject();
        if (hasText(givenName)) {
            expected.put("first_name", givenName.trim());
        }
        if (hasText(lastName)) {
            expected.put("last_name", lastName.trim());
        }
        if (!expected.isEmpty()) {
            body.put("expected_details", expected);
        }

        return body.toString();
    }

    private static boolean hasText(String s) {
        return s != null && !s.trim().isEmpty();
    }
}
