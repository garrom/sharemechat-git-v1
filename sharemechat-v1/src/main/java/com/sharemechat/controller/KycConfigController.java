package com.sharemechat.controller;

import com.sharemechat.service.KycProviderConfigService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/kyc/config")
public class KycConfigController {

    private final KycProviderConfigService kycProviderConfigService;

    public KycConfigController(KycProviderConfigService kycProviderConfigService) {
        this.kycProviderConfigService = kycProviderConfigService;
    }

    @GetMapping("/model-onboarding")
    public ResponseEntity<?> getModelOnboardingConfig() {
        String mode = kycProviderConfigService.getActiveModeForModelOnboarding();
        boolean manualEnabled = kycProviderConfigService.isManualEnabledForModelOnboarding();
        boolean veriffEnabled = kycProviderConfigService.isVeriffEnabledForModelOnboarding();

        return ResponseEntity.ok(Map.of(
                "providerKey", KycProviderConfigService.KEY_MODEL_ONBOARDING,
                "activeMode", mode,
                "manualEnabled", manualEnabled,
                "veriffEnabled", veriffEnabled
        ));
    }
}