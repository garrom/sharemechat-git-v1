package com.sharemechat.service;

import com.sharemechat.dto.ModelContractManifestDTO;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ModelContractManifestService {

    private static final String MANIFEST_URL =
            "https://assets.test.sharemechat.com/legal/model_contract.manifest.json";

    private final RestTemplate restTemplate = new RestTemplate();

    public ModelContractManifestDTO getCurrent() {
        ModelContractManifestDTO manifest = restTemplate.getForObject(
                MANIFEST_URL,
                ModelContractManifestDTO.class
        );

        if (manifest == null) {
            throw new IllegalStateException("Model contract manifest is empty");
        }

        manifest.setVersion(normalizeRequired(manifest.getVersion(), "version"));
        manifest.setSha256(normalizeRequired(manifest.getSha256(), "sha256"));
        manifest.setUrl(normalizeRequired(manifest.getUrl(), "url"));

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
}
