package com.sharemechat.service;

import com.sharemechat.entity.KycProviderConfig;
import com.sharemechat.repository.KycProviderConfigRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests del bootstrap por defecto y de los helpers de modo activo del
 * KycProviderConfigService (frente Integracion Didit en flujo KYC del
 * modelo, 2026-06-19). ADR-035 fija Didit como Plan A, asi que el default
 * de bootstrap debe ser MODE_DIDIT.
 */
class KycProviderConfigServiceTest {

    private static KycProviderConfig configWithMode(String mode) {
        KycProviderConfig c = new KycProviderConfig();
        c.setProviderKey(KycProviderConfigService.KEY_MODEL_ONBOARDING);
        c.setActiveMode(mode);
        c.setEnabled(true);
        return c;
    }

    @Test
    @DisplayName("Bootstrap: cuando no hay fila previa, default es DIDIT (Plan A, ADR-035)")
    void getOrCreate_bootstrapsWithDidit() {
        KycProviderConfigRepository repo = mock(KycProviderConfigRepository.class);
        when(repo.findByProviderKey(KycProviderConfigService.KEY_MODEL_ONBOARDING))
                .thenReturn(Optional.empty());
        when(repo.save(any(KycProviderConfig.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        KycProviderConfigService svc = new KycProviderConfigService(repo);

        KycProviderConfig created = svc.getOrCreateModelOnboardingConfig();

        assertEquals(KycProviderConfigService.MODE_DIDIT, created.getActiveMode());
        assertTrue(created.isEnabled());
        assertEquals(KycProviderConfigService.KEY_MODEL_ONBOARDING, created.getProviderKey());
    }

    @Test
    @DisplayName("isDiditEnabled true cuando active_mode=DIDIT; los otros helpers quedan false")
    void isDiditEnabled_reflectsActiveMode() {
        KycProviderConfigRepository repo = mock(KycProviderConfigRepository.class);
        when(repo.findByProviderKey(KycProviderConfigService.KEY_MODEL_ONBOARDING))
                .thenReturn(Optional.of(configWithMode(KycProviderConfigService.MODE_DIDIT)));

        KycProviderConfigService svc = new KycProviderConfigService(repo);

        assertTrue(svc.isDiditEnabledForModelOnboarding());
        assertFalse(svc.isVeriffEnabledForModelOnboarding());
        assertFalse(svc.isManualEnabledForModelOnboarding());
        assertEquals(KycProviderConfigService.MODE_DIDIT, svc.getActiveModeForModelOnboarding());
    }
}
