package com.sharemechat.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.InputStreamResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    @Value("${app.storage.local.root:/usr/share/nginx/html/uploads}")
    private String root;

    @Value("${app.storage.allowed-extensions:jpg,jpeg,png,webp,gif,mp4,webm,pdf}")
    private String allowedExtensionsCsv;

    @Value("${app.storage.max-file-size-bytes:26214400}")
    private long maxFileSizeBytes;

    @Value("${app.storage.max-basename-length:80}")
    private int maxBaseNameLength;

    private Set<String> allowedExtensions;

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

        final Path rootPath = Paths.get(root).toAbsolutePath().normalize();
        Path dir = rootPath.resolve(prefix).normalize();
        if (!dir.startsWith(rootPath)) {
            throw new SecurityException("Ruta fuera del root de storage");
        }
        Files.createDirectories(dir);

        final Path dest = dir.resolve(safeName).normalize();
        if (!dest.startsWith(rootPath)) {
            throw new SecurityException("Ruta fuera del root de storage");
        }

        // Strip de metadatos (EXIF/GPS) para imágenes; el resto se copia tal cual.
        if (ImageMetadataScrubber.handles(ext)) {
            byte[] clean = ImageMetadataScrubber.scrub(file.getBytes(), ext);
            Files.write(dest, clean);
        } else {
            try (var in = file.getInputStream()) {
                Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
            }
        }

        try {
            Set<PosixFilePermission> perms = PosixFilePermissions.fromString("rw-r--r--");
            Files.setPosixFilePermissions(dest, perms);
        } catch (UnsupportedOperationException ignore) {
        }

        String cleanPrefix = prefix.replace('\\', '/').replaceAll("^/+", "").replaceAll("/+", "/");
        return "/uploads/" + (cleanPrefix.isEmpty() ? "" : (cleanPrefix + "/")) + safeName;
    }

    @Override
    public void deleteByPublicUrl(String publicUrl) throws IOException {
        if (publicUrl == null || publicUrl.isBlank()) return;

        final String prefix = "/uploads/";
        if (!publicUrl.startsWith(prefix)) return;

        String relative = publicUrl.substring(prefix.length());
        Path rootPath = Paths.get(root).toAbsolutePath().normalize();
        Path target = rootPath.resolve(relative).normalize();

        if (!target.toAbsolutePath().startsWith(rootPath)) {
            throw new SecurityException("Ruta fuera del root de storage");
        }

        try {
            Files.deleteIfExists(target);
        } catch (NoSuchFileException ignore) {
        }
    }

    @Override
    public StoredFile loadByKey(String storageKey) throws IOException {
        String relative = sanitizePrefix(storageKey);
        Path rootPath = Paths.get(root).toAbsolutePath().normalize();
        Path target = rootPath.resolve(relative).normalize();

        if (!target.startsWith(rootPath)) {
            throw new SecurityException("Ruta fuera del root de storage");
        }
        if (!Files.exists(target) || !Files.isReadable(target)) {
            throw new NoSuchFileException(target.toString());
        }

        String contentType = Files.probeContentType(target);
        long size = Files.size(target);
        return new StoredFile(
                new InputStreamResource(Files.newInputStream(target)),
                contentType,
                size,
                target.getFileName().toString()
        );
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
