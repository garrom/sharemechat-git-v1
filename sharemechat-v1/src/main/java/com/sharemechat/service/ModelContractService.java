package com.sharemechat.service;

import com.sharemechat.dto.ModelContractManifestDTO;
import com.sharemechat.entity.ModelContractAcceptance;
import com.sharemechat.repository.ModelContractAcceptanceRepository;
import jakarta.transaction.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
public class ModelContractService {

    private final ModelContractAcceptanceRepository repo;
    private final ModelContractManifestService manifestService;

    public ModelContractService(
            ModelContractAcceptanceRepository repo,
            ModelContractManifestService manifestService
    ) {
        this.repo = repo;
        this.manifestService = manifestService;
    }

    public Map<String, String> current() {
        ModelContractManifestDTO manifest = manifestService.getCurrent();
        return Map.of(
                "version", manifest.getVersion(),
                "sha256", manifest.getSha256(),
                "url", manifest.getUrl()
        );
    }

    /**
     * acceptedCurrent = ha aceptado el contrato VIGENTE (versión actual).
     * Método "oficial".
     */
    public boolean isAccepted(Long userId) {
        var manifest = manifestService.getCurrent();
        return userId != null && repo.existsByUserIdAndContractVersion(userId, manifest.getVersion());
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
        var manifest = manifestService.getCurrent();
        String version = manifest.getVersion();
        String sha256 = manifest.getSha256();
        String url = manifest.getUrl();

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
}
