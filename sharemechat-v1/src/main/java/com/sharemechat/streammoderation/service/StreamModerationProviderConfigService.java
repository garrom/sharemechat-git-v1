package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.entity.StreamModerationProviderConfig;
import com.sharemechat.streammoderation.repository.StreamModerationProviderConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * Servicio de gestion del modo activo del pipeline de moderacion
 * visual del streaming (frente Moderacion IA; ADR-030 / ADR-036 /
 * ADR-037). Calca {@code KycProviderConfigService}.
 *
 * <p>El modo activo vive en la fila unica de
 * {@code stream_moderation_provider_config} con
 * {@code provider_key=STREAM_VISUAL_MODERATION}. El bootstrap inicial
 * lo hace la migracion V10 (INSERT seed con
 * {@code active_mode=MOCK}); el metodo
 * {@link #getOrCreateConfig()} mantiene un fallback defensivo si la
 * fila se borrara accidentalmente en runtime.
 *
 * <p>Patron Plan A + contingencias documentadas (ADR-035 / ADR-037):
 * un unico {@code active_mode} en produccion en cualquier momento;
 * los modos no activos quedan disponibles para conmutar via
 * {@link #setActiveMode(String, Long, String)} (endpoint admin en
 * P1.3) sin redeploy.
 */
@Service
public class StreamModerationProviderConfigService {

    private static final Set<String> SUPPORTED_MODES = Set.of(
            Constants.StreamModerationProvider.MOCK,
            Constants.StreamModerationProvider.SIGHTENGINE,
            Constants.StreamModerationProvider.HIVE,
            Constants.StreamModerationProvider.REKOGNITION
    );

    private final StreamModerationProviderConfigRepository repo;

    public StreamModerationProviderConfigService(StreamModerationProviderConfigRepository repo) {
        this.repo = repo;
    }

    /**
     * Devuelve la fila unica de configuracion. Si no existe (la fila
     * seed de V10 ha sido borrada accidentalmente), la recrea con
     * {@code active_mode=MOCK}.
     */
    public StreamModerationProviderConfig getOrCreateConfig() {
        return repo.findByProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION)
                .orElseGet(() -> {
                    StreamModerationProviderConfig c = new StreamModerationProviderConfig();
                    c.setProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION);
                    c.setActiveMode(Constants.StreamModerationProvider.MOCK);
                    c.setEnabled(true);
                    c.setNote("Auto-created at runtime (V10 seed not present)");
                    return repo.save(c);
                });
    }

    public String getActiveMode() {
        return safe(getOrCreateConfig().getActiveMode()).toUpperCase();
    }

    public boolean isMockEnabled() {
        StreamModerationProviderConfig c = getOrCreateConfig();
        return c.isEnabled()
                && Constants.StreamModerationProvider.MOCK.equalsIgnoreCase(safe(c.getActiveMode()));
    }

    public boolean isSightengineEnabled() {
        StreamModerationProviderConfig c = getOrCreateConfig();
        return c.isEnabled()
                && Constants.StreamModerationProvider.SIGHTENGINE.equalsIgnoreCase(safe(c.getActiveMode()));
    }

    public boolean isHiveEnabled() {
        StreamModerationProviderConfig c = getOrCreateConfig();
        return c.isEnabled()
                && Constants.StreamModerationProvider.HIVE.equalsIgnoreCase(safe(c.getActiveMode()));
    }

    public boolean isRekognitionEnabled() {
        StreamModerationProviderConfig c = getOrCreateConfig();
        return c.isEnabled()
                && Constants.StreamModerationProvider.REKOGNITION.equalsIgnoreCase(safe(c.getActiveMode()));
    }

    /**
     * Cambia el modo activo. Sin endpoint admin que lo invoque todavia
     * en P1.2 (eso es P1.3); la API queda completa para evitar
     * refactor cuando llegue ese sub-paquete.
     */
    @Transactional
    public StreamModerationProviderConfig setActiveMode(String newMode, Long actorUserId, String note) {
        String normalized = safe(newMode).toUpperCase();
        if (!SUPPORTED_MODES.contains(normalized)) {
            throw new IllegalArgumentException("Modo de moderacion visual no soportado: " + newMode);
        }
        StreamModerationProviderConfig c = getOrCreateConfig();
        c.setActiveMode(normalized);
        c.setEnabled(true);
        c.setUpdatedByUserId(actorUserId);
        if (note != null && !note.trim().isEmpty()) {
            c.setNote(note.trim());
        }
        return repo.save(c);
    }

    private String safe(String s) {
        return s == null ? "" : s.trim();
    }
}
