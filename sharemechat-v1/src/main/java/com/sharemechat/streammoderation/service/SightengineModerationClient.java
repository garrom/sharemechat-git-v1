package com.sharemechat.streammoderation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.config.SightengineProperties;
import com.sharemechat.streammoderation.dto.ModerationFrameSubmission;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import com.sharemechat.streammoderation.dto.SightengineWorkflowResponse;
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

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Adapter Sightengine (vendor de clasificacion visual seleccionado en
 * ADR-037; Plan A del frente Moderacion IA P2.1).
 *
 * <p>Image API frame-a-frame sincrona: cada llamada a
 * {@link #submitImage(ModerationFrameSubmission)} envia el frame a
 * {@code POST /1.0/check-workflow.json} con el workflow consolidado
 * del operador y devuelve un verdict normalizado al control plane. El
 * delegado del mapeo concreto vive en {@link ModerationCategoryMapper}.
 *
 * <p>Politica de errores (DEC-11 P2.1, fail-closed-soft de ADR-036
 * bloque 3):
 * <ul>
 *   <li>Credenciales blank/{@code enabled=false}: lanza
 *       {@link IllegalStateException}. El caller
 *       ({@code StreamFrameIngestionService}) traduce a
 *       {@code markDegraded} sobre la sesion.</li>
 *   <li>HTTP 4xx (auth/quota), 5xx (vendor down), timeout: lanza
 *       {@link RuntimeException}. Mismo tratamiento por el caller.</li>
 * </ul>
 *
 * <p>Timeouts explicitos 5s connect / 10s read (divergencia controlada
 * respecto a {@code DiditClientImpl} que usa defaults sin timeout;
 * Sightengine forma parte del path critico del frente moderacion y
 * colgar el thread saturaria el {@code moderationExecutor}).
 *
 * <p>Vendor-agnostic en dominio: el nombre Sightengine vive aqui en el
 * adapter, en los DTOs vendor-specific y en
 * {@code SightengineProperties}; el control plane usa
 * {@link ModerationProviderClient}.
 */
@Service
@Qualifier("SIGHTENGINE")
public class SightengineModerationClient implements ModerationProviderClient {

    private static final Logger log = LoggerFactory.getLogger(SightengineModerationClient.class);

    private final SightengineProperties props;
    private final ModerationCategoryMapper mapper;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public SightengineModerationClient(SightengineProperties props,
                                       ModerationCategoryMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(10_000);
        this.restTemplate = new RestTemplate(factory);
        this.objectMapper = new ObjectMapper();
    }

    // Constructor para tests con RestTemplate inyectable.
    SightengineModerationClient(SightengineProperties props,
                                ModerationCategoryMapper mapper,
                                RestTemplate restTemplate,
                                ObjectMapper objectMapper) {
        this.props = props;
        this.mapper = mapper;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public ModerationVerdictResult submitImage(ModerationFrameSubmission frame) {
        if (!props.isEnabled()
                || isBlank(props.getApiUser())
                || isBlank(props.getApiSecret())
                || isBlank(props.getWorkflowId())) {
            // DEC-11: fail-closed-soft. El caller marca la sesion DEGRADED.
            throw new IllegalStateException("Sightengine credentials missing");
        }

        long t0 = System.currentTimeMillis();

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("media", new ByteArrayResource(frame.getFrameBytes()) {
            @Override public String getFilename() { return "frame.jpg"; }
        });
        body.add("workflow", props.getWorkflowId());
        body.add("api_user", props.getApiUser());
        body.add("api_secret", props.getApiSecret());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> req = new HttpEntity<>(body, headers);

        String url = props.getBaseUrl() + "/1.0/check-workflow.json";

        ResponseEntity<String> resp;
        try {
            resp = restTemplate.exchange(url, HttpMethod.POST, req, String.class);
        } catch (RuntimeException ex) {
            log.warn("[STREAM-MOD-SIGHTENGINE] HTTP error url={}: {}", url, ex.getMessage());
            throw ex;
        }

        long latency = System.currentTimeMillis() - t0;

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            log.warn("[STREAM-MOD-SIGHTENGINE] non-2xx status={} latency_ms={}",
                    resp.getStatusCode(), latency);
            throw new IllegalStateException("Sightengine HTTP " + resp.getStatusCode());
        }

        String rawBody = resp.getBody();
        SightengineWorkflowResponse parsed;
        try {
            parsed = parseResponse(rawBody);
        } catch (Exception ex) {
            log.warn("[STREAM-MOD-SIGHTENGINE] parse error: {}", ex.getMessage());
            throw new IllegalStateException("Sightengine response parse error", ex);
        }

        Instant frameTs = frame.getFrameTimestamp() != null
                ? frame.getFrameTimestamp()
                : Instant.now();
        ModerationVerdictResult verdict = mapper.buildVerdict(parsed, rawBody, frameTs);

        log.info("[STREAM-MOD-SIGHTENGINE] verdict severity={} categories={} latency_ms={}",
                verdict.getSeverityOverall(),
                verdict.getCategoryVerdicts().size(),
                latency);
        return verdict;
    }

    /**
     * Parse del response Sightengine. Detrae los objetos de cada modelo
     * conocido al map plano {@code rawScoresByModel}.
     *
     * <p>Aplica flattening contextual sobre las divergencias detectadas
     * en la calibracion contra el workflow real (P2.1):
     * <ul>
     *   <li>{@code weapon.classes.{firearm,knife,...}} -&gt; sube como
     *       sub-claves directas del modelo {@code weapon}, para que el
     *       mapper las trate como scores planos.</li>
     *   <li>{@code faces[*].attributes.age.minor} -&gt; sintetiza un
     *       modelo {@code minor} con {@code prob = max(minor)} sobre
     *       todas las caras detectadas. Si {@code faces} esta vacio, no
     *       se sintetiza (la categoria MINORS sale GREEN por ausencia).</li>
     * </ul>
     *
     * <p>El resto de modelos top-level cuyos sub-scores ya estan a nivel 1
     * (nudity, gore, violence, recreational_drug, self-harm, offensive,
     * gambling) se ofrecen al mapper tal cual.
     */
    SightengineWorkflowResponse parseResponse(String rawBody) throws Exception {
        @SuppressWarnings("unchecked")
        Map<String, Object> root = objectMapper.readValue(rawBody, Map.class);
        SightengineWorkflowResponse r = new SightengineWorkflowResponse();

        Object statusObj = root.get("status");
        if (statusObj instanceof Map) {
            SightengineWorkflowResponse.Status s = new SightengineWorkflowResponse.Status();
            Object code = ((Map<?, ?>) statusObj).get("code");
            Object msg = ((Map<?, ?>) statusObj).get("message");
            if (code != null) s.setCode(code.toString());
            if (msg != null) s.setMessage(msg.toString());
            r.setStatus(s);
        } else if (statusObj != null) {
            SightengineWorkflowResponse.Status s = new SightengineWorkflowResponse.Status();
            s.setCode(statusObj.toString());
            r.setStatus(s);
        }

        Object requestId = root.get("request");
        if (requestId instanceof Map) {
            Object id = ((Map<?, ?>) requestId).get("id");
            if (id != null) r.setRequestId(id.toString());
        }

        Map<String, Object> scores = new HashMap<>();
        for (Map.Entry<String, Object> e : root.entrySet()) {
            String k = e.getKey();
            if ("status".equals(k) || "request".equals(k)) continue;
            if (e.getValue() instanceof Map) {
                scores.put(k, e.getValue());
            }
        }

        // Flattening (calibracion P2.1): weapon.classes.* -> weapon.*
        Object weaponObj = scores.get("weapon");
        if (weaponObj instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> weapon = (Map<String, Object>) weaponObj;
            Object classes = weapon.get("classes");
            if (classes instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> wClasses = (Map<String, Object>) classes;
                for (Map.Entry<String, Object> sc : wClasses.entrySet()) {
                    weapon.putIfAbsent(sc.getKey(), sc.getValue());
                }
            }
        }

        // Sintesis (calibracion P2.1): faces[*].attributes.age.minor -> minor.prob
        Object facesObj = root.get("faces");
        if (facesObj instanceof java.util.List) {
            @SuppressWarnings("unchecked")
            java.util.List<Object> faces = (java.util.List<Object>) facesObj;
            double maxMinor = -1.0;
            for (Object faceObj : faces) {
                if (!(faceObj instanceof Map)) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> face = (Map<String, Object>) faceObj;
                Object attrs = face.get("attributes");
                if (!(attrs instanceof Map)) continue;
                Object age = ((Map<?, ?>) attrs).get("age");
                if (!(age instanceof Map)) continue;
                Object minor = ((Map<?, ?>) age).get("minor");
                if (minor instanceof Number) {
                    double v = ((Number) minor).doubleValue();
                    if (v > maxMinor) maxMinor = v;
                }
            }
            if (maxMinor >= 0.0) {
                Map<String, Object> minorModel = new HashMap<>();
                minorModel.put("prob", maxMinor);
                scores.put("minor", minorModel);
            }
        }

        r.setRawScoresByModel(scores);
        return r;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
