package com.sharemechat.service;

import com.sharemechat.dto.ModelContractManifestDTO;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class ModelContractManifestService {

    private static final String MANIFEST_URL =
            "https://assets.test.sharemechat.com/legal/model_contract.manifest.json";

    private static final Pattern VERSION_PATTERN =
            Pattern.compile("^model_contract_v\\d+_\\d{4}-\\d{2}-\\d{2}$");

    private static final Pattern SHA256_PATTERN =
            Pattern.compile("^[A-F0-9]{64}$");

    private static final String EXPECTED_URL =
            "https://assets.test.sharemechat.com/legal/model_contract.pdf";

    private final RestTemplate restTemplate = new RestTemplate();

    public ModelContractManifestDTO getCurrent() {
        ModelContractManifestDTO manifest = restTemplate.getForObject(
                MANIFEST_URL,
                ModelContractManifestDTO.class
        );

        if (manifest == null) {
            throw new IllegalStateException("Model contract manifest is empty");
        }

        String version = normalizeRequired(manifest.getVersion(), "version");
        String sha256 = normalizeRequired(manifest.getSha256(), "sha256")
                .toUpperCase(Locale.ROOT);
        String url = normalizeRequired(manifest.getUrl(), "url");

        validateVersion(version);
        validateSha256(sha256);
        validateUrl(url);

        manifest.setVersion(version);
        manifest.setSha256(sha256);
        manifest.setUrl(url);

        return manifest;
    }

    private String normalizeRequired(String s, String fieldName) {
        if (s == null) {
            throw new IllegalStateException("Missing required manifest field: " + fieldName);
        }
        String t = s.trim();
        if (t.isEmpty()) {
            throw new IllegalStateException("Empty required manifest field: " + fieldName);
        }
        return t;
    }

    private void validateVersion(String version) {
        if (!VERSION_PATTERN.matcher(version).matches()) {
            throw new IllegalStateException("Invalid manifest version format: " + version);
        }
    }

    private void validateSha256(String sha256) {
        if (!SHA256_PATTERN.matcher(sha256).matches()) {
            throw new IllegalStateException("Invalid manifest sha256 format: " + sha256);
        }
    }

    private void validateUrl(String url) {
        if (!EXPECTED_URL.equals(url)) {
            throw new IllegalStateException("Invalid manifest url: " + url);
        }
    }
}