package com.sharemechat.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.Objects;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    @Value("${app.storage.local.root:/usr/share/nginx/html/uploads}")
    private String root; // ruta real en disco donde Nginx sirve /uploads/*

    @Override
    public String store(MultipartFile file, String keyPrefix) throws IOException {
        String safeName = UUID.randomUUID() + "-" +
                Objects.requireNonNull(file.getOriginalFilename()).replaceAll("[^a-zA-Z0-9._-]", "_");
        Path dir = Paths.get(root, keyPrefix).normalize();
        Files.createDirectories(dir);
        Path dest = dir.resolve(safeName);
        Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);
        // URL pública servida por Nginx
        return "/uploads/" + keyPrefix + "/" + safeName;
    }

    @Override
    public void deleteByPublicUrl(String publicUrl) throws IOException {
        if (publicUrl == null || publicUrl.isBlank()) return;

        // Debe empezar por /uploads/
        final String prefix = "/uploads/";
        if (!publicUrl.startsWith(prefix)) return;

        // Mapear URL pública a ruta física
        String relative = publicUrl.substring(prefix.length());
        Path target = Paths.get(root).resolve(relative).normalize();

        // Evitar path traversal
        Path rootPath = Paths.get(root).toAbsolutePath().normalize();
        if (!target.toAbsolutePath().startsWith(rootPath)) {
            throw new SecurityException("Ruta fuera del root de storage");
        }

        // Borrado best-effort
        try {
            Files.deleteIfExists(target);
        } catch (NoSuchFileException ignore) {
            // ya no existe
        }
    }
}
