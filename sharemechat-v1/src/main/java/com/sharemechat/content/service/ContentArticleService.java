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
import com.sharemechat.content.dto.TranslationDetailDTO;
import com.sharemechat.content.dto.TranslationSummaryDTO;
import com.sharemechat.content.dto.TranslationVersionSummaryDTO;
import com.sharemechat.content.dto.VersionDTO;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.entity.ContentArticleTranslation;
import com.sharemechat.content.entity.ContentArticleTranslationVersion;
import com.sharemechat.content.entity.ContentArticleVersion;
import com.sharemechat.content.entity.ContentReviewEvent;
import com.sharemechat.content.repository.ContentArticleRepository;
import com.sharemechat.content.repository.ContentArticleTranslationRepository;
import com.sharemechat.content.repository.ContentArticleTranslationVersionRepository;
import com.sharemechat.content.repository.ContentArticleVersionRepository;
import com.sharemechat.content.repository.ContentReviewEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.NoSuchFileException;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Servicio CRUD + workflow editorial sobre el modelo bilingue (ADR-025).
 *
 * Articulo logico = fila en content_articles + N filas en
 * content_article_translations (una por locale). Slugs distintos por locale.
 *
 * Workflow ADR-016: DRAFT -> IN_REVIEW -> PUBLISHED -> RETRACTED.
 * SCHEDULED en CHECK BD pero inalcanzable via service.
 *
 * Invariantes para transicion DRAFT -> IN_REVIEW:
 *  - hero_image_url no vacio en content_articles
 *  - brief no vacio en content_articles
 *  - translations ES y EN ambas existen con body_s3_key + body_content_hash
 *    + seo_title + meta_description completos
 *
 * Solo POST /api/admin/content/articles esta reactivado en paquete 2. El
 * resto de endpoints sigue neutralizado con UnsupportedOperationException
 * a nivel de controller. La logica de service esta implementada para que
 * paquete 3 solo tenga que reactivar endpoints.
 */
@Service
public class ContentArticleService {

    private static final Logger log = LoggerFactory.getLogger(ContentArticleService.class);

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final int SLUG_MAX = 160;
    private static final int TITLE_MAX = 255;
    private static final int SEO_TITLE_MAX = 60;
    private static final int META_DESCRIPTION_MAX = 160;
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

    /** Locales obligatorios para que un articulo pase DRAFT -> IN_REVIEW. */
    private static final Set<String> MANDATORY_LOCALES_FOR_REVIEW = Set.of(
            ContentConstants.LOCALE_ES, ContentConstants.LOCALE_EN);

    private static final Set<String> EDITABLE_STATES = Set.of(
            ContentConstants.STATE_DRAFT);

    private static final Set<String> TERMINAL_STATES = Set.of(
            ContentConstants.STATE_PUBLISHED,
            ContentConstants.STATE_RETRACTED);

    private static final Set<String> REACHABLE_STATES = Set.of(
            ContentConstants.STATE_DRAFT,
            ContentConstants.STATE_IN_REVIEW,
            ContentConstants.STATE_PUBLISHED,
            ContentConstants.STATE_RETRACTED);

    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
            ContentConstants.STATE_DRAFT,
                Set.of(ContentConstants.STATE_IN_REVIEW),
            ContentConstants.STATE_IN_REVIEW,
                Set.of(ContentConstants.STATE_DRAFT, ContentConstants.STATE_PUBLISHED),
            ContentConstants.STATE_PUBLISHED,
                Set.of(ContentConstants.STATE_RETRACTED));

    private final ContentArticleRepository articleRepo;
    private final ContentArticleTranslationRepository translationRepo;
    private final ContentArticleVersionRepository versionRepo;
    private final ContentArticleTranslationVersionRepository translationVersionRepo;
    private final ContentReviewEventRepository eventRepo;
    private final ContentBodyStorageService bodyStorageService;
    private final ObjectMapper objectMapper;

    public ContentArticleService(ContentArticleRepository articleRepo,
                                 ContentArticleTranslationRepository translationRepo,
                                 ContentArticleVersionRepository versionRepo,
                                 ContentArticleTranslationVersionRepository translationVersionRepo,
                                 ContentReviewEventRepository eventRepo,
                                 ContentBodyStorageService bodyStorageService,
                                 ObjectMapper objectMapper) {
        this.articleRepo = articleRepo;
        this.translationRepo = translationRepo;
        this.versionRepo = versionRepo;
        this.translationVersionRepo = translationVersionRepo;
        this.eventRepo = eventRepo;
        this.bodyStorageService = bodyStorageService;
        this.objectMapper = objectMapper;
    }

    // ================================================================
    // CRUD articulo + traduccion ES inicial
    // ================================================================

    @Transactional
    public ArticleDetailDTO createArticle(ArticleCreateRequest req, Long actorUserId) {
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request requerida");
        }
        if (actorUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Actor no resuelto");
        }

        // Locale obligatorio ES en creacion (modelo nuevo: EN siempre viene del pipeline IA)
        String locale = normalizeLocale(req.getLocale());
        if (!ContentConstants.LOCALE_ES.equals(locale)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "createArticle solo acepta locale='es'. Locale EN llega via pipeline IA bilingue.");
        }

        String slug = normalizeSlug(req.getSlug());
        String title = normalizeText(req.getTitle(), TITLE_MAX, true, "title");
        String brief = normalizeText(req.getBrief(), BRIEF_MAX, false, "brief");
        String category = normalizeText(req.getCategory(), CATEGORY_MAX, false, "category");
        String keywords = normalizeKeywords(req.getKeywords());
        String heroImageUrl = normalizeHeroImageUrl(req.getHeroImageUrl());

        // UNIQUE (slug, locale)
        if (translationRepo.existsBySlugAndLocale(slug, locale)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya existe una traduccion con slug='" + slug + "' locale='" + locale + "'");
        }

        ContentArticle article = new ContentArticle();
        article.setHeroImageUrl(heroImageUrl);
        article.setCategory(category);
        article.setKeywords(keywords);
        article.setBrief(brief);
        article.setState(ContentConstants.STATE_DRAFT);
        article.setAiAssisted(false);
        article.setDisclosureRequired(false);
        article.setResponsibleEditorUserId(req.getResponsibleEditorUserId());
        article.setCreatedByUserId(actorUserId);
        article.setUpdatedByUserId(actorUserId);
        ContentArticle savedArticle = articleRepo.save(article);

        ContentArticleTranslation tr = new ContentArticleTranslation();
        tr.setArticleId(savedArticle.getId());
        tr.setLocale(locale);
        tr.setSlug(slug);
        tr.setTitle(title);
        translationRepo.save(tr);

        log.info("{} article created id={} slug_es={} actor={}",
                ContentConstants.LOG_PREFIX, savedArticle.getId(), slug, actorUserId);

        return toDetail(savedArticle);
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
        if (req.getHeroImageUrl() != null) {
            article.setHeroImageUrl(normalizeHeroImageUrl(req.getHeroImageUrl()));
            changedFields.add("heroImageUrl");
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
            emitEvent(saved.getId(), null, ContentConstants.EVENT_EDIT_APPLIED, actorUserId, payload);
        }

        log.info("{} metadata updated articleId={} actor={} fields={}",
                ContentConstants.LOG_PREFIX, saved.getId(), actorUserId, changedFields);
        return toDetail(saved);
    }

    /**
     * Actualiza el body de UNA traduccion (uso desde endpoint PUT body por
     * locale, paquete 3) o como helper interno. Idempotente.
     */
    @Transactional
    public ArticleDetailDTO updateTranslationBody(Long articleId,
                                                  String localeRaw,
                                                  byte[] markdownBytes,
                                                  Long actorUserId,
                                                  boolean isAdmin) {
        ContentArticle article = requireExisting(articleId);
        assertEditable(article, isAdmin);
        String locale = normalizeLocale(localeRaw);

        ContentArticleTranslation tr = translationRepo
                .findByArticleIdAndLocale(article.getId(), locale)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Traduccion " + locale + " no encontrada para articleId=" + article.getId()));

        ContentBodyStorageService.Result uploaded;
        try {
            uploaded = bodyStorageService.uploadDraftBody(article.getId(), locale, markdownBytes);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo subir cuerpo a S3", ex);
        }
        tr.setBodyS3Key(uploaded.s3Key());
        tr.setBodyContentHash(uploaded.contentHash());
        translationRepo.save(tr);

        article.setUpdatedByUserId(actorUserId);
        articleRepo.save(article);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("target", "translation_body");
        payload.put("locale", locale);
        payload.put("bytes", uploaded.byteSize());
        emitEvent(article.getId(), null, ContentConstants.EVENT_EDIT_APPLIED, actorUserId, payload);

        log.info("{} translation body updated articleId={} locale={} bytes={} actor={}",
                ContentConstants.LOG_PREFIX, article.getId(), locale, uploaded.byteSize(), actorUserId);
        return toDetail(article);
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
        articleRepo.delete(article); // FK CASCADE limpia translations, versions, runs, events
        log.info("{} article deleted articleId={} actor={}",
                ContentConstants.LOG_PREFIX, articleId, actorUserId);
    }

    @Transactional(readOnly = true)
    public ArticleDetailDTO findById(Long articleId) {
        ContentArticle article = requireExisting(articleId);
        return toDetail(article);
    }

    @Transactional(readOnly = true)
    public Page<ArticleSummaryDTO> listPaginated(String state, String category,
                                                 int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "updatedAt"));

        Page<ContentArticle> articles;
        String normalizedState = blankToNull(state);
        String normalizedCategory = blankToNull(category);
        if (normalizedState == null && normalizedCategory == null) {
            articles = articleRepo.findAll(pageable);
        } else if (normalizedState != null && normalizedCategory == null) {
            articles = articleRepo.findByState(normalizedState, pageable);
        } else if (normalizedState == null) {
            articles = articleRepo.findByCategory(normalizedCategory, pageable);
        } else {
            articles = articleRepo.findByStateAndCategory(normalizedState, normalizedCategory, pageable);
        }

        if (articles.isEmpty()) {
            return new PageImpl<>(Collections.emptyList(), pageable, articles.getTotalElements());
        }

        List<Long> ids = articles.getContent().stream().map(ContentArticle::getId).toList();
        List<ContentArticleTranslation> allTrans = translationRepo.findByArticleIdIn(ids);
        Map<Long, List<ContentArticleTranslation>> byArticle = new LinkedHashMap<>();
        for (ContentArticleTranslation t : allTrans) {
            byArticle.computeIfAbsent(t.getArticleId(), k -> new java.util.ArrayList<>()).add(t);
        }

        return articles.map(a -> toSummary(a, byArticle.getOrDefault(a.getId(), Collections.emptyList())));
    }

    public ContentArticle requireExisting(Long articleId) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        return articleRepo.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));
    }

    public ContentArticle requireEditable(Long articleId, boolean isAdmin) {
        ContentArticle article = requireExisting(articleId);
        assertEditable(article, isAdmin);
        return article;
    }

    private void assertEditable(ContentArticle article, boolean isAdmin) {
        if (TERMINAL_STATES.contains(article.getState())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Articulo en estado terminal " + article.getState()
                            + "; no se admite edicion. Para modificarlo, reabrelo primero.");
        }
        if (isAdmin) return;
        if (!EDITABLE_STATES.contains(article.getState())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede editar en estado " + article.getState()
                            + ". Devuelve a borrador antes de modificar.");
        }
    }

    // ================================================================
    // Workflow editorial
    // ================================================================

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

        if (ContentConstants.STATE_DRAFT.equals(fromState)
                && ContentConstants.STATE_IN_REVIEW.equals(toState)) {
            assertReadyForReview(article);
            Long newVersionId = createVersionFromDraft(article, actorUserId);
            article.setCurrentVersionId(newVersionId);
            // sin event; el rastro es la fila en versions
        } else if (ContentConstants.STATE_IN_REVIEW.equals(fromState)
                && ContentConstants.STATE_DRAFT.equals(toState)) {
            eventType = ContentConstants.EVENT_DRAFT_REQUESTED;
            payload.put("from", fromState);
            if (reason != null) payload.put("reason", reason);
        } else if (ContentConstants.STATE_IN_REVIEW.equals(fromState)
                && ContentConstants.STATE_PUBLISHED.equals(toState)) {
            article.setPublishedAt(java.time.Instant.now());
            eventType = ContentConstants.EVENT_PUBLISHED;
            eventVersionId = article.getCurrentVersionId();
            if (comment != null) payload.put("comment", comment);
        } else if (ContentConstants.STATE_PUBLISHED.equals(fromState)
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

    private void assertReadyForReview(ContentArticle article) {
        if (article.getHeroImageUrl() == null || article.getHeroImageUrl().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Pendiente para revision: hero_image_url");
        }
        if (article.getBrief() == null || article.getBrief().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Pendiente para revision: brief");
        }
        List<ContentArticleTranslation> translations =
                translationRepo.findByArticleId(article.getId());
        Map<String, ContentArticleTranslation> byLocale = new LinkedHashMap<>();
        for (ContentArticleTranslation t : translations) {
            byLocale.put(t.getLocale(), t);
        }
        for (String required : MANDATORY_LOCALES_FOR_REVIEW) {
            ContentArticleTranslation t = byLocale.get(required);
            if (t == null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Pendiente para revision: traduccion " + required + " no existe");
            }
            if (t.getBodyS3Key() == null || t.getBodyS3Key().isBlank()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Pendiente para revision: locales." + required + ".body_s3_key");
            }
            if (t.getSeoTitle() == null || t.getSeoTitle().isBlank()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Pendiente para revision: locales." + required + ".seo_title");
            }
            if (t.getMetaDescription() == null || t.getMetaDescription().isBlank()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Pendiente para revision: locales." + required + ".meta_description");
            }
        }
    }

    /**
     * Crea una nueva fila en content_article_versions + filas
     * content_article_translation_versions (una por locale presente). Copia
     * draft.md -> v{n}.md por cada locale en S3.
     */
    private Long createVersionFromDraft(ContentArticle article, Long actorUserId) {
        Integer maxNumber = versionRepo.findMaxVersionNumber(article.getId());
        int nextNumber = (maxNumber == null ? 0 : maxNumber) + 1;

        ContentArticleVersion version = new ContentArticleVersion();
        version.setArticleId(article.getId());
        version.setVersionNumber(nextNumber);
        version.setCreatedByUserId(actorUserId);
        ContentArticleVersion savedVersion = versionRepo.save(version);

        List<ContentArticleTranslation> translations =
                translationRepo.findByArticleId(article.getId());
        for (ContentArticleTranslation t : translations) {
            ContentBodyStorageService.Result copy;
            try {
                copy = bodyStorageService.copyDraftToVersion(
                        article.getId(), t.getLocale(), nextNumber);
            } catch (NoSuchFileException ex) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "No hay draft.md en S3 para locale=" + t.getLocale());
            } catch (IOException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "No se pudo crear version en S3 para locale=" + t.getLocale(), ex);
            }
            ContentArticleTranslationVersion tv = new ContentArticleTranslationVersion();
            tv.setVersionId(savedVersion.getId());
            tv.setLocale(t.getLocale());
            tv.setBodyS3Key(copy.s3Key());
            tv.setBodyContentHash(copy.contentHash());
            tv.setSlug(t.getSlug());
            tv.setTitle(t.getTitle());
            tv.setSeoTitle(t.getSeoTitle());
            tv.setMetaDescription(t.getMetaDescription());
            translationVersionRepo.save(tv);
        }
        return savedVersion.getId();
    }

    // ================================================================
    // Listados de versiones / eventos
    // ================================================================

    @Transactional(readOnly = true)
    public List<VersionDTO> listVersions(Long articleId) {
        requireExisting(articleId);
        List<ContentArticleVersion> versions =
                versionRepo.findByArticleIdOrderByVersionNumberDesc(articleId);
        if (versions.isEmpty()) return List.of();

        List<Long> versionIds = versions.stream().map(ContentArticleVersion::getId).toList();
        Map<Long, List<ContentArticleTranslationVersion>> tvByVersion = new LinkedHashMap<>();
        for (Long vid : versionIds) {
            List<ContentArticleTranslationVersion> tvs = translationVersionRepo.findByVersionId(vid);
            tvByVersion.put(vid, tvs);
        }
        return versions.stream()
                .map(v -> toVersionDTO(v, tvByVersion.getOrDefault(v.getId(), Collections.emptyList())))
                .toList();
    }

    @Transactional(readOnly = true)
    public String loadVersionBody(Long articleId, Integer versionNumber, String localeRaw) {
        if (articleId == null || versionNumber == null || versionNumber < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "articleId y versionNumber requeridos");
        }
        String locale = normalizeLocale(localeRaw);
        versionRepo.findByArticleIdAndVersionNumber(articleId, versionNumber)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Version no encontrada"));
        try {
            return bodyStorageService.loadVersionBody(articleId, locale, versionNumber);
        } catch (NoSuchFileException ex) {
            log.warn("{} version body missing in S3 articleId={} versionNumber={} locale={}",
                    ContentConstants.LOG_PREFIX, articleId, versionNumber, locale);
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

    // ================================================================
    // Helpers expuestos para ContentRunService.applyBilingual
    // ================================================================

    public ContentArticleTranslation findOrCreateTranslation(Long articleId, String locale) {
        return translationRepo.findByArticleIdAndLocale(articleId, locale)
                .orElseGet(() -> {
                    ContentArticleTranslation t = new ContentArticleTranslation();
                    t.setArticleId(articleId);
                    t.setLocale(locale);
                    return t;
                });
    }

    public ContentArticleTranslation requireTranslation(Long articleId, String locale) {
        return translationRepo.findByArticleIdAndLocale(articleId, locale)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Traduccion " + locale + " no encontrada para articleId=" + articleId));
    }

    public ContentArticleTranslation saveTranslation(ContentArticleTranslation t) {
        return translationRepo.save(t);
    }

    public ContentArticle saveArticle(ContentArticle a) {
        return articleRepo.save(a);
    }

    public void emitEventPublic(Long articleId,
                                Long versionId,
                                String eventType,
                                Long actorUserId,
                                Map<String, Object> payload) {
        emitEvent(articleId, versionId, eventType, actorUserId, payload);
    }

    public void assertSlugAvailableForLocale(String slug, String locale, Long currentTranslationId) {
        if (slug == null || locale == null) return;
        translationRepo.findBySlugAndLocale(slug, locale).ifPresent(existing -> {
            if (currentTranslationId == null || !existing.getId().equals(currentTranslationId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Ya existe una traduccion con slug='" + slug + "' locale='" + locale + "'");
            }
        });
    }

    // ================================================================
    // Mappers entidad -> DTO
    // ================================================================

    public ArticleDetailDTO toDetail(ContentArticle article) {
        List<ContentArticleTranslation> translations =
                translationRepo.findByArticleId(article.getId());
        List<TranslationDetailDTO> trDtos = translations.stream()
                .map(this::toTranslationDetail)
                .toList();
        return new ArticleDetailDTO(
                article.getId(),
                article.getState(),
                article.getCategory(),
                article.getKeywords(),
                article.getBrief(),
                article.getHeroImageUrl(),
                article.isAiAssisted(),
                article.isDisclosureRequired(),
                article.getPublishedAt(),
                article.getScheduledFor(),
                article.getRetractedAt(),
                article.getCurrentVersionId(),
                article.getResponsibleEditorUserId(),
                article.getCreatedByUserId(),
                article.getUpdatedByUserId(),
                article.getCreatedAt(),
                article.getUpdatedAt(),
                trDtos
        );
    }

    private TranslationDetailDTO toTranslationDetail(ContentArticleTranslation t) {
        return new TranslationDetailDTO(
                t.getId(),
                t.getLocale(),
                t.getSlug(),
                t.getTitle(),
                t.getSeoTitle(),
                t.getMetaDescription(),
                t.getBodyS3Key(),
                t.getBodyContentHash(),
                t.getTargetKeywords(),
                t.getCreatedAt(),
                t.getUpdatedAt()
        );
    }

    private ArticleSummaryDTO toSummary(ContentArticle article,
                                        List<ContentArticleTranslation> translations) {
        List<TranslationSummaryDTO> tr = translations.stream()
                .map(t -> new TranslationSummaryDTO(
                        t.getLocale(), t.getSlug(), t.getTitle(),
                        t.getBodyS3Key() != null && !t.getBodyS3Key().isBlank()))
                .toList();
        return new ArticleSummaryDTO(
                article.getId(),
                article.getState(),
                article.getCategory(),
                article.isAiAssisted(),
                article.getCreatedAt(),
                article.getUpdatedAt(),
                tr
        );
    }

    private VersionDTO toVersionDTO(ContentArticleVersion v,
                                    List<ContentArticleTranslationVersion> tvs) {
        List<TranslationVersionSummaryDTO> tvDtos = tvs.stream()
                .map(tv -> new TranslationVersionSummaryDTO(
                        tv.getLocale(), tv.getSlug(), tv.getTitle(),
                        tv.getSeoTitle(), tv.getMetaDescription(),
                        tv.getBodyS3Key(), tv.getBodyContentHash()))
                .toList();
        return new VersionDTO(
                v.getId(),
                v.getArticleId(),
                v.getVersionNumber(),
                v.getSourceRunId(),
                v.getCreatedByUserId(),
                v.getCreatedAt(),
                tvDtos
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

    // ================================================================
    // Normalizadores y helpers
    // ================================================================

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
        String locale = raw == null ? null : raw.trim().toLowerCase(Locale.ROOT);
        if (locale == null || !ALLOWED_LOCALES.contains(locale)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "locale no soportado: " + raw);
        }
        return locale;
    }

    public String normalizeLocalePublic(String raw) {
        return normalizeLocale(raw);
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

    private String normalizeHeroImageUrl(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        if (trimmed.length() > 500) {
            trimmed = trimmed.substring(0, 500);
        }
        return trimmed;
    }

    private String blankToNull(String raw) {
        if (raw == null) return null;
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }

    public String normalizeKeywordsPublic(String raw) {
        return normalizeKeywords(raw);
    }

    /**
     * Normaliza keywords a array JSON canonico o null. Acepta:
     *  - null/vacio -> null
     *  - array JSON valido -> reaplica trim+lowercase, dedupe
     *  - lista separada por comas ("a, B, C") -> ["a","b","c"]
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
                        "keywords: JSON invalido. Usa array JSON de strings o lista separada por comas.");
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

    /**
     * Helper para uploads bilingues desde ContentRunService.applyBilingual.
     * Encapsula la subida del body a S3 + actualizacion en BD de la
     * traduccion correspondiente. No emite eventos; el caller (run service)
     * emite EDIT_APPLIED con target=ai_apply al cerrar la transaccion.
     */
    public ContentBodyStorageService.Result uploadTranslationDraftBody(Long articleId,
                                                                       String locale,
                                                                       String markdown) {
        if (markdown == null) markdown = "";
        byte[] bytes = markdown.getBytes(StandardCharsets.UTF_8);
        try {
            return bodyStorageService.uploadDraftBody(articleId, locale, bytes);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo subir body de locale=" + locale + " a S3", ex);
        }
    }
}
