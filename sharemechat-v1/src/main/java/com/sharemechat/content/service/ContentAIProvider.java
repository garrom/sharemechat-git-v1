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
     * Contexto de input editorial pasado al prompt (ADR-025, schema 2.0).
     *
     * Post-rediseno bilingue: el articulo es logico, no monolingue. El
     * contexto trae los datos compartidos (category, brief, keywords,
     * hero_image_url, estado) + los datos del locale base ES (slug ES,
     * title ES) que el operador fijo al crear. El pipeline IA produce
     * los datos del locale EN.
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
            Long triggeringUserId
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
