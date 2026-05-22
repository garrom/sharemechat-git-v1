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
import com.sharemechat.content.dto.TranslationMetadataUpdateRequest;
import com.sharemechat.content.dto.TranslationSummaryDTO;
import com.sharemechat.content.dto.TranslationVersionSummaryDTO;
import com.sharemechat.content.dto.VersionDTO;
import com.sharemechat.content.publishing.ArticleAlternateDTO;
import com.sharemechat.content.publishing.ArticlePublicDetailDTO;
import com.sharemechat.content.publishing.ArticlePublicSummaryDTO;
import com.sharemechat.content.publishing.MarkdownRendererService;
import com.sharemechat.config.PublicSiteProperties;
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
    private final MarkdownRendererService markdownRenderer;
    private final PublicSiteProperties publicSiteProperties;
    private final ObjectMapper objectMapper;

    public ContentArticleService(ContentArticleRepository articleRepo,
                                 ContentArticleTranslationRepository translationRepo,
                                 ContentArticleVersionRepository versionRepo,
                                 ContentArticleTranslationVersionRepository translationVersionRepo,
                                 ContentReviewEventRepository eventRepo,
                                 ContentBodyStorageService bodyStorageService,
                                 MarkdownRendererService markdownRenderer,
                                 PublicSiteProperties publicSiteProperties,
                                 ObjectMapper objectMapper) {
        this.articleRepo = articleRepo;
        this.translationRepo = translationRepo;
        this.versionRepo = versionRepo;
        this.translationVersionRepo = translationVersionRepo;
        this.eventRepo = eventRepo;
        this.bodyStorageService = bodyStorageService;
        this.markdownRenderer = markdownRenderer;
        this.publicSiteProperties = publicSiteProperties;
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
     * Actualiza el body de UNA traduccion. Semantica idempotente:
     * crea la traduccion si no existe todavia (caso: PUT body EN antes de
     * haber pasado por apply-bilingual). En ese caso la translation nace
     * con slug y title placeholder vacios (a llenar por apply-bilingual
     * o por endpoint dedicado en paquete 6).
     *
     * NOTA: si la translation no existia y se crea aqui, slug y title
     * quedan vacios. La transicion DRAFT -> IN_REVIEW exigira que esos
     * campos esten poblados (junto con seo_title y meta_description),
     * por lo que el operador deberia complementar la creacion via
     * apply-bilingual o ediciones posteriores antes de mandar a revision.
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
                .orElseGet(() -> {
                    ContentArticleTranslation fresh = new ContentArticleTranslation();
                    fresh.setArticleId(article.getId());
                    fresh.setLocale(locale);
                    // slug y title quedan null; se rellenan al hacer
                    // apply-bilingual o edicion explicita futura. La
                    // transicion a IN_REVIEW los exige; mientras sea DRAFT,
                    // pueden quedar vacios.
                    return fresh;
                });

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

    /**
     * Actualiza campos linguisticos per-locale de una traduccion existente
     * (paquete 6.5, ADR-025). Complementa al apply-bilingual: permite
     * correcciones manuales finas de title, slug, seo_title, meta_description
     * sin tener que re-ejecutar el pipeline IA.
     *
     * Semantica de campos:
     *  - null o ausente -> no se modifica.
     *  - string vacio "" -> 400 (para borrar un campo no se usa "").
     *
     * Validaciones:
     *  - title: trim, max TITLE_MAX (255).
     *  - slug: formato kebab-case, max SLUG_MAX (160), unico dentro del locale.
     *  - seoTitle: trim, max SEO_TITLE_MAX (60).
     *  - metaDescription: trim, max META_DESCRIPTION_MAX (160).
     *
     * NO crea translations. Si no existe la translation (articleId, locale)
     * lanza 404; el operador debe poblarla primero via apply-bilingual (caso
     * EN) o estaba ya creada al crear el articulo (caso ES).
     */
    @Transactional
    public TranslationDetailDTO updateTranslationMetadata(Long articleId,
                                                          String localeRaw,
                                                          TranslationMetadataUpdateRequest req,
                                                          Long actorUserId,
                                                          boolean isAdmin) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request requerida");
        }
        if (actorUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Actor no resuelto");
        }

        ContentArticle article = requireExisting(articleId);
        assertEditable(article, isAdmin);
        String locale = normalizeLocale(localeRaw);

        ContentArticleTranslation tr = translationRepo
                .findByArticleIdAndLocale(article.getId(), locale)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Traduccion " + locale + " no encontrada para articleId=" + articleId));

        List<String> changedFields = new java.util.ArrayList<>();

        // title: opcional, "" -> 400 explicito, normalizeText con required=false
        // ya rechaza la cadena vacia? Comprobamos manualmente: normalizeText con
        // required=false devuelve null para "" trimeado. Pero queremos un 400
        // explicito para distinguir "no enviado" (null) de "enviado vacio" ("").
        if (req.getTitle() != null) {
            if (req.getTitle().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "title no puede ser vacio; omite el campo para no modificarlo");
            }
            String normalizedTitle = normalizeText(req.getTitle(), TITLE_MAX, true, "title");
            if (!java.util.Objects.equals(normalizedTitle, tr.getTitle())) {
                tr.setTitle(normalizedTitle);
                changedFields.add("title");
            }
        }

        if (req.getSlug() != null) {
            if (req.getSlug().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "slug no puede ser vacio; omite el campo para no modificarlo");
            }
            String normalizedSlug = normalizeSlug(req.getSlug());
            if (!java.util.Objects.equals(normalizedSlug, tr.getSlug())) {
                // Unicidad dentro del locale, excluyendo la translation actual.
                assertSlugAvailableForLocale(normalizedSlug, locale, tr.getId());
                tr.setSlug(normalizedSlug);
                changedFields.add("slug");
            }
        }

        if (req.getSeoTitle() != null) {
            if (req.getSeoTitle().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "seoTitle no puede ser vacio; omite el campo para no modificarlo");
            }
            String normalizedSeoTitle = normalizeText(req.getSeoTitle(), SEO_TITLE_MAX, true, "seoTitle");
            if (!java.util.Objects.equals(normalizedSeoTitle, tr.getSeoTitle())) {
                tr.setSeoTitle(normalizedSeoTitle);
                changedFields.add("seoTitle");
            }
        }

        if (req.getMetaDescription() != null) {
            if (req.getMetaDescription().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "metaDescription no puede ser vacio; omite el campo para no modificarlo");
            }
            String normalizedMeta = normalizeText(req.getMetaDescription(),
                    META_DESCRIPTION_MAX, true, "metaDescription");
            if (!java.util.Objects.equals(normalizedMeta, tr.getMetaDescription())) {
                tr.setMetaDescription(normalizedMeta);
                changedFields.add("metaDescription");
            }
        }

        // Persistir solo si hubo cambio efectivo. Si la request llego sin
        // campos a modificar (todos null) o todos coincidian con el valor
        // actual, devolvemos el estado sin emitir evento ni updated_at nuevo.
        ContentArticleTranslation savedTr = tr;
        if (!changedFields.isEmpty()) {
            savedTr = translationRepo.save(tr);
            article.setUpdatedByUserId(actorUserId);
            articleRepo.save(article);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("target", "translation_metadata");
            payload.put("locale", locale);
            payload.put("fields", changedFields);
            emitEvent(article.getId(), null, ContentConstants.EVENT_EDIT_APPLIED, actorUserId, payload);

            log.info("{} translation metadata updated articleId={} locale={} actor={} fields={}",
                    ContentConstants.LOG_PREFIX, article.getId(), locale, actorUserId, changedFields);
        }

        return toTranslationDetail(savedTr);
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

    // ================================================================
    // Lecturas publicas (paquete 5 — capa publica del blog)
    // ================================================================

    /**
     * Listado publico paginado de articulos PUBLISHED para un locale dado.
     *
     * Devuelve solo articulos cuyo `state = PUBLISHED` Y tengan una traduccion
     * con `locale = ?` Y `body_s3_key` no nulo (descarta articulos publicados
     * que no tengan body en ese locale; coherencia con la invariante "ambos
     * locales obligatorios para publicar" del paquete 2).
     *
     * Sin filtro por category aplica solo a artículos PUBLISHED.
     */
    @Transactional(readOnly = true)
    public Page<ArticlePublicSummaryDTO> listPublicByLocale(String localeRaw,
                                                            String category,
                                                            int page,
                                                            int size) {
        String locale = normalizeLocale(localeRaw);
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 50));
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "publishedAt"));

        Page<ContentArticle> articles;
        String normalizedCategory = blankToNull(category);
        if (normalizedCategory == null) {
            articles = articleRepo.findByState(ContentConstants.STATE_PUBLISHED, pageable);
        } else {
            articles = articleRepo.findByStateAndCategory(
                    ContentConstants.STATE_PUBLISHED, normalizedCategory, pageable);
        }

        if (articles.isEmpty()) {
            return new PageImpl<>(Collections.emptyList(), pageable, articles.getTotalElements());
        }

        // Bulk-load translations del locale solicitado para los articulos de la pagina.
        List<Long> ids = articles.getContent().stream().map(ContentArticle::getId).toList();
        List<ContentArticleTranslation> allTrans = translationRepo.findByArticleIdIn(ids);
        Map<Long, ContentArticleTranslation> trByArticle = new LinkedHashMap<>();
        for (ContentArticleTranslation t : allTrans) {
            if (locale.equals(t.getLocale())) {
                trByArticle.put(t.getArticleId(), t);
            }
        }

        // Mapear, descartando los articulos sin traduccion publicada en este locale
        // (no tiene sentido devolverlos al frontend publico).
        List<ArticlePublicSummaryDTO> items = articles.getContent().stream()
                .map(a -> {
                    ContentArticleTranslation t = trByArticle.get(a.getId());
                    if (t == null || t.getBodyS3Key() == null || t.getBodyS3Key().isBlank()) {
                        return null;
                    }
                    return new ArticlePublicSummaryDTO(
                            a.getId(),
                            t.getSlug(),
                            t.getLocale(),
                            t.getTitle(),
                            a.getBrief(),
                            a.getCategory(),
                            a.getKeywords(),
                            a.getPublishedAt(),
                            a.getHeroImageUrl(),
                            a.isAiAssisted(),
                            a.isDisclosureRequired()
                    );
                })
                .filter(java.util.Objects::nonNull)
                .toList();

        return new PageImpl<>(items, pageable, articles.getTotalElements());
    }

    /**
     * Detalle publico de un articulo identificado por (slug, locale).
     *
     * Reglas:
     *  - La traduccion (slug, locale) debe existir; si no -> 404.
     *  - El articulo logico debe estar en PUBLISHED; si no -> 404 (no se
     *    filtra al publico el estado real de un DRAFT o RETRACTED).
     *  - El body de esa traduccion se carga de S3, se renderiza Markdown->HTML
     *    sanitizado y se devuelve en `htmlBody`. Si S3 no tiene el fichero,
     *    htmlBody queda "".
     *  - Alternates: por cada OTRA traduccion del mismo articulo que tambien
     *    este publicada (body presente), se incluye su (locale, slug, url
     *    absoluta `{base}/blog/{locale}/{slug}`).
     */
    @Transactional(readOnly = true)
    public ArticlePublicDetailDTO findPublicBySlugAndLocale(String slugRaw, String localeRaw) {
        String locale = normalizeLocale(localeRaw);
        if (slugRaw == null || slugRaw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "slug requerido");
        }
        String slug = slugRaw.trim().toLowerCase(Locale.ROOT);

        ContentArticleTranslation tr = translationRepo.findBySlugAndLocale(slug, locale)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));

        ContentArticle article = articleRepo.findById(tr.getArticleId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));

        if (!ContentConstants.STATE_PUBLISHED.equals(article.getState())) {
            // No exponer el estado real al publico: cualquier estado distinto -> 404.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Articulo no encontrado");
        }
        if (tr.getBodyS3Key() == null || tr.getBodyS3Key().isBlank()) {
            // Translation existe pero sin body publicado en este locale.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Articulo no encontrado");
        }

        // Cargar body de S3 y renderizar a HTML sanitizado.
        String htmlBody = "";
        try {
            String md = bodyStorageService.loadBodyAsString(tr.getBodyS3Key());
            htmlBody = markdownRenderer.renderMarkdownToSafeHtml(md);
        } catch (NoSuchFileException ex) {
            log.warn("{} public detail: bodyS3Key apunta a fichero ausente articleId={} locale={} key={}",
                    ContentConstants.LOG_PREFIX, article.getId(), locale, tr.getBodyS3Key());
            htmlBody = "";
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo leer el cuerpo del articulo", ex);
        }

        // Alternates: otras translations del mismo articulo con body publicado.
        List<ContentArticleTranslation> all = translationRepo.findByArticleId(article.getId());
        String baseUrl = resolvePublicBaseUrl();
        List<ArticleAlternateDTO> alternates = all.stream()
                .filter(other -> !locale.equals(other.getLocale()))
                .filter(other -> other.getBodyS3Key() != null && !other.getBodyS3Key().isBlank())
                .map(other -> new ArticleAlternateDTO(
                        other.getLocale(),
                        other.getSlug(),
                        baseUrl + "/blog/" + other.getLocale() + "/" + other.getSlug()))
                .toList();

        return new ArticlePublicDetailDTO(
                article.getId(),
                tr.getSlug(),
                tr.getLocale(),
                tr.getTitle(),
                article.getBrief(),
                tr.getSeoTitle(),
                tr.getMetaDescription(),
                article.getCategory(),
                article.getKeywords(),
                article.getPublishedAt(),
                article.getUpdatedAt(),
                htmlBody,
                article.isAiAssisted(),
                article.isDisclosureRequired(),
                article.getHeroImageUrl(),
                alternates
        );
    }

    /**
     * Snapshot crudo del estado publicado para el SitemapController (paquete 5):
     * todos los articulos PUBLISHED + sus translations con body. El sitemap
     * itera este resultado y construye las `<url>` con `<xhtml:link>` por
     * locale alternativo.
     */
    @Transactional(readOnly = true)
    public List<PublishedArticleSnapshot> listPublishedForSitemap() {
        List<ContentArticle> published =
                articleRepo.findByStateOrderByPublishedAtDesc(ContentConstants.STATE_PUBLISHED);
        if (published.isEmpty()) return List.of();

        List<Long> ids = published.stream().map(ContentArticle::getId).toList();
        List<ContentArticleTranslation> allTrans = translationRepo.findByArticleIdIn(ids);
        Map<Long, List<ContentArticleTranslation>> trByArticle = new LinkedHashMap<>();
        for (ContentArticleTranslation t : allTrans) {
            if (t.getBodyS3Key() == null || t.getBodyS3Key().isBlank()) continue;
            trByArticle.computeIfAbsent(t.getArticleId(),
                    k -> new java.util.ArrayList<>()).add(t);
        }

        return published.stream()
                .map(a -> {
                    List<ContentArticleTranslation> trs =
                            trByArticle.getOrDefault(a.getId(), List.of());
                    if (trs.isEmpty()) return null;
                    java.time.Instant lastMod = a.getUpdatedAt() != null
                            ? a.getUpdatedAt() : a.getPublishedAt();
                    return new PublishedArticleSnapshot(a.getId(), lastMod, a.getHeroImageUrl(), trs);
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /** Tupla interna para SitemapController. */
    public record PublishedArticleSnapshot(
            Long articleId,
            java.time.Instant lastModified,
            String heroImageUrl,
            List<ContentArticleTranslation> translations
    ) {}

    private String resolvePublicBaseUrl() {
        String configured = publicSiteProperties == null ? null : publicSiteProperties.getBaseUrl();
        if (configured != null && !configured.isBlank()) return configured;
        // Paquete 10.A.5: sin fallback hardcoded. La property
        // app.public.base-url DEBE estar configurada en el entorno.
        throw new IllegalStateException(
                "app.public.base-url is not configured. Set APP_PUBLIC_BASE_URL or"
                        + " override the property in application-<env>.properties.");
    }
}
