package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.dto.ModerationCategoryVerdict;
import com.sharemechat.streammoderation.dto.ModerationFrameSubmission;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Adapter MOCK del pipeline de moderacion visual del streaming
 * (frente Moderacion IA; ADR-030 / ADR-036 / ADR-037).
 *
 * <p>Deterministic GREEN: cada llamada a
 * {@link #submitImage(ModerationFrameSubmission)} devuelve un verdict
 * con {@code severityOverall=GREEN}, {@code suggestedAction=NO_OP}, y
 * todas las categorias scoreadas a 0 con severity GREEN. No es
 * aleatorio; es "siempre seguro". Permite cimentar el control plane y
 * arrancar TEST/dev sin coste y sin credenciales del vendor real.
 *
 * <p>Bean Spring: {@code @Service} + {@code @Qualifier("MOCK")}. El
 * qualifier queda inerte en P1.2 (unico adapter); en P2 se sumara el
 * {@code SightengineModerationClient} con {@code @Qualifier("SIGHTENGINE")}
 * y el orquestador {@code StreamModerationSessionService} podra
 * inyectar cada uno explicitamente.
 *
 * <p>Sin dependencias inyectadas. Sin HTTP. Sin properties. Esta es
 * la mayor garantia operativa del adapter: imposible romper TEST
 * porque MOCK falle.
 */
@Service
@Qualifier("MOCK")
public class MockModerationClient implements ModerationProviderClient {

    /**
     * Categorias normalizadas del verdict MOCK. Cubre las 9 categorias
     * de {@link Constants.StreamModerationCategory} excluyendo
     * {@code OTHER}: OTHER es catch-all para verdicts no mapeados desde
     * un vendor real, no aplica al MOCK que cubre todas explicitamente.
     */
    private static final String[] ALL_CATEGORIES = {
            Constants.StreamModerationCategory.NUDITY,
            Constants.StreamModerationCategory.WEAPONS,
            Constants.StreamModerationCategory.DRUGS,
            Constants.StreamModerationCategory.VIOLENCE,
            Constants.StreamModerationCategory.GORE,
            Constants.StreamModerationCategory.SELF_HARM,
            Constants.StreamModerationCategory.GAMBLING,
            Constants.StreamModerationCategory.OFFENSIVE_SYMBOLS,
            Constants.StreamModerationCategory.MINORS
    };

    @Override
    public ModerationVerdictResult submitImage(ModerationFrameSubmission frame) {
        ModerationVerdictResult result = new ModerationVerdictResult();
        result.setProviderEventId("mock_" + UUID.randomUUID());
        result.setFrameTimestamp(Instant.now());
        result.setSeverityOverall(Constants.StreamModerationSeverity.GREEN);
        result.setSuggestedAction("NO_OP");
        for (String category : ALL_CATEGORIES) {
            result.getCategoryVerdicts().put(
                    category,
                    new ModerationCategoryVerdict(
                            category,
                            BigDecimal.ZERO,
                            Constants.StreamModerationSeverity.GREEN
                    )
            );
        }
        result.setVendorMetadataJson("{\"mock\":true}");
        return result;
    }
}
