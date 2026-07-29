package com.sharemechat.master.service;

import com.sharemechat.master.dto.MasterContractManifestDTO;
import com.sharemechat.master.entity.MasterContractAcceptance;
import com.sharemechat.master.repository.MasterContractAcceptanceRepository;
import jakarta.transaction.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * ADR-056 S2: gestor de aceptaciones del contrato Master. Simetrico a
 * {@code ModelContractService}. Idempotente + carrera-safe via
 * DataIntegrityViolationException (unique constraint DB
 * uq_master_contract_user_version).
 */
@Service
public class MasterContractService {

    private final MasterContractAcceptanceRepository repo;
    private final MasterContractManifestService manifestService;

    public MasterContractService(
            MasterContractAcceptanceRepository repo,
            MasterContractManifestService manifestService
    ) {
        this.repo = repo;
        this.manifestService = manifestService;
    }

    public Map<String, String> current() {
        MasterContractManifestDTO manifest = manifestService.getCurrent();
        return Map.of(
                "version", manifest.getVersion(),
                "sha256", manifest.getSha256(),
                "url", manifest.getUrl()
        );
    }

    /** ¿Ha aceptado el contrato VIGENTE (version actual)? */
    public boolean isAccepted(Long userId) {
        var manifest = manifestService.getCurrent();
        return userId != null && repo.existsByUserIdAndContractVersion(userId, manifest.getVersion());
    }

    /** Alias por simetria con {@code ModelContractService.isAcceptedCurrent}. */
    public boolean isAcceptedCurrent(Long userId) {
        return isAccepted(userId);
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

        // 1) Idempotencia: si ya existe aceptacion para (user_id + version vigente), devolvemos OK.
        var existing = repo.findFirstByUserIdAndContractVersion(userId, version).orElse(null);
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

        // 2) No hay aceptacion para la version vigente: insertamos nueva fila.
        try {
            MasterContractAcceptance row = new MasterContractAcceptance();
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
            // 3) Carrera: otro thread inserto primero, devolvemos idempotente.
            var after = repo.findFirstByUserIdAndContractVersion(userId, version).orElse(null);
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
