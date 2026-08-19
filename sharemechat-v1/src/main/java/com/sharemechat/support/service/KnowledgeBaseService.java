package com.sharemechat.support.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.sharemechat.support.entity.SupportBotPrompt;
import com.sharemechat.support.repository.SupportBotPromptRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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

    // ---- ADR-060: sincronización desde la fuente en git + estado con hashes ----

    /**
     * ADR-060: UPSERT idempotente de la BdC desde la fuente en git.
     * INSERT los nuevos; UPDATE los que cambian (incrementa {@code version}
     * solo si cambia el {@code content}); soft-delete ({@code active=false})
     * de los {@code case_key} activos ausentes del payload. Nunca borra filas.
     * Al terminar, recarga la caché.
     */
    @Transactional
    public SyncResult sync(List<SyncInput> inputs) {
        SyncResult res = new SyncResult();
        if (inputs == null) {
            inputs = new ArrayList<>();
        }

        List<SupportBotPrompt> existing = repository.findAll();
        Map<String, SupportBotPrompt> byKey = new HashMap<>();
        for (SupportBotPrompt p : existing) {
            byKey.put(p.getCaseKey(), p);
        }
        Set<String> incoming = new HashSet<>();

        for (SyncInput in : inputs) {
            if (in == null || in.caseKey == null || in.caseKey.isEmpty() || in.content == null) {
                continue;
            }
            incoming.add(in.caseKey);
            String role = (in.role == null || in.role.isEmpty()) ? "BOTH" : in.role;
            SupportBotPrompt row = byKey.get(in.caseKey);
            if (row == null) {
                SupportBotPrompt n = new SupportBotPrompt();
                n.setCaseKey(in.caseKey);
                n.setRole(role);
                n.setContent(in.content);
                n.setDescription(in.description);
                n.setActive(in.active);
                n.setVersion(1);
                repository.save(n);
                res.created.add(in.caseKey);
            } else {
                boolean contentChanged = !in.content.equals(row.getContent());
                boolean metaChanged = !equalsSafe(role, row.getRole())
                        || !equalsSafe(in.description, row.getDescription())
                        || in.active != row.isActive();
                if (contentChanged || metaChanged) {
                    row.setRole(role);
                    row.setDescription(in.description);
                    row.setActive(in.active);
                    if (contentChanged) {
                        row.setContent(in.content);
                        row.setVersion(row.getVersion() + 1);
                    }
                    row.setUpdatedAt(LocalDateTime.now());
                    repository.save(row);
                    res.updated.add(in.caseKey);
                } else {
                    res.unchanged.add(in.caseKey);
                }
            }
        }

        // Soft-delete: filas activas ausentes del payload.
        for (SupportBotPrompt p : existing) {
            if (!incoming.contains(p.getCaseKey()) && p.isActive()) {
                p.setActive(false);
                p.setUpdatedAt(LocalDateTime.now());
                repository.save(p);
                res.deactivated.add(p.getCaseKey());
            }
        }

        long reloaded = reload();
        log.info("[KB-SYNC] created={} updated={} unchanged={} deactivated={} cached={}",
                res.created.size(), res.updated.size(), res.unchanged.size(),
                res.deactivated.size(), reloaded);
        return res;
    }

    /**
     * ADR-060: estado por {@code case_key} para el drift-check del script.
     * Devuelve el hash SHA-256 del {@code content} (NUNCA el content —
     * higiene ADR-044), ordenado por case_key.
     */
    public List<Map<String, Object>> state() {
        List<SupportBotPrompt> all = new ArrayList<>(repository.findAll());
        all.sort(Comparator.comparing(SupportBotPrompt::getCaseKey));
        List<Map<String, Object>> out = new ArrayList<>();
        for (SupportBotPrompt p : all) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("caseKey", p.getCaseKey());
            m.put("role", p.getRole());
            m.put("active", p.isActive());
            m.put("version", p.getVersion());
            m.put("updatedAt", p.getUpdatedAt());
            m.put("contentHash", sha256(p.getContent()));
            out.add(m);
        }
        return out;
    }

    private static boolean equalsSafe(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }

    static String sha256(String s) {
        if (s == null) {
            return null;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) {
                    sb.append('0');
                }
                sb.append(h);
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    /** Entrada de sincronización — input de {@link #sync(List)}. */
    public static final class SyncInput {
        public final String caseKey;
        public final String role;
        public final String content;
        public final String description;
        public final boolean active;

        public SyncInput(String caseKey, String role, String content,
                         String description, boolean active) {
            this.caseKey = caseKey;
            this.role = role;
            this.content = content;
            this.description = description;
            this.active = active;
        }
    }

    /** Diff resultante de {@link #sync(List)}. */
    public static final class SyncResult {
        public final List<String> created = new ArrayList<>();
        public final List<String> updated = new ArrayList<>();
        public final List<String> unchanged = new ArrayList<>();
        public final List<String> deactivated = new ArrayList<>();
    }
}
