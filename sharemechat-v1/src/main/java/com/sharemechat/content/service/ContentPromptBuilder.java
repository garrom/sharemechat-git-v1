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

        if (ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED.equals(runType)) {
            // FULL_ARTICLE_ORCHESTRATED (ADR-014) delega el pipeline editorial en
            // las skills personales versionadas en docs/cms/skills/. Reemplaza al
            // antiguo FULL_ARTICLE (ADR-013) que concentraba el pipeline en un
            // unico prompt monolitico.
            appendFullArticleOrchestratedPipeline(sb, ctx);
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
        sb.append("    - draft_markdown DEBE ser Markdown CommonMark/GFM puro, copiable\n");
        sb.append("      directamente al CMS sin retoques. Sintaxis LITERAL obligatoria:\n");
        sb.append("      * cada H2 empieza con \"## \" (dos almohadillas y UN espacio) en linea propia\n");
        sb.append("        ejemplo literal: ## Titulo de seccion\n");
        sb.append("      * cada H3 empieza con \"### \" (tres almohadillas y UN espacio) en linea propia\n");
        sb.append("        ejemplo literal: ### Titulo de subseccion\n");
        sb.append("      * NUNCA usar H1: el titulo principal lo gestiona el blog\n");
        sb.append("      * cada parrafo separado del siguiente por UNA linea en blanco (doble \\n)\n");
        sb.append("      * listas no ordenadas con guion-espacio: \"- elemento\" en linea propia\n");
        sb.append("      * listas ordenadas con \"1. elemento\", \"2. elemento\", ...\n");
        sb.append("      * negritas con doble asterisco: **texto** (puntual, no decoracion)\n");
        sb.append("      * cursiva con asterisco simple: *texto*\n");
        sb.append("      * citas con \"> texto citado\" en linea propia\n");
        sb.append("      * enlaces con sintaxis [texto](https://example.com)\n");
        sb.append("    - PROHIBIDO en draft_markdown:\n");
        sb.append("      * cualquier HTML inline (<p>, <br>, <strong>, <em>, <ul>, <ol>, <li>,\n");
        sb.append("        <h1>, <h2>, <h3>, <a>, <div>, <span>, <table>, <tr>, <td>, etc.)\n");
        sb.append("      * formato visual del chat: si tu interfaz muestra negrita pero no\n");
        sb.append("        emites \"**\" literalmente, eso llega al CMS como texto plano\n");
        sb.append("      * indentacion arbitraria que no forme parte de listas o blockquotes\n");
        sb.append("      * lineas separadas con un solo \\n cuando deberian ser parrafos distintos\n");
        sb.append("    - draft_markdown debe poder copiarse y pegarse TAL CUAL en el CMS\n");
        sb.append("      conservando jerarquia (titulos, parrafos, listas, negritas)\n");
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
                || ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED.equals(runType);
        boolean reviewOrSeo = ContentConstants.RUN_TYPE_REVIEW.equals(runType)
                || ContentConstants.RUN_TYPE_SEO.equals(runType);

        sb.append("<research_directives>\n");
        sb.append("  El backend del CMS NO realiza busqueda web. La investigacion debe\n");
        sb.append("  hacerla Claude Cowork directamente en internet, accediendo a fuentes\n");
        sb.append("  reales y citandolas literalmente en sources_used.\n");
        if (researchHeavy) {
            int minSources = ContentConstants.RUN_TYPE_RESEARCH.equals(runType) ? 5
                    : ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED.equals(runType) ? 5 : 3;
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
     * Pipeline orquestado para FULL_ARTICLE_ORCHESTRATED (ADR-014 + ADR-023).
     *
     * Pipeline bilingue ES+EN: incluye fase 4.5 (cms-translate-en) entre la
     * fase 4 (cms-brand-legal-review) y la fase 5 (cms-json-builder). La 4.5
     * se ejecuta POR DEFECTO; opt-out con la marca textual "skip translate-en"
     * en el mensaje al lanzar el pipeline en Cowork.
     *
     * El backend NO ejecuta las skills: solo nombra las skills personales
     * que Claude Cowork debe invocar en orden, declara la estructura del
     * directorio de trabajo en disco y describe el output esperado. La
     * orquestacion concreta de las fases la encapsula la skill
     * `cms-orchestrator` en Cowork (creada por el operador).
     *
     * Output del run: REPORTE ESTRUCTURADO en texto plano (no JSON). Los
     * ficheros final_es.json y final_en.json (si la 4.5 se ejecuto) quedan
     * en disco bajo 05_final/ del working_dir. El operador los abre y los
     * pega manualmente en el admin del CMS uno cada vez, sin cambios en el
     * endpoint admin.
     *
     * Las skills referenciadas estan versionadas (en stubs) en
     * `docs/cms/skills/` del repositorio.
     */
    private void appendFullArticleOrchestratedPipeline(StringBuilder sb,
                                                       ContentAIProvider.PromptContext ctx) {
        sb.append("<full_article_orchestrated_pipeline>\n");
        sb.append("  Este run es FULL_ARTICLE_ORCHESTRATED. Actuas como orquestador\n");
        sb.append("  editorial: invocas en orden las skills personales listadas mas abajo,\n");
        sb.append("  dejas que cada una escriba sus artefactos en disco bajo el working_dir\n");
        sb.append("  indicado y, al terminar, emites como output un REPORTE ESTRUCTURADO\n");
        sb.append("  en texto plano (no JSON) con los datos clave del run. Los ficheros\n");
        sb.append("  final_es.json y final_en.json quedan en disco bajo 05_final/; el\n");
        sb.append("  operador los abre y los pega manualmente en el admin del CMS, uno\n");
        sb.append("  cada vez.\n");
        sb.append("\n");
        sb.append("  Pipeline bilingue ES+EN (ADR-023): incluye fase 4.5 (cms-translate-en)\n");
        sb.append("  entre la fase 4 y la 5. La 4.5 se ejecuta POR DEFECTO. Opt-out: si el\n");
        sb.append("  operador incluye la cadena literal \"skip translate-en\" en su mensaje\n");
        sb.append("  al lanzar el pipeline, la 4.5 se salta y la 5 emite solo final_es.json\n");
        sb.append("  (equivalente al pipeline monolingue de ADR-014).\n");
        sb.append("\n");
        sb.append("  Si tus skills personales contienen referencias historicas a un bloque\n");
        sb.append("  <full_article_pipeline> con seis fases inline (ADR-013, ya superseded),\n");
        sb.append("  IGNORA esa orquestacion antigua. La orquestacion vigente es la que\n");
        sb.append("  describe este bloque <full_article_orchestrated_pipeline>.\n");
        sb.append("\n");
        sb.append("  <skills_pipeline>\n");
        sb.append("    Orden estricto. No avances a la siguiente skill sin haber escrito\n");
        sb.append("    los artefactos esperados de la actual.\n");
        sb.append("\n");
        sb.append("    1.   cms-research-seo       -> 01_research/  (research.json,\n");
        sb.append("                                                  sources.md, intent.json,\n");
        sb.append("                                                  outline.json)\n");
        sb.append("    2.   cms-draft-writer       -> 02_draft/     (draft.md)\n");
        sb.append("    3.   cms-editorial-polish   -> 03_polish/    (draft.polished.md)\n");
        sb.append("    4.   cms-brand-legal-review -> 04_review/    (risk_notes.json,\n");
        sb.append("                                                  fact_check_notes.json,\n");
        sb.append("                                                  draft.reviewed.md)\n");
        sb.append("    4.5. cms-translate-en       -> 04_review/    (reviewed_en.md con\n");
        sb.append("                                                  bloque metadata al final:\n");
        sb.append("                                                  SUGGESTED_SLUG_EN,\n");
        sb.append("                                                  SUGGESTED_SEO_TITLE_EN,\n");
        sb.append("                                                  SUGGESTED_META_DESC_EN).\n");
        sb.append("                                                  Se ejecuta POR DEFECTO\n");
        sb.append("                                                  salvo \"skip translate-en\".\n");
        sb.append("    5.   cms-json-builder       -> 05_final/     (final_es.json y, si la\n");
        sb.append("                                                  fase 4.5 se ejecuto,\n");
        sb.append("                                                  final_en.json)\n");
        sb.append("\n");
        sb.append("    sharemechat-voice se aplica de forma transversal en cada paso\n");
        sb.append("    (no produce artefactos propios; impone tono, prohibiciones de\n");
        sb.append("    marca y registro).\n");
        sb.append("  </skills_pipeline>\n");
        sb.append("\n");
        sb.append("  <working_dir>\n");
        sb.append("    Crea o reutiliza el directorio de trabajo:\n");
        sb.append("      cowork/sharemechat/article-").append(safe(ctx.articleId()))
                .append("/run-").append(Instant.now().toEpochMilli()).append("/\n");
        sb.append("    con la siguiente estructura inicial:\n");
        sb.append("      01_research/   (cms-research-seo)\n");
        sb.append("      02_draft/      (cms-draft-writer)\n");
        sb.append("      03_polish/     (cms-editorial-polish)\n");
        sb.append("      04_review/     (cms-brand-legal-review)\n");
        sb.append("      05_final/      (cms-json-builder)\n");
        sb.append("    Todos los artefactos intermedios (json, md) se escriben en disco;\n");
        sb.append("    no los embebas en la respuesta final. Los ficheros 05_final/final_es.json\n");
        sb.append("    y (si la 4.5 se ejecuto) 05_final/final_en.json quedan en disco para\n");
        sb.append("    que el operador los pegue manualmente en el admin del CMS. El output\n");
        sb.append("    del run es el reporte estructurado descrito en <output_rules>.\n");
        sb.append("  </working_dir>\n");
        sb.append("\n");
        sb.append("  <brief>\n");
        sb.append("    El brief editorial completo es el bloque entre los marcadores\n");
        sb.append("    <<<BEGIN_BRIEF>>> y <<<END_BRIEF>>>. cms-research-seo lo lee como\n");
        sb.append("    entrada principal y las skills posteriores tambien tienen acceso\n");
        sb.append("    a el a traves del working_dir o de tu memoria de la conversacion.\n");
        sb.append("\n");
        sb.append("    <<<BEGIN_BRIEF>>>\n");
        sb.append("    title:    ").append(safe(ctx.title())).append('\n');
        sb.append("    slug:     ").append(safe(ctx.slug())).append('\n');
        sb.append("    locale:   ").append(safe(ctx.locale())).append('\n');
        sb.append("    category: ").append(safe(ctx.category())).append('\n');
        sb.append("    keywords: ").append(safe(ctx.keywordsJson())).append('\n');
        sb.append("    state:    ").append(safe(ctx.currentState())).append('\n');
        sb.append("    brief:\n");
        sb.append("    ").append(safe(ctx.brief())).append('\n');
        sb.append("    <<<END_BRIEF>>>\n");
        sb.append("  </brief>\n");
        sb.append("\n");
        sb.append("  <output_rules>\n");
        sb.append("    - el output del run es un REPORTE ESTRUCTURADO en texto plano (no\n");
        sb.append("      JSON), emitido por la skill cms-orchestrator de Cowork. El reporte\n");
        sb.append("      resume: title, slug ES, slug EN (si aplica), ficheros generados,\n");
        sb.append("      self_check_passed de cada JSON, validaciones clave y proximos\n");
        sb.append("      pasos para el operador (que JSON pegar primero en el admin).\n");
        sb.append("    - los ficheros final_es.json y final_en.json quedan en disco bajo\n");
        sb.append("      05_final/ del working_dir. El operador los abre, copia y pega\n");
        sb.append("      manualmente al CMS uno cada vez (mismo flujo de import monolingue\n");
        sb.append("      de ADR-014; el backend no cambia su endpoint).\n");
        sb.append("    - run_type de cada JSON DEBE ser exactamente \"FULL_ARTICLE_ORCHESTRATED\".\n");
        sb.append("    - schema_version DEBE ser exactamente \"")
                .append(ContentConstants.AI_OUTPUT_SCHEMA_VERSION).append("\".\n");
        sb.append("    - cada JSON debe pasar la validacion reforzada del backend\n");
        sb.append("      individualmente:\n");
        sb.append("        * sources_used >= 5\n");
        sb.append("        * article_outline >= 4\n");
        sb.append("        * draft_markdown >= 800 chars\n");
        sb.append("        * seo_title <= 60 chars (NO null)\n");
        sb.append("        * meta_description <= 160 chars (NO null)\n");
        sb.append("        * target_keywords con al menos un type=primary\n");
        sb.append("        * self_check_passed = true (run atomico, no admite parcial)\n");
        sb.append("    - final_es.json tiene parent_slug=null (raiz).\n");
        sb.append("    - final_en.json (si la 4.5 se ejecuto) tiene parent_slug =\n");
        sb.append("      suggested_slug del final_es.json (debe coincidir LITERALMENTE).\n");
        sb.append("    - sources_used, article_outline, search_intent y target_keywords\n");
        sb.append("      deben coincidir entre final_es.json y final_en.json (campos\n");
        sb.append("      compartidos: no se traducen).\n");
        sb.append("    - language=\"es\" en final_es.json; language=\"en\" en final_en.json.\n");
        sb.append("    - si una skill no logra cumplir un criterio, corrige antes de\n");
        sb.append("      emitir; no emitas un JSON con self_check_passed=false salvo que\n");
        sb.append("      el problema sea irrecuperable en este run.\n");
        sb.append("  </output_rules>\n");
        sb.append("</full_article_orchestrated_pipeline>\n\n");
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
        if (ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED.equals(runType)) {
            sb.append("  Validacion reforzada FULL_ARTICLE_ORCHESTRATED (rechazo si falla):\n");
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
        sb.append("  Verifica especificamente sobre draft_markdown (cuando aplique):\n");
        sb.append("    - contiene al menos DOS H2 literales (lineas que empiezan por \"## \")\n");
        sb.append("    - los parrafos estan separados por al menos UNA linea en blanco\n");
        sb.append("    - NO contiene HTML inline (sin <p>, <br>, <strong>, <em>, <ul>, <ol>,\n");
        sb.append("      <li>, <h1>, <h2>, <h3>, <a>, <div>, <span>, <table>, <tr>, <td>)\n");
        sb.append("    - NO depende de formato visual del chat: si la negrita o el titulo\n");
        sb.append("      no llegan con la sintaxis Markdown literal (** o ##), no cuentan\n");
        sb.append("    - el draft_markdown se podria copiar y pegar tal cual al CMS\n");
        sb.append("      conservando jerarquia (titulos, parrafos, listas, negritas)\n");
        sb.append("  Si CUALQUIERA de los puntos anteriores falla, debes CORREGIR\n");
        sb.append("  draft_markdown antes de emitir el JSON final, no marcarlo como warning.\n");
        sb.append("  Si tras corregir aun detectas problemas no resolubles, marca\n");
        sb.append("  self_check_passed=false y enumera fallos en self_check_failures;\n");
        sb.append("  emite igualmente el JSON.\n");
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
