package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.service.KycProviderConfigService;
import com.sharemechat.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

import java.util.Map;

@RestController
@RequestMapping("/api/kyc/config")
public class KycConfigController {

    private final KycProviderConfigService kycProviderConfigService;
    private final UserService userService;

    public KycConfigController(KycProviderConfigService kycProviderConfigService, UserService userService) {
        this.kycProviderConfigService = kycProviderConfigService;
        this.userService = userService;
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

    @GetMapping("/product/model-onboarding")
    public ResponseEntity<?> getProductModelOnboardingConfig(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        boolean isOnboardingModel =
                Constants.Roles.USER.equals(user.getRole())
                        && Constants.UserTypes.FORM_MODEL.equals(user.getUserType());

        if (!isOnboardingModel) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }

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
