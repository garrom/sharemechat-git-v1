package com.sharemechat.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.InputStreamResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.NoSuchFileException;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class S3StorageService implements StorageService {

    @Value("${app.storage.s3.bucket:}")
    private String bucket;

    @Value("${app.storage.s3.region:}")
    private String region;

    @Value("${app.storage.s3.endpoint:}")
    private String endpoint;

    @Value("${app.storage.s3.key-prefix:private-uploads}")
    private String keyPrefixRoot;

    @Value("${app.storage.s3.path-style-access:false}")
    private boolean pathStyleAccess;

    @Value("${app.storage.s3.server-side-encryption:AES256}")
    private String serverSideEncryption;

    @Value("${app.storage.allowed-extensions:jpg,jpeg,png,webp,gif,mp4,webm,pdf}")
    private String allowedExtensionsCsv;

    @Value("${app.storage.max-file-size-bytes:26214400}")
    private long maxFileSizeBytes;

    @Value("${app.storage.max-basename-length:80}")
    private int maxBaseNameLength;

    private Set<String> allowedExtensions;
    private S3Client s3Client;

    private final StorageUrlCodec storageUrlCodec;

    public S3StorageService(StorageUrlCodec storageUrlCodec) {
        this.storageUrlCodec = storageUrlCodec;
    }

    @jakarta.annotation.PostConstruct
    void init() {
        allowedExtensions = Arrays.stream(allowedExtensionsCsv.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (allowedExtensions.isEmpty()) {
            throw new IllegalStateException("app.storage.allowed-extensions no puede estar vacio");
        }
        if (!StringUtils.hasText(bucket)) {
            throw new IllegalStateException("app.storage.s3.bucket es obligatorio cuando app.storage.type=s3");
        }
        if (!StringUtils.hasText(region)) {
            throw new IllegalStateException("app.storage.s3.region es obligatorio cuando app.storage.type=s3");
        }

        var builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .forcePathStyle(pathStyleAccess);

        if (StringUtils.hasText(endpoint)) {
            builder.endpointOverride(URI.create(endpoint));
        }

        s3Client = builder.build();
    }

    @jakarta.annotation.PreDestroy
    void destroy() {
        if (s3Client != null) {
            s3Client.close();
        }
    }

    @Override
    public String store(MultipartFile file, String keyPrefix) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichero vacio o inexistente");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new IllegalArgumentException("Fichero demasiado grande");
        }

        final String prefix = sanitizePrefix(keyPrefix);
        final String original = Objects.requireNonNullElse(file.getOriginalFilename(), "file");
        final String sanitized = original.replaceAll("[^a-zA-Z0-9._-]", "_");
        final int dot = sanitized.lastIndexOf('.');
        final String ext = (dot >= 0 && dot < sanitized.length() - 1)
                ? sanitized.substring(dot + 1).toLowerCase()
                : "";

        if (!allowedExtensions.contains(ext)) {
            throw new IllegalArgumentException("Extension no permitida");
        }

        validateMagicBytes(file, ext);

        String base = (dot > 0) ? sanitized.substring(0, dot) : sanitized;
        if (base.length() > maxBaseNameLength) {
            base = base.substring(0, maxBaseNameLength);
        }
        if (base.isBlank()) base = "file";

        final String safeName = UUID.randomUUID() + "-" + base + "." + ext;
        final String key = buildStorageKey(prefix, safeName);

        PutObjectRequest.Builder requestBuilder = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentLength(file.getSize())
                .contentType(resolveContentType(file, ext));

        if (StringUtils.hasText(serverSideEncryption)) {
            requestBuilder.serverSideEncryption(ServerSideEncryption.fromValue(serverSideEncryption));
        }

        try (InputStream inputStream = file.getInputStream()) {
            s3Client.putObject(requestBuilder.build(), RequestBody.fromInputStream(inputStream, file.getSize()));
        }
        return storageUrlCodec.buildManagedUrl(key);
    }

    @Override
    public void deleteByPublicUrl(String publicUrl) {
        String key = storageUrlCodec.extractKeyFromManagedUrl(publicUrl);
        if (!StringUtils.hasText(key)) return;

        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build());
    }

    @Override
    public StoredFile loadByKey(String storageKey) throws IOException {
        try {
            var head = s3Client.headObject(HeadObjectRequest.builder()
                    .bucket(bucket)
                    .key(storageKey)
                    .build());

            ResponseInputStream<GetObjectResponse> stream = s3Client.getObject(GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(storageKey)
                    .build());

            return new StoredFile(
                    new InputStreamResource(stream),
                    head.contentType(),
                    head.contentLength(),
                    fileNameFromKey(storageKey)
            );
        } catch (NoSuchKeyException ex) {
            throw new NoSuchFileException(storageKey);
        } catch (S3Exception ex) {
            if (isMissingObject(ex)) {
                throw new NoSuchFileException(storageKey);
            }
            throw new IOException("No se pudo leer el objeto S3", ex);
        } catch (RuntimeException ex) {
            throw new IOException("No se pudo leer el objeto S3", ex);
        }
    }

    private boolean isMissingObject(S3Exception ex) {
        if (ex == null) return false;
        if (ex.statusCode() == 404) return true;
        if (ex.awsErrorDetails() == null) return false;
        String code = ex.awsErrorDetails().errorCode();
        return "NoSuchKey".equals(code) || "NotFound".equals(code);
    }

    private String buildStorageKey(String prefix, String safeName) {
        String root = sanitizePrefix(keyPrefixRoot);
        if (!StringUtils.hasText(root)) {
            return prefix.isEmpty() ? safeName : prefix + "/" + safeName;
        }
        if (!StringUtils.hasText(prefix)) {
            return root + "/" + safeName;
        }
        return root + "/" + prefix + "/" + safeName;
    }

    private String resolveContentType(MultipartFile file, String ext) {
        if (StringUtils.hasText(file.getContentType())) {
            return file.getContentType();
        }
        return switch (ext) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            case "pdf" -> "application/pdf";
            case "mp4" -> "video/mp4";
            case "webm" -> "video/webm";
            default -> "application/octet-stream";
        };
    }

    private String sanitizePrefix(String keyPrefix) {
        String p = keyPrefix == null ? "" : keyPrefix.trim();
        if (p.isEmpty()) return "";
        p = p.replaceAll("[^a-zA-Z0-9_\\-/]", "_");
        p = p.replaceAll("/+", "/");
        if (p.startsWith("/")) p = p.substring(1);
        if (p.endsWith("/")) p = p.substring(0, p.length() - 1);
        if (p.contains("..")) throw new SecurityException("Prefijo invalido");
        return p;
    }

    private String fileNameFromKey(String storageKey) {
        int idx = storageKey.lastIndexOf('/');
        return idx >= 0 ? storageKey.substring(idx + 1) : storageKey;
    }

    private void validateMagicBytes(MultipartFile file, String ext) throws IOException {
        byte[] head = readHead(file, 32);

        if (ext.equals("jpg") || ext.equals("jpeg")) {
            if (!(head.length >= 3
                    && (head[0] & 0xFF) == 0xFF
                    && (head[1] & 0xFF) == 0xD8
                    && (head[2] & 0xFF) == 0xFF)) {
                throw new IllegalArgumentException("Contenido no es JPEG valido");
            }
            return;
        }

        if (ext.equals("png")) {
            byte[] sig = new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
            if (!startsWith(head, sig)) {
                throw new IllegalArgumentException("Contenido no es PNG valido");
            }
            return;
        }

        if (ext.equals("gif")) {
            if (!(head.length >= 6
                    && head[0] == 'G' && head[1] == 'I' && head[2] == 'F'
                    && head[3] == '8' && (head[4] == '7' || head[4] == '9') && head[5] == 'a')) {
                throw new IllegalArgumentException("Contenido no es GIF valido");
            }
            return;
        }

        if (ext.equals("webp")) {
            if (!(head.length >= 12
                    && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                    && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P')) {
                throw new IllegalArgumentException("Contenido no es WEBP valido");
            }
            return;
        }

        if (ext.equals("pdf")) {
            if (!(head.length >= 5
                    && head[0] == '%' && head[1] == 'P' && head[2] == 'D' && head[3] == 'F' && head[4] == '-')) {
                throw new IllegalArgumentException("Contenido no es PDF valido");
            }
            return;
        }

        if (ext.equals("mp4")) {
            if (!(head.length >= 8
                    && head[4] == 'f' && head[5] == 't' && head[6] == 'y' && head[7] == 'p')) {
                throw new IllegalArgumentException("Contenido no es MP4 valido");
            }
            return;
        }

        if (ext.equals("webm")) {
            if (!(head.length >= 4
                    && (head[0] & 0xFF) == 0x1A
                    && (head[1] & 0xFF) == 0x45
                    && (head[2] & 0xFF) == 0xDF
                    && (head[3] & 0xFF) == 0xA3)) {
                throw new IllegalArgumentException("Contenido no es WEBM valido");
            }
            return;
        }

        throw new IllegalArgumentException("Tipo de archivo no validable para ext=" + ext);
    }

    private byte[] readHead(MultipartFile file, int max) throws IOException {
        try (var in = file.getInputStream()) {
            byte[] buf = new byte[max];
            int n = in.read(buf);
            if (n <= 0) return new byte[0];
            return Arrays.copyOf(buf, n);
        }
    }

    private boolean startsWith(byte[] data, byte[] prefix) {
        if (data == null || prefix == null) return false;
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }
}
