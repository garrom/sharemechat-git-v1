package com.sharemechat.content.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.dto.ArticleCreateRequest;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.ArticleSummaryDTO;
import com.sharemechat.content.dto.ArticleUpdateRequest;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.repository.ContentArticleRepository;
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

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Servicio CRUD de articulos editoriales para Fase 1.
 *
 * Restricciones explicitas:
 *  - solo crea, actualiza metadata y borra articulos en estado IDEA;
 *  - no cambia el state de un articulo;
 *  - no escribe versiones, runs IA ni eventos de revision;
 *  - no publica nada al exterior.
 *
 * Toda transicion de estado y workflow editorial llega en Fase 2.
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
    private static final Set<String> ALLOWED_LOCALES = Set.of(
            ContentConstants.LOCALE_ES, ContentConstants.LOCALE_EN);

    private final ContentArticleRepository articleRepo;
    private final ObjectMapper objectMapper;

    public ContentArticleService(ContentArticleRepository articleRepo, ObjectMapper objectMapper) {
        this.articleRepo = articleRepo;
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
        article.setState(ContentConstants.STATE_IDEA);
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
                                                  Long actorUserId) {
        if (articleId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId requerido");
        }
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request requerida");
        }
        ContentArticle article = articleRepo.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Articulo no encontrado"));

        if (req.getTitle() != null) {
            article.setTitle(normalizeText(req.getTitle(), TITLE_MAX, true, "title"));
        }
        if (req.getBrief() != null) {
            article.setBrief(normalizeText(req.getBrief(), BRIEF_MAX, false, "brief"));
        }
        if (req.getCategory() != null) {
            article.setCategory(normalizeText(req.getCategory(), CATEGORY_MAX, false, "category"));
        }
        if (req.getKeywords() != null) {
            article.setKeywords(normalizeKeywords(req.getKeywords()));
        }
        if (req.getResponsibleEditorUserId() != null) {
            article.setResponsibleEditorUserId(req.getResponsibleEditorUserId());
        }
        article.setUpdatedByUserId(actorUserId);

        ContentArticle saved = articleRepo.save(article);
        log.info("{} article metadata updated id={} actor={}",
                ContentConstants.LOG_PREFIX, saved.getId(), actorUserId);
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

        if (!ContentConstants.STATE_IDEA.equals(article.getState())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Solo se permite borrar articulos en estado IDEA en Fase 1");
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

    @Transactional
    public ContentArticle persistBodyReference(Long articleId,
                                               String bodyS3Key,
                                               String bodyContentHash,
                                               Long actorUserId) {
        ContentArticle article = requireExisting(articleId);
        article.setBodyS3Key(bodyS3Key);
        article.setBodyContentHash(bodyContentHash);
        article.setUpdatedByUserId(actorUserId);
        return articleRepo.save(article);
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
}
