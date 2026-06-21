package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.entity.StreamModerationProviderConfig;
import com.sharemechat.streammoderation.repository.StreamModerationProviderConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests del service de gestion del modo activo del pipeline (P1.2).
 *
 * Cubre getOrCreateConfig, setActiveMode con validacion del set permitido,
 * y los helpers isXxxEnabled para los cuatro modos.
 */
class StreamModerationProviderConfigServiceTest {

    private StreamModerationProviderConfigRepository repo;
    private StreamModerationProviderConfigService svc;

    @BeforeEach
    void setUp() {
        repo = mock(StreamModerationProviderConfigRepository.class);
        svc = new StreamModerationProviderConfigService(repo);
    }

    @Test
    @DisplayName("getOrCreateConfig: fila existe -> devuelve la existente")
    void getOrCreateConfig_existing() {
        StreamModerationProviderConfig c = new StreamModerationProviderConfig();
        c.setProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION);
        c.setActiveMode(Constants.StreamModerationProvider.SIGHTENGINE);
        c.setEnabled(true);
        when(repo.findByProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION))
                .thenReturn(Optional.of(c));

        StreamModerationProviderConfig got = svc.getOrCreateConfig();

        assertEquals(Constants.StreamModerationProvider.SIGHTENGINE, got.getActiveMode());
    }

    @Test
    @DisplayName("getOrCreateConfig: fila ausente -> recrea con MOCK (defensive bootstrap)")
    void getOrCreateConfig_lazyCreate() {
        when(repo.findByProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION))
                .thenReturn(Optional.empty());
        when(repo.save(any(StreamModerationProviderConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        StreamModerationProviderConfig created = svc.getOrCreateConfig();

        assertNotNull(created);
        assertEquals(Constants.StreamModerationProvider.MOCK, created.getActiveMode());
        assertTrue(created.isEnabled());
        assertEquals(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION, created.getProviderKey());
    }

    @Test
    @DisplayName("getActiveMode: devuelve el modo en uppercase, trimmed")
    void getActiveMode_returnsUppercase() {
        StreamModerationProviderConfig c = new StreamModerationProviderConfig();
        c.setActiveMode("  sightengine  ");
        c.setEnabled(true);
        when(repo.findByProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION))
                .thenReturn(Optional.of(c));

        assertEquals("SIGHTENGINE", svc.getActiveMode());
    }

    @Test
    @DisplayName("isMockEnabled true cuando active_mode=MOCK + enabled=true")
    void isMockEnabled_true() {
        StreamModerationProviderConfig c = new StreamModerationProviderConfig();
        c.setActiveMode(Constants.StreamModerationProvider.MOCK);
        c.setEnabled(true);
        when(repo.findByProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION))
                .thenReturn(Optional.of(c));

        assertTrue(svc.isMockEnabled());
        assertFalse(svc.isSightengineEnabled());
        assertFalse(svc.isHiveEnabled());
        assertFalse(svc.isRekognitionEnabled());
    }

    @Test
    @DisplayName("isSightengineEnabled false cuando enabled=false aunque modo coincida")
    void isSightengineEnabled_falseWhenDisabled() {
        StreamModerationProviderConfig c = new StreamModerationProviderConfig();
        c.setActiveMode(Constants.StreamModerationProvider.SIGHTENGINE);
        c.setEnabled(false);
        when(repo.findByProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION))
                .thenReturn(Optional.of(c));

        assertFalse(svc.isSightengineEnabled());
        assertFalse(svc.isMockEnabled());
    }

    @Test
    @DisplayName("setActiveMode: modo valido se persiste normalizado uppercase")
    void setActiveMode_valid() {
        StreamModerationProviderConfig c = new StreamModerationProviderConfig();
        c.setActiveMode(Constants.StreamModerationProvider.MOCK);
        c.setEnabled(false);
        when(repo.findByProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION))
                .thenReturn(Optional.of(c));
        when(repo.save(any(StreamModerationProviderConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        StreamModerationProviderConfig updated = svc.setActiveMode("sightengine", 42L, "smoke test");

        assertEquals(Constants.StreamModerationProvider.SIGHTENGINE, updated.getActiveMode());
        assertTrue(updated.isEnabled());
        assertEquals(Long.valueOf(42L), updated.getUpdatedByUserId());
        assertEquals("smoke test", updated.getNote());
    }

    @Test
    @DisplayName("setActiveMode: modo no soportado -> IllegalArgumentException")
    void setActiveMode_invalid() {
        assertThrows(IllegalArgumentException.class,
                () -> svc.setActiveMode("VERIFF", 1L, null));
        assertThrows(IllegalArgumentException.class,
                () -> svc.setActiveMode(null, 1L, null));
        assertThrows(IllegalArgumentException.class,
                () -> svc.setActiveMode("", 1L, null));
    }

    @Test
    @DisplayName("setActiveMode: note blank no sobreescribe la nota existente")
    void setActiveMode_blankNotePreserves() {
        StreamModerationProviderConfig c = new StreamModerationProviderConfig();
        c.setActiveMode(Constants.StreamModerationProvider.MOCK);
        c.setEnabled(true);
        c.setNote("nota previa");
        when(repo.findByProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION))
                .thenReturn(Optional.of(c));
        when(repo.save(any(StreamModerationProviderConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        StreamModerationProviderConfig updated = svc.setActiveMode("MOCK", 7L, "   ");

        assertEquals("nota previa", updated.getNote());
    }
}
