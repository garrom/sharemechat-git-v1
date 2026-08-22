package com.sharemechat.controller;

import com.sharemechat.service.ProductOperationalModeService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.GitProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Observabilidad (2026-08-22): endpoint de salud/versión SIN auth. Devuelve el
 * commit vivo del JAR (git.properties, generado por git-commit-id-maven-plugin) +
 * el modo operacional actual. Permite a {@code update-manifest-backend.ps1}
 * confirmar el commit REAL del backend desplegado (cierra la limitación del
 * drift-check que hoy infiere el commit desde HEAD) y a un uptime monitor
 * comprobar que el proceso responde. El check de infraestructura (BD, disco)
 * vive en {@code /actuator/health}, complementario a éste.
 */
@RestController
@RequestMapping("/api/health")
public class HealthVersionController {

    private final ObjectProvider<GitProperties> gitProperties;
    private final ProductOperationalModeService productOperationalModeService;

    public HealthVersionController(ObjectProvider<GitProperties> gitProperties,
                                   ProductOperationalModeService productOperationalModeService) {
        this.gitProperties = gitProperties;
        this.productOperationalModeService = productOperationalModeService;
    }

    @GetMapping("/version")
    public Map<String, Object> version() {
        GitProperties git = gitProperties.getIfAvailable(); // null si no hay git.properties

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "UP");
        body.put("commit", git != null ? git.getShortCommitId() : "unknown");
        body.put("commitFull", git != null ? git.getCommitId() : "unknown");
        body.put("commitTime", (git != null && git.getCommitTime() != null) ? git.getCommitTime().toString() : null);
        body.put("branch", git != null ? git.getBranch() : "unknown");
        body.put("productAccessMode", modeName());
        body.put("serverTime", Instant.now().toString());
        return body;
    }

    private String modeName() {
        try {
            return productOperationalModeService.currentMode().name();
        } catch (Exception e) {
            return "unknown";
        }
    }
}
