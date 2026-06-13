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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

@Service
public class ModelKycSessionService {

    private static final Logger log = LoggerFactory.getLogger(ModelKycSessionService.class);

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
                rejected.setProviderEventId(extractProviderEventId(j));
                rejected.setProviderSessionId(extractSessionId(j));
                rejected.setEventType(extractProviderEventType(j));
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

        String providerEventId = extractProviderEventId(json);
        String eventType = extractProviderEventType(json);
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

            // provider_status: literal de verification.status (NO se interpreta;
            // se persiste tal cual para auditoría). Cae a null si no viene.
            String providerStatus = extractProviderStatus(json);

            // Decisión interna: la AUTORIDAD final es verification.code numérico,
            // no el string status (que puede ser "success" para una declined real).
            Integer code = extractDecisionCode(json);
            String internalStatus = mapInternalStatusFromCode(code, providerSessionId);

            s.setProviderStatus(providerStatus);
            s.setKycStatus(internalStatus);

            // decided_at: solo cuando el code mapea a una decisión FINAL.
            if (Constants.VerificationStatuses.APPROVED.equals(internalStatus)
                    || Constants.VerificationStatuses.REJECTED.equals(internalStatus)) {
                s.setDecidedAt(LocalDateTime.now());
            }
            // submitted_at: NO se deduce del decision webhook; queda para el
            // event webhook si se integra en futuro.

            s.setProviderDecisionCode(code == null ? null : String.valueOf(code));
            s.setProviderDecisionReason(extractDecisionReason(json));

            modelKycSessionRepository.save(s);

            // Fuente de verdad interna para gating: solo actualizamos el user
            // si recibimos una decisión final (APPROVED/REJECTED). Para RESUBMISSION
            // o code desconocido (kyc_status sigue PENDING) NO tocamos al user,
            // porque el flujo sigue abierto y el estado previo (PENDING) ya es correcto.
            if (Constants.VerificationStatuses.APPROVED.equals(internalStatus)
                    || Constants.VerificationStatuses.REJECTED.equals(internalStatus)) {
                User u = userRepository.findById(s.getUserId())
                        .orElseThrow(() -> new IllegalArgumentException("Usuario de KYC no encontrado"));
                u.setVerificationStatus(internalStatus);
                userRepository.save(u);
            }

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

    /**
     * Identificador único del evento para idempotencia. Veriff Decision webhook
     * NO trae un id top-level, pero sí trae {@code verification.attemptId} que
     * es único por intento. Se prefiere antes que sustitutos.
     *
     * Si Veriff no envía {@code attemptId} (otros tipos de webhook futuros),
     * intentamos los nombres alternativos por compatibilidad. Si todos faltan,
     * devuelve {@code null}: la idempotencia se sostiene por
     * {@code provider_session_id} (la fila se reconcilia, no se duplica el
     * efecto de negocio aunque pueda crearse una fila extra de auditoría).
     */
    String extractProviderEventId(JSONObject json) {
        JSONObject v = json.optJSONObject("verification");
        if (v != null) {
            String x = firstNonBlank(
                    v.optString("attemptId", null),
                    v.optString("attempt_id", null)
            );
            if (x != null) return x;
        }
        return firstNonBlank(
                json.optString("id", null),
                json.optString("eventId", null),
                json.optString("event_id", null)
        );
    }

    /**
     * Tipo de evento para auditoría / logs. Veriff Decision webhook no tiene
     * un campo "eventType" explícito, pero el flujo se infiere de
     * {@code verification.status}: {@code "decision_<status>"} (p.ej.
     * {@code "decision_declined"}, {@code "decision_approved"}). Sirve para
     * distinguir en logs los decision webhooks de event webhooks futuros, sin
     * inventar contrato sobre lo que no controlamos.
     */
    String extractProviderEventType(JSONObject json) {
        // Compatibilidad con payloads que SÍ traen eventType/action/type
        String declared = firstNonBlank(
                json.optString("action", null),
                json.optString("eventType", null),
                json.optString("type", null)
        );
        if (declared != null) return declared;

        // Decision webhook: derivamos de verification.status
        JSONObject v = json.optJSONObject("verification");
        if (v != null) {
            String vs = firstNonBlank(v.optString("status", null));
            if (vs != null) return "decision_" + vs.toLowerCase();
        }
        return null;
    }

    /**
     * provider_status = literal de verification.status (sin interpretar). Veriff
     * envía aquí "approved"/"declined"/"resubmission_requested"/etc. en el
     * Decision webhook. NO se confunde con el {@code status} top-level que
     * Veriff usa como "webhook recibido OK" ("success").
     */
    String extractProviderStatus(JSONObject json) {
        JSONObject v = json.optJSONObject("verification");
        if (v != null) {
            return firstNonBlank(v.optString("status", null));
        }
        return null;
    }

    /**
     * Mapea {@code verification.code} (numérico, autoridad final de Veriff)
     * al estado interno del proyecto. Referencia: Veriff Decision codes.
     *
     * <ul>
     *   <li>9001 → APPROVED</li>
     *   <li>9102, 9103, 9104 → REJECTED</li>
     *   <li>9121 → RESUBMISSION_REQUESTED (kyc_status sigue PENDING; el flujo
     *       sigue abierto esperando nueva submission)</li>
     *   <li>Otros / null → PENDING + log warn (no asumimos APPROVED por defecto)</li>
     * </ul>
     */
    String mapInternalStatusFromCode(Integer code, String providerSessionId) {
        if (code == null) {
            log.warn("Veriff webhook sin verification.code (provider_session_id={}); kyc_status se mantiene PENDING",
                    providerSessionId);
            return Constants.VerificationStatuses.PENDING;
        }
        switch (code) {
            case 9001:
                return Constants.VerificationStatuses.APPROVED;
            case 9102:
            case 9103:
            case 9104:
                return Constants.VerificationStatuses.REJECTED;
            case 9121:
                // Resubmission requested: el usuario debe reintentar; sesión sigue abierta.
                return Constants.VerificationStatuses.PENDING;
            default:
                log.warn("Veriff webhook con verification.code desconocido={} (provider_session_id={}); kyc_status se mantiene PENDING",
                        code, providerSessionId);
                return Constants.VerificationStatuses.PENDING;
        }
    }

    /**
     * Extrae {@code verification.code} como Integer. Devuelve null si no existe
     * o no es numérico.
     */
    Integer extractDecisionCode(JSONObject json) {
        JSONObject v = json.optJSONObject("verification");
        if (v == null) return null;
        if (!v.has("code") || v.isNull("code")) return null;
        try {
            return v.getInt("code");
        } catch (Exception ex) {
            // Algunos payloads podrían enviarlo como string numérica.
            try {
                String s = v.optString("code", null);
                return s == null || s.isBlank() ? null : Integer.valueOf(s.trim());
            } catch (Exception ignore) {
                return null;
            }
        }
    }

    String extractDecisionReason(JSONObject json) {
        JSONObject v = json.optJSONObject("verification");
        if (v != null) {
            String x = firstNonBlank(
                    v.optString("reason", null),
                    v.optString("comment", null)
            );
            if (x != null) return x;
            // reasonCode puede venir como número; lo convertimos si está presente
            if (v.has("reasonCode") && !v.isNull("reasonCode")) {
                Object rc = v.get("reasonCode");
                return String.valueOf(rc);
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
