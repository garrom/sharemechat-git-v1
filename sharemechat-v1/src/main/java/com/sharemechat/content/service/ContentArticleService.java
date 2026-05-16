package com.sharemechat.content.service;

import com.sharemechat.content.dto.ArticleCreateRequest;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.ArticleSummaryDTO;
import com.sharemechat.content.dto.ArticleUpdateRequest;
import com.sharemechat.content.dto.ReviewEventDTO;
import com.sharemechat.content.dto.TransitionRequest;
import com.sharemechat.content.dto.VersionDTO;
import com.sharemechat.content.entity.ContentArticle;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Servicio CRUD + workflow editorial de articulos.
 *
 * --------------------------------------------------------------------
 * PAQUETE 1 (ADR-025): NEUTRALIZADO.
 *
 * El rediseño bilingue ES+EN cambia la forma del modelo de datos:
 * los campos linguisticos (slug, locale, title, body) se mueven a
 * la tabla satelite content_article_translations. Las firmas de los
 * metodos publicos se mantienen para que el resto del modulo compile
 * durante la ventana entre paquete 1 y paquete 2; los cuerpos lanzan
 * UnsupportedOperationException.
 *
 * Reescritura completa con la nueva logica (creacion + transiciones
 * + apply IA + creacion bilingue) entrara en paquete 2.
 * --------------------------------------------------------------------
 */
@Service
public class ContentArticleService {

    private static final String MSG =
            "Pendiente paquete 2 — rediseño CMS bilingüe (ADR-025)";

    public ArticleDetailDTO createArticle(ArticleCreateRequest req, Long actorUserId) {
        throw new UnsupportedOperationException(MSG);
    }

    public ArticleDetailDTO updateArticleMetadata(Long articleId,
                                                  ArticleUpdateRequest req,
                                                  Long actorUserId,
                                                  boolean isAdmin) {
        throw new UnsupportedOperationException(MSG);
    }

    public void deleteArticleIfDraft(Long articleId, Long actorUserId) {
        throw new UnsupportedOperationException(MSG);
    }

    public ArticleDetailDTO findById(Long articleId) {
        throw new UnsupportedOperationException(MSG);
    }

    public Page<ArticleSummaryDTO> listPaginated(String state, String locale, String category,
                                                 int page, int size) {
        throw new UnsupportedOperationException(MSG);
    }

    public ContentArticle requireExisting(Long articleId) {
        throw new UnsupportedOperationException(MSG);
    }

    public ContentArticle requireEditable(Long articleId, boolean isAdmin) {
        throw new UnsupportedOperationException(MSG);
    }

    public ContentArticle persistBodyReference(Long articleId,
                                               String bodyS3Key,
                                               String bodyContentHash,
                                               int byteSize,
                                               Long actorUserId,
                                               boolean isAdmin) {
        throw new UnsupportedOperationException(MSG);
    }

    public ContentArticle applyAiDraftToArticle(Long articleId,
                                                String bodyS3Key,
                                                String bodyContentHash,
                                                int byteSize,
                                                Long aiRunId,
                                                String aiRunType,
                                                Long actorUserId,
                                                boolean isAdmin) {
        throw new UnsupportedOperationException(MSG);
    }

    public ArticleDetailDTO createBilingualChildArticle(Long parentArticleId,
                                                       String slugRaw,
                                                       String localeRaw,
                                                       String titleRaw,
                                                       String briefRaw,
                                                       String keywordsCsv,
                                                       String inheritedCategory,
                                                       String draftMarkdown,
                                                       Long sourceRunId,
                                                       Long actorUserId) {
        throw new UnsupportedOperationException(MSG);
    }

    public ArticleDetailDTO transitionState(Long articleId,
                                            TransitionRequest req,
                                            Long actorUserId,
                                            boolean isAdmin) {
        throw new UnsupportedOperationException(MSG);
    }

    public List<VersionDTO> listVersions(Long articleId) {
        throw new UnsupportedOperationException(MSG);
    }

    public String loadVersionBody(Long articleId, Integer versionNumber) {
        throw new UnsupportedOperationException(MSG);
    }

    public Page<ReviewEventDTO> listEvents(Long articleId, int page, int size) {
        throw new UnsupportedOperationException(MSG);
    }
}
