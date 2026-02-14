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

        // === HARDENING: validar contenido real (magic bytes) ===
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

    // =========================
    // MAGIC BYTES (HARDENING)
    // =========================

    private void validateMagicBytes(MultipartFile file, String ext) throws IOException {
        byte[] head = readHead(file, 32);

        // Imagen JPEG: FF D8 FF
        if (ext.equals("jpg") || ext.equals("jpeg")) {
            if (!(head.length >= 3
                    && (head[0] & 0xFF) == 0xFF
                    && (head[1] & 0xFF) == 0xD8
                    && (head[2] & 0xFF) == 0xFF)) {
                throw new IllegalArgumentException("Contenido no es JPEG válido");
            }
            return;
        }

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (ext.equals("png")) {
            byte[] sig = new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
            if (!startsWith(head, sig)) {
                throw new IllegalArgumentException("Contenido no es PNG válido");
            }
            return;
        }

        // GIF: "GIF87a" o "GIF89a"
        if (ext.equals("gif")) {
            if (!(head.length >= 6
                    && head[0] == 'G' && head[1] == 'I' && head[2] == 'F'
                    && head[3] == '8' && (head[4] == '7' || head[4] == '9') && head[5] == 'a')) {
                throw new IllegalArgumentException("Contenido no es GIF válido");
            }
            return;
        }

        // WEBP: "RIFF" .... "WEBP"
        if (ext.equals("webp")) {
            if (!(head.length >= 12
                    && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                    && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P')) {
                throw new IllegalArgumentException("Contenido no es WEBP válido");
            }
            return;
        }

        // PDF: "%PDF-"
        if (ext.equals("pdf")) {
            if (!(head.length >= 5
                    && head[0] == '%' && head[1] == 'P' && head[2] == 'D' && head[3] == 'F' && head[4] == '-')) {
                throw new IllegalArgumentException("Contenido no es PDF válido");
            }
            return;
        }

        // MP4: bytes 4..7 == "ftyp"
        if (ext.equals("mp4")) {
            if (!(head.length >= 8
                    && head[4] == 'f' && head[5] == 't' && head[6] == 'y' && head[7] == 'p')) {
                throw new IllegalArgumentException("Contenido no es MP4 válido");
            }
            return;
        }

        // WEBM (Matroska): EBML header 1A 45 DF A3
        if (ext.equals("webm")) {
            if (!(head.length >= 4
                    && (head[0] & 0xFF) == 0x1A
                    && (head[1] & 0xFF) == 0x45
                    && (head[2] & 0xFF) == 0xDF
                    && (head[3] & 0xFF) == 0xA3)) {
                throw new IllegalArgumentException("Contenido no es WEBM válido");
            }
            return;
        }

        // Extensión permitida pero sin validador: bloquear por defecto
        throw new IllegalArgumentException("Tipo de archivo no validable (magic-bytes) para ext=" + ext);
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
