package com.sharemechat.content.service;

import com.sharemechat.content.config.ContentS3Config;
import com.sharemechat.content.constants.ContentConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.NoSuchFileException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;

/**
 * Almacena cuerpos editoriales (markdown) en el bucket S3 privado del CMS.
 * Bucket separado del bucket privado de uploads (KYC, perfiles) para
 * aislar blast radius. ADR-010, decision D2.
 *
 * Post-ADR-025: el layout S3 es per-locale.
 *   articles/{id}/{locale}/draft.md
 *   articles/{id}/{locale}/v{n}.md
 */
@Service
public class ContentBodyStorageService {

    private static final Logger log = LoggerFactory.getLogger(ContentBodyStorageService.class);

    private static final Set<String> ALLOWED_LOCALES_FOR_S3 = Set.of(
            ContentConstants.LOCALE_ES, ContentConstants.LOCALE_EN);

    private final S3Client s3Client;
    private final ContentS3Config s3Config;

    public ContentBodyStorageService(@Qualifier("contentS3Client") S3Client s3Client,
                                     ContentS3Config s3Config) {
        this.s3Client = s3Client;
        this.s3Config = s3Config;
    }

    /**
     * Sube el draft de una traduccion. Sobreescribe si existe. Idempotente.
     */
    public Result uploadDraftBody(Long articleId, String locale, byte[] markdownBytes) throws IOException {
        ensureConfigured();
        if (articleId == null) {
            throw new IllegalArgumentException("articleId requerido");
        }
        String safeLocale = requireValidLocale(locale);
        byte[] safeBytes = markdownBytes == null ? new byte[0] : markdownBytes;
        String key = buildKey(String.format(ContentConstants.S3_KEY_DRAFT_TEMPLATE, articleId, safeLocale));

        try {
            s3Client.putObject(PutObjectRequest.builder()
                            .bucket(s3Config.getPrivateBucket())
                            .key(key)
                            .contentType("text/markdown; charset=utf-8")
                            .contentLength((long) safeBytes.length)
                            .serverSideEncryption(ServerSideEncryption.AES256)
                            .build(),
                    RequestBody.fromBytes(safeBytes));
        } catch (S3Exception ex) {
            throw new IOException("No se pudo subir cuerpo a S3 content-private", ex);
        }

        String hash = computeContentHash(safeBytes);
        log.info("{} draft uploaded articleId={} locale={} key={} hash={} bytes={}",
                ContentConstants.LOG_PREFIX, articleId, safeLocale, key, hash, safeBytes.length);
        return new Result(key, hash, safeBytes.length);
    }

    public String loadBodyAsString(String storageKey) throws IOException {
        ensureConfigured();
        if (storageKey == null || storageKey.isBlank()) {
            return "";
        }
        try {
            ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(
                    GetObjectRequest.builder()
                            .bucket(s3Config.getPrivateBucket())
                            .key(storageKey)
                            .build());
            return new String(response.asByteArray(), StandardCharsets.UTF_8);
        } catch (NoSuchKeyException ex) {
            throw new NoSuchFileException(storageKey);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                throw new NoSuchFileException(storageKey);
            }
            throw new IOException("No se pudo leer cuerpo de S3 content-private", ex);
        }
    }

    /**
     * Fija una version inmutable per-locale copiando draft.md a v{n}.md
     * dentro del mismo locale. Re-sube los bytes (no usa CopyObject) para
     * mantener SSE y recalcular hash en una operacion.
     */
    public Result copyDraftToVersion(Long articleId, String locale, int versionNumber) throws IOException {
        ensureConfigured();
        if (articleId == null || versionNumber < 1) {
            throw new IllegalArgumentException("articleId y versionNumber requeridos");
        }
        String safeLocale = requireValidLocale(locale);
        String draftKey = buildKey(String.format(
                ContentConstants.S3_KEY_DRAFT_TEMPLATE, articleId, safeLocale));
        String versionKey = buildKey(String.format(
                ContentConstants.S3_KEY_VERSION_TEMPLATE, articleId, safeLocale, versionNumber));

        byte[] bytes;
        try {
            ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(
                    GetObjectRequest.builder()
                            .bucket(s3Config.getPrivateBucket())
                            .key(draftKey)
                            .build());
            bytes = response.asByteArray();
        } catch (NoSuchKeyException ex) {
            throw new NoSuchFileException(draftKey);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                throw new NoSuchFileException(draftKey);
            }
            throw new IOException("No se pudo leer draft de S3 content-private", ex);
        }

        try {
            s3Client.putObject(PutObjectRequest.builder()
                            .bucket(s3Config.getPrivateBucket())
                            .key(versionKey)
                            .contentType("text/markdown; charset=utf-8")
                            .contentLength((long) bytes.length)
                            .serverSideEncryption(ServerSideEncryption.AES256)
                            .build(),
                    RequestBody.fromBytes(bytes));
        } catch (S3Exception ex) {
            throw new IOException("No se pudo escribir version en S3 content-private", ex);
        }

        String hash = computeContentHash(bytes);
        log.info("{} version persisted articleId={} locale={} versionNumber={} key={} hash={} bytes={}",
                ContentConstants.LOG_PREFIX, articleId, safeLocale, versionNumber, versionKey, hash, bytes.length);
        return new Result(versionKey, hash, bytes.length);
    }

    /**
     * Lee el body inmutable de una version per-locale. Devuelve "" si la
     * key no existe en S3.
     */
    public String loadVersionBody(Long articleId, String locale, int versionNumber) throws IOException {
        if (articleId == null || versionNumber < 1) {
            throw new IllegalArgumentException("articleId y versionNumber requeridos");
        }
        String safeLocale = requireValidLocale(locale);
        String versionKey = buildKey(String.format(
                ContentConstants.S3_KEY_VERSION_TEMPLATE, articleId, safeLocale, versionNumber));
        return loadBodyAsString(versionKey);
    }

    // ================================================================
    // Artefactos de runs IA (Claude Cowork manual structured).
    // Layout: content/runs/{runId}/[prompt.txt | output_raw.md |
    //         output_validated.json | validation_errors.json]
    // No depende de locale.
    // ================================================================

    /** Sube el prompt expandido inmutable de un run. Devuelve la S3 key absoluta. */
    public String uploadRunPrompt(Long runId, byte[] promptBytes) throws IOException {
        return putRunArtifact(
                String.format(ContentConstants.S3_KEY_RUN_PROMPT_TEMPLATE, runId),
                promptBytes,
                "text/plain; charset=utf-8");
    }

    /** Sube el output crudo pegado por el editor (siempre, valide o no). */
    public String uploadRunOutputRaw(Long runId, byte[] rawBytes) throws IOException {
        return putRunArtifact(
                String.format(ContentConstants.S3_KEY_RUN_OUTPUT_RAW_TEMPLATE, runId),
                rawBytes,
                "text/plain; charset=utf-8");
    }

    /** Sube el output canonico re-serializado (solo cuando la validacion pasa). */
    public String uploadRunOutputValidated(Long runId, byte[] canonicalJsonBytes) throws IOException {
        return putRunArtifact(
                String.format(ContentConstants.S3_KEY_RUN_OUTPUT_VALIDATED_TEMPLATE, runId),
                canonicalJsonBytes,
                "application/json; charset=utf-8");
    }

    /** Sube el detalle de errores de validacion (solo cuando la validacion falla). */
    public String uploadRunValidationErrors(Long runId, byte[] errorsJsonBytes) throws IOException {
        return putRunArtifact(
                String.format(ContentConstants.S3_KEY_RUN_VALIDATION_ERRORS_TEMPLATE, runId),
                errorsJsonBytes,
                "application/json; charset=utf-8");
    }

    /** Carga el prompt expandido de un run. Devuelve "" si no existe. */
    public String loadRunPrompt(Long runId) throws IOException {
        try {
            return loadBodyAsString(buildKey(
                    String.format(ContentConstants.S3_KEY_RUN_PROMPT_TEMPLATE, runId)));
        } catch (NoSuchFileException ex) {
            return "";
        }
    }

    /** Carga el JSON de errores de validacion. Devuelve "" si no existe. */
    public String loadRunValidationErrors(Long runId) throws IOException {
        try {
            return loadBodyAsString(buildKey(
                    String.format(ContentConstants.S3_KEY_RUN_VALIDATION_ERRORS_TEMPLATE, runId)));
        } catch (NoSuchFileException ex) {
            return "";
        }
    }

    /**
     * Carga el output canonico validado de un run. Devuelve "" si la key
     * no existe en S3 (run REJECTED o PENDING).
     */
    public String loadRunOutputValidated(Long runId) throws IOException {
        try {
            return loadBodyAsString(buildKey(
                    String.format(ContentConstants.S3_KEY_RUN_OUTPUT_VALIDATED_TEMPLATE, runId)));
        } catch (NoSuchFileException ex) {
            return "";
        }
    }

    private String putRunArtifact(String relativeKey, byte[] bytes, String contentType) throws IOException {
        ensureConfigured();
        if (bytes == null) bytes = new byte[0];
        String key = buildKey(relativeKey);
        try {
            s3Client.putObject(PutObjectRequest.builder()
                            .bucket(s3Config.getPrivateBucket())
                            .key(key)
                            .contentType(contentType)
                            .contentLength((long) bytes.length)
                            .serverSideEncryption(ServerSideEncryption.AES256)
                            .build(),
                    RequestBody.fromBytes(bytes));
        } catch (S3Exception ex) {
            throw new IOException("No se pudo subir artefacto de run a S3 content-private", ex);
        }
        log.info("{} run artifact uploaded key={} bytes={}",
                ContentConstants.LOG_PREFIX, key, bytes.length);
        return key;
    }

    public String computeContentHash(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data == null ? new byte[0] : data);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 no disponible", ex);
        }
    }

    private String buildKey(String relativeKey) {
        String prefix = s3Config.getPrivateKeyPrefix();
        if (prefix == null || prefix.isBlank()) {
            return relativeKey;
        }
        if (prefix.endsWith("/")) {
            return prefix + relativeKey;
        }
        return prefix + "/" + relativeKey;
    }

    private void ensureConfigured() {
        if (!s3Config.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Content S3 no configurado: app.storage.s3.content.private-bucket vacio");
        }
    }

    /**
     * Defensa server-side: rechaza locales no soportados al construir paths S3.
     * El service caller ya valida; este es el segundo cinturon.
     */
    private static String requireValidLocale(String locale) {
        if (locale == null) {
            throw new IllegalArgumentException("locale requerido para path S3");
        }
        String norm = locale.trim().toLowerCase(java.util.Locale.ROOT);
        if (!ALLOWED_LOCALES_FOR_S3.contains(norm)) {
            throw new IllegalArgumentException("locale no soportado para path S3: " + locale);
        }
        return norm;
    }

    public record Result(String s3Key, String contentHash, int byteSize) {}
}
