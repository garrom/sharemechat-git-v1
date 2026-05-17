package com.sharemechat.content.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.dto.ApplyBilingualResultDTO;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.RunDetailDTO;
import com.sharemechat.content.dto.RunSummaryDTO;
import com.sharemechat.content.dto.ValidationErrorDTO;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.entity.ContentArticleTranslation;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Orquesta el ciclo de vida de runs IA bajo el modelo bilingue ADR-025.
 *
 *  - createRun: crea fila en content_generation_runs (status PENDING),
 *    construye prompt expandido via ContentPromptBuilder, sube prompt.txt
 *    a S3. Solo runType FULL_ARTICLE_ORCHESTRATED esta operativo.
 *
 *  - applyBilingual: endpoint atomico que recibe el JSON unico bilingue
 *    schema 2.0, lo valida via ManualClipboardClaudeAdapter y, si pasa,
 *    aplica simultaneamente ambas traducciones (ES + EN) al articulo,
 *    actualiza el run y emite evento de auditoria.
 *
 *  - listByArticle, findById: lecturas auxiliares (paquete 3 endpoint).
 */
@Service
public class ContentRunService {

    private static final Logger log = LoggerFactory.getLogger(ContentRunService.class);

    /** Solo FULL_ARTICLE_ORCHESTRATED es operativo en el modelo nuevo (ADR-025). */
    private static final Set<String> ALLOWED_RUN_TYPES = Set.of(
            ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED);

    /** Tope defensivo para JSON crudo pegado por el operador. */
    private static final int RAW_OUTPUT_MAX_BYTES = 1_048_576; // 1 MiB

    private final ContentArticleRepository articleRepo;
    private final ContentGenerationRunRepository runRepo;
    private final ContentBodyStorageService bodyStorageService;
    private final ContentAIProvider aiProvider;
    private final ContentArticleService articleService;
    private final ObjectMapper objectMapper;

    public ContentRunService(ContentArticleRepository articleRepo,
                             ContentGenerationRunRepository runRepo,
                             ContentBodyStorageService bodyStorageService,
                             ContentAIProvider aiProvider,
                             ContentArticleService articleService,
                             ObjectMapper objectMapper) {
        this.articleRepo = articleRepo;
        this.runRepo = runRepo;
        this.bodyStorageService = bodyStorageService;
        this.aiProvider = aiProvider;
        this.articleService = articleService;
        this.objectMapper = objectMapper;
    }

    // ================================================================
    // createRun
    // ================================================================

    @Transactional
    public RunDetailDTO createRun(Long articleId, String runTypeRaw, Long actorUserId) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        String runType = normalizeRunType(runTypeRaw);

        ContentArticle article = articleRepo.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));

        // Localizar translation ES para inyectar slug_es y title_es en el contexto del prompt.
        ContentArticleTranslation esTranslation = articleService
                .requireTranslation(article.getId(), ContentConstants.LOCALE_ES);

        ContentAIProvider.PromptContext ctx = new ContentAIProvider.PromptContext(
                runType,
                article.getId(),
                esTranslation.getSlug(),
                esTranslation.getTitle(),
                article.getBrief(),
                article.getCategory(),
                article.getKeywords(),
                article.getHeroImageUrl(),
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

        ContentGenerationRun run = new ContentGenerationRun();
        run.setArticleId(article.getId());
        run.setModelProvider(aiProvider.providerName());
        run.setModelId("");
        run.setModelVersion(null);
        run.setPromptTemplateId(aiProvider.resolveTemplateId(runType));
        run.setPromptHash(promptHash);
        run.setOutputValidated(false);
        run.setMode(aiProvider.mode());
        run.setStatus(ContentConstants.RUN_STATUS_PENDING);
        run.setTriggeredByUserId(actorUserId);
        ContentGenerationRun saved = runRepo.save(run);

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

    // ================================================================
    // applyBilingual
    // ================================================================

    /**
     * Endpoint atomico apply-bilingual (ADR-025).
     *
     * Metodo @Transactional global. Flujo:
     *  1. Pre-check articulo y run.
     *  2. Upload output_raw.md a S3 (auditoria, siempre).
     *  3. Validate JSON via adapter (schema 2.0).
     *  4. Fail path: upload validation_errors.json + UPDATE run REJECTED +
     *     return result con runDetail.status=REJECTED. La tx commitea normal.
     *  5. Pass path: upload bodies ES + EN + output_validated.json + UPSERT
     *     translations + UPDATE article + UPDATE run VALIDATED + INSERT event.
     *
     * Side-effects S3 viven dentro de la tx logica pero S3 no participa en
     * la BD-tx. Si el commit BD falla al final, S3 quedan como huerfanos
     * (deuda heredada de ADR-024, mitigada por idempotencia de overwrite en
     * re-paste del operador).
     *
     * Caso edge: si upload raw S3 falla (S3 caido), se propaga 502 y el run
     * queda en PENDING. El operador reintenta cuando S3 vuelve.
     */
    @Transactional
    public ApplyBilingualResultDTO applyBilingual(Long articleId,
                                                  Long runId,
                                                  String rawJson,
                                                  String modelId,
                                                  String modelVersion,
                                                  Long actorUserId,
                                                  boolean isAdmin) {
        if (articleId == null || runId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "articleId y runId requeridos");
        }
        if (rawJson == null || rawJson.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "rawJson requerido");
        }
        byte[] rawBytes = rawJson.getBytes(StandardCharsets.UTF_8);
        if (rawBytes.length > RAW_OUTPUT_MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "rawJson excede " + RAW_OUTPUT_MAX_BYTES + " bytes");
        }
        String modelIdNorm = modelId == null ? "" : modelId.trim();
        if (modelIdNorm.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "modelId requerido (declara el modelo Claude usado)");
        }
        if (!aiProvider.isModelAllowed(modelIdNorm)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "modelId no aceptado por el adaptador: " + modelIdNorm);
        }

        // 1. Pre-check.
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
        ContentArticle article = articleService.requireEditable(articleId, isAdmin);
        String runType = extractRunTypeFromTemplateId(run.getPromptTemplateId());
        String modelVersionNorm = (modelVersion == null || modelVersion.isBlank())
                ? null : modelVersion.trim();

        // 2. Upload raw a S3.
        String outputRawKey;
        try {
            outputRawKey = bodyStorageService.uploadRunOutputRaw(runId, rawBytes);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo subir output crudo a S3 (run queda en PENDING para reintento)", ex);
        }
        String outputHash = sha256Hex(rawBytes);

        // 3. Validate.
        ContentAIProvider.OutputValidationResult validation =
                aiProvider.validateOutput(runType, rawJson);

        // 4. Fail path.
        if (!validation.valid()) {
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
                log.warn("{} no se pudo subir validation_errors.json runId={}: {}",
                        ContentConstants.LOG_PREFIX, runId, ex.getMessage());
            }
            run.setStatus(ContentConstants.RUN_STATUS_REJECTED);
            run.setOutputValidated(false);
            run.setOutputS3Key(outputRawKey);
            run.setOutputHash(outputHash);
            run.setModelId(modelIdNorm);
            run.setModelVersion(modelVersionNorm);
            ContentGenerationRun savedRun = runRepo.save(run);
            log.info("{} apply-bilingual REJECTED runId={} articleId={} errorCount={}",
                    ContentConstants.LOG_PREFIX, runId, articleId, validation.errors().size());
            return new ApplyBilingualResultDTO(
                    toDetail(savedRun, runType, null, validation.errors()),
                    null);
        }

        // 5. Pass path: parse canonical.
        JsonNode root;
        try {
            root = objectMapper.readTree(validation.canonicalJson());
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "JSON canonico no parseable tras validacion: " + ex.getMessage());
        }
        JsonNode shared = root.get("shared");
        JsonNode locales = root.get("locales");
        JsonNode es = locales.get(ContentConstants.LOCALE_ES);
        JsonNode en = locales.get(ContentConstants.LOCALE_EN);
        String esDraft = es.get("draft_markdown").asText();
        String enDraft = en.get("draft_markdown").asText();

        // 5a. Upload bodies ES + EN.
        ContentBodyStorageService.Result esBody =
                articleService.uploadTranslationDraftBody(articleId, ContentConstants.LOCALE_ES, esDraft);
        ContentBodyStorageService.Result enBody =
                articleService.uploadTranslationDraftBody(articleId, ContentConstants.LOCALE_EN, enDraft);

        // 5b. Upload output_validated.json.
        try {
            bodyStorageService.uploadRunOutputValidated(runId,
                    validation.canonicalJson().getBytes(StandardCharsets.UTF_8));
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo subir output_validated.json a S3", ex);
        }

        // 6. UPSERT translation ES (existe por createArticle).
        ContentArticleTranslation esTr = articleService.requireTranslation(articleId, ContentConstants.LOCALE_ES);
        applyTranslationFromJson(esTr, es, ContentConstants.LOCALE_ES, esBody, /*allowSlugAssign=*/false);
        articleService.saveTranslation(esTr);

        // 6b. UPSERT translation EN (puede no existir).
        ContentArticleTranslation enTr = articleService.findOrCreateTranslation(articleId, ContentConstants.LOCALE_EN);
        applyTranslationFromJson(enTr, en, ContentConstants.LOCALE_EN, enBody, /*allowSlugAssign=*/true);
        articleService.saveTranslation(enTr);

        // 6c. UPDATE article (hero/category/keywords solo si BD null).
        String sharedCategory = textOrNull(shared, "category");
        String sharedHero = textOrNull(shared, "hero_image_url");
        JsonNode sharedKeywords = shared.get("keywords");
        if (sharedHero != null && (article.getHeroImageUrl() == null || article.getHeroImageUrl().isBlank())) {
            article.setHeroImageUrl(sharedHero);
        }
        if (sharedCategory != null && (article.getCategory() == null || article.getCategory().isBlank())) {
            article.setCategory(sharedCategory);
        }
        if (sharedKeywords != null && !sharedKeywords.isNull()
                && (article.getKeywords() == null || article.getKeywords().isBlank())) {
            try {
                String kwsJson = null;
                if (sharedKeywords.isArray()) {
                    StringBuilder sb = new StringBuilder();
                    for (int i = 0; i < sharedKeywords.size(); i++) {
                        if (i > 0) sb.append(',');
                        JsonNode item = sharedKeywords.get(i);
                        if (item != null && item.isTextual()) sb.append(item.asText());
                    }
                    kwsJson = articleService.normalizeKeywordsPublic(sb.toString());
                } else if (sharedKeywords.isTextual()) {
                    kwsJson = articleService.normalizeKeywordsPublic(sharedKeywords.asText());
                }
                if (kwsJson != null) article.setKeywords(kwsJson);
            } catch (RuntimeException ignored) { /* dejamos keywords como estaba */ }
        }
        article.setAiAssisted(true);
        article.setDisclosureRequired(true);
        article.setUpdatedByUserId(actorUserId);
        ContentArticle savedArticle = articleService.saveArticle(article);

        // 6d. UPDATE run.
        run.setStatus(ContentConstants.RUN_STATUS_VALIDATED);
        run.setOutputValidated(true);
        run.setOutputS3Key(outputRawKey);
        run.setOutputHash(outputHash);
        run.setModelId(modelIdNorm);
        run.setModelVersion(modelVersionNorm);
        ContentGenerationRun savedRun = runRepo.save(run);

        // 6e. INSERT event EDIT_APPLIED.
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("target", "ai_apply");
        payload.put("run_id", runId);
        payload.put("locales", List.of(ContentConstants.LOCALE_ES, ContentConstants.LOCALE_EN));
        payload.put("model_id", modelIdNorm);
        articleService.emitEventPublic(savedArticle.getId(), null,
                ContentConstants.EVENT_EDIT_APPLIED, actorUserId, payload);

        ArticleDetailDTO detail = articleService.toDetail(savedArticle);
        RunDetailDTO runDetail = toDetail(savedRun, runType, null, List.of());
        log.info("{} apply-bilingual VALIDATED runId={} articleId={} actor={}",
                ContentConstants.LOG_PREFIX, runId, articleId, actorUserId);
        return new ApplyBilingualResultDTO(runDetail, detail);
    }

    /**
     * Aplica un nodo locales.<lang> del JSON validado a una traduccion.
     *  - allowSlugAssign=true: usa el slug del JSON (caso EN al crearse por primera vez).
     *  - allowSlugAssign=false: NO toca slug (caso ES, sovereignty del operador).
     */
    private void applyTranslationFromJson(ContentArticleTranslation tr,
                                          JsonNode loc,
                                          String locale,
                                          ContentBodyStorageService.Result bodyResult,
                                          boolean allowSlugAssign) {
        if (tr.getArticleId() != null && tr.getLocale() == null) {
            tr.setLocale(locale);
        } else if (tr.getLocale() == null) {
            tr.setLocale(locale);
        }
        if (allowSlugAssign) {
            String slug = textOrNull(loc, "slug");
            if (slug == null) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "locales." + locale + ".slug requerido para crear traduccion nueva");
            }
            // Si el slug propuesto ya existe en otra traduccion del mismo locale, 409.
            articleService.assertSlugAvailableForLocale(slug, locale, tr.getId());
            tr.setSlug(slug);
        }
        String title = textOrNull(loc, "title");
        if (title != null) tr.setTitle(title);
        tr.setSeoTitle(textOrNull(loc, "seo_title"));
        tr.setMetaDescription(textOrNull(loc, "meta_description"));
        tr.setBodyS3Key(bodyResult.s3Key());
        tr.setBodyContentHash(bodyResult.contentHash());
        JsonNode targetKeywords = loc.get("target_keywords");
        if (targetKeywords != null && !targetKeywords.isNull()) {
            try {
                tr.setTargetKeywords(objectMapper.writeValueAsString(targetKeywords));
            } catch (JsonProcessingException ex) {
                tr.setTargetKeywords(null);
            }
        }
    }

    // ================================================================
    // Lecturas (paquete 3 endpoint)
    // ================================================================

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
            log.warn("{} no se pudo recargar prompt runId={}: {}",
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
                log.warn("{} no se pudo recargar errores runId={}: {}",
                        ContentConstants.LOG_PREFIX, run.getId(), ex.getMessage());
            }
        }
        return toDetail(run, runType, prompt, errors);
    }

    // ================================================================
    // Helpers
    // ================================================================

    private String normalizeRunType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "runType requerido");
        }
        String rt = raw.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_RUN_TYPES.contains(rt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "runType no soportado: " + rt + " (paquete 2 solo soporta FULL_ARTICLE_ORCHESTRATED)");
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

    private static String textOrNull(JsonNode root, String field) {
        if (root == null) return null;
        JsonNode n = root.get(field);
        if (n == null || n.isNull() || !n.isTextual()) return null;
        String v = n.asText();
        return v.isBlank() ? null : v;
    }

    private static String sha256Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(data == null ? new byte[0] : data));
        } catch (NoSuchAlgorithmException ex) {
            throw new UncheckedIOException("SHA-256 no disponible",
                    new java.io.IOException(ex));
        }
    }
}
