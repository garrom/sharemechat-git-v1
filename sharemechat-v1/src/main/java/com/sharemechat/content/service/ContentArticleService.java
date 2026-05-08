package com.sharemechat.content.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.dto.ArticleCreateRequest;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.ArticleSummaryDTO;
import com.sharemechat.content.dto.ArticleUpdateRequest;
import com.sharemechat.content.dto.ReviewEventDTO;
import com.sharemechat.content.dto.TransitionRequest;
import com.sharemechat.content.dto.VersionDTO;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.entity.ContentArticleVersion;
import com.sharemechat.content.entity.ContentReviewEvent;
import com.sharemechat.content.repository.ContentArticleRepository;
import com.sharemechat.content.repository.ContentArticleVersionRepository;
import com.sharemechat.content.repository.ContentReviewEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.NoSuchFileException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Servicio CRUD + workflow editorial de articulos.
 *
 * ADR-016 (workflow simplificado): cuatro estados operables
 *   DRAFT -> IN_REVIEW -> PUBLISHED -> RETRACTED
 * Mas SCHEDULED conservado en el CHECK BD pero inalcanzable via service
 * (decision D5, diferida sin fecha).
 *
 * Reglas vigentes:
 *  - DRAFT es el unico estado editable de metadata y body.
 *  - PUBLISHED y RETRACTED son terminales: bloqueo absoluto, ADMIN no bypassa.
 *  - DRAFT -> IN_REVIEW crea version inmutable v{n}.md en S3.
 *  - IN_REVIEW -> PUBLISHED fija published_at = now(). Requiere CONTENT.PUBLISH.
 *  - PUBLISHED -> RETRACTED fija retracted_at = now(); el body S3 NO se borra
 *    (tombstone). Requiere CONTENT.PUBLISH.
 *  - IN_REVIEW -> DRAFT permite devolver a borrador si hay correcciones que
 *    aplicar antes de publicar.
 *  - Sin segregacion generador<->aprobador (operacion 1-persona, decision D2).
 */
@Service
public class ContentArticleService {

    private static final Logger log = LoggerFactory.getLogger(ContentArticleService.class);

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final int SLUG_MAX = 160;
    private static final int TITLE_MAX = 255;
    private static final int CATEGORY_MAX = 80;
    private static final int KEYWORDS_MAX = 4096;
    private static final int KEYWORD_ITEM_MAX = 80;
    private static final int KEYWORDS_MAX_ITEMS = 50;
    private static final int BRIEF_MAX = 8192;
    private static final int COMMENT_MAX = 500;
    private static final int EVENT_PAGE_SIZE_DEFAULT = 50;
    private static final int EVENT_PAGE_SIZE_MAX = 200;

    private static final Set<String> ALLOWED_LOCALES = Set.of(
            ContentConstants.LOCALE_ES, ContentConstants.LOCALE_EN);

    /**
     * Unico estado editable de metadata y body (ADR-016).
     * IN_REVIEW, PUBLISHED y RETRACTED bloquean cualquier modificacion.
     */
    private static final Set<String> EDITABLE_STATES = Set.of(
            ContentConstants.STATE_DRAFT);

    /**
     * Estados terminales: cuerpo y metadata congelados de forma absoluta.
     * Ni siquiera ADMIN puede editar aqui. Para corregir un articulo
     * RETRACTED no hay reapertura: se cierra como tombstone y se crea uno
     * nuevo si fuera necesario (decision D3 del ADR-016).
     */
    private static final Set<String> TERMINAL_STATES = Set.of(
            ContentConstants.STATE_PUBLISHED,
            ContentConstants.STATE_RETRACTED);

    /**
     * Estados alcanzables como destino de transicion (ADR-016). SCHEDULED se
     * mantiene en el CHECK BD pero NO esta aqui: cualquier intento de llegar
     * a SCHEDULED responde 409. La operativizacion futura abrira su propio ADR.
     */
    private static final Set<String> REACHABLE_STATES = Set.of(
            ContentConstants.STATE_DRAFT,
            ContentConstants.STATE_IN_REVIEW,
            ContentConstants.STATE_PUBLISHED,
            ContentConstants.STATE_RETRACTED);

    /**
     * Mapa de transiciones permitidas (ADR-016). ADMIN no salta este mapa.
     * Sin segregacion generador<->aprobador (decision D2): cualquier actor
     * con el permiso adecuado puede ejecutar cualquier transicion.
     */
    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
            ContentConstants.STATE_DRAFT,
                Set.of(ContentConstants.STATE_IN_REVIEW),
            ContentConstants.STATE_IN_REVIEW,
                Set.of(ContentConstants.STATE_DRAFT, ContentConstants.STATE_PUBLISHED),
            ContentConstants.STATE_PUBLISHED,
                Set.of(ContentConstants.STATE_RETRACTED));

    private final ContentArticleRepository articleRepo;
    private final ContentArticleVersionRepository versionRepo;
    private final ContentReviewEventRepository eventRepo;
    private final ContentBodyStorageService bodyStorageService;
    private final ObjectMapper objectMapper;

    public ContentArticleService(ContentArticleRepository articleRepo,
                                 ContentArticleVersionRepository versionRepo,
                                 ContentReviewEventRepository eventRepo,
                                 ContentBodyStorageService bodyStorageService,
                                 ObjectMapper objectMapper) {
        this.articleRepo = articleRepo;
        this.versionRepo = versionRepo;
        this.eventRepo = eventRepo;
        this.bodyStorageService = bodyStorageService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ArticleDetailDTO createArticle(ArticleCreateRequest req, Long actorUserId) {
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request requerida");
        }
        String slug = normalizeSlug(req.getSlug());
        String locale = normalizeLocale(req.getLocale());
        String title = normalizeText(req.getTitle(), TITLE_MAX, true, "title");
        String brief = normalizeText(req.getBrief(), BRIEF_MAX, false, "brief");
        String category = normalizeText(req.getCategory(), CATEGORY_MAX, false, "category");
        String keywords = normalizeKeywords(req.getKeywords());

        if (articleRepo.existsBySlugAndLocale(slug, locale)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya existe un articulo con slug='" + slug + "' locale='" + locale + "'");
        }

        ContentArticle article = new ContentArticle();
        article.setSlug(slug);
        article.setLocale(locale);
        article.setState(ContentConstants.STATE_DRAFT);
        article.setTitle(title);
        article.setBrief(brief);
        article.setCategory(category);
        article.setKeywords(keywords);
        article.setResponsibleEditorUserId(req.getResponsibleEditorUserId());
        article.setAiAssisted(false);
        article.setDisclosureRequired(false);
        article.setCreatedByUserId(actorUserId);
        article.setUpdatedByUserId(actorUserId);

        ContentArticle saved = articleRepo.save(article);
        log.info("{} article created id={} slug={} locale={} actor={}",
                ContentConstants.LOG_PREFIX, saved.getId(), saved.getSlug(),
                saved.getLocale(), actorUserId);
        return toDetail(saved);
    }

    @Transactional
    public ArticleDetailDTO updateArticleMetadata(Long articleId,
                                                  ArticleUpdateRequest req,
                                                  Long actorUserId,
                                                  boolean isAdmin) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request requerida");
        }
        ContentArticle article = articleRepo.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));

        assertEditable(article, isAdmin);

        List<String> changedFields = new java.util.ArrayList<>();
        if (req.getTitle() != null) {
            article.setTitle(normalizeText(req.getTitle(), TITLE_MAX, true, "title"));
            changedFields.add("title");
        }
        if (req.getBrief() != null) {
            article.setBrief(normalizeText(req.getBrief(), BRIEF_MAX, false, "brief"));
            changedFields.add("brief");
        }
        if (req.getCategory() != null) {
            article.setCategory(normalizeText(req.getCategory(), CATEGORY_MAX, false, "category"));
            changedFields.add("category");
        }
        if (req.getKeywords() != null) {
            article.setKeywords(normalizeKeywords(req.getKeywords()));
            changedFields.add("keywords");
        }
        if (req.getResponsibleEditorUserId() != null) {
            article.setResponsibleEditorUserId(req.getResponsibleEditorUserId());
            changedFields.add("responsibleEditorUserId");
        }
        article.setUpdatedByUserId(actorUserId);

        ContentArticle saved = articleRepo.save(article);

        if (!changedFields.isEmpty()) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("target", "metadata");
            payload.put("fields", changedFields);
            if (isAdmin && !EDITABLE_STATES.contains(saved.getState())) {
                payload.put("adminBypass", true);
            }
            emitEvent(saved.getId(), null, ContentConstants.EVENT_EDIT_APPLIED, actorUserId, payload);
        }

        log.info("{} article metadata updated id={} actor={} fields={}",
                ContentConstants.LOG_PREFIX, saved.getId(), actorUserId, changedFields);
        return toDetail(saved);
    }

    @Transactional
    public void deleteArticleIfDraft(Long articleId, Long actorUserId) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        ContentArticle article = articleRepo.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));

        if (!ContentConstants.STATE_DRAFT.equals(article.getState())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Solo se permite borrar articulos en estado DRAFT");
        }
        articleRepo.delete(article);
        log.info("{} article deleted id={} actor={}",
                ContentConstants.LOG_PREFIX, articleId, actorUserId);
    }

    @Transactional(readOnly = true)
    public ArticleDetailDTO findById(Long articleId) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        ContentArticle article = articleRepo.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));
        return toDetail(article);
    }

    @Transactional(readOnly = true)
    public Page<ArticleSummaryDTO> listPaginated(String state, String locale, String category,
                                                 int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "updatedAt"));
        String normalizedState = normalizeFilter(state);
        String normalizedLocale = normalizeFilter(locale);
        if (normalizedLocale != null) {
            normalizedLocale = normalizedLocale.toLowerCase(Locale.ROOT);
        }
        String normalizedCategory = normalizeFilter(category);

        Page<ContentArticle> articles = articleRepo.findFiltered(
                normalizedState, normalizedLocale, normalizedCategory, pageable);
        return articles.map(this::toSummary);
    }

    public ContentArticle requireExisting(Long articleId) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        return articleRepo.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));
    }

    /**
     * Como requireExisting pero ademas exige que el articulo este en estado
     * editable (IDEA, OUTLINE_READY, DRAFT_GENERATED). ADMIN bypassa el check.
     */
    public ContentArticle requireEditable(Long articleId, boolean isAdmin) {
        ContentArticle article = requireExisting(articleId);
        assertEditable(article, isAdmin);
        return article;
    }

    private void assertEditable(ContentArticle article, boolean isAdmin) {
        // Estados terminales: bloqueo absoluto, ADMIN no bypassa (Fase 4A).
        if (TERMINAL_STATES.contains(article.getState())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Articulo en estado terminal " + article.getState()
                            + "; no se admite edicion. Para modificarlo, reabrelo primero.");
        }
        if (isAdmin) return;
        if (!EDITABLE_STATES.contains(article.getState())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede editar en estado " + article.getState()
                            + ". Reabre como borrador antes de modificar.");
        }
    }

    @Transactional
    public ContentArticle persistBodyReference(Long articleId,
                                               String bodyS3Key,
                                               String bodyContentHash,
                                               int byteSize,
                                               Long actorUserId,
                                               boolean isAdmin) {
        ContentArticle article = requireExisting(articleId);
        assertEditable(article, isAdmin);
        article.setBodyS3Key(bodyS3Key);
        article.setBodyContentHash(bodyContentHash);
        article.setUpdatedByUserId(actorUserId);
        ContentArticle saved = articleRepo.save(article);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("target", "body");
        payload.put("bytes", byteSize);
        if (isAdmin && !EDITABLE_STATES.contains(saved.getState())) {
            payload.put("adminBypass", true);
        }
        emitEvent(saved.getId(), null, ContentConstants.EVENT_EDIT_APPLIED, actorUserId, payload);

        return saved;
    }

    /**
     * Fase 4A: aplica un draft generado por un run IA validado al articulo.
     * - Reusa el body ya subido a draft.md (mismo path que PUT /body manual).
     * - Asegura que el articulo NO esta en estado terminal (PUBLISHED/RETRACTED)
     *   ni en estado no editable salvo bypass ADMIN para intermedios.
     * - Marca ai_assisted=true y disclosure_required=true por defecto (ADR-010
     *   sec 6: cuando ai_assisted=true, disclosure_required=true por defecto;
     *   el editor puede revertir disclosure manualmente en una accion separada).
     * - Emite EVENT_EDIT_APPLIED con target="ai_apply" y referencia al run
     *   (run_id, run_type, applied_fields), reutilizando el evento existente
     *   en el CHECK del schema (no requiere migracion).
     * - NO cambia el estado del articulo.
     */
    @Transactional
    public ContentArticle applyAiDraftToArticle(Long articleId,
                                                String bodyS3Key,
                                                String bodyContentHash,
                                                int byteSize,
                                                Long aiRunId,
                                                String aiRunType,
                                                Long actorUserId,
                                                boolean isAdmin) {
        ContentArticle article = requireExisting(articleId);
        assertEditable(article, isAdmin);
        article.setBodyS3Key(bodyS3Key);
        article.setBodyContentHash(bodyContentHash);
        article.setAiAssisted(true);
        article.setDisclosureRequired(true);
        article.setUpdatedByUserId(actorUserId);
        ContentArticle saved = articleRepo.save(article);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("target", "ai_apply");
        payload.put("run_id", aiRunId);
        payload.put("run_type", aiRunType);
        payload.put("applied_fields",
                java.util.List.of("body", "ai_assisted", "disclosure_required"));
        payload.put("bytes", byteSize);
        if (isAdmin && !EDITABLE_STATES.contains(saved.getState())) {
            payload.put("adminBypass", true);
        }
        emitEvent(saved.getId(), null, ContentConstants.EVENT_EDIT_APPLIED, actorUserId, payload);

        log.info("{} ai draft applied articleId={} runId={} runType={} actor={} bytes={}",
                ContentConstants.LOG_PREFIX, saved.getId(), aiRunId, aiRunType,
                actorUserId, byteSize);
        return saved;
    }

    private ArticleSummaryDTO toSummary(ContentArticle a) {
        return new ArticleSummaryDTO(
                a.getId(),
                a.getSlug(),
                a.getLocale(),
                a.getState(),
                a.getTitle(),
                a.getCategory(),
                a.getResponsibleEditorUserId(),
                a.isAiAssisted(),
                a.getCreatedAt(),
                a.getUpdatedAt()
        );
    }

    private ArticleDetailDTO toDetail(ContentArticle a) {
        return new ArticleDetailDTO(
                a.getId(),
                a.getSlug(),
                a.getLocale(),
                a.getParentArticleId(),
                a.getState(),
                a.getTitle(),
                a.getBrief(),
                a.getCategory(),
                a.getKeywords(),
                a.getResponsibleEditorUserId(),
                a.getCurrentVersionId(),
                a.getBodyS3Key(),
                a.getBodyContentHash(),
                a.getPublishedAt(),
                a.getScheduledFor(),
                a.getRetractedAt(),
                a.isAiAssisted(),
                a.isDisclosureRequired(),
                a.getCreatedByUserId(),
                a.getUpdatedByUserId(),
                a.getCreatedAt(),
                a.getUpdatedAt()
        );
    }

    private String normalizeSlug(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "slug requerido");
        }
        String slug = raw.trim().toLowerCase(Locale.ROOT);
        if (slug.length() > SLUG_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "slug excede " + SLUG_MAX + " caracteres");
        }
        if (!SLUG_PATTERN.matcher(slug).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "slug invalido: solo minusculas, digitos y guiones");
        }
        return slug;
    }

    private String normalizeLocale(String raw) {
        String locale = raw == null ? ContentConstants.LOCALE_ES : raw.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_LOCALES.contains(locale)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "locale no soportado: " + locale);
        }
        return locale;
    }

    private String normalizeText(String raw, int maxLen, boolean required, String fieldName) {
        if (raw == null) {
            if (required) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " requerido");
            }
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            if (required) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " requerido");
            }
            return null;
        }
        if (trimmed.length() > maxLen) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    fieldName + " excede " + maxLen + " caracteres");
        }
        return trimmed;
    }

    private String normalizeFilter(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * Normaliza el campo keywords para guardar siempre un array JSON canonico
     * (o NULL si esta vacio). Acepta tres formatos de entrada:
     *  - cadena vacia o null  -> NULL
     *  - array JSON valido    -> reaplica trim+lowercase, dedupe y reserializa
     *  - lista separada por comas ("a, B, C") -> array JSON ["a","b","c"]
     * Cada item se trimea y pasa a minusculas. Items duplicados se descartan
     * preservando el primer orden de aparicion. Cualquier JSON invalido se
     * traduce a 400 con mensaje claro, nunca a un error SQL aguas abajo.
     */
    private String normalizeKeywords(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;
        if (trimmed.length() > KEYWORDS_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "keywords excede " + KEYWORDS_MAX + " caracteres");
        }

        List<String> rawItems;
        if (trimmed.startsWith("[")) {
            try {
                rawItems = objectMapper.readValue(trimmed, new TypeReference<List<String>>() {});
            } catch (JsonProcessingException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "keywords: JSON invalido. Usa un array JSON de strings o una lista separada por comas.");
            }
        } else {
            rawItems = Arrays.asList(trimmed.split(","));
        }

        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String item : rawItems) {
            if (item == null) continue;
            String norm = item.trim().toLowerCase(Locale.ROOT);
            if (norm.isEmpty()) continue;
            if (norm.length() > KEYWORD_ITEM_MAX) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "keyword excede " + KEYWORD_ITEM_MAX + " caracteres");
            }
            normalized.add(norm);
            if (normalized.size() > KEYWORDS_MAX_ITEMS) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "demasiadas keywords (max " + KEYWORDS_MAX_ITEMS + ")");
            }
        }

        if (normalized.isEmpty()) return null;

        try {
            return objectMapper.writeValueAsString(normalized);
        } catch (JsonProcessingException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "no se pudo serializar keywords");
        }
    }

    // ================================================================
    // Workflow editorial (ADR-016): DRAFT -> IN_REVIEW -> PUBLISHED -> RETRACTED
    // ================================================================

    /**
     * Aplica una transicion de estado, crea version cuando corresponda y
     * emite evento de revision.
     *
     * Reglas (ADR-016):
     *  - Solo transiciones del mapa ALLOWED_TRANSITIONS son permitidas;
     *    ADMIN no salta este check.
     *  - Estado destino debe estar en REACHABLE_STATES. SCHEDULED queda
     *    inalcanzable aunque siga en el CHECK de BD.
     *  - DRAFT -> IN_REVIEW: crea nueva fila en content_article_versions con
     *    snapshot inmutable v{n}.md en S3; sin evento (el rastro auditable
     *    es la propia fila de version).
     *  - IN_REVIEW -> PUBLISHED: fija published_at = now(); emite EVENT_PUBLISHED.
     *  - IN_REVIEW -> DRAFT: devolver a borrador para correcciones; emite
     *    EVENT_DRAFT_REQUESTED. Sin segregacion.
     *  - PUBLISHED -> RETRACTED: fija retracted_at = now(); emite EVENT_RETRACTED.
     *    NO toca S3 (el body queda como tombstone; D3 del ADR-016).
     *
     * El permiso CONTENT.PUBLISH para llegar a PUBLISHED o RETRACTED se valida
     * en el controller (ContentAdminController) antes de invocar este metodo.
     */
    @Transactional
    public ArticleDetailDTO transitionState(Long articleId,
                                            TransitionRequest req,
                                            Long actorUserId,
                                            boolean isAdmin) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        if (req == null || req.getToState() == null || req.getToState().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "toState requerido");
        }
        String toState = req.getToState().trim().toUpperCase(Locale.ROOT);

        if (!REACHABLE_STATES.contains(toState)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Estado " + toState + " no operativo en este momento");
        }

        ContentArticle article = articleRepo.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));
        String fromState = article.getState();

        Set<String> allowedTo = ALLOWED_TRANSITIONS.getOrDefault(fromState, Set.of());
        if (!allowedTo.contains(toState)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Transicion no permitida: " + fromState + " -> " + toState);
        }

        String comment = truncateText(req.getComment(), COMMENT_MAX);
        String reason = truncateText(req.getReason(), COMMENT_MAX);

        String eventType = null;
        Long eventVersionId = null;
        Map<String, Object> payload = new LinkedHashMap<>();

        // ----- DRAFT -> IN_REVIEW: crear nueva version en S3 -----
        if (ContentConstants.STATE_DRAFT.equals(fromState)
                && ContentConstants.STATE_IN_REVIEW.equals(toState)) {
            if (article.getBodyS3Key() == null || article.getBodyS3Key().isBlank()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "No hay borrador guardado; guarda el cuerpo antes de enviar a revision");
            }
            Long newVersionId = createVersionFromDraft(article, actorUserId);
            article.setCurrentVersionId(newVersionId);
            // sin eventType: el rastro es la fila en content_article_versions
        }
        // ----- IN_REVIEW -> DRAFT: devolver a borrador para correcciones -----
        else if (ContentConstants.STATE_IN_REVIEW.equals(fromState)
                && ContentConstants.STATE_DRAFT.equals(toState)) {
            eventType = ContentConstants.EVENT_DRAFT_REQUESTED;
            payload.put("from", fromState);
            if (reason != null) payload.put("reason", reason);
        }
        // ----- IN_REVIEW -> PUBLISHED: publicacion editorial -----
        // El blog publico lee el body desde S3 privado y lo renderiza por API.
        // No hay HTML estatico ni invalidacion CloudFront en esta fase.
        else if (ContentConstants.STATE_IN_REVIEW.equals(fromState)
                && ContentConstants.STATE_PUBLISHED.equals(toState)) {
            article.setPublishedAt(java.time.Instant.now());
            eventType = ContentConstants.EVENT_PUBLISHED;
            eventVersionId = article.getCurrentVersionId();
            if (comment != null) payload.put("comment", comment);
        }
        // ----- PUBLISHED -> RETRACTED: tombstone publico -----
        // Fija retracted_at; NO borra body S3 ni versiones. El public controller
        // devuelve 410 Gone para slugs en RETRACTED.
        else if (ContentConstants.STATE_PUBLISHED.equals(fromState)
                && ContentConstants.STATE_RETRACTED.equals(toState)) {
            article.setRetractedAt(java.time.Instant.now());
            eventType = ContentConstants.EVENT_RETRACTED;
            eventVersionId = article.getCurrentVersionId();
            if (reason != null) payload.put("reason", reason);
            if (comment != null) payload.put("comment", comment);
        }

        article.setState(toState);
        article.setUpdatedByUserId(actorUserId);
        ContentArticle saved = articleRepo.save(article);

        if (eventType != null) {
            emitEvent(saved.getId(), eventVersionId, eventType, actorUserId, payload);
        }

        log.info("{} transition articleId={} from={} to={} actor={} admin={} versionId={}",
                ContentConstants.LOG_PREFIX, saved.getId(), fromState, toState,
                actorUserId, isAdmin, eventVersionId);
        return toDetail(saved);
    }

    @Transactional(readOnly = true)
    public List<VersionDTO> listVersions(Long articleId) {
        requireExisting(articleId);
        return versionRepo.findByArticleIdOrderByVersionNumberDesc(articleId)
                .stream()
                .map(this::toVersionDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public String loadVersionBody(Long articleId, Integer versionNumber) {
        if (articleId == null || versionNumber == null || versionNumber < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "articleId y versionNumber requeridos");
        }
        // Validar que la version existe en BD antes de tocar S3
        versionRepo.findByArticleIdAndVersionNumber(articleId, versionNumber)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Version no encontrada"));
        try {
            return bodyStorageService.loadVersionBody(articleId, versionNumber);
        } catch (NoSuchFileException ex) {
            // BD tiene la fila pero S3 no; estado inconsistente, devolvemos vacio
            log.warn("{} version body missing in S3 articleId={} versionNumber={}",
                    ContentConstants.LOG_PREFIX, articleId, versionNumber);
            return "";
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo leer cuerpo de version", ex);
        }
    }

    @Transactional(readOnly = true)
    public Page<ReviewEventDTO> listEvents(Long articleId, int page, int size) {
        requireExisting(articleId);
        int safePage = Math.max(0, page);
        int safeSize = size <= 0 ? EVENT_PAGE_SIZE_DEFAULT : Math.min(size, EVENT_PAGE_SIZE_MAX);
        Pageable pageable = PageRequest.of(safePage, safeSize);
        return eventRepo.findByArticleIdOrderByIdDesc(articleId, pageable)
                .map(this::toEventDTO);
    }

    private Long createVersionFromDraft(ContentArticle article, Long actorUserId) {
        Integer maxNumber = versionRepo.findMaxVersionNumber(article.getId());
        int nextNumber = (maxNumber == null ? 0 : maxNumber) + 1;

        ContentBodyStorageService.Result copy;
        try {
            copy = bodyStorageService.copyDraftToVersion(article.getId(), nextNumber);
        } catch (NoSuchFileException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No hay borrador en S3; guarda el cuerpo antes de enviar a revision");
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo crear version en S3", ex);
        }

        ContentArticleVersion version = new ContentArticleVersion();
        version.setArticleId(article.getId());
        version.setVersionNumber(nextNumber);
        version.setBodyS3Key(copy.s3Key());
        version.setBodyContentHash(copy.contentHash());
        version.setCreatedByUserId(actorUserId);
        ContentArticleVersion saved = versionRepo.save(version);
        return saved.getId();
    }

    private void emitEvent(Long articleId,
                           Long versionId,
                           String eventType,
                           Long actorUserId,
                           Map<String, Object> payload) {
        ContentReviewEvent event = new ContentReviewEvent();
        event.setArticleId(articleId);
        event.setVersionId(versionId);
        event.setEventType(eventType);
        event.setActorUserId(actorUserId);
        event.setPayloadJson(serializePayload(payload));
        eventRepo.save(event);
    }

    private String serializePayload(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            log.warn("{} no se pudo serializar payload de evento: {}",
                    ContentConstants.LOG_PREFIX, ex.getMessage());
            return null;
        }
    }

    private String truncateText(String raw, int maxLen) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;
        if (trimmed.length() > maxLen) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "texto excede " + maxLen + " caracteres");
        }
        return trimmed;
    }

    private VersionDTO toVersionDTO(ContentArticleVersion v) {
        return new VersionDTO(
                v.getId(),
                v.getArticleId(),
                v.getVersionNumber(),
                v.getBodyS3Key(),
                v.getBodyContentHash(),
                v.getSourceRunId(),
                v.getCreatedByUserId(),
                v.getCreatedAt()
        );
    }

    private ReviewEventDTO toEventDTO(ContentReviewEvent e) {
        return new ReviewEventDTO(
                e.getId(),
                e.getArticleId(),
                e.getVersionId(),
                e.getEventType(),
                e.getActorUserId(),
                e.getPayloadJson(),
                e.getCreatedAt()
        );
    }
}
