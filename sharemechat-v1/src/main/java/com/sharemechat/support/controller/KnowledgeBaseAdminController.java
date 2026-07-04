package com.sharemechat.support.controller;

import com.sharemechat.support.config.ClaudeApiProperties;
import com.sharemechat.support.entity.SupportBotPrompt;
import com.sharemechat.support.repository.SupportBotPromptRepository;
import com.sharemechat.support.service.KnowledgeBaseService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Collections;

/**
 * Endpoints admin para operar la Base de Conocimiento externalizada del Agente
 * IA de soporte (ADR-044).
 *
 * <p>Autorización: heredada del catch-all {@code /api/admin/**} en SecurityConfig
 * — requiere autoridad ROLE_ADMIN. No se registran matchers adicionales.</p>
 *
 * <p>Higiene: ninguna respuesta incluye el {@code content} completo de un prompt.
 * Los logs reportan únicamente {@code case_key}s y conteos.</p>
 */
@RestController
@RequestMapping("/api/admin/knowledge-base")
public class KnowledgeBaseAdminController {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseAdminController.class);

    private static final String README = "README.md";
    private static final String PLACEHOLDER = "00-placeholder.md";

    /**
     * Overrides explícitos de {@code role} para case_keys cuyo nombre de
     * fichero no revela la audiencia (Fase 1.B del refactor ADR-044).
     *
     * <p>La lógica por defecto ({@link #deriveRole(String)}) infiere el rol
     * de sufijos {@code -modelo} / {@code -cliente}. Este map cubre los
     * casos donde el fichero fuente no lleva sufijo pero el contenido es
     * específico de un rol.</p>
     *
     * <p>Añadir aquí cualquier futuro case_key que necesite forzar rol.
     * Fase 1.C podría poblar esto vía configuración; hoy es hardcoded
     * porque son 2 filas y añadir infraestructura sobra.</p>
     */
    static final Map<String, String> ROLE_OVERRIDES;
    static {
        Map<String, String> m = new HashMap<>();
        m.put("pagos-y-saldo", "CLIENT");
        m.put("payout-y-tiers", "MODEL");
        ROLE_OVERRIDES = Collections.unmodifiableMap(m);
    }

    private final KnowledgeBaseService knowledgeBaseService;
    private final SupportBotPromptRepository repository;
    private final ClaudeApiProperties props;

    public KnowledgeBaseAdminController(KnowledgeBaseService knowledgeBaseService,
                                        SupportBotPromptRepository repository,
                                        ClaudeApiProperties props) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.repository = repository;
        this.props = props;
    }

    /**
     * Recarga completa de la caché desde la tabla {@code support_bot_prompts}.
     * Idempotente. Sustituye la caché atómicamente (no bloquea lecturas).
     */
    @PostMapping("/reload")
    public ResponseEntity<Map<String, Object>> reload() {
        long loaded = knowledgeBaseService.reload();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reloaded", true);
        body.put("cachedPromptCount", loaded);
        body.putAll(knowledgeBaseService.getStats());
        log.info("[KB-ADMIN] reload requested — {} active prompts now in cache", loaded);
        return ResponseEntity.ok(body);
    }

    /**
     * Migración one-shot desde los .md del JAR a la tabla
     * {@code support_bot_prompts}. Idempotente: los registros existentes por
     * {@code case_key} no se sobrescriben. Tras el seed, recarga la caché.
     */
    @PostMapping("/seed-from-jar")
    public ResponseEntity<Map<String, Object>> seedFromJar() {
        String dir = props.getKbDirectory();
        String pattern = (dir == null || dir.isBlank())
                ? "classpath:knowledge-base/*.md"
                : (dir.endsWith("/") ? dir + "*.md" : dir + "/*.md");

        List<String> inserted = new ArrayList<>();
        List<String> skippedExisting = new ArrayList<>();
        List<String> excluded = new ArrayList<>();
        List<String> failed = new ArrayList<>();

        try {
            ResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources(pattern);
            Arrays.sort(resources, Comparator.comparing(
                    r -> r.getFilename() == null ? "" : r.getFilename()));

            for (Resource r : resources) {
                String name = r.getFilename();
                if (name == null) continue;
                if (README.equalsIgnoreCase(name) || PLACEHOLDER.equalsIgnoreCase(name)) {
                    excluded.add(name);
                    continue;
                }
                String caseKey = deriveCaseKey(name);
                if (caseKey == null || caseKey.isEmpty()) {
                    failed.add(name);
                    continue;
                }
                if (repository.existsByCaseKey(caseKey)) {
                    skippedExisting.add(caseKey);
                    continue;
                }
                String content;
                try {
                    content = readAll(r);
                } catch (IOException ex) {
                    log.warn("[KB-ADMIN] seed: failed to read {}: {}", name, ex.getClass().getSimpleName());
                    failed.add(caseKey);
                    continue;
                }
                String role = deriveRole(caseKey);
                SupportBotPrompt entity = new SupportBotPrompt();
                entity.setCaseKey(caseKey);
                entity.setRole(role);
                entity.setContent(content);
                entity.setDescription("Seeded from JAR: " + name);
                entity.setActive(true);
                entity.setVersion(1);
                repository.save(entity);
                inserted.add(caseKey);
                log.info("[KB-ADMIN] seed: inserted case_key={} role={} source={}",
                        caseKey, role, name);
            }
        } catch (IOException ex) {
            log.warn("[KB-ADMIN] seed: resolver failure ({})", ex.getClass().getSimpleName());
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("seeded", false);
            err.put("error", "resource_resolver_failure");
            return ResponseEntity.status(500).body(err);
        }

        long reloadedCount = knowledgeBaseService.reload();

        log.info("[KB-ADMIN] seed-from-jar: inserted={}, skipped_existing={}, excluded={}, failed={}",
                inserted.size(), skippedExisting.size(), excluded.size(), failed.size());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("seeded", true);
        body.put("insertedCount", inserted.size());
        body.put("skippedExistingCount", skippedExisting.size());
        body.put("excludedCount", excluded.size());
        body.put("failedCount", failed.size());
        body.put("insertedCaseKeys", inserted);
        body.put("skippedExistingCaseKeys", skippedExisting);
        body.put("excludedFiles", excluded);
        body.put("failedCaseKeys", failed);
        body.put("cachedPromptCountAfterReload", reloadedCount);
        return ResponseEntity.ok(body);
    }

    /**
     * Deriva la clave semántica del nombre de fichero: elimina la extensión
     * {@code .md} y el prefijo numérico. Devuelve kebab-case en minúsculas.
     *
     * <p>Dos formas de prefijo son aceptadas, en ramas explícitas:
     * <ul>
     *   <li>Rama 1 — {@code \d+-} (uno o más dígitos + guion). Ej.:
     *       {@code "12-troubleshooting-modelo.md" -> "troubleshooting-modelo"}.</li>
     *   <li>Rama 2 — {@code \d+[a-z]-} (uno o más dígitos + una letra
     *       minúscula + guion). Ej.:
     *       {@code "03b-payout-y-tiers.md" -> "payout-y-tiers"}. Introducida
     *       en Fase 1.B del refactor ADR-044 para soportar el split de un
     *       fichero temático en dos filas sin renumerar el resto.</li>
     * </ul>
     *
     * <p>Ficheros sin prefijo (p. ej. {@code "producto-general.md"}) se
     * devuelven tal cual, sin extensión.</p>
     */
    static String deriveCaseKey(String filename) {
        if (filename == null) return null;
        String base = filename;
        int dot = base.lastIndexOf('.');
        if (dot > 0) base = base.substring(0, dot);
        base = base.trim().toLowerCase();

        int i = 0;
        while (i < base.length() && Character.isDigit(base.charAt(i))) i++;
        if (i == 0) {
            // Sin prefijo numérico: nombre libre.
            return base;
        }

        // Rama 1: \d+-
        if (i < base.length() && base.charAt(i) == '-') {
            return base.substring(i + 1);
        }
        // Rama 2: \d+[a-z]-
        if (i + 1 < base.length()
                && base.charAt(i) >= 'a' && base.charAt(i) <= 'z'
                && base.charAt(i + 1) == '-') {
            return base.substring(i + 2);
        }
        // Prefijo raro (p. ej. \d+ sin guion detrás): devolver base como está.
        return base;
    }

    /**
     * Infere la audiencia del prompt desde la {@code case_key}.
     *
     * <p>Precedencia: {@link #ROLE_OVERRIDES} → sufijo {@code -modelo} (MODEL)
     * → sufijo {@code -cliente} (CLIENT) → BOTH.</p>
     */
    static String deriveRole(String caseKey) {
        if (caseKey == null) return "BOTH";
        String override = ROLE_OVERRIDES.get(caseKey);
        if (override != null) return override;
        if (caseKey.endsWith("-modelo")) return "MODEL";
        if (caseKey.endsWith("-cliente")) return "CLIENT";
        return "BOTH";
    }

    private static String readAll(Resource resource) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append('\n');
            }
        }
        return sb.toString();
    }
}
