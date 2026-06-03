package com.sharemechat.service;

import com.sharemechat.dto.ModelContractManifestDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;

@Service
public class ModelContractManifestService {

    private static final Logger log = LoggerFactory.getLogger(ModelContractManifestService.class);

    private static final String MANIFEST_PATH = "/legal/model_contract.manifest.json";
    private static final String CONTRACT_PDF_PATH = "/legal/model_contract.pdf";

    private static final Pattern VERSION_PATTERN =
            Pattern.compile("^model_contract_v\\d+_\\d{4}-\\d{2}-\\d{2}$");

    private static final Pattern SHA256_PATTERN =
            Pattern.compile("^[A-F0-9]{64}$");

    private final RestTemplate restTemplate = new RestTemplate();

    private final String assetsBaseUrl;

    /**
     * Cache de la versión cuyo SHA-256 hemos verificado contra el PDF
     * real. Si la versión vigente del manifest coincide con esta, no
     * volvemos a descargar el PDF. Cuando cambia la versión, se vuelve
     * a verificar (un único GET por publicación de versión nueva).
     */
    private final AtomicReference<String> verifiedVersion = new AtomicReference<>(null);

    public ModelContractManifestService(
            @Value("${app.assets.base-url}") String assetsBaseUrl
    ) {
        // Normalizar quitando barra final si la hubiera (defensa contra typos en .env).
        this.assetsBaseUrl = assetsBaseUrl.endsWith("/")
                ? assetsBaseUrl.substring(0, assetsBaseUrl.length() - 1)
                : assetsBaseUrl;
    }

    /**
     * URL absoluta del manifest en el bucket de assets del entorno actual.
     * Construida en runtime a partir de {@code app.assets.base-url}.
     */
    private String manifestUrl() {
        return assetsBaseUrl + MANIFEST_PATH;
    }

    /**
     * URL absoluta del PDF en el bucket de assets del entorno actual.
     * Construida en runtime a partir de {@code app.assets.base-url}.
     */
    private String expectedContractUrl() {
        return assetsBaseUrl + CONTRACT_PDF_PATH;
    }

    public ModelContractManifestDTO getCurrent() {
        ModelContractManifestDTO manifest = restTemplate.getForObject(
                manifestUrl(),
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

        // Lote endurecimiento 2026-06-04: verificar que el sha256 del
        // manifest corresponde realmente al contenido del PDF publicado.
        // Sin esto el backend confía ciegamente en el manifest, lo que
        // permitiría persistir un hash que no corresponde al texto. Si
        // falla, fail-secure: no se sirve la versión.
        ensureManifestMatchesPdf(version, sha256, url);

        return manifest;
    }

    /**
     * Si la versión vigente del manifest ya fue verificada contra el PDF,
     * salta. En caso contrario, descarga el PDF, calcula SHA-256 y
     * compara. Si no coincide, lanza {@link IllegalStateException} sin
     * marcar la versión como verificada (fail-secure: el siguiente
     * request volverá a intentarlo).
     */
    private void ensureManifestMatchesPdf(String version, String sha256, String url) {
        String currentVerified = verifiedVersion.get();
        if (version.equals(currentVerified)) {
            return;
        }

        byte[] pdfBytes;
        try {
            pdfBytes = restTemplate.getForObject(url, byte[].class);
        } catch (Exception ex) {
            log.error("[MODEL-CONTRACT] error descargando PDF para verificación de hash version={} url={}: {}",
                    version, url, ex.getMessage());
            throw new IllegalStateException(
                    "No se puede verificar la integridad del PDF del contrato (versión "
                            + version + "). Servicio no disponible.", ex);
        }
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new IllegalStateException(
                    "PDF del contrato vacío (versión " + version + "). Servicio no disponible.");
        }

        String actualSha = sha256Hex(pdfBytes);
        if (!sha256.equals(actualSha)) {
            log.error("[MODEL-CONTRACT] MISMATCH version={} manifestSha256={} actualPdfSha256={}",
                    version, sha256, actualSha);
            throw new IllegalStateException(
                    "Integridad del PDF del contrato comprometida: SHA-256 del PDF ("
                            + actualSha + ") no coincide con el publicado en el manifest ("
                            + sha256 + ") para versión " + version
                            + ". El servicio no aceptará nuevas aceptaciones hasta que se corrija.");
        }

        // Marcar como verificada (cache implícita por versión).
        verifiedVersion.set(version);
        log.info("[MODEL-CONTRACT] verificación SHA-256 OK version={} bytes={}",
                version, pdfBytes.length);
    }

    private String sha256Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02X", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible en la JVM", e);
        }
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
        String expected = expectedContractUrl();
        if (!expected.equals(url)) {
            throw new IllegalStateException("Invalid manifest url: " + url
                    + " (expected " + expected + ")");
        }
    }
}
