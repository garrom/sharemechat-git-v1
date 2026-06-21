package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.dto.ModerationCategoryVerdict;
import com.sharemechat.streammoderation.dto.ModerationFrameSubmission;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests del adapter MOCK del frente moderacion IA (P1.2; ADR-036/ADR-037).
 *
 * MOCK deterministic GREEN: cubre las 9 categorias visuales con score 0
 * y severity GREEN, providerEventId con prefijo "mock_", suggestedAction
 * "NO_OP", vendorMetadataJson "{\"mock\":true}".
 */
class MockModerationClientTest {

    private final MockModerationClient client = new MockModerationClient();

    @Test
    @DisplayName("submitImage devuelve verdict GREEN determinista")
    void submitImage_returnsGreenVerdict() {
        ModerationVerdictResult result = client.submitImage(new ModerationFrameSubmission());

        assertNotNull(result);
        assertEquals(Constants.StreamModerationSeverity.GREEN, result.getSeverityOverall());
        assertEquals("NO_OP", result.getSuggestedAction());
        assertEquals("{\"mock\":true}", result.getVendorMetadataJson());
    }

    @Test
    @DisplayName("providerEventId tiene prefijo 'mock_'")
    void submitImage_providerEventIdHasMockPrefix() {
        ModerationVerdictResult result = client.submitImage(new ModerationFrameSubmission());

        assertNotNull(result.getProviderEventId());
        assertTrue(result.getProviderEventId().startsWith("mock_"),
                "Esperado prefijo 'mock_' en providerEventId, fue: " + result.getProviderEventId());
    }

    @Test
    @DisplayName("frameTimestamp se rellena con instante actual")
    void submitImage_frameTimestampNotNull() {
        ModerationVerdictResult result = client.submitImage(new ModerationFrameSubmission());
        assertNotNull(result.getFrameTimestamp());
    }

    @Test
    @DisplayName("categoryVerdicts contiene las 9 categorias visuales con score 0 y GREEN")
    void submitImage_allCategoriesGreen() {
        ModerationVerdictResult result = client.submitImage(new ModerationFrameSubmission());

        String[] expected = {
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

        assertEquals(expected.length, result.getCategoryVerdicts().size(),
                "Esperadas 9 categorias en el verdict MOCK");

        for (String category : expected) {
            ModerationCategoryVerdict verdict = result.getCategoryVerdicts().get(category);
            assertNotNull(verdict, "Categoria " + category + " ausente del verdict MOCK");
            assertEquals(category, verdict.getCategory());
            assertEquals(BigDecimal.ZERO, verdict.getScore());
            assertEquals(Constants.StreamModerationSeverity.GREEN, verdict.getSeverity());
        }
    }

    @Test
    @DisplayName("OTHER NO esta en el verdict MOCK (catch-all reservado a vendors reales)")
    void submitImage_otherCategoryAbsent() {
        ModerationVerdictResult result = client.submitImage(new ModerationFrameSubmission());

        assertEquals(null, result.getCategoryVerdicts().get(Constants.StreamModerationCategory.OTHER),
                "OTHER no debe aparecer en el verdict MOCK; es catch-all de vendors reales");
    }

    @Test
    @DisplayName("Llamadas consecutivas generan providerEventIds distintos")
    void submitImage_uniqueProviderEventIds() {
        ModerationVerdictResult a = client.submitImage(new ModerationFrameSubmission());
        ModerationVerdictResult b = client.submitImage(new ModerationFrameSubmission());

        assertTrue(!a.getProviderEventId().equals(b.getProviderEventId()),
                "Cada llamada al MOCK debe producir un providerEventId distinto");
    }
}
