package com.sharemechat.psp.service;

import com.sharemechat.psp.entity.PspProviderConfig;
import com.sharemechat.psp.repository.PspProviderConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * ADR-051 D8: gobierno runtime del kill-switch del PSP activo.
 * Calcado de {@link com.sharemechat.service.KycProviderConfigService}
 * (ADR-035, 2026-06-13).
 *
 * <p>Un fila por vendor. Getter {@link #isEnabled(String)} devuelve
 * {@code true} SOLO si {@code enabled=true} AND {@code active_mode='ENABLED'}.
 * El orquestador consulta este método antes de aceptar checkout o
 * procesar webhook; si {@code false}, responde {@code 503 PSP_UNAVAILABLE}.
 *
 * <p>Editable via panel admin (endpoint futuro Fase 3) sin redeploy.
 * Combinado con la property {@code psp.<vendor>.enabled} da kill-switch
 * doble (deploy + runtime).
 */
@Service
public class PspProviderConfigService {

    public static final String PROVIDER_NOWPAYMENTS = "nowpayments";

    public static final String MODE_ENABLED = "ENABLED";
    public static final String MODE_DISABLED = "DISABLED";

    private final PspProviderConfigRepository repo;

    public PspProviderConfigService(PspProviderConfigRepository repo) {
        this.repo = repo;
    }

    /**
     * Devuelve la config del vendor. Si no existe (raro: la migración V28
     * ya sembró {@code nowpayments/DISABLED}), la crea con defaults.
     */
    public PspProviderConfig getOrCreateConfig(String providerKey) {
        String key = normalize(providerKey);
        return repo.findByProviderKey(key).orElseGet(() -> {
            PspProviderConfig c = new PspProviderConfig();
            c.setProviderKey(key);
            c.setActiveMode(MODE_DISABLED); // default seguro: nada activo hasta configuración explícita
            c.setEnabled(true);
            c.setNote("Auto-created");
            return repo.save(c);
        });
    }

    /**
     * Query hot del orquestador. Devuelve {@code true} SOLO si
     * {@code enabled=true} AND {@code active_mode=ENABLED}.
     */
    public boolean isEnabled(String providerKey) {
        Optional<PspProviderConfig> opt = repo.findByProviderKey(normalize(providerKey));
        return opt.isPresent()
                && opt.get().isEnabled()
                && MODE_ENABLED.equalsIgnoreCase(safe(opt.get().getActiveMode()));
    }

    /** Getter conveniente para el vendor NOWPayments (uso mayoritario en Fase 1-4). */
    public boolean isNowPaymentsEnabled() {
        return isEnabled(PROVIDER_NOWPAYMENTS);
    }

    @Transactional
    public PspProviderConfig setActiveMode(String providerKey, String mode, Long adminUserId, String note) {
        String normalized = safe(mode).toUpperCase();
        if (!MODE_ENABLED.equals(normalized) && !MODE_DISABLED.equals(normalized)) {
            throw new IllegalArgumentException("Modo PSP no soportado: " + mode);
        }
        PspProviderConfig c = getOrCreateConfig(providerKey);
        c.setActiveMode(normalized);
        c.setUpdatedByUserId(adminUserId);
        if (note != null && !note.trim().isEmpty()) {
            c.setNote(note.trim());
        }
        return repo.save(c);
    }

    @Transactional
    public PspProviderConfig setEnabled(String providerKey, boolean enabled, Long adminUserId, String note) {
        PspProviderConfig c = getOrCreateConfig(providerKey);
        c.setEnabled(enabled);
        c.setUpdatedByUserId(adminUserId);
        if (note != null && !note.trim().isEmpty()) {
            c.setNote(note.trim());
        }
        return repo.save(c);
    }

    private String normalize(String providerKey) {
        return safe(providerKey).toLowerCase();
    }

    private String safe(String s) {
        return s == null ? "" : s.trim();
    }
}
