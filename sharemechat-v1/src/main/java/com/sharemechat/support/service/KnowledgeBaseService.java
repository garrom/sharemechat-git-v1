package com.sharemechat.support.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.sharemechat.support.entity.SupportBotPrompt;
import com.sharemechat.support.repository.SupportBotPromptRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * ADR-044: fuente en memoria de la Base de Conocimiento del Agente IA de soporte.
 *
 * <p>Tras Fase 1.D, este service es la ÚNICA fuente en runtime del contenido de la
 * BdC. {@code SupportBotService.buildSystemPrompt} obtiene cada bloque por
 * {@link #getPromptContent(String)}. La BdC del JAR ya no existe: los
 * {@code .md} bajo {@code resources/knowledge-base/} fueron retirados y el
 * antiguo {@code SupportKnowledgeBaseLoader} fue eliminado.</p>
 *
 * <p>La caché se hidrata al arrancar (@PostConstruct) y sólo se refresca por
 * llamada explícita a {@link #reload()} desde KnowledgeBaseAdminController. No
 * hay TTL: los cambios en la tabla no se propagan hasta que el operador ejecute
 * el endpoint /reload.</p>
 *
 * <p>Higiene de logs: nunca se loguea el {@code content} de un prompt; sólo su
 * {@code case_key} y conteos.</p>
 */
@Service
public class KnowledgeBaseService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseService.class);

    private final SupportBotPromptRepository repository;

    private final AtomicReference<Cache<String, String>> cacheRef =
            new AtomicReference<>(Caffeine.newBuilder().build());

    private volatile LocalDateTime lastLoadedAt;
    private volatile long lastLoadedCount;

    public KnowledgeBaseService(SupportBotPromptRepository repository) {
        this.repository = repository;
    }

    @PostConstruct
    void hydrateOnStartup() {
        try {
            long loaded = loadIntoNewCache();
            log.info("KnowledgeBaseService hydrated at startup: {} active prompts loaded", loaded);
        } catch (Exception e) {
            // Post-Fase 1.D: no hay BdC en el JAR como fallback. Si la hidratación
            // falla, la caché queda vacía y SupportBotService loguea WARN
            // "[SUPPORT-BOT] KB missing prompt" por cada case_key sin resolver.
            // El bot sigue respondiendo pero sin BdC efectiva. El operador debe
            // ejecutar /reload en cuanto detecte el WARN de arranque.
            log.warn("KnowledgeBaseService failed to hydrate at startup ({}). " +
                    "Continuing with empty cache; operator must run /reload once BD is reachable.",
                    e.getClass().getSimpleName());
        }
    }

    /**
     * Recarga completa desde MySQL. Construye una caché nueva, la puebla y sustituye
     * la referencia atómicamente para no bloquear lecturas concurrentes.
     *
     * @return número de prompts activos cargados.
     */
    public long reload() {
        long loaded = loadIntoNewCache();
        log.info("KnowledgeBaseService reloaded: {} active prompts in cache", loaded);
        return loaded;
    }

    private long loadIntoNewCache() {
        List<SupportBotPrompt> active = repository.findAllByActive(true);
        Cache<String, String> next = Caffeine.newBuilder().build();
        for (SupportBotPrompt p : active) {
            String key = p.getCaseKey();
            String content = p.getContent();
            if (key == null || content == null) {
                continue;
            }
            next.put(key, content);
        }
        cacheRef.set(next);
        lastLoadedAt = LocalDateTime.now();
        lastLoadedCount = active.size();
        return active.size();
    }

    /**
     * Devuelve el contenido markdown del prompt identificado por {@code caseKey},
     * o {@link Optional#empty()} si no está en caché (inactivo, no existente, o
     * la caché no llegó a hidratarse).
     */
    public Optional<String> getPromptContent(String caseKey) {
        if (caseKey == null || caseKey.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(cacheRef.get().getIfPresent(caseKey));
    }

    /**
     * Diagnóstico para el endpoint admin /reload y /seed-from-jar. Devuelve
     * únicamente conteos y timestamps — nunca content de prompts.
     */
    public Map<String, Object> getStats() {
        Cache<String, String> current = cacheRef.get();
        long size = current.estimatedSize();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("cachedPromptCount", size);
        stats.put("lastLoadedCount", lastLoadedCount);
        stats.put("lastLoadedAt", lastLoadedAt);
        return stats;
    }
}
