package com.sharemechat.controller;

import com.sharemechat.config.SightengineProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.security.HmacSha256;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Webhook entrante generico de moderacion visual del streaming
 * (frente Moderacion IA; ADR-036 / ADR-037).
 *
 * <p>P1.3 stub: este controller valida {@code vendor} contra el set
 * permitido + valida firma HMAC con la utility
 * {@link HmacSha256} usando el secret del vendor correspondiente.
 * NO persiste el evento, NO parsea el payload, NO invoca
 * {@code applyVerdict}. El parser vendor-specific y la identificacion
 * de sesion son responsabilidad del adapter Sightengine cuando llegue
 * en P2.
 *
 * <p>Politica de respuestas (decisiones K3 y K4 de Fase A):
 * <ul>
 *   <li>400 si {@code vendor} no esta en el set permitido.</li>
 *   <li>401 si el webhook_secret del vendor esta vacio en config.</li>
 *   <li>401 si la firma HMAC es invalida o ausente.</li>
 *   <li>200 con cuerpo informativo {@code {status:"received","stub":"P1.3"}}
 *       si la firma es valida (sin persistir).</li>
 * </ul>
 *
 * <p>Patron identico a {@code KycProviderController.diditWebhook} en
 * la lectura del body como {@code byte[]} para preservar los bytes
 * exactos que el vendor firmo.
 */
@RestController
public class StreamModerationWebhookController {

    private static final Logger log = LoggerFactory.getLogger(StreamModerationWebhookController.class);

    private static final Set<String> SUPPORTED_VENDORS = Set.of(
            Constants.StreamModerationProvider.SIGHTENGINE,
            Constants.StreamModerationProvider.HIVE,
            Constants.StreamModerationProvider.REKOGNITION
    );

    private final SightengineProperties sightengineProperties;

    public StreamModerationWebhookController(SightengineProperties sightengineProperties) {
        this.sightengineProperties = sightengineProperties;
    }

    @PostMapping("/api/webhooks/moderation/{vendor}")
    public ResponseEntity<?> handleWebhook(
            @PathVariable String vendor,
            @RequestHeader(value = "X-Signature", required = false) String signature,
            @RequestHeader(value = "X-Timestamp", required = false) String timestamp,
            @RequestBody(required = false) byte[] rawBody) {

        String normalized = vendor == null ? "" : vendor.trim().toUpperCase();
        if (!SUPPORTED_VENDORS.contains(normalized)) {
            log.warn("[STREAM-MOD] webhook vendor no soportado vendor={}", vendor);
            return ResponseEntity.badRequest().body(Map.of("error", "unsupported_vendor"));
        }

        String webhookSecret = resolveSecret(normalized);
        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.warn("[STREAM-MOD] webhook secret not configured vendor={}", normalized);
            return ResponseEntity.status(401).body(Map.of("error", "webhook_secret_not_configured"));
        }

        boolean signatureValid = HmacSha256.verifyHexHmacSha256(webhookSecret, rawBody, signature);
        if (!signatureValid) {
            log.warn("[STREAM-MOD] webhook invalid signature vendor={}", normalized);
            return ResponseEntity.status(401).build();
        }

        // P1.3 stub: NO se persiste el evento porque
        // stream_moderation_events.stream_moderation_session_id es NOT NULL y
        // no podemos identificar la sesion sin parser vendor-specific. El
        // parser y la persistencia son trabajo del adapter en P2.
        log.warn("[STREAM-MOD] webhook stub: payload received but not persisted vendor={} bytes={} timestamp={} (P1.3 stub, parser pending P2 adapter)",
                normalized, rawBody == null ? 0 : rawBody.length, timestamp);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "received");
        body.put("stub", "P1.3");
        body.put("note", "payload-to-session mapping pending P2 adapter");
        return ResponseEntity.ok(body);
    }

    private String resolveSecret(String vendor) {
        if (Constants.StreamModerationProvider.SIGHTENGINE.equals(vendor)) {
            return sightengineProperties.getWebhookSecret();
        }
        // HIVE / REKOGNITION: en P1.3 no tienen properties propias; devuelve
        // null para que el endpoint responda 401 webhook_secret_not_configured
        // hasta que se creen sus @ConfigurationProperties si se activan.
        return null;
    }
}
