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

/**
 * Almacena cuerpos editoriales (markdown) en el bucket S3 privado del CMS.
 * Bucket separado del bucket privado de uploads (KYC, perfiles) para
 * aislar blast radius. ADR-010, decision D2.
 */
@Service
public class ContentBodyStorageService {

    private static final Logger log = LoggerFactory.getLogger(ContentBodyStorageService.class);

    private final S3Client s3Client;
    private final ContentS3Config s3Config;

    public ContentBodyStorageService(@Qualifier("contentS3Client") S3Client s3Client,
                                     ContentS3Config s3Config) {
        this.s3Client = s3Client;
        this.s3Config = s3Config;
    }

    public Result uploadDraftBody(Long articleId, byte[] markdownBytes) throws IOException {
        ensureConfigured();
        if (articleId == null) {
            throw new IllegalArgumentException("articleId requerido");
        }
        byte[] safeBytes = markdownBytes == null ? new byte[0] : markdownBytes;
        String key = buildKey(String.format(ContentConstants.S3_KEY_DRAFT_TEMPLATE, articleId));

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
        log.info("{} draft uploaded articleId={} key={} hash={} bytes={}",
                ContentConstants.LOG_PREFIX, articleId, key, hash, safeBytes.length);
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
            // 503 explicito en lugar de IllegalStateException (que el handler global
            // mapea a 500). El bucket vacio es estado operativo, no bug del codigo.
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Content S3 no configurado: app.storage.s3.content.private-bucket vacio");
        }
    }

    public record Result(String s3Key, String contentHash, int byteSize) {}
}
