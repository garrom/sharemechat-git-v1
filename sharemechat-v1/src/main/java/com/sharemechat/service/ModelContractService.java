// ==============================
// FILE: src/main/java/com/sharemechat/service/ModelContractService.java
// Robust + backwards-compatible (isAcceptedCurrent alias)
// ==============================
package com.sharemechat.service;

import com.sharemechat.entity.ModelContractAcceptance;
import com.sharemechat.repository.ModelContractAcceptanceRepository;
import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
public class ModelContractService {

    private final ModelContractAcceptanceRepository repo;

    @Value("${modelContract.version}")
    private String version;

    @Value("${modelContract.sha256}")
    private String sha256;

    @Value("${modelContract.url}")
    private String url;

    public ModelContractService(ModelContractAcceptanceRepository repo) {
        this.repo = repo;
    }

    @PostConstruct
    void normalizeAndValidate() {
        version = normalizeRequired(version, "modelContract.version");
        sha256  = normalizeRequired(sha256, "modelContract.sha256");
        url     = normalizeRequired(url, "modelContract.url");
    }

    public Map<String, String> current() {
        return Map.of(
                "version", version,
                "sha256", sha256,
                "url", url
        );
    }

    /**
     * acceptedCurrent = ha aceptado el contrato VIGENTE (versión actual).
     * Método "oficial".
     */
    public boolean isAccepted(Long userId) {
        return userId != null && repo.existsByUserIdAndContractVersion(userId, version);
    }

    /**
     * Alias retrocompatible: algunos controllers antiguos llamaban isAcceptedCurrent().
     */
    public boolean isAcceptedCurrent(Long userId) {
        return isAccepted(userId);
    }

    /**
     * acceptedEver = ha aceptado algún contrato alguna vez.
     */
    public boolean isAcceptedEver(Long userId) {
        return userId != null && repo.existsByUserId(userId);
    }

    @Transactional
    public Map<String, Object> accept(Long userId, String ip, String userAgent) {
        if (userId == null) {
            return Map.of(
                    "ok", false,
                    "alreadyAccepted", false,
                    "matchesCurrent", false,
                    "version", version,
                    "sha256", sha256,
                    "url", url
            );
        }

        // 1) Idempotencia: si ya existe aceptación para (user_id + versión vigente), devolvemos OK.
        var existing = repo.findByUserIdAndContractVersion(userId, version).orElse(null);
        if (existing != null) {
            boolean matches = sha256.equals(existing.getContractSha256());
            return Map.of(
                    "ok", true,
                    "alreadyAccepted", true,
                    "matchesCurrent", matches,
                    "acceptedAt", String.valueOf(existing.getAcceptedAt()),
                    "version", existing.getContractVersion(),
                    "sha256", existing.getContractSha256(),
                    "url", url
            );
        }

        // 2) No hay aceptación para la versión vigente: insertamos nueva fila.
        try {
            ModelContractAcceptance row = new ModelContractAcceptance();
            row.setUserId(userId);
            row.setContractVersion(version);
            row.setContractSha256(sha256);
            row.setAcceptedAt(LocalDateTime.now());
            row.setIpAddress(ip);
            row.setUserAgent(userAgent);

            repo.save(row);

            return Map.of(
                    "ok", true,
                    "alreadyAccepted", false,
                    "matchesCurrent", true,
                    "acceptedAt", String.valueOf(row.getAcceptedAt()),
                    "version", version,
                    "sha256", sha256,
                    "url", url
            );
        } catch (DataIntegrityViolationException dup) {
            // 3) Si hubo carrera y otro insertó primero, devolvemos idempotente como OK.
            var after = repo.findByUserIdAndContractVersion(userId, version).orElse(null);
            if (after != null) {
                boolean matches = sha256.equals(after.getContractSha256());
                return Map.of(
                        "ok", true,
                        "alreadyAccepted", true,
                        "matchesCurrent", matches,
                        "acceptedAt", String.valueOf(after.getAcceptedAt()),
                        "version", after.getContractVersion(),
                        "sha256", after.getContractSha256(),
                        "url", url
                );
            }

            throw dup;
        }
    }

    private String normalizeRequired(String s, String keyName) {
        if (s == null) throw new IllegalStateException("Missing required property: " + keyName);
        String t = s.trim();
        if (t.isEmpty()) throw new IllegalStateException("Empty required property: " + keyName);
        return t;
    }
}
