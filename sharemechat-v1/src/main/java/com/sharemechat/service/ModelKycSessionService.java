package com.sharemechat.service;

import com.sharemechat.config.VeriffProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.KycStartSessionResponseDTO;
import com.sharemechat.dto.VeriffCreateSessionResult;
import com.sharemechat.entity.KycWebhookEvent;
import com.sharemechat.entity.ModelKycSession;
import com.sharemechat.entity.User;
import com.sharemechat.repository.KycWebhookEventRepository;
import com.sharemechat.repository.ModelKycSessionRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.HmacSha256;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

@Service
public class ModelKycSessionService {

    private static final String PROVIDER_VERIFF = "VERIFF";

    private final UserRepository userRepository;
    private final ModelKycSessionRepository modelKycSessionRepository;
    private final KycWebhookEventRepository kycWebhookEventRepository;
    private final VeriffClient veriffClient;
    private final ModelContractService modelContractService;
    private final EmailVerificationService emailVerificationService;
    private final VeriffProperties veriffProperties;

    public ModelKycSessionService(UserRepository userRepository,
                                  ModelKycSessionRepository modelKycSessionRepository,
                                  KycWebhookEventRepository kycWebhookEventRepository,
                                  VeriffClient veriffClient,
                                  ModelContractService modelContractService,
                                  EmailVerificationService emailVerificationService,
                                  VeriffProperties veriffProperties) {
        this.userRepository = userRepository;
        this.modelKycSessionRepository = modelKycSessionRepository;
        this.kycWebhookEventRepository = kycWebhookEventRepository;
        this.veriffClient = veriffClient;
        this.modelContractService = modelContractService;
        this.emailVerificationService = emailVerificationService;
        this.veriffProperties = veriffProperties;
    }

    @Transactional
    public KycStartSessionResponseDTO startVeriffSession(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        boolean isOnboardingModel =
                Constants.Roles.USER.equals(user.getRole())
                        && Constants.UserTypes.FORM_MODEL.equals(user.getUserType());

        if (!isOnboardingModel) {
            throw new IllegalArgumentException("Solo USER + FORM_MODEL puede iniciar KYC");
        }

        emailVerificationService.assertEmailVerified(
                user,
                "Debes validar tu email antes de iniciar el KYC de modelo.",
                "MODEL_ONBOARDING",
                "VERIFY_EMAIL"
        );

        if (!modelContractService.isAcceptedCurrent(userId)) {
            throw new IllegalArgumentException("Debes aceptar el contrato de modelo antes del KYC");
        }

        // Pasamos givenName/lastName del User si los tenemos en el registro;
        // VeriffClientImpl los OMITE del JSON cuando vienen vacíos/null
        // (Veriff rechaza con 400/1104 si recibe strings vacíos). idNumber no
        // se pasa: nunca lo conocemos antes de la verificación.
        VeriffCreateSessionResult result = veriffClient.createSession(
                userId, user.getEmail(), user.getName(), user.getSurname());

        ModelKycSession row = new ModelKycSession();
        row.setUserId(userId);
        row.setProvider(PROVIDER_VERIFF);
        row.setProviderSessionId(result.getSessionId());
        row.setProviderVendorRef(result.getVendorData());
        row.setProviderStatus("started");
        row.setKycStatus(Constants.VerificationStatuses.PENDING);
        row.setHostedUrl(result.getVerificationUrl());

        modelKycSessionRepository.save(row);

        KycStartSessionResponseDTO dto = new KycStartSessionResponseDTO();
        dto.setUserId(userId);
        dto.setProvider(PROVIDER_VERIFF);
        dto.setProviderSessionId(result.getSessionId());
        dto.setVerificationUrl(result.getVerificationUrl());
        dto.setProviderStatus("started");
        dto.setMappedStatus(Constants.VerificationStatuses.PENDING);

        return dto;
    }

    /**
     * Procesa el webhook entrante de Veriff.
     *
     * Recibe el body CRUDO en bytes (lo preserva tal cual llega para que la
     * verificación HMAC sea sobre los bytes exactos firmados por Veriff). La
     * firma entrante (cabecera X-HMAC-SIGNATURE) se valida con HMAC-SHA256 del
     * raw body usando el shared secret (kyc.veriff.api-secret) y comparación
     * constant-time.
     *
     * @return true si la firma es válida y el evento se procesó; false si la
     *         firma es inválida/ausente (el controller debe responder 401). En
     *         ambos casos se persiste una fila en kyc_webhook_events para
     *         auditoría (signature_valid refleja el resultado real).
     */
    @Transactional
    public boolean processVeriffWebhook(byte[] rawBodyBytes, String signatureHeader) {
        byte[] safeBytes = rawBodyBytes == null ? new byte[0] : rawBodyBytes;
        String rawBody = new String(safeBytes, StandardCharsets.UTF_8);

        // Validación HMAC real (constant-time) contra el shared secret de Veriff.
        boolean signatureValid = HmacSha256.verifyHexHmacSha256(
                veriffProperties.getApiSecret(), safeBytes, signatureHeader);

        // Si la firma no es válida: persistimos el intento para auditoría y
        // NO procesamos el evento. El controller responderá 401.
        if (!signatureValid) {
            KycWebhookEvent rejected = new KycWebhookEvent();
            rejected.setProvider(PROVIDER_VERIFF);
            rejected.setPayloadJson(rawBody);
            rejected.setSignatureValid(false);
            // Mejor esfuerzo para enriquecer la fila de auditoría (puede fallar
            // el parseo si el body no es JSON válido; no debe romper el guardado).
            try {
                JSONObject j = new JSONObject(rawBody);
                rejected.setProviderEventId(firstNonBlank(
                        j.optString("id", null), j.optString("eventId", null), j.optString("event_id", null)));
                rejected.setProviderSessionId(extractSessionId(j));
                rejected.setEventType(firstNonBlank(
                        j.optString("action", null), j.optString("eventType", null), j.optString("type", null)));
            } catch (Exception ignore) {
                // body no parseable: dejamos los campos a null
            }
            rejected.setProcessed(false);
            rejected.setProcessedAt(LocalDateTime.now());
            rejected.setProcessingError("invalid_signature");
            kycWebhookEventRepository.save(rejected);
            return false;
        }

        JSONObject json = new JSONObject(rawBody);

        String providerEventId = firstNonBlank(
                json.optString("id", null),
                json.optString("eventId", null),
                json.optString("event_id", null)
        );

        String eventType = firstNonBlank(
                json.optString("action", null),
                json.optString("eventType", null),
                json.optString("type", null)
        );

        String providerSessionId = extractSessionId(json);

        // Idempotencia si viene event_id
        if (providerEventId != null) {
            var existing = kycWebhookEventRepository.findByProviderAndProviderEventId(PROVIDER_VERIFF, providerEventId);
            if (existing.isPresent()) {
                return true;
            }
        }

        KycWebhookEvent ev = new KycWebhookEvent();
        ev.setProvider(PROVIDER_VERIFF);
        ev.setProviderEventId(providerEventId);
        ev.setProviderSessionId(providerSessionId);
        ev.setEventType(eventType);
        ev.setPayloadJson(rawBody);
        ev.setSignatureValid(true);

        try {
            if (providerSessionId == null || providerSessionId.isBlank()) {
                throw new IllegalArgumentException("Webhook sin provider_session_id");
            }

            ModelKycSession s = modelKycSessionRepository
                    .findByProviderAndProviderSessionId(PROVIDER_VERIFF, providerSessionId)
                    .orElseThrow(() -> new IllegalArgumentException("No existe sesión KYC para provider_session_id=" + providerSessionId));

            s.setLastWebhookAt(LocalDateTime.now());
            s.setLastProviderEventType(eventType);

            // Mapping básico (robusto aunque luego ajustes los nombres reales de Veriff)
            String providerStatus = mapProviderStatus(eventType, json);
            String internalStatus = mapInternalStatus(providerStatus);

            s.setProviderStatus(providerStatus);
            s.setKycStatus(internalStatus);

            if ("submitted".equalsIgnoreCase(providerStatus) && s.getSubmittedAt() == null) {
                s.setSubmittedAt(LocalDateTime.now());
            }

            if (Constants.VerificationStatuses.APPROVED.equals(internalStatus)
                    || Constants.VerificationStatuses.REJECTED.equals(internalStatus)) {
                s.setDecidedAt(LocalDateTime.now());
            }

            s.setProviderDecisionCode(extractDecisionCode(json));
            s.setProviderDecisionReason(extractDecisionReason(json));

            modelKycSessionRepository.save(s);

            // Fuente de verdad interna para gating
            User u = userRepository.findById(s.getUserId())
                    .orElseThrow(() -> new IllegalArgumentException("Usuario de KYC no encontrado"));

            u.setVerificationStatus(internalStatus);
            userRepository.save(u);

            ev.setProcessed(true);
            ev.setProcessedAt(LocalDateTime.now());
            ev.setProcessingError(null);

        } catch (Exception ex) {
            ev.setProcessed(false);
            ev.setProcessedAt(LocalDateTime.now());
            ev.setProcessingError(truncate(ex.getMessage(), 500));
        }

        kycWebhookEventRepository.save(ev);
        return true;
    }

    private String extractSessionId(JSONObject json) {
        // Soporta varios formatos
        if (json.has("verification")) {
            JSONObject v = json.optJSONObject("verification");
            if (v != null) {
                String id = firstNonBlank(
                        v.optString("id", null),
                        v.optString("sessionId", null),
                        v.optString("session_id", null)
                );
                if (id != null) {
                    return id;
                }
            }
        }

        return firstNonBlank(
                json.optString("verificationId", null),
                json.optString("sessionId", null),
                json.optString("session_id", null)
        );
    }

    private String mapProviderStatus(String eventType, JSONObject json) {
        String t = eventType == null ? "" : eventType.toLowerCase();

        // Mapping genérico compatible con payloads típicos
        if (t.contains("started") || t.contains("created")) {
            return "started";
        }
        if (t.contains("submitted")) {
            return "submitted";
        }
        if (t.contains("approved") || t.contains("verified")) {
            return "approved";
        }
        if (t.contains("declined") || t.contains("rejected") || t.contains("failed")) {
            return "declined";
        }

        // fallback por decision/status
        String decision = extractDecisionCode(json);
        if (decision != null) {
            String d = decision.toLowerCase();
            if (d.contains("approved")) {
                return "approved";
            }
            if (d.contains("declined") || d.contains("rejected")) {
                return "declined";
            }
        }

        String rawStatus = firstNonBlank(json.optString("status", null), json.optString("state", null));
        if (rawStatus != null) {
            return rawStatus.toLowerCase();
        }

        return "unknown";
    }

    private String mapInternalStatus(String providerStatus) {
        if (providerStatus == null) {
            return Constants.VerificationStatuses.PENDING;
        }

        String p = providerStatus.toLowerCase();

        if (p.contains("approved") || p.contains("verified")) {
            return Constants.VerificationStatuses.APPROVED;
        }
        if (p.contains("declined") || p.contains("rejected") || p.contains("failed")) {
            return Constants.VerificationStatuses.REJECTED;
        }

        return Constants.VerificationStatuses.PENDING;
    }

    private String extractDecisionCode(JSONObject json) {
        if (json.has("verification")) {
            JSONObject v = json.optJSONObject("verification");
            if (v != null) {
                String x = firstNonBlank(
                        v.optString("decision", null),
                        v.optString("code", null),
                        v.optString("status", null)
                );
                if (x != null) {
                    return x;
                }
            }
        }

        return firstNonBlank(
                json.optString("decision", null),
                json.optString("code", null)
        );
    }

    private String extractDecisionReason(JSONObject json) {
        if (json.has("verification")) {
            JSONObject v = json.optJSONObject("verification");
            if (v != null) {
                String x = firstNonBlank(
                        v.optString("reason", null),
                        v.optString("reasonCode", null),
                        v.optString("comment", null)
                );
                if (x != null) {
                    return x;
                }
            }
        }

        return firstNonBlank(
                json.optString("reason", null),
                json.optString("comment", null)
        );
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String v : values) {
            if (v != null && !v.trim().isEmpty() && !"null".equalsIgnoreCase(v.trim())) {
                return v.trim();
            }
        }
        return null;
    }

    private String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
