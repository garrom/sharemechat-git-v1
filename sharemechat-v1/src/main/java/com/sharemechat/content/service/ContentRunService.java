package com.sharemechat.content.service;

import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.BilingualSubmitResultDTO;
import com.sharemechat.content.dto.RunDetailDTO;
import com.sharemechat.content.dto.RunSummaryDTO;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Orquesta el ciclo de vida de runs IA.
 *
 * --------------------------------------------------------------------
 * PAQUETE 1 (ADR-025): NEUTRALIZADO.
 *
 * El rediseno bilingue cambia tanto el modelo de datos como el contrato
 * del JSON pegado por el operador (paso de dos JSON a uno solo,
 * schema 2.0). El run service se reescribira en paquete 2-4 una vez
 * que el modelo nuevo, el prompt builder y las skills esten listos.
 *
 * Las firmas se conservan para que controllers compilen durante la
 * ventana. Cuerpos lanzan UnsupportedOperationException.
 * --------------------------------------------------------------------
 */
@Service
public class ContentRunService {

    private static final String MSG =
            "Pendiente paquete 2 — rediseño CMS bilingüe (ADR-025)";

    public RunDetailDTO createRun(Long articleId, String runTypeRaw, Long actorUserId) {
        throw new UnsupportedOperationException(MSG);
    }

    public RunDetailDTO submitOutput(Long articleId,
                                     Long runId,
                                     String rawOutput,
                                     String declaredModelId,
                                     String declaredModelVersion,
                                     Integer tokensInput,
                                     Integer tokensOutput,
                                     Long actorUserId) {
        throw new UnsupportedOperationException(MSG);
    }

    public BilingualSubmitResultDTO submitOutputBilingual(Long articleId,
                                                          Long runId,
                                                          String rawJsonEs,
                                                          String rawJsonEn,
                                                          String declaredModelId,
                                                          String declaredModelVersion,
                                                          Long actorUserId,
                                                          boolean isAdmin) {
        throw new UnsupportedOperationException(MSG);
    }

    public List<RunSummaryDTO> listByArticle(Long articleId) {
        throw new UnsupportedOperationException(MSG);
    }

    public RunDetailDTO findById(Long runId) {
        throw new UnsupportedOperationException(MSG);
    }

    public ArticleDetailDTO applyValidatedDraftToArticle(Long articleId,
                                                         Long runId,
                                                         Long actorUserId,
                                                         boolean isAdmin) {
        throw new UnsupportedOperationException(MSG);
    }
}
