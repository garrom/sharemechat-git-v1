package com.sharemechat.content.service;

import com.sharemechat.content.constants.ContentConstants;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Construye el texto del prompt expandido por tipo de run.
 * El editor copia el resultado y lo despacha en Claude Cowork.
 *
 * Estructura comun (XML semantico) para que Claude trate cada bloque
 * como seccion independiente:
 *   <run_metadata>, <editorial_input>, <constraints>,
 *   <research_directives>, <output_contract>, <self_check>
 * Las secciones se rellenan o se omiten segun run_type.
 */
@Component
public class ContentPromptBuilder {

    public String build(String runType, ContentAIProvider.PromptContext ctx) {
        StringBuilder sb = new StringBuilder(4096);

        appendRunMetadata(sb, runType, ctx);
        appendEditorialInput(sb, ctx);
        appendConstraints(sb, ctx);
        appendResearchDirectives(sb, runType);

        if (ContentConstants.RUN_TYPE_FULL_ARTICLE.equals(runType)) {
            // FULL_ARTICLE (ADR-013) ejecuta pipeline multi-rol explicito en un solo prompt
            appendFullArticlePipeline(sb);
        }

        appendOutputContract(sb, runType);
        appendSelfCheck(sb);

        return sb.toString();
    }

    private void appendRunMetadata(StringBuilder sb, String runType,
                                   ContentAIProvider.PromptContext ctx) {
        sb.append("<run_metadata>\n");
        sb.append("  run_type: ").append(runType).append('\n');
        sb.append("  template_id: ").append(runType).append('/')
                .append(ContentConstants.PROMPT_TEMPLATE_VERSION).append('\n');
        sb.append("  schema_version: ").append(ContentConstants.AI_OUTPUT_SCHEMA_VERSION).append('\n');
        sb.append("  article_id: ").append(ctx.articleId()).append('\n');
        sb.append("  triggered_at: ").append(Instant.now()).append('\n');
        sb.append("  triggered_by_user_id: ").append(safe(ctx.triggeringUserId())).append('\n');
        sb.append("</run_metadata>\n\n");
    }

    private void appendEditorialInput(StringBuilder sb, ContentAIProvider.PromptContext ctx) {
        sb.append("<editorial_input>\n");
        sb.append("  slug: ").append(safe(ctx.slug())).append('\n');
        sb.append("  locale: ").append(safe(ctx.locale())).append('\n');
        sb.append("  title: ").append(safe(ctx.title())).append('\n');
        sb.append("  category: ").append(safe(ctx.category())).append('\n');
        sb.append("  brief: ").append(safe(ctx.brief())).append('\n');
        sb.append("  keywords: ").append(safe(ctx.keywordsJson())).append('\n');
        sb.append("  current_state: ").append(safe(ctx.currentState())).append('\n');
        sb.append("  current_version_id: ").append(safe(ctx.currentVersionId())).append('\n');
        sb.append("</editorial_input>\n\n");
    }

    private void appendConstraints(StringBuilder sb, ContentAIProvider.PromptContext ctx) {
        sb.append("<constraints>\n");
        sb.append("  legal:\n");
        sb.append("    - no afirmar cifras economicas no verificables\n");
        sb.append("    - no comparar competidores nombrandolos negativamente\n");
        sb.append("    - DSA: marcar claims poleimicos en risk_notes\n");
        sb.append("    - GDPR: no pedir datos personales al lector en el cuerpo\n");
        sb.append("  brand:\n");
        sb.append("    - no mencionar packs ni precios concretos (catalogo volatil)\n");
        sb.append("    - no prometer disponibilidad 24/7\n");
        sb.append("    - tono sobrio, sin sensacionalismo\n");
        sb.append("  format:\n");
        sb.append("    - markdown puro, sin HTML inline\n");
        sb.append("    - headings H2/H3 unicamente (no usar H1, lo gestiona el blog)\n");
        sb.append("    - longitud objetivo draft: 1200-1800 palabras\n");
        sb.append("    - links solo a dominios listados o sources_used; nada a competidores comerciales\n");
        sb.append("  language:\n");
        sb.append("    - locale del articulo: ").append(safe(ctx.locale())).append('\n');
        sb.append("    - registro neutro y profesional\n");
        sb.append("</constraints>\n\n");
    }

    private void appendResearchDirectives(StringBuilder sb, String runType) {
        boolean researchHeavy = ContentConstants.RUN_TYPE_RESEARCH.equals(runType)
                || ContentConstants.RUN_TYPE_DRAFT.equals(runType)
                || ContentConstants.RUN_TYPE_FULL_ARTICLE.equals(runType);
        boolean reviewOrSeo = ContentConstants.RUN_TYPE_REVIEW.equals(runType)
                || ContentConstants.RUN_TYPE_SEO.equals(runType);

        sb.append("<research_directives>\n");
        sb.append("  El backend del CMS NO realiza busqueda web. La investigacion debe\n");
        sb.append("  hacerla Claude Cowork directamente en internet, accediendo a fuentes\n");
        sb.append("  reales y citandolas literalmente en sources_used.\n");
        if (researchHeavy) {
            int minSources = ContentConstants.RUN_TYPE_RESEARCH.equals(runType) ? 5
                    : ContentConstants.RUN_TYPE_FULL_ARTICLE.equals(runType) ? 5 : 3;
            sb.append("  required_sources_min: ").append(minSources).append('\n');
            sb.append("  source_quality:\n");
            sb.append("    - prioridad: medios establecidos, papers, regulacion oficial\n");
            sb.append("    - aceptable: blogs especializados con autoria visible\n");
            sb.append("    - rechazar: forums anonimos, agregadores SEO sin firma\n");
            sb.append("  freshness: preferir fuentes de los ultimos 18 meses; marcar si mas antiguas\n");
            sb.append("  competitor_analysis: identificar 3-5 articulos top en SERP para target_keywords\n");
            sb.append("    - resumir que cubren y que hueco editorial dejan\n");
            sb.append("  search_intent_classification: obligatoria\n");
            sb.append("  no inventar URLs; cada URL debe haber sido accedida en este run\n");
        } else if (reviewOrSeo) {
            sb.append("  Modo ").append(runType).append(": no se requiere investigacion fresca extensa.\n");
            sb.append("  Si surgen dudas factuales sobre el draft revisado, citar fuentes en sources_used.\n");
        } else {
            sb.append("  Para OUTLINE basta investigacion ligera para validar estructura y huecos.\n");
        }
        sb.append("</research_directives>\n\n");
    }

    /**
     * Pipeline interno explicito para FULL_ARTICLE (ADR-013).
     * Claude debe ejecutar las seis subfases en orden, sin saltarse ninguna,
     * y solo emitir el JSON final cuando todas hayan completado correctamente.
     */
    private void appendFullArticlePipeline(StringBuilder sb) {
        sb.append("<full_article_pipeline>\n");
        sb.append("  Este run es FULL_ARTICLE: actuas como pipeline editorial multi-rol\n");
        sb.append("  ejecutando las seis subfases siguientes en orden estricto. No avances\n");
        sb.append("  a la siguiente subfase hasta completar la anterior. Solo emite el JSON\n");
        sb.append("  final cuando las seis hayan completado y self_check_passed sea true.\n");
        sb.append("\n");
        sb.append("  <phase_1_research>\n");
        sb.append("    Rol: investigador.\n");
        sb.append("    Tarea: identifica y accede a >=5 fuentes primarias reales en la web.\n");
        sb.append("    Salida interna: lista de URLs con publisher, fecha, citas literales\n");
        sb.append("    relevantes. Resuelve contradicciones entre fuentes.\n");
        sb.append("  </phase_1_research>\n");
        sb.append("\n");
        sb.append("  <phase_2_seo>\n");
        sb.append("    Rol: estratega SEO.\n");
        sb.append("    Tarea: clasifica search_intent (informational/transactional/\n");
        sb.append("    navigational/commercial). Identifica target_keywords (al menos uno\n");
        sb.append("    type=primary). Analiza 3-5 articulos top en SERP y extrae\n");
        sb.append("    competitor_insights con que cubren y que hueco dejan.\n");
        sb.append("  </phase_2_seo>\n");
        sb.append("\n");
        sb.append("  <phase_3_outline>\n");
        sb.append("    Rol: arquitecto editorial.\n");
        sb.append("    Tarea: diseña article_outline con >=4 secciones H2/H3, cada una con\n");
        sb.append("    objetivo, angulo y supporting_sources (indices a sources_used).\n");
        sb.append("    Marca risk_flags por seccion cuando aplique.\n");
        sb.append("  </phase_3_outline>\n");
        sb.append("\n");
        sb.append("  <phase_4_writer>\n");
        sb.append("    Rol: redactor.\n");
        sb.append("    Tarea: redacta draft_markdown completo respetando outline,\n");
        sb.append("    constraints (legal, brand, format, language), longitud objetivo\n");
        sb.append("    1200-1800 palabras (minimo absoluto 800 chars), citas inline a\n");
        sb.append("    sources_used. Solo Markdown puro, headings H2/H3, sin H1, sin HTML.\n");
        sb.append("  </phase_4_writer>\n");
        sb.append("\n");
        sb.append("  <phase_5_fact_check>\n");
        sb.append("    Rol: fact-checker.\n");
        sb.append("    Tarea: verifica cada claim numerico, cita o afirmacion factual\n");
        sb.append("    contra sources_used. Anota fact_check_notes con status\n");
        sb.append("    (verified|uncertain|contradicted) y source_index. Marca\n");
        sb.append("    risk_notes con kind=factual cuando un claim no quede verificable.\n");
        sb.append("  </phase_5_fact_check>\n");
        sb.append("\n");
        sb.append("  <phase_6_editor>\n");
        sb.append("    Rol: editor jefe.\n");
        sb.append("    Tarea: pase final de coherencia, tono, longitud, formato y\n");
        sb.append("    cumplimiento de constraints. Genera seo_title (<=60 chars,\n");
        sb.append("    obligatorio), meta_description (<=160 chars, obligatoria),\n");
        sb.append("    suggested_slug en kebab-case. Anota risk_notes con kind=brand,\n");
        sb.append("    legal o seo cuando corresponda. Si detectas un fallo no resoluble\n");
        sb.append("    en este run, marca self_check_passed=false con el detalle en\n");
        sb.append("    self_check_failures; el backend rechazara y se re-ejecutara.\n");
        sb.append("  </phase_6_editor>\n");
        sb.append("\n");
        sb.append("  Reglas globales:\n");
        sb.append("    - no avances a la fase siguiente sin completar la actual\n");
        sb.append("    - todas las URLs en sources_used deben referenciarse en outline,\n");
        sb.append("      fact_check_notes o citas inline; ninguna huerfana\n");
        sb.append("    - run atomico: el output debe ser aplicable sin completar piezas\n");
        sb.append("      manualmente; por eso self_check_passed=true es obligatorio para\n");
        sb.append("      pasar la validacion del backend\n");
        sb.append("</full_article_pipeline>\n\n");
    }

    private void appendOutputContract(StringBuilder sb, String runType) {
        sb.append("<output_contract>\n");
        sb.append("  formato: JSON estricto, un unico objeto raiz, sin texto fuera del JSON\n");
        sb.append("  schema_version: \"").append(ContentConstants.AI_OUTPUT_SCHEMA_VERSION).append("\"\n");
        sb.append("  campos obligatorios (todos siempre presentes; null o [] si no aplica):\n");
        sb.append("    - schema_version (string)\n");
        sb.append("    - run_type (string igual a este run)\n");
        sb.append("    - language (string)\n");
        sb.append("    - research_summary (string, hasta 800 palabras)\n");
        sb.append("    - sources_used (array de objetos con url, title, publisher,\n");
        sb.append("        published_at, accessed_at, relevance, key_points)\n");
        sb.append("    - search_intent (informational|transactional|navigational|commercial)\n");
        sb.append("    - target_keywords (array de objetos {term,type,search_intent_match})\n");
        sb.append("    - competitor_insights (array de objetos {url,what_they_cover,gap})\n");
        sb.append("    - article_outline (array de objetos {level,heading,objective,\n");
        sb.append("        supporting_sources,risk_flags})\n");
        sb.append("    - draft_markdown (string en DRAFT, null en otros run_type)\n");
        sb.append("    - seo_title (<=60 chars o null)\n");
        sb.append("    - meta_description (<=160 chars o null)\n");
        sb.append("    - suggested_slug (kebab-case o null)\n");
        sb.append("    - risk_notes (array de objetos {kind,severity,note})\n");
        sb.append("    - fact_check_notes (array de objetos {claim,status,source_index,note})\n");
        sb.append("    - self_check_passed (boolean)\n");
        sb.append("    - self_check_failures (array de strings)\n");
        if (ContentConstants.RUN_TYPE_DRAFT.equals(runType)) {
            sb.append("  draft_markdown obligatorio NO VACIO para run_type=DRAFT\n");
        }
        if (ContentConstants.RUN_TYPE_RESEARCH.equals(runType)
                || ContentConstants.RUN_TYPE_DRAFT.equals(runType)) {
            sb.append("  sources_used obligatorio NO VACIO para run_type=").append(runType).append('\n');
        }
        if (ContentConstants.RUN_TYPE_FULL_ARTICLE.equals(runType)) {
            sb.append("  Validacion reforzada FULL_ARTICLE (rechazo si falla):\n");
            sb.append("    - sources_used >= 5 elementos\n");
            sb.append("    - article_outline >= 4 secciones\n");
            sb.append("    - draft_markdown >= 800 caracteres y NO null\n");
            sb.append("    - seo_title NO null y <= 60 chars\n");
            sb.append("    - meta_description NO null y <= 160 chars\n");
            sb.append("    - target_keywords con al menos un type=primary\n");
            sb.append("    - self_check_passed = true (run atomico, no admite parcial)\n");
        }
        sb.append("</output_contract>\n\n");
    }

    private void appendSelfCheck(StringBuilder sb) {
        sb.append("<self_check>\n");
        sb.append("  Antes de emitir el JSON final, verifica:\n");
        sb.append("    - todas las URLs de sources_used son reales y accedidas en este run\n");
        sb.append("    - todos los claims numericos del draft tienen fuente en sources_used\n");
        sb.append("    - el draft no contradice constraints (legal, brand, format, language)\n");
        sb.append("    - search_intent es uno de los 4 valores permitidos\n");
        sb.append("    - longitud de draft dentro del rango sugerido\n");
        sb.append("    - run_type del output coincide con run_type de run_metadata\n");
        sb.append("  Si self_check detecta problemas, marca self_check_passed=false y\n");
        sb.append("  enumera fallos en self_check_failures; emite igualmente el JSON.\n");
        sb.append("  Nunca emitir parcial ni mezclar texto fuera del JSON.\n");
        sb.append("</self_check>\n");
    }

    private static String safe(Object v) {
        if (v == null) return "null";
        String s = String.valueOf(v);
        // Sustituir saltos de linea por espacio para no romper la estructura YAML-like
        return s.replace('\n', ' ').replace('\r', ' ');
    }
}
