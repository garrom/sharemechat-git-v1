package com.sharemechat.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    @Value("${app.storage.local.root:/usr/share/nginx/html/uploads}")
    private String root; // ruta real en disco donde Nginx sirve /uploads/*

    // CSV de extensiones permitidas (minúsculas, sin puntos)
    @Value("${app.storage.allowed-extensions:jpg,jpeg,png,webp,gif,mp4,webm,pdf}")
    private String allowedExtensionsCsv;

    // Límite de tamaño en bytes (por defecto 25 MB)
    @Value("${app.storage.max-file-size-bytes:26214400}")
    private long maxFileSizeBytes;

    // Límite de longitud para el "base name" (sin extensión)
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
            throw new IllegalStateException("app.storage.allowed-extensions no puede estar vacío");
        }
    }

    @Override
    public String store(MultipartFile file, String keyPrefix) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichero vacío o inexistente");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new IllegalArgumentException("Fichero demasiado grande");
        }

        final String prefix = sanitizePrefix(keyPrefix);

        // Sanitizar nombre original y extraer extensión
        final String original = Objects.requireNonNullElse(file.getOriginalFilename(), "file");
        final String sanitized = original.replaceAll("[^a-zA-Z0-9._-]", "_");
        final int dot = sanitized.lastIndexOf('.');
        final String ext = (dot >= 0 && dot < sanitized.length() - 1)
                ? sanitized.substring(dot + 1).toLowerCase()
                : "";

        if (!allowedExtensions.contains(ext)) {
            throw new IllegalArgumentException("Extensión no permitida");
        }

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

        // Copiar contenido
        try (var in = file.getInputStream()) {
            Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
        }

        // Permisos 0644 (si el FS soporta POSIX)
        try {
            Set<PosixFilePermission> perms = PosixFilePermissions.fromString("rw-r--r--");
            Files.setPosixFilePermissions(dest, perms);
        } catch (UnsupportedOperationException ignore) {
            // en FS no-POSIX (ej. Windows) lo ignoramos
        }

        // URL pública servida por Nginx
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
            // ya no existe
        }
    }

    private String sanitizePrefix(String keyPrefix) {
        String p = keyPrefix == null ? "" : keyPrefix.trim();
        if (p.isEmpty()) return "";
        // Solo letras/números/_/- y separadores '/'
        p = p.replaceAll("[^a-zA-Z0-9_\\-/]", "_");
        p = p.replaceAll("/+", "/");
        if (p.startsWith("/")) p = p.substring(1);
        if (p.endsWith("/")) p = p.substring(0, p.length() - 1);
        if (p.contains("..")) throw new SecurityException("Prefijo inválido");
        // (opcional) restringir a un solo nivel de carpeta:
        // if (p.contains("/")) throw new SecurityException("Prefijo con subcarpetas no permitido");
        return p;
    }
}
