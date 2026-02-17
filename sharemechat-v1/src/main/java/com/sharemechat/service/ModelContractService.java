package com.sharemechat.service;

import com.sharemechat.entity.ModelContractAcceptance;
import com.sharemechat.repository.ModelContractAcceptanceRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import jakarta.transaction.Transactional;

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

    public Map<String, String> current() {
        return Map.of(
                "version", version,
                "sha256", sha256,
                "url", url
        );
    }

    public boolean isAccepted(Long userId) {
        return userId != null && repo.findById(userId).isPresent();
    }

    @Transactional
    public Map<String, Object> accept(Long userId, String ip, String userAgent) {

        ModelContractAcceptance existing = repo.findById(userId).orElse(null);

        if (existing != null) {
            boolean matches = version.equals(existing.getContractVersion())
                    && sha256.equals(existing.getContractSha256());

            // Si ya aceptó el contrato vigente, idempotente “real”
            if (matches) {
                return Map.of(
                        "ok", true,
                        "alreadyAccepted", true,
                        "matchesCurrent", true,
                        "acceptedAt", String.valueOf(existing.getAcceptedAt()),
                        "version", existing.getContractVersion(),
                        "sha256", existing.getContractSha256(),
                        "url", url
                );
            }

            // Si NO coincide con el contrato vigente, actualizamos la aceptación
            existing.setContractVersion(version);
            existing.setContractSha256(sha256);
            existing.setAcceptedAt(LocalDateTime.now());
            existing.setIpAddress(ip);
            existing.setUserAgent(userAgent);

            repo.save(existing);

            return Map.of(
                    "ok", true,
                    "alreadyAccepted", false,      // importante: ahora sí “acepta de nuevo”
                    "matchesCurrent", true,
                    "acceptedAt", String.valueOf(existing.getAcceptedAt()),
                    "version", version,
                    "sha256", sha256,
                    "url", url
            );
        }

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
    }

}
