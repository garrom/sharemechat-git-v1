package com.sharemechat.content.service;

import com.sharemechat.content.dto.ValidationErrorDTO;

import java.util.List;

/**
 * Interfaz provider-agnostic del CMS para integracion IA.
 * Fase 3A solo expone el modo manual structured: el backend construye prompts
 * y valida outputs JSON pegados por el editor; no llama a ninguna API externa.
 *
 * Implementaciones futuras (API directa, otros proveedores) deben respetar
 * este contrato sin que el dominio editorial cambie.
 */
public interface ContentAIProvider {

    /** Identificador estable del proveedor (se persiste en model_provider). */
    String providerName();

    /** Modo operativo (MANUAL_STRUCTURED, API_HYBRID, ...). */
    String mode();

    /**
     * Construye el prompt expandido y firmado para un run dado.
     * El texto resultante es lo que el editor copia y pega en Claude Cowork.
     */
    String buildPrompt(PromptContext context);

    /**
     * Valida un output crudo pegado por el editor.
     * Devuelve resultado con errores; nunca lanza por fallos de formato.
     */
    OutputValidationResult validateOutput(String runType, String rawOutput);

    /**
     * Whitelist defensiva de model_id que el adaptador acepta declarar.
     * Vacio o null en el modelId del editor -> rechazo por validacion.
     */
    boolean isModelAllowed(String modelId);

    /**
     * Identificador semantico del template usado para construir el prompt.
     * Convencion: "<RUN_TYPE>/v<N>". Se persiste en prompt_template_id.
     */
    String resolveTemplateId(String runType);

    /**
     * Keywords SEO per-locale que el operador declara antes de lanzar el run
     * (ADR-045 D1/D3/D8). Formato:
     *  - {@code primary}: string no vacio (autoritativo) o null si el operador
     *    no lo declaro. Solo permitido null en EN por el gate D3.
     *  - {@code secondaries}: lista de terminos secundarios (0..5). Nunca null;
     *    se materializa como lista inmutable via {@code List.copyOf}. Puede
     *    estar vacia si el operador no aporto secondaries.
     *
     * La instancia se construye en {@code ContentRunService.createRun} leyendo
     * de {@code content_article_translations.target_keywords} y parseando el
     * JSON via {@code ContentArticleService.parseTargetKeywords}. El
     * {@code ContentPromptBuilder} la emite en el bloque
     * {@code <locale_input locale="X">} del prompt.
     */
    record LocaleKeywords(String primary, List<String> secondaries) {
        public LocaleKeywords {
            secondaries = secondaries == null ? List.of() : List.copyOf(secondaries);
        }
        public static LocaleKeywords empty() {
            return new LocaleKeywords(null, List.of());
        }
    }

    /**
     * Contexto de input editorial pasado al prompt (ADR-025, schema 2.0; brief
     * reubicado por ADR-027; keywords SEO per-locale por ADR-045).
     *
     * Post-rediseno bilingue: el articulo es logico, no monolingue. El
     * contexto trae los datos compartidos (category, hero_image_url, estado)
     * + los datos del locale base ES (slug ES, title ES, brief ES) que el
     * operador fijo al crear + las keywords SEO per-locale declaradas via
     * PATCH translation (ADR-045).
     *
     * Nota ADR-045 D5: {@code keywordsJson} (compartido, legacy) se mantiene
     * como field aditivo por retro-compat con el flujo legacy admin, pero el
     * {@code ContentPromptBuilder} YA NO lo emite en el prompt. La retirada
     * estructural del campo llega en un ADR futuro junto con el DROP de
     * {@code content_articles.keywords}.
     */
    record PromptContext(
            String runType,
            Long articleId,
            String slugEs,
            String titleEs,
            String brief,
            String category,
            String keywordsJson,
            String heroImageUrl,
            String currentState,
            Long currentVersionId,
            Long triggeringUserId,
            LocaleKeywords keywordsEs,
            LocaleKeywords keywordsEn
    ) {}

    /**
     * Resultado de la validacion de un output crudo.
     * - valid: true si pasa todos los checks
     * - errors: lista de errores para el editor (vacia si valid)
     * - canonicalJson: JSON re-serializado canonico (presente solo si valid),
     *   contenido a guardar en output_validated.json en S3
     */
    record OutputValidationResult(
            boolean valid,
            List<ValidationErrorDTO> errors,
            String canonicalJson
    ) {}
}
