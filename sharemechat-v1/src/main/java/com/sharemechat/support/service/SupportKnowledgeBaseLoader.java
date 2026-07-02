package com.sharemechat.support.service;

import com.sharemechat.support.config.ClaudeApiProperties;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;
import java.util.stream.Collectors;

/**
 * Carga la base de conocimiento (Markdown) desde el classpath al arrancar
 * el backend (DEC-CS-4). El operador puede anadir/quitar ficheros .md sin
 * requerir cambios de codigo, se recargan en el siguiente restart.
 *
 * <p>La cadena resultante se pasa al system prompt de cada llamada Claude
 * con {@code cache_control} para reducir coste 90% en hits subsecuentes
 * (DEC-CS-13).
 */
@Service
public class SupportKnowledgeBaseLoader {

    private static final Logger log = LoggerFactory.getLogger(SupportKnowledgeBaseLoader.class);

    private final ClaudeApiProperties props;
    private String cachedKnowledgeBase = "";
    private int fileCount = 0;

    public SupportKnowledgeBaseLoader(ClaudeApiProperties props) {
        this.props = props;
    }

    @PostConstruct
    void init() {
        reload();
    }

    public synchronized void reload() {
        try {
            String dir = props.getKbDirectory();
            if (dir == null || dir.isBlank()) {
                log.warn("[SUPPORT-KB] directory not configured; empty KB");
                this.cachedKnowledgeBase = "";
                this.fileCount = 0;
                return;
            }
            String pattern = dir.endsWith("/") ? dir + "*.md" : dir + "/*.md";
            ResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources(pattern);
            Arrays.sort(resources, Comparator.comparing(r -> r.getFilename() == null ? "" : r.getFilename()));

            StringBuilder sb = new StringBuilder();
            int loaded = 0;
            for (Resource r : resources) {
                String name = r.getFilename();
                if (name == null || "README.md".equalsIgnoreCase(name)) continue;
                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(r.getInputStream(), StandardCharsets.UTF_8))) {
                    sb.append("\n\n===== ").append(name).append(" =====\n\n");
                    String line;
                    while ((line = br.readLine()) != null) {
                        sb.append(line).append('\n');
                    }
                    loaded++;
                } catch (IOException ex) {
                    log.warn("[SUPPORT-KB] failed to read {}: {}", name, ex.getMessage());
                }
            }
            this.cachedKnowledgeBase = sb.toString();
            this.fileCount = loaded;
            log.info("[SUPPORT-KB] loaded {} markdown files from {} (chars={})",
                    fileCount, dir, cachedKnowledgeBase.length());
        } catch (IOException ex) {
            log.warn("[SUPPORT-KB] init failure: {}", ex.getMessage());
            this.cachedKnowledgeBase = "";
            this.fileCount = 0;
        }
    }

    public String getKnowledgeBase() {
        return cachedKnowledgeBase;
    }

    public int getFileCount() {
        return fileCount;
    }
}
