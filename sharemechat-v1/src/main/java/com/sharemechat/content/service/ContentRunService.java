package com.sharemechat.content.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.RunDetailDTO;
import com.sharemechat.content.dto.RunSummaryDTO;
import com.sharemechat.content.dto.ValidationErrorDTO;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.entity.ContentGenerationRun;
import com.sharemechat.content.repository.ContentArticleRepository;
import com.sharemechat.content.repository.ContentGenerationRunRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Orquesta el ciclo de vida de runs IA en Fase 3A.
 *
 * Flujo:
 *  1. createRun: crea fila content_generation_runs en PENDING, construye prompt
 *     expandido, sube prompt.txt a S3, fija prompt_template_id/prompt_s3_key/hash.
 *  2. submitOutput: guarda output_raw.md siempre. Valida JSON via provider.
 *     Si pasa: sube output_validated.json, status=VALIDATED, output_validated=true.
 *     Si falla: sube validation_errors.json, status=REJECTED, output_validated=false.
 *  3. listByArticle / findById: lectura de runs.
 *
 * Fase 3A NO aplica el output al articulo, NO crea versiones, NO emite eventos.
 */
@Service
public class ContentRunService {

    private static final Logger log = LoggerFactory.getLogger(ContentRunService.class);

    private static final Set<String> ALLOWED_RUN_TYPES = Set.of(
            ContentConstants.RUN_TYPE_RESEARCH,
            ContentConstants.RUN_TYPE_OUTLINE,
            ContentConstants.RUN_TYPE_DRAFT,
            ContentConstants.RUN_TYPE_REVIEW,
            ContentConstants.RUN_TYPE_SEO,
            ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED);

    /** Tope defensivo para output crudo pegado por el editor. */
    private static final int RAW_OUTPUT_MAX_BYTES = 1_048_576; // 1 MiB

    private final ContentArticleRepository articleRepo;
    private final ContentGenerationRunRepository runRepo;
    private final ContentBodyStorageService bodyStorageService;
    private final ContentAIProvider aiProvider;
    private final ObjectMapper objectMapper;
    private final ContentArticleService articleService;

    public ContentRunService(ContentArticleRepository articleRepo,
                             ContentGenerationRunRepository runRepo,
                             ContentBodyStorageService bodyStorageService,
                             ContentAIProvider aiProvider,
                             ObjectMapper objectMapper,
                             ContentArticleService articleService) {
        this.articleRepo = articleRepo;
        this.runRepo = runRepo;
        this.bodyStorageService = bodyStorageService;
        this.aiProvider = aiProvider;
        this.objectMapper = objectMapper;
        this.articleService = articleService;
    }

    @Transactional
    public RunDetailDTO createRun(Long articleId, String runTypeRaw, Long actorUserId) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        String runType = normalizeRunType(runTypeRaw);

        ContentArticle article = articleRepo.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));

        // 1. Construir prompt expandido (no se persiste todavia el ID del run -> placeholder)
        ContentAIProvider.PromptContext ctx = new ContentAIProvider.PromptContext(
                runType,
                article.getId(),
                article.getSlug(),
                article.getLocale(),
                article.getTitle(),
                article.getBrief(),
                article.getCategory(),
                article.getKeywords(),
                article.getState(),
                article.getCurrentVersionId(),
                actorUserId);
        String promptText;
        try {
            promptText = aiProvider.buildPrompt(ctx);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
        byte[] promptBytes = promptText.getBytes(StandardCharsets.UTF_8);
        String promptHash = sha256Hex(promptBytes);

        // 2. Insertar fila PENDING (sin S3 keys aun -> se rellenan tras subir)
        ContentGenerationRun run = new ContentGenerationRun();
        run.setArticleId(article.getId());
        run.setModelProvider(aiProvider.providerName());
        run.setModelId("");          // se declara al pegar output
        run.setModelVersion(null);
        run.setPromptTemplateId(aiProvider.resolveTemplateId(runType));
        run.setPromptHash(promptHash);
        run.setOutputValidated(false);
        run.setMode(aiProvider.mode());
        run.setStatus(ContentConstants.RUN_STATUS_PENDING);
        run.setTriggeredByUserId(actorUserId);
        ContentGenerationRun saved = runRepo.save(run);

        // 3. Subir prompt.txt a S3 con el id ya conocido y persistir prompt_s3_key
        String promptKey;
        try {
            promptKey = bodyStorageService.uploadRunPrompt(saved.getId(), promptBytes);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo subir prompt a S3", ex);
        }
        saved.setPromptS3Key(promptKey);
        runRepo.save(saved);

        log.info("{} run created id={} articleId={} runType={} actor={} promptHash={}",
                ContentConstants.LOG_PREFIX, saved.getId(), articleId, runType,
                actorUserId, promptHash);

        return toDetail(saved, runType, promptText, List.of());
    }

    @Transactional
    public RunDetailDTO submitOutput(Long articleId,
                                     Long runId,
                                     String rawOutput,
                                     String declaredModelId,
                                     String declaredModelVersion,
                                     Integer tokensInput,
                                     Integer tokensOutput,
                                     Long actorUserId) {
        if (articleId == null || runId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId y runId requeridos");
        }
        ContentGenerationRun run = runRepo.findById(runId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Run no encontrado"));
        if (!articleId.equals(run.getArticleId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Run no pertenece al articulo indicado");
        }
        if (!ContentConstants.RUN_STATUS_PENDING.equals(run.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Run no esta PENDING; ya tiene output registrado (status="
                            + run.getStatus() + ")");
        }
        if (rawOutput == null) rawOutput = "";
        byte[] rawBytes = rawOutput.getBytes(StandardCharsets.UTF_8);
        if (rawBytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "rawOutput vacio");
        }
        if (rawBytes.length > RAW_OUTPUT_MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "rawOutput excede " + RAW_OUTPUT_MAX_BYTES + " bytes");
        }
        String modelId = declaredModelId == null ? "" : declaredModelId.trim();
        if (modelId.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "modelId requerido (debes declarar el modelo de Claude usado)");
        }
        if (!aiProvider.isModelAllowed(modelId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "modelId no aceptado por el adaptador: " + modelId);
        }

        String runType = extractRunTypeFromTemplateId(run.getPromptTemplateId());

        // 1. Subir SIEMPRE output_raw.md (auditoria, antes de validar)
        String outputRawKey;
        try {
            outputRawKey = bodyStorageService.uploadRunOutputRaw(runId, rawBytes);
        } catch (IOException ex) {
            // Sistema fallido: marcar FAILED, no contaminar dataset con runs huerfanos
            run.setStatus(ContentConstants.RUN_STATUS_FAILED);
            runRepo.save(run);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo subir output crudo a S3", ex);
        }
        String outputHash = sha256Hex(rawBytes);
        run.setOutputS3Key(outputRawKey);
        run.setOutputHash(outputHash);
        run.setModelId(modelId);
        run.setModelVersion(declaredModelVersion == null || declaredModelVersion.isBlank()
                ? null : declaredModelVersion.trim());
        if (tokensInput != null && tokensInput >= 0) run.setTokensInput(tokensInput);
        if (tokensOutput != null && tokensOutput >= 0) run.setTokensOutput(tokensOutput);

        // 2. Validar JSON
        ContentAIProvider.OutputValidationResult validation =
                aiProvider.validateOutput(runType, rawOutput);

        if (validation.valid()) {
            byte[] canonicalBytes = validation.canonicalJson().getBytes(StandardCharsets.UTF_8);
            try {
                bodyStorageService.uploadRunOutputValidated(runId, canonicalBytes);
            } catch (IOException ex) {
                run.setStatus(ContentConstants.RUN_STATUS_FAILED);
                runRepo.save(run);
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "No se pudo subir output_validated.json a S3", ex);
            }
            run.setOutputValidated(true);
            run.setStatus(ContentConstants.RUN_STATUS_VALIDATED);
            runRepo.save(run);
            log.info("{} run output VALIDATED id={} runType={} actor={}",
                    ContentConstants.LOG_PREFIX, runId, runType, actorUserId);
            return toDetail(run, runType, null, List.of());
        }

        // Invalida: persistir errors a S3 y marcar REJECTED
        byte[] errorsBytes;
        try {
            errorsBytes = objectMapper.writeValueAsBytes(validation.errors());
        } catch (JsonProcessingException ex) {
            errorsBytes = ("[\"no se pudo serializar errores: " + ex.getMessage() + "\"]")
                    .getBytes(StandardCharsets.UTF_8);
        }
        try {
            bodyStorageService.uploadRunValidationErrors(runId, errorsBytes);
        } catch (IOException ex) {
            log.warn("{} no se pudo subir validation_errors.json para runId={}: {}",
                    ContentConstants.LOG_PREFIX, runId, ex.getMessage());
        }
        run.setOutputValidated(false);
        run.setStatus(ContentConstants.RUN_STATUS_REJECTED);
        runRepo.save(run);
        log.info("{} run output REJECTED id={} runType={} actor={} errorCount={}",
                ContentConstants.LOG_PREFIX, runId, runType, actorUserId,
                validation.errors().size());
        return toDetail(run, runType, null, validation.errors());
    }

    @Transactional(readOnly = true)
    public List<RunSummaryDTO> listByArticle(Long articleId) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        articleRepo.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));
        return runRepo.findByArticleIdOrderByIdDesc(articleId).stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public RunDetailDTO findById(Long runId) {
        if (runId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "runId requerido");
        }
        ContentGenerationRun run = runRepo.findById(runId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Run no encontrado"));
        String runType = extractRunTypeFromTemplateId(run.getPromptTemplateId());

        String prompt = "";
        try {
            prompt = bodyStorageService.loadRunPrompt(run.getId());
        } catch (IOException ex) {
            log.warn("{} no se pudo recargar prompt de runId={}: {}",
                    ContentConstants.LOG_PREFIX, run.getId(), ex.getMessage());
        }

        List<ValidationErrorDTO> errors = List.of();
        if (ContentConstants.RUN_STATUS_REJECTED.equals(run.getStatus())) {
            try {
                String errJson = bodyStorageService.loadRunValidationErrors(run.getId());
                if (errJson != null && !errJson.isBlank()) {
                    ValidationErrorDTO[] arr = objectMapper.readValue(errJson, ValidationErrorDTO[].class);
                    errors = List.of(arr);
                }
            } catch (IOException ex) {
                log.warn("{} no se pudo recargar errores de runId={}: {}",
                        ContentConstants.LOG_PREFIX, run.getId(), ex.getMessage());
            }
        }
        return toDetail(run, runType, prompt, errors);
    }

    /**
     * Fase 4A: aplica draft_markdown del output validado de un run al cuerpo
     * del articulo. El operador no necesita copiar el draft manualmente.
     *
     * Reglas:
     *  - run debe pertenecer al articulo indicado
     *  - run debe estar en status VALIDATED y output_validated=true
     *  - draft_markdown del output canonico debe existir y no estar en blanco
     *  - articulo debe ser editable (terminales PUBLISHED/RETRACTED bloquean
     *    incluso para ADMIN, post-Fase 4A hardening)
     *  - subida del draft a S3 reusa el mismo path que PUT /body
     *    (content/articles/{id}/draft.md)
     *  - aplicacion al articulo emite EVENT_EDIT_APPLIED con target="ai_apply"
     *    y payload con run_id/run_type para auditoria
     *  - NO cambia estado, NO publica, NO crea version inmutable
     */
    @Transactional
    public ArticleDetailDTO applyValidatedDraftToArticle(Long articleId,
                                                         Long runId,
                                                         Long actorUserId,
                                                         boolean isAdmin) {
        if (articleId == null || runId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "articleId y runId requeridos");
        }
        ContentGenerationRun run = runRepo.findById(runId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Run no encontrado"));
        if (!articleId.equals(run.getArticleId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Run no pertenece al articulo indicado");
        }
        if (!ContentConstants.RUN_STATUS_VALIDATED.equals(run.getStatus())
                || !run.isOutputValidated()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Run no esta VALIDATED; no se puede aplicar (status="
                            + run.getStatus() + ")");
        }

        // Pre-check editable antes de tocar S3 (fail fast, evita huerfanos en draft.md).
        articleService.requireEditable(articleId, isAdmin);

        // Cargar el output canonico del run desde S3.
        String validatedJson;
        try {
            validatedJson = bodyStorageService.loadRunOutputValidated(runId);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo leer output_validated.json del run", ex);
        }
        if (validatedJson == null || validatedJson.isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "output_validated.json no encontrado en S3 para el run");
        }

        // Extraer draft_markdown del JSON canonico.
        JsonNode root;
        try {
            root = objectMapper.readTree(validatedJson);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "output_validated.json del run no es JSON parseable", ex);
        }
        JsonNode draftNode = root == null ? null : root.get("draft_markdown");
        if (draftNode == null || draftNode.isNull() || !draftNode.isTextual()
                || draftNode.asText().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "draft_markdown ausente o vacio en el output validado del run");
        }
        String md = draftNode.asText();
        byte[] mdBytes = md.getBytes(StandardCharsets.UTF_8);

        // Subir como draft.md (mismo path/mecanismo que PUT /body manual).
        ContentBodyStorageService.Result uploaded;
        try {
            uploaded = bodyStorageService.uploadDraftBody(articleId, mdBytes);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo subir draft a S3", ex);
        }

        String runType = extractRunTypeFromTemplateId(run.getPromptTemplateId());

        // Aplicar al articulo (assertEditable + flags ai_assisted/disclosure +
        // emite EVENT_EDIT_APPLIED con target="ai_apply" + run_id/run_type).
        articleService.applyAiDraftToArticle(
                articleId,
                uploaded.s3Key(),
                uploaded.contentHash(),
                uploaded.byteSize(),
                runId,
                runType,
                actorUserId,
                isAdmin);

        log.info("{} run draft applied to article runId={} articleId={} runType={} actor={}",
                ContentConstants.LOG_PREFIX, runId, articleId, runType, actorUserId);

        return articleService.findById(articleId);
    }

    private String normalizeRunType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "runType requerido");
        }
        String rt = raw.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_RUN_TYPES.contains(rt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "runType no soportado: " + rt);
        }
        return rt;
    }

    private String extractRunTypeFromTemplateId(String templateId) {
        if (templateId == null) return "";
        int slash = templateId.indexOf('/');
        return slash > 0 ? templateId.substring(0, slash) : templateId;
    }

    private RunSummaryDTO toSummary(ContentGenerationRun r) {
        return new RunSummaryDTO(
                r.getId(),
                r.getArticleId(),
                extractRunTypeFromTemplateId(r.getPromptTemplateId()),
                r.getModelProvider(),
                r.getModelId(),
                r.getModelVersion(),
                r.getMode(),
                r.getStatus(),
                r.isOutputValidated(),
                r.getTriggeredByUserId(),
                r.getCreatedAt()
        );
    }

    private RunDetailDTO toDetail(ContentGenerationRun r,
                                  String runType,
                                  String prompt,
                                  List<ValidationErrorDTO> errors) {
        return new RunDetailDTO(
                r.getId(),
                r.getArticleId(),
                runType,
                r.getModelProvider(),
                r.getModelId(),
                r.getModelVersion(),
                r.getMode(),
                r.getStatus(),
                r.isOutputValidated(),
                r.getPromptTemplateId(),
                r.getPromptS3Key(),
                r.getPromptHash(),
                r.getOutputS3Key(),
                r.getOutputHash(),
                r.getTriggeredByUserId(),
                r.getCreatedAt(),
                prompt,
                errors
        );
    }

    private static String sha256Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(data == null ? new byte[0] : data));
        } catch (NoSuchAlgorithmException ex) {
            throw new UncheckedIOException("SHA-256 no disponible",
                    new IOException(ex));
        }
    }
}
