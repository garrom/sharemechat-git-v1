package com.sharemechat.service;

import com.sharemechat.entity.KycProviderConfig;
import com.sharemechat.repository.KycProviderConfigRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

@Service
public class KycProviderConfigService {

    public static final String KEY_MODEL_ONBOARDING = "MODEL_ONBOARDING";

    public static final String MODE_VERIFF = "VERIFF";
    public static final String MODE_MANUAL = "MANUAL";

    private final KycProviderConfigRepository repo;

    public KycProviderConfigService(KycProviderConfigRepository repo) {
        this.repo = repo;
    }

    public KycProviderConfig getOrCreateModelOnboardingConfig() {
        return repo.findByProviderKey(KEY_MODEL_ONBOARDING).orElseGet(() -> {
            KycProviderConfig c = new KycProviderConfig();
            c.setProviderKey(KEY_MODEL_ONBOARDING);
            c.setActiveMode(MODE_VERIFF); // default
            c.setEnabled(true);
            c.setNote("Auto-created");
            return repo.save(c);
        });
    }

    public boolean isManualEnabledForModelOnboarding() {
        KycProviderConfig c = getOrCreateModelOnboardingConfig();
        return c.isEnabled() && MODE_MANUAL.equalsIgnoreCase(safe(c.getActiveMode()));
    }

    public boolean isVeriffEnabledForModelOnboarding() {
        KycProviderConfig c = getOrCreateModelOnboardingConfig();
        return c.isEnabled() && MODE_VERIFF.equalsIgnoreCase(safe(c.getActiveMode()));
    }

    public String getActiveModeForModelOnboarding() {
        KycProviderConfig c = getOrCreateModelOnboardingConfig();
        return safe(c.getActiveMode()).toUpperCase();
    }

    @Transactional
    public KycProviderConfig setModelOnboardingMode(String mode, Long adminUserId, String note) {
        String normalized = safe(mode).toUpperCase();
        if (!MODE_VERIFF.equals(normalized) && !MODE_MANUAL.equals(normalized)) {
            throw new IllegalArgumentException("Modo KYC no soportado: " + mode);
        }

        KycProviderConfig c = getOrCreateModelOnboardingConfig();
        c.setActiveMode(normalized);
        c.setEnabled(true);
        c.setUpdatedByUserId(adminUserId);
        if (note != null && !note.trim().isEmpty()) {
            c.setNote(note.trim());
        }
        return repo.save(c);
    }

    @Transactional
    public KycProviderConfig setModelOnboardingEnabled(boolean enabled, Long adminUserId, String note) {
        KycProviderConfig c = getOrCreateModelOnboardingConfig();
        c.setEnabled(enabled);
        c.setUpdatedByUserId(adminUserId);
        if (note != null && !note.trim().isEmpty()) {
            c.setNote(note.trim());
        }
        return repo.save(c);
    }

    private String safe(String s) {
        return s == null ? "" : s.trim();
    }
}