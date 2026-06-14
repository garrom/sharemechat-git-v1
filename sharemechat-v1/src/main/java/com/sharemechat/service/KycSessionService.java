package com.sharemechat.service;

import com.sharemechat.config.DiditProperties;
import com.sharemechat.config.VeriffProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.DiditCreateSessionResult;
import com.sharemechat.dto.KycStartSessionResponseDTO;
import com.sharemechat.dto.VeriffCreateSessionResult;
import com.sharemechat.entity.KycWebhookEvent;
import com.sharemechat.entity.KycSession;
import com.sharemechat.entity.User;
import com.sharemechat.repository.KycWebhookEventRepository;
import com.sharemechat.repository.KycSessionRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.HmacSha256;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;

@Service
public class KycSessionService {

    private static final Logger log = LoggerFactory.getLogger(KycSessionService.class);

    private static final String PROVIDER_VERIFF = "VERIFF";
    private static final String PROVIDER_DIDIT = "DIDIT";

    /**
     * Ventana de proteccion anti-replay del webhook Didit. La doc oficial
     * (docs.didit.me/integration/webhooks) exige rechazar webhooks cuyo
     * {@code X-Timestamp} difiera del reloj actual por mas de 300s. Veriff NO
     * tiene este mecanismo, asi que es nuevo en este service.
     */
    private static final long DIDIT_TIMESTAMP_TOLERANCE_SECONDS = 300L;

    private final UserRepository userRepository;
    private final KycSessionRepository kycSessionRepository;
    private final KycWebhookEventRepository kycWebhookEventRepository;
    private final VeriffClient veriffClient;
    private final ModelContractService modelContractService;
    private final EmailVerificationService emailVerificationService;
    private final VeriffProperties veriffProperties;
    private final DiditClient diditClient;
    private final DiditProperties diditProperties;

    public KycSessionService(UserRepository userRepository,
                                  KycSessionRepository kycSessionRepository,
                                  KycWebhookEventRepository kycWebhookEventRepository,
                                  VeriffClient veriffClient,
                                  ModelContractService modelContractService,
                                  EmailVerificationService emailVerificationService,
                                  VeriffProperties veriffProperties,
                                  DiditClient diditClient,
                                  DiditProperties diditProperties) {
        this.userRepository = userRepository;
        this.kycSessionRepository = kycSessionRepository;
        this.kycWebhookEventRepository = kycWebhookEventRepository;
        this.veriffClient = veriffClient;
        this.modelContractService = modelContractService;
        this.emailVerificationService = emailVerificationService;
        this.veriffProperties = veriffProperties;
        this.diditClient = diditClient;
        this.diditProperties = diditProperties;
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

        KycSession row = new KycSession();
        row.setUserId(userId);
        row.setProvider(PROVIDER_VERIFF);
        row.setProviderSessionId(result.getSessionId());
        row.setProviderVendorRef(result.getVendorData());
        row.setProviderStatus("started");
        row.setKycStatus(Constants.VerificationStatuses.PENDING);
        row.setHostedUrl(result.getVerificationUrl());

        kycSessionRepository.save(row);

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

            KycSession s = kycSessionRepository
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

            kycSessionRepository.save(s);

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

    // =========================================================================
    // DIDIT — flujo KYC modelo (Document + Selfie + Liveness via Workflow
    // Builder). ADR-035, frente Plan A. Metodos paralelos a los de Veriff
    // (decision arquitectonica: NO se refactoriza a strategy todavia, ver
    // project-log.md 2026-06-13).
    // =========================================================================

    @Transactional
    public KycStartSessionResponseDTO startDiditModelSession(Long userId) {
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

        DiditCreateSessionResult result = diditClient.createSession(
                userId, user.getEmail(), user.getName(), user.getSurname(),
                diditProperties.getModelWorkflowId());

        KycSession row = new KycSession();
        row.setUserId(userId);
        row.setSessionType(Constants.SessionTypes.MODEL);
        row.setProvider(PROVIDER_DIDIT);
        row.setProviderSessionId(result.getSessionId());
        row.setProviderVendorRef(result.getVendorData());
        // Provider status inicial: literal de Didit cuando creas una sesion
        // ("Not Started"). Case-sensitive — se persiste tal cual para que la
        // comparacion con futuros webhooks (que mandan "In Progress" / "In
        // Review" / "Approved" / ...) sea consistente.
        row.setProviderStatus("Not Started");
        row.setKycStatus(Constants.VerificationStatuses.PENDING);
        row.setHostedUrl(result.getVerificationUrl());

        kycSessionRepository.save(row);

        KycStartSessionResponseDTO dto = new KycStartSessionResponseDTO();
        dto.setUserId(userId);
        dto.setProvider(PROVIDER_DIDIT);
        dto.setProviderSessionId(result.getSessionId());
        dto.setVerificationUrl(result.getVerificationUrl());
        dto.setProviderStatus("Not Started");
        dto.setMappedStatus(Constants.VerificationStatuses.PENDING);

        return dto;
    }

    /**
     * Inicia una sesion Didit para el CLIENTE (Age Estimation con step-up
     * documental). Paralelo a {@link #startDiditModelSession(Long)} pero
     * dirigido al rol CLIENT.
     *
     * Pre-requisitos:
     * - Usuario existe.
     * - Usuario tiene rol CLIENT (o USER + FORM_CLIENT durante el registro,
     *   aunque el endpoint hoy se expone como hasRole CLIENT). Mantenemos el
     *   chequeo en ambos sitios por defensa en profundidad.
     * - Usuario NO esta ya APPROVED para client KYC: si lo esta, lanzamos.
     *   La re-verificacion por expiracion se gestiona en otra ruta (no
     *   abordada en este frente).
     *
     * Idempotencia: si existe una sesion CLIENT en PENDING para el user, se
     * devuelve la existente sin crear una nueva. Evita duplicar sesiones si
     * el cliente recarga la pagina del flujo.
     *
     * El age_estimation_threshold actual se hardcodea a 25 (challenge age
     * provisional decidido en ADR-035 §"Acciones inmediatas"). Cuando se
     * estabilice se moverá a property/config; por ahora documentado como TODO.
     */
    @Transactional
    public KycStartSessionResponseDTO startDiditClientSession(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        boolean isClient = Constants.Roles.CLIENT.equals(user.getRole())
                || (Constants.Roles.USER.equals(user.getRole())
                        && Constants.UserTypes.FORM_CLIENT.equals(user.getUserType()));

        if (!isClient) {
            throw new IllegalArgumentException("Solo CLIENT (o USER + FORM_CLIENT) puede iniciar KYC de cliente");
        }

        if (Constants.VerificationStatuses.APPROVED.equals(user.getClientKycStatus())) {
            throw new IllegalStateException("El usuario ya tiene client_kyc_status=APPROVED; no procede reverificar aqui.");
        }

        // Idempotencia: si hay sesion CLIENT en PENDING, devolverla.
        var existingPending = kycSessionRepository
                .findTopByUserIdAndSessionTypeAndKycStatusOrderByIdDesc(
                        userId, Constants.SessionTypes.CLIENT, Constants.VerificationStatuses.PENDING);
        if (existingPending.isPresent()) {
            KycSession s = existingPending.get();
            KycStartSessionResponseDTO dto = new KycStartSessionResponseDTO();
            dto.setUserId(userId);
            dto.setProvider(s.getProvider());
            dto.setProviderSessionId(s.getProviderSessionId());
            dto.setVerificationUrl(s.getHostedUrl());
            dto.setProviderStatus(s.getProviderStatus());
            dto.setMappedStatus(s.getKycStatus());
            return dto;
        }

        DiditCreateSessionResult result = diditClient.createSession(
                userId, user.getEmail(), user.getName(), user.getSurname(),
                diditProperties.getClientWorkflowId());

        KycSession row = new KycSession();
        row.setUserId(userId);
        row.setSessionType(Constants.SessionTypes.CLIENT);
        row.setProvider(PROVIDER_DIDIT);
        row.setProviderSessionId(result.getSessionId());
        row.setProviderVendorRef(result.getVendorData());
        row.setProviderStatus("Not Started");
        row.setKycStatus(Constants.VerificationStatuses.PENDING);
        row.setHostedUrl(result.getVerificationUrl());
        // TODO: mover a property kyc.didit.age-estimation-threshold cuando se
        // estabilice. Hoy hardcoded a 25 conforme ADR-035.
        row.setAgeEstimationThreshold(25);

        kycSessionRepository.save(row);

        KycStartSessionResponseDTO dto = new KycStartSessionResponseDTO();
        dto.setUserId(userId);
        dto.setProvider(PROVIDER_DIDIT);
        dto.setProviderSessionId(result.getSessionId());
        dto.setVerificationUrl(result.getVerificationUrl());
        dto.setProviderStatus("Not Started");
        dto.setMappedStatus(Constants.VerificationStatuses.PENDING);

        return dto;
    }

    /**
     * Procesa el webhook entrante de Didit.
     *
     * Diferencias clave respecto al webhook de Veriff:
     *  - Protección anti-replay: Didit envía la cabecera {@code X-Timestamp}
     *    (Unix epoch seconds). Se rechaza con {@code processing_error_message=
     *    "invalid_timestamp"} cualquier webhook cuya antiguedad supere
     *    {@link #DIDIT_TIMESTAMP_TOLERANCE_SECONDS} (300s). Esto es NUEVO; en
     *    Veriff no existia.
     *  - Firma: variante "Standard" de Didit (cabecera {@code X-Signature},
     *    HMAC-SHA256 hex sobre raw body). Se usa la MISMA utilidad
     *    {@link HmacSha256#verifyHexHmacSha256} que con Veriff. El secret es
     *    {@code kyc.didit.api-secret} (el {@code secret_shared_key} del
     *    destino webhook configurado en la consola de Didit).
     *  - Identificador unico del evento: {@code event_id} explicito en el
     *    payload (no derivado como en Veriff). Idempotencia por (DIDIT, event_id).
     *  - Status: string case-sensitive directo del payload ("Approved",
     *    "Declined", "Resubmitted", etc.). No hay codigo numerico autoridad
     *    como en Veriff.
     *
     * @return true si firma + timestamp son validos y el evento se proceso;
     *         false si la firma o timestamp son invalidos/ausentes. En todos
     *         los casos se persiste una fila en kyc_webhook_events para
     *         auditoria.
     */
    @Transactional
    public boolean processDiditWebhook(byte[] rawBodyBytes, String signatureHeader, String timestampHeader) {
        byte[] safeBytes = rawBodyBytes == null ? new byte[0] : rawBodyBytes;
        String rawBody = new String(safeBytes, StandardCharsets.UTF_8);

        // 1) Replay protection: |now - X-Timestamp| <= 300s. Es la PRIMERA
        // barrera (antes de verificar HMAC) porque un timestamp invalido es
        // siempre fatal independientemente de la firma.
        if (!isDiditTimestampFresh(timestampHeader)) {
            persistDiditRejection(rawBody, "invalid_timestamp");
            return false;
        }

        // 2) Firma HMAC-SHA256 sobre el raw body (variante Standard de Didit).
        boolean signatureValid = HmacSha256.verifyHexHmacSha256(
                diditProperties.getApiSecret(), safeBytes, signatureHeader);

        if (!signatureValid) {
            persistDiditRejection(rawBody, "invalid_signature");
            return false;
        }

        JSONObject json;
        try {
            json = new JSONObject(rawBody);
        } catch (Exception ex) {
            // Body con firma valida pero no parseable como JSON: lo persistimos
            // como procesado=false pero firma=true (caso anomalo, dejamos rastro).
            KycWebhookEvent ev = new KycWebhookEvent();
            ev.setProvider(PROVIDER_DIDIT);
            ev.setPayloadJson(rawBody);
            ev.setSignatureValid(true);
            ev.setProcessed(false);
            ev.setProcessedAt(LocalDateTime.now());
            ev.setProcessingError(truncate("invalid_payload: " + ex.getMessage(), 500));
            kycWebhookEventRepository.save(ev);
            return true;
        }

        String providerEventId = extractDiditEventId(json);
        String eventType = extractDiditEventType(json);
        String providerSessionId = extractDiditSessionId(json);

        // Idempotencia por (provider=DIDIT, event_id).
        if (providerEventId != null) {
            var existing = kycWebhookEventRepository.findByProviderAndProviderEventId(PROVIDER_DIDIT, providerEventId);
            if (existing.isPresent()) {
                return true;
            }
        }

        KycWebhookEvent ev = new KycWebhookEvent();
        ev.setProvider(PROVIDER_DIDIT);
        ev.setProviderEventId(providerEventId);
        ev.setProviderSessionId(providerSessionId);
        ev.setEventType(eventType);
        ev.setPayloadJson(rawBody);
        ev.setSignatureValid(true);

        try {
            if (providerSessionId == null || providerSessionId.isBlank()) {
                throw new IllegalArgumentException("Webhook sin session_id");
            }

            KycSession s = kycSessionRepository
                    .findByProviderAndProviderSessionId(PROVIDER_DIDIT, providerSessionId)
                    .orElseThrow(() -> new IllegalArgumentException("No existe sesion KYC para session_id=" + providerSessionId));

            // Sanity check de coherencia workflow_id <-> session_type. Didit
            // envia el workflow_id top-level en cada webhook; si la fila en
            // BD dice MODEL pero el payload trae el workflow_id del CLIENTE
            // (o viceversa), algo va muy mal y mejor rechazar el evento. No
            // es una barrera de seguridad (la barrera real ya es el HMAC),
            // pero blinda contra mezclas de destinos webhook mal configurados
            // en consola.
            String payloadWorkflowId = json.optString("workflow_id", null);
            assertWorkflowIdMatchesSessionType(payloadWorkflowId, s.getSessionType(), providerSessionId);

            s.setLastWebhookAt(LocalDateTime.now());
            s.setLastProviderEventType(eventType);

            String diditStatus = extractDiditStatus(json);
            String internalStatus = mapInternalStatusFromDiditStatus(diditStatus, providerSessionId);

            // provider_status: literal case-sensitive de Didit (sin tocar).
            s.setProviderStatus(diditStatus);
            s.setKycStatus(internalStatus);

            // decided_at: solo cuando el status mapea a una decision final
            // (APPROVED / REJECTED). PENDING (Resubmitted, In Review, etc.)
            // no fija decided_at.
            boolean isFinalDecision = Constants.VerificationStatuses.APPROVED.equals(internalStatus)
                    || Constants.VerificationStatuses.REJECTED.equals(internalStatus);
            if (isFinalDecision) {
                s.setDecidedAt(LocalDateTime.now());
            }

            // Didit no envia codigo numerico; persistimos el propio status
            // como "decision_code" para mantener trazabilidad uniforme con
            // la columna usada por Veriff.
            s.setProviderDecisionCode(diditStatus);
            s.setProviderDecisionReason(null);

            // Para CLIENT: extraer datos de Age Estimation del payload y
            // guardarlos en la fila kyc_sessions. El path exacto del JSON
            // se valida contra la doc de Didit Adaptive Age Verification en
            // el siguiente paso del frente (paso 4, cuando llegue el webhook
            // real). Por ahora extraemos con mejor esfuerzo y dejamos null
            // si no esta presente: para MODEL siempre seran null (en MODEL
            // no hay Age Estimation), para CLIENT los rellenara el payload
            // del workflow Adaptive.
            if (Constants.SessionTypes.CLIENT.equals(s.getSessionType())) {
                extractDiditAgeEstimation(json, s);
            }

            kycSessionRepository.save(s);

            // Actualizar campos del user en decision final segun session_type.
            // MODEL toca verification_status; CLIENT toca client_kyc_*. No se
            // mezclan: un mismo user podria tener ambos flujos completados de
            // forma independiente.
            if (isFinalDecision) {
                User u = userRepository.findById(s.getUserId())
                        .orElseThrow(() -> new IllegalArgumentException("Usuario de KYC no encontrado"));
                if (Constants.SessionTypes.CLIENT.equals(s.getSessionType())) {
                    u.setClientKycStatus(internalStatus);
                    u.setClientKycDecidedAt(LocalDateTime.now());
                    if (s.getEstimatedAgeDecimal() != null) {
                        u.setClientKycEstimatedAge(s.getEstimatedAgeDecimal());
                    }
                } else {
                    u.setVerificationStatus(internalStatus);
                }
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

    /**
     * Devuelve true si el header {@code X-Timestamp} esta dentro de la ventana
     * {@link #DIDIT_TIMESTAMP_TOLERANCE_SECONDS}. Si el header esta ausente, no
     * es numerico, o cae fuera de la ventana, devuelve false (rechazo).
     *
     * Package-private para tests.
     */
    boolean isDiditTimestampFresh(String timestampHeader) {
        if (timestampHeader == null || timestampHeader.isBlank()) {
            return false;
        }
        final long ts;
        try {
            ts = Long.parseLong(timestampHeader.trim());
        } catch (NumberFormatException ex) {
            return false;
        }
        long nowEpoch = Instant.now().getEpochSecond();
        long delta = Math.abs(nowEpoch - ts);
        return delta <= DIDIT_TIMESTAMP_TOLERANCE_SECONDS;
    }

    private void persistDiditRejection(String rawBody, String errorTag) {
        KycWebhookEvent rejected = new KycWebhookEvent();
        rejected.setProvider(PROVIDER_DIDIT);
        rejected.setPayloadJson(rawBody);
        rejected.setSignatureValid(false);
        // Mejor esfuerzo para enriquecer la auditoria; si el body no parsea
        // o el rechazo es por timestamp, dejamos los campos opcionales a null.
        try {
            JSONObject j = new JSONObject(rawBody);
            rejected.setProviderEventId(extractDiditEventId(j));
            rejected.setProviderSessionId(extractDiditSessionId(j));
            rejected.setEventType(extractDiditEventType(j));
        } catch (Exception ignore) {
            // body no parseable
        }
        rejected.setProcessed(false);
        rejected.setProcessedAt(LocalDateTime.now());
        rejected.setProcessingError(errorTag);
        kycWebhookEventRepository.save(rejected);
    }

    /**
     * Valida que el workflow_id del payload coincida con el session_type de
     * la fila kyc_sessions. Si el workflow_id del payload no esta poblado
     * (campo opcional en algunos eventos), se acepta el evento sin barrera.
     * Si esta poblado pero no matchea ninguno de los dos workflows
     * configurados, log warn y dejar pasar (puede ser un workflow de otro
     * proyecto; el HMAC ya garantiza la autenticidad). Si esta poblado y
     * matchea con el otro workflow distinto al session_type esperado,
     * lanzar (mismatch fatal: el destino webhook esta mezclando flujos).
     *
     * Package-private para tests.
     */
    void assertWorkflowIdMatchesSessionType(String payloadWorkflowId, String sessionType, String providerSessionId) {
        if (payloadWorkflowId == null || payloadWorkflowId.isBlank()) {
            return;
        }
        String modelWf = diditProperties == null ? null : diditProperties.getModelWorkflowId();
        String clientWf = diditProperties == null ? null : diditProperties.getClientWorkflowId();

        boolean isModelWf = modelWf != null && !modelWf.isBlank() && payloadWorkflowId.equals(modelWf);
        boolean isClientWf = clientWf != null && !clientWf.isBlank() && payloadWorkflowId.equals(clientWf);

        if (!isModelWf && !isClientWf) {
            log.warn("Didit webhook con workflow_id desconocido='{}' (session_id={}, session_type={}); se procesa con la session existente sin barrera adicional",
                    payloadWorkflowId, providerSessionId, sessionType);
            return;
        }

        if (isModelWf && !Constants.SessionTypes.MODEL.equals(sessionType)) {
            throw new IllegalStateException(
                    "Mismatch workflow_id/session_type: payload=" + payloadWorkflowId
                            + " (model workflow) pero la sesion " + providerSessionId + " es " + sessionType);
        }
        if (isClientWf && !Constants.SessionTypes.CLIENT.equals(sessionType)) {
            throw new IllegalStateException(
                    "Mismatch workflow_id/session_type: payload=" + payloadWorkflowId
                            + " (client workflow) pero la sesion " + providerSessionId + " es " + sessionType);
        }
    }

    /**
     * Extrae los datos de Age Estimation del payload Didit y los persiste en
     * la fila kyc_sessions. Mejor esfuerzo: si el path esperado no esta
     * presente, se dejan los campos a null (caso de webhooks intermedios o
     * de step-up documental ya disparado).
     *
     * Paths esperados (a confirmar con payload real en paso 4):
     *   decision.age_estimation.age_estimation -> estimatedAgeDecimal
     *   decision.age_estimation.score          -> confidenceScore
     *
     * Package-private para tests.
     */
    void extractDiditAgeEstimation(JSONObject json, KycSession session) {
        JSONObject decision = json.optJSONObject("decision");
        if (decision == null) return;
        JSONObject ageEstimation = decision.optJSONObject("age_estimation");
        if (ageEstimation == null) return;

        if (ageEstimation.has("age_estimation") && !ageEstimation.isNull("age_estimation")) {
            try {
                session.setEstimatedAgeDecimal(new java.math.BigDecimal(ageEstimation.get("age_estimation").toString()));
            } catch (NumberFormatException ignore) {
                // payload con formato no numerico: dejamos null
            }
        }
        if (ageEstimation.has("score") && !ageEstimation.isNull("score")) {
            try {
                session.setConfidenceScore(new java.math.BigDecimal(ageEstimation.get("score").toString()));
            } catch (NumberFormatException ignore) {
                // payload con formato no numerico: dejamos null
            }
        }
    }

    // -------------------- DIDIT extractors (package-private para tests) -------

    /**
     * event_id estable provisto por Didit en cada webhook (idempotencia).
     */
    String extractDiditEventId(JSONObject json) {
        return firstNonBlank(
                json.optString("event_id", null),
                json.optString("webhook_id", null)
        );
    }

    /**
     * webhook_type segun la doc Didit: "status.updated", "data.updated", etc.
     * Se almacena en kyc_webhook_events.provider_event_type literal.
     */
    String extractDiditEventType(JSONObject json) {
        return firstNonBlank(
                json.optString("webhook_type", null),
                json.optString("event_type", null)
        );
    }

    String extractDiditSessionId(JSONObject json) {
        return firstNonBlank(
                json.optString("session_id", null)
        );
    }

    /**
     * Status case-sensitive directo del payload. Se persiste tal cual y se
     * usa como entrada de {@link #mapInternalStatusFromDiditStatus}.
     */
    String extractDiditStatus(JSONObject json) {
        return firstNonBlank(json.optString("status", null));
    }

    /**
     * Mapea el status Didit (case-sensitive) al estado interno del proyecto.
     *
     * <ul>
     *   <li>{@code "Approved"} -> APPROVED (decision final)</li>
     *   <li>{@code "Declined"}, {@code "Expired"}, {@code "Abandoned"},
     *       {@code "Kyc Expired"} -> REJECTED (decision final)</li>
     *   <li>{@code "Resubmitted"}, {@code "Not Started"}, {@code "In Progress"},
     *       {@code "Awaiting User"}, {@code "In Review"} -> PENDING (flujo
     *       abierto, NO se toca users.verification_status)</li>
     *   <li>null / desconocido -> PENDING + log warn (NO se asume APPROVED)</li>
     * </ul>
     *
     * Las comparaciones son CASE-SENSITIVE a proposito porque Didit envia
     * exactamente esos strings (incl. {@code "Kyc Expired"} con K mayuscula y
     * el resto minusculas).
     */
    String mapInternalStatusFromDiditStatus(String status, String providerSessionId) {
        if (status == null) {
            log.warn("Didit webhook sin status (session_id={}); kyc_status se mantiene PENDING",
                    providerSessionId);
            return Constants.VerificationStatuses.PENDING;
        }
        switch (status) {
            case "Approved":
                return Constants.VerificationStatuses.APPROVED;
            case "Declined":
            case "Expired":
            case "Abandoned":
            case "Kyc Expired":
                return Constants.VerificationStatuses.REJECTED;
            case "Resubmitted":
            case "Not Started":
            case "In Progress":
            case "Awaiting User":
            case "In Review":
                return Constants.VerificationStatuses.PENDING;
            default:
                log.warn("Didit webhook con status desconocido='{}' (session_id={}); kyc_status se mantiene PENDING",
                        status, providerSessionId);
                return Constants.VerificationStatuses.PENDING;
        }
    }

    // -------------------- VERIFF extractors (existentes) ---------------------

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
