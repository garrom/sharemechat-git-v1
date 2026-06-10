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
    public VeriffCreateSessionResult createSession(Long userId, String email) {
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

        // Real Veriff call (ajustable cuando tengas payload definitivo del proveedor).
        // El shared secret es obligatorio para firmar el body: si Veriff está
        // habilitado pero falta el secret, fallamos con un error claro en lugar
        // de enviar una firma inválida (nunca más "TODO_SIGN").
        if (props.getApiSecret() == null || props.getApiSecret().isBlank()) {
            throw new IllegalStateException(
                    "kyc.veriff.api-secret es obligatorio cuando kyc.veriff.enabled=true (firma HMAC de salida).");
        }

        String vendorData = props.getVendorDataPrefix() + ":" + userId;

        JSONObject payload = new JSONObject()
                .put("verification", new JSONObject()
                        .put("callback", props.getCallbackUrl())
                        .put("person", new JSONObject()
                                .put("givenName", "")
                                .put("lastName", "")
                                .put("idNumber", "")
                        )
                        .put("vendorData", vendorData)
                );

        // Body crudo exacto que se firma y se envía (mismos bytes).
        String rawBody = payload.toString();
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
}