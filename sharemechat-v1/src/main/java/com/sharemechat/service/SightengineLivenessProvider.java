package com.sharemechat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.config.SightengineProperties;
import com.sharemechat.dto.FaceAttributesResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

/**
 * ADR-050 Fase B: adapter concreto SightEngine face-attributes para
 * liveness challenge.
 *
 * <p>Reutiliza credenciales de {@link SightengineProperties} (mismo
 * {@code apiUser} + {@code apiSecret} que el frente de moderacion de
 * contenido, ADR-037). Endpoint diferente: {@code /1.0/check.json} con
 * {@code models=face-attributes} en vez del workflow consolidado.
 * SightEngine cobra por op igualmente; el modelo economico del ADR-050
 * documenta el coste adicional.
 *
 * <p>Vendor-agnostic en dominio: el nombre SightEngine solo aparece aqui
 * y en config; el control plane usa la interface
 * {@link LivenessFaceAttributesProvider}.
 *
 * <p>Timeouts explicitos 5s connect / 10s read alineados con el otro
 * adapter Sightengine para consistencia operativa.
 *
 * <p>Formato del response {@code face-attributes} (extracto):
 * <pre>
 * {
 *   "status": "success",
 *   "faces": [
 *     {
 *       "x1": 0.32, "y1": 0.18, "x2": 0.71, "y2": 0.62,
 *       "attributes": {
 *         "smile": 0.87,
 *         "eyes_open": 0.94,
 *         "pose": { "yaw": -12.4, "pitch": 3.1, "roll": 0.2 }
 *       }
 *     }
 *   ]
 * }
 * </pre>
 * Si {@code faces} es vacio → {@code faceDetected=false}. Si hay N caras,
 * se toma la de mayor area (asumimos que es el sujeto principal frente
 * a la webcam).
 */
@Service
@Qualifier("SIGHTENGINE_LIVENESS")
public class SightengineLivenessProvider implements LivenessFaceAttributesProvider {

    private static final Logger log = LoggerFactory.getLogger(SightengineLivenessProvider.class);

    private final SightengineProperties props;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public SightengineLivenessProvider(SightengineProperties props) {
        this.props = props;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(10_000);
        this.restTemplate = new RestTemplate(factory);
        this.objectMapper = new ObjectMapper();
    }

    // Constructor de test con RestTemplate inyectable.
    SightengineLivenessProvider(SightengineProperties props,
                                RestTemplate restTemplate,
                                ObjectMapper objectMapper) {
        this.props = props;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public FaceAttributesResult analyze(byte[] frameBytes) {
        if (!props.isEnabled()
                || isBlank(props.getApiUser())
                || isBlank(props.getApiSecret())) {
            throw new IllegalStateException("Sightengine credentials missing for liveness");
        }
        if (frameBytes == null || frameBytes.length == 0) {
            throw new IllegalArgumentException("frameBytes empty");
        }

        long t0 = System.currentTimeMillis();

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("media", new ByteArrayResource(frameBytes) {
            @Override public String getFilename() { return "frame.jpg"; }
        });
        body.add("models", "face-attributes");
        body.add("api_user", props.getApiUser());
        body.add("api_secret", props.getApiSecret());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> req = new HttpEntity<>(body, headers);

        String url = props.getBaseUrl() + "/1.0/check.json";

        ResponseEntity<String> resp;
        try {
            resp = restTemplate.exchange(url, HttpMethod.POST, req, String.class);
        } catch (RuntimeException ex) {
            log.warn("[LIVENESS-SIGHTENGINE] HTTP error url={}: {}", url, ex.getMessage());
            throw ex;
        }

        long latency = System.currentTimeMillis() - t0;

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            log.warn("[LIVENESS-SIGHTENGINE] non-2xx status={} latency_ms={}",
                    resp.getStatusCode(), latency);
            throw new IllegalStateException("Sightengine HTTP " + resp.getStatusCode());
        }

        String rawBody = resp.getBody();
        try {
            FaceAttributesResult result = parseResponse(rawBody);
            log.info("[LIVENESS-SIGHTENGINE] faceDetected={} smile={} eyesClosed={} yaw={} latency_ms={}",
                    result.isFaceDetected(),
                    String.format("%.2f", result.getSmile()),
                    String.format("%.2f", result.getEyesClosed()),
                    String.format("%.1f", result.getYaw()),
                    latency);
            return result;
        } catch (Exception ex) {
            log.warn("[LIVENESS-SIGHTENGINE] parse error: {}", ex.getMessage());
            throw new IllegalStateException("Sightengine liveness response parse error", ex);
        }
    }

    FaceAttributesResult parseResponse(String rawBody) throws Exception {
        JsonNode root = objectMapper.readTree(rawBody);
        JsonNode faces = root.get("faces");
        if (faces == null || !faces.isArray() || faces.size() == 0) {
            return new FaceAttributesResult(false, 0.0, 0.0, 0.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, rawBody);
        }

        // Escoger la cara de mayor area (sujeto principal frente a webcam).
        JsonNode chosen = null;
        double bestArea = -1.0;
        for (JsonNode face : faces) {
            double x1 = face.path("x1").asDouble(0.0);
            double y1 = face.path("y1").asDouble(0.0);
            double x2 = face.path("x2").asDouble(0.0);
            double y2 = face.path("y2").asDouble(0.0);
            double area = Math.max(0.0, x2 - x1) * Math.max(0.0, y2 - y1);
            if (area > bestArea) {
                bestArea = area;
                chosen = face;
            }
        }
        if (chosen == null) {
            return new FaceAttributesResult(false, 0.0, 0.0, 0.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, rawBody);
        }

        // face-attributes API: los atributos disponibles varian por plan
        // del vendor. En el plan actual solo se devuelven minor +
        // sunglasses. Los legacy smile/eyes_open/pose son ausentes; se
        // toman defaults. Los tests de gestures viejos siguen validos
        // con MOCK; el PRESENCE nuevo usa landmarks que si vienen.
        JsonNode attrs = chosen.path("attributes");
        double smile = attrs.path("smile").asDouble(0.0);
        double eyesOpen = attrs.path("eyes_open").asDouble(1.0);
        double eyesClosed = Math.max(0.0, Math.min(1.0, 1.0 - eyesOpen));
        double yaw = attrs.path("pose").path("yaw").asDouble(0.0);

        // Landmarks del modelo face (SIEMPRE presentes cuando hay cara).
        // Coordenadas normalizadas [0, 1] respecto al frame.
        JsonNode features = chosen.path("features");
        double leftEyeX = features.path("left_eye").path("x").asDouble(0.0);
        double leftEyeY = features.path("left_eye").path("y").asDouble(0.0);
        double rightEyeX = features.path("right_eye").path("x").asDouble(0.0);
        double rightEyeY = features.path("right_eye").path("y").asDouble(0.0);
        double noseTipX = features.path("nose_tip").path("x").asDouble(0.0);
        double noseTipY = features.path("nose_tip").path("y").asDouble(0.0);

        return new FaceAttributesResult(true, smile, eyesClosed, yaw,
                leftEyeX, leftEyeY, rightEyeX, rightEyeY, noseTipX, noseTipY,
                rawBody);
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
