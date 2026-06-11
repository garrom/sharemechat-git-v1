package com.sharemechat.service;

import com.sharemechat.config.VeriffProperties;
import com.sharemechat.dto.VeriffCreateSessionResult;
import com.sharemechat.security.HmacSha256;
import org.json.JSONObject;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Service
public class VeriffClientImpl implements VeriffClient {

    private final VeriffProperties props;
    private final RestTemplate restTemplate = new RestTemplate();

    public VeriffClientImpl(VeriffProperties props) {
        this.props = props;
    }

    @Override
    public VeriffCreateSessionResult createSession(Long userId, String email,
                                                   String givenName, String lastName) {
        // Modo sin coste / sin credenciales: devolvemos mock estable
        if (!props.isEnabled() || props.getApiKey() == null || props.getApiKey().isBlank()) {
            String fakeSessionId = "veriff_mock_" + UUID.randomUUID();
            String vendorData = props.getVendorDataPrefix() + ":" + userId;
            String fakeUrl = "https://verification.test.sharemechat.com/mock/veriff/" + fakeSessionId;

            JSONObject raw = new JSONObject()
                    .put("mock", true)
                    .put("sessionId", fakeSessionId)
                    .put("verificationUrl", fakeUrl)
                    .put("vendorData", vendorData);

            return new VeriffCreateSessionResult(fakeSessionId, fakeUrl, vendorData, raw.toString());
        }

        // Real Veriff call. El shared secret es obligatorio para firmar el body:
        // si Veriff está habilitado pero falta el secret, fallamos con un error
        // claro en lugar de enviar una firma inválida (nunca más "TODO_SIGN").
        if (props.getApiSecret() == null || props.getApiSecret().isBlank()) {
            throw new IllegalStateException(
                    "kyc.veriff.api-secret es obligatorio cuando kyc.veriff.enabled=true (firma HMAC de salida).");
        }

        String vendorData = props.getVendorDataPrefix() + ":" + userId;
        String rawBody = buildCreateSessionPayloadJson(
                props.getCallbackUrl(), vendorData, givenName, lastName);
        byte[] rawBytes = rawBody.getBytes(StandardCharsets.UTF_8);

        // Firma HMAC-SHA256 del body con el shared secret, hex lowercase.
        String signature = HmacSha256.hexHmacSha256(props.getApiSecret(), rawBytes);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-AUTH-CLIENT", props.getApiKey());
        headers.set("X-HMAC-SIGNATURE", signature);

        HttpEntity<String> req = new HttpEntity<>(rawBody, headers);

        ResponseEntity<String> resp = restTemplate.exchange(
                props.getBaseUrl() + "/v1/sessions",
                HttpMethod.POST,
                req,
                String.class
        );

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            throw new IllegalStateException("Error creando sesión Veriff");
        }

        JSONObject json = new JSONObject(resp.getBody());

        // Ajusta estos paths cuando veas respuesta real exacta de Veriff
        String sessionId = json.optJSONObject("verification") != null
                ? json.getJSONObject("verification").optString("id", null)
                : null;

        String url = json.optJSONObject("verification") != null
                ? json.getJSONObject("verification").optString("url", null)
                : null;

        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalStateException("Veriff no devolvió sessionId");
        }

        return new VeriffCreateSessionResult(sessionId, url, vendorData, resp.getBody());
    }

    /**
     * Construye el body JSON crudo de POST /v1/sessions con campos opcionales
     * condicionales.
     *
     * Política: incluir una clave en {@code verification.person} SOLO si tiene
     * valor real (no null, no string vacío tras {@code trim}). Veriff rechaza
     * con 400/1104 si recibe strings vacíos en los campos del {@code person}
     * (caso real reproducido en TEST el 2026-06-11, paso 4 del frente Veriff;
     * ver project-log.md). {@code idNumber} se omite siempre: no lo conocemos
     * antes de la verificación (lo lee Veriff del documento).
     *
     * Package-private para permitir test del JSON exacto sin tocar la capa
     * HTTP. El body devuelto son los mismos bytes que se firmarán con HMAC y
     * se enviarán: lo que se firma == lo que se manda.
     */
    String buildCreateSessionPayloadJson(String callbackUrl, String vendorData,
                                         String givenName, String lastName) {
        JSONObject person = new JSONObject();
        if (hasText(givenName)) {
            person.put("givenName", givenName.trim());
        }
        if (hasText(lastName)) {
            person.put("lastName", lastName.trim());
        }
        // idNumber omitido intencionadamente: lo aporta Veriff al leer el documento.

        JSONObject verification = new JSONObject()
                .put("callback", callbackUrl)
                .put("vendorData", vendorData);
        // Incluimos 'person' solo si tiene al menos un campo (omitir bloque vacío).
        if (!person.isEmpty()) {
            verification.put("person", person);
        }

        return new JSONObject().put("verification", verification).toString();
    }

    private static boolean hasText(String s) {
        return s != null && !s.trim().isEmpty();
    }
}