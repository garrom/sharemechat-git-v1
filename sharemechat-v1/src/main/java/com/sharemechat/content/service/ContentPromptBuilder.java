package com.sharemechat.content.service;

import com.sharemechat.content.constants.ContentConstants;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Construye el texto del prompt expandido para el run FULL_ARTICLE_ORCHESTRATED.
 * El operador copia el resultado y lo despacha en Claude Cowork.
 *
 * Post-ADR-025 (paquete 2): schema 2.0 bilingue. El pipeline ejecuta SIEMPRE
 * las 6 fases (research -> draft -> polish -> review -> translate-en ->
 * json-builder), sin opt-out "skip translate-en". El output del run es UN
 * UNICO JSON estricto con estructura shared/locales{es,en}, no un reporte
 * en texto plano (contradiccion del paquete 0 resuelta).
 *
 * Bloques emitidos:
 *   <run_metadata>, <editorial_input>, <constraints>,
 *   <research_directives>, <full_article_orchestrated_pipeline>,
 *   <output_contract>, <self_check>
 */
@Component
public class ContentPromptBuilder {

    public String build(String runType, ContentAIProvider.PromptContext ctx) {
        if (!ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED.equals(runType)) {
            throw new IllegalArgumentException(
                    "ContentPromptBuilder solo soporta FULL_ARTICLE_ORCHESTRATED en schema 2.0");
        }
        StringBuilder sb = new StringBuilder(4096);

        appendRunMetadata(sb, runType, ctx);
        appendEditorialInput(sb, ctx);
        appendConstraints(sb);
        appendResearchDirectives(sb);
        appendFullArticleOrchestratedPipeline(sb, ctx);
        appendOutputContract(sb);
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
        sb.append("  Datos compartidos del articulo (heredan ambos locales):\n");
        sb.append("    category:           ").append(safe(ctx.category())).append('\n');
        sb.append("    hero_image_url:     ").append(safe(ctx.heroImageUrl())).append('\n');
        sb.append("    current_state:      ").append(safe(ctx.currentState())).append('\n');
        sb.append("    current_version_id: ").append(safe(ctx.currentVersionId())).append('\n');
        sb.append('\n');

        ContentAIProvider.LocaleKeywords kwEs = ctx.keywordsEs() != null
                ? ctx.keywordsEs() : ContentAIProvider.LocaleKeywords.empty();
        sb.append("  <locale_input locale=\"es\">\n");
        sb.append("    slug:               ").append(safe(ctx.slugEs())).append('\n');
        sb.append("    title:              ").append(safe(ctx.titleEs())).append('\n');
        sb.append("    brief:              ").append(safe(ctx.brief())).append('\n');
        sb.append("    primary_keyword:    ").append(quotedOrEmpty(kwEs.primary())).append('\n');
        sb.append("    secondary_keywords: ").append(quotedArray(kwEs.secondaries())).append('\n');
        sb.append("  </locale_input>\n");
        sb.append('\n');

        ContentAIProvider.LocaleKeywords kwEn = ctx.keywordsEn() != null
                ? ctx.keywordsEn() : ContentAIProvider.LocaleKeywords.empty();
        sb.append("  <locale_input locale=\"en\">\n");
        sb.append("    Nota: en EN los campos primary_keyword y secondary_keywords siguen la\n");
        sb.append("    politica ADR-045 D3:\n");
        sb.append("      - Si vienen POBLADOS, la fase 4.5 debe HONRAR esos terminos.\n");
        sb.append("        NO se puede proponer una primary distinta ni sustituir secondaries.\n");
        sb.append("      - Si vienen VACIOS, la fase 4.5 los DERIVA del ES adaptandolos al\n");
        sb.append("        mercado anglosajon (no traduccion literal).\n");
        sb.append("    primary_keyword:    ").append(quotedOrEmpty(kwEn.primary())).append('\n');
        sb.append("    secondary_keywords: ").append(quotedArray(kwEn.secondaries())).append('\n');
        sb.append("  </locale_input>\n");
        sb.append('\n');

        sb.append("  Reglas duras (el input operador es autoritativo):\n");
        sb.append("    - El slug ES lo fijo el operador al crear el articulo; NO debe cambiar.\n");
        sb.append("    - El slug EN lo decide el pipeline (skill cms-translate-en) y debe ser\n");
        sb.append("      distinto del ES por SEO.\n");
        sb.append("    - Cada primary_keyword no vacio del input es AUTORITATIVO en su locale.\n");
        sb.append("      El JSON de salida DEBE contener {term: <mismo valor>, type: 'primary'}\n");
        sb.append("      en locales.<locale>.target_keywords. Ver <output_contract> y <self_check>.\n");
        sb.append("</editorial_input>\n\n");
    }

    private void appendConstraints(StringBuilder sb) {
        sb.append("<constraints>\n");
        sb.append("  legal:\n");
        sb.append("    - no afirmar cifras economicas no verificables\n");
        sb.append("    - no comparar competidores nombrandolos negativamente\n");
        sb.append("    - DSA: marcar claims polemicos en risk_notes\n");
        sb.append("    - GDPR: no pedir datos personales al lector en el cuerpo\n");
        sb.append("  brand:\n");
        sb.append("    - no mencionar packs ni precios concretos (catalogo volatil)\n");
        sb.append("    - no prometer disponibilidad 24/7\n");
        sb.append("    - tono sobrio, sin sensacionalismo\n");
        sb.append("  format (aplica a draft_markdown de ambos locales):\n");
        sb.append("    - Markdown CommonMark/GFM puro, copiable tal cual al CMS\n");
        sb.append("    - cada H2 empieza con \"## \" (dos almohadillas y UN espacio) en linea propia\n");
        sb.append("    - cada H3 empieza con \"### \" en linea propia\n");
        sb.append("    - NUNCA usar H1: el titulo principal lo gestiona el blog\n");
        sb.append("    - cada parrafo separado del siguiente por UNA linea en blanco (doble \\n)\n");
        sb.append("    - listas no ordenadas con \"- elemento\" en linea propia\n");
        sb.append("    - listas ordenadas con \"1. elemento\", \"2. elemento\", ...\n");
        sb.append("    - negritas con **texto** (puntual, no decorativo)\n");
        sb.append("    - cursiva con *texto*\n");
        sb.append("    - citas con \"> texto citado\" en linea propia\n");
        sb.append("    - enlaces con [texto](https://example.com)\n");
        sb.append("    - PROHIBIDO HTML inline (<p>, <br>, <strong>, <em>, <ul>, <ol>, <li>,\n");
        sb.append("      <h1>, <h2>, <h3>, <a>, <div>, <span>, <table>, etc.)\n");
        sb.append("    - longitud objetivo draft: 1200-1800 palabras por locale\n");
        sb.append("    - links solo a dominios listados o sources_used; nada a competidores comerciales\n");
        sb.append("  language:\n");
        sb.append("    - locale base ES: registro neutro y profesional\n");
        sb.append("    - locale EN: traduccion adaptada al mercado anglosajon (no literal)\n");
        sb.append("</constraints>\n\n");
    }

    private void appendResearchDirectives(StringBuilder sb) {
        sb.append("<research_directives>\n");
        sb.append("  El backend del CMS NO realiza busqueda web. La investigacion la hace\n");
        sb.append("  Claude Cowork directamente en internet, accediendo a fuentes reales y\n");
        sb.append("  citandolas literalmente en shared.sources_used.\n");
        sb.append("  required_sources_min: 5\n");
        sb.append("  source_quality:\n");
        sb.append("    - prioridad: medios establecidos, papers, regulacion oficial\n");
        sb.append("    - aceptable: blogs especializados con autoria visible\n");
        sb.append("    - rechazar: forums anonimos, agregadores SEO sin firma\n");
        sb.append("  freshness: preferir fuentes de los ultimos 18 meses; marcar si mas antiguas\n");
        sb.append("  competitor_analysis: identificar 3-5 articulos top en SERP para target_keywords\n");
        sb.append("    - resumir que cubren y que hueco editorial dejan, POR LOCALE (los\n");
        sb.append("      competidores del mercado hispano y anglosajon son distintos)\n");
        sb.append("  search_intent_classification: obligatoria, POR LOCALE\n");
        sb.append("  no inventar URLs; cada URL debe haber sido accedida en este run\n");
        sb.append("</research_directives>\n\n");
    }

    /**
     * Pipeline orquestado bilingue (ADR-025, schema 2.0).
     *
     * Las 6 fases SIEMPRE se ejecutan; no hay "skip translate-en". El output
     * es un unico JSON estricto schema 2.0, no un reporte de texto.
     */
    private void appendFullArticleOrchestratedPipeline(StringBuilder sb,
                                                       ContentAIProvider.PromptContext ctx) {
        sb.append("<full_article_orchestrated_pipeline>\n");
        sb.append("  Este run es FULL_ARTICLE_ORCHESTRATED. Actuas como orquestador\n");
        sb.append("  editorial: invocas en orden las skills personales listadas abajo,\n");
        sb.append("  dejas que cada una escriba sus artefactos en disco bajo el working_dir\n");
        sb.append("  indicado y, al terminar, emites como output UN UNICO JSON estricto\n");
        sb.append("  schema 2.0 (ver <output_contract>). Sin texto fuera del JSON.\n");
        sb.append("\n");
        sb.append("  El pipeline es SIEMPRE bilingue (ES + EN). No existe opt-out.\n");
        sb.append("\n");
        sb.append("  <skills_pipeline>\n");
        sb.append("    Orden estricto. No avances a la siguiente skill sin haber escrito\n");
        sb.append("    los artefactos esperados de la actual.\n");
        sb.append("\n");
        sb.append("    1.   cms-research-seo       -> 01_research/  (research.md con fuentes,\n");
        sb.append("                                                  search_intent inicial,\n");
        sb.append("                                                  outline ES)\n");
        sb.append("    2.   cms-draft-writer       -> 02_draft/     (draft.md ES con bloque\n");
        sb.append("                                                  TRACE interno)\n");
        sb.append("    3.   cms-editorial-polish   -> 03_polish/    (polished.md ES)\n");
        sb.append("    4.   cms-brand-legal-review -> 04_review/    (reviewed.md ES,\n");
        sb.append("                                                  review_notes.md)\n");
        sb.append("    4.5. cms-translate-en       -> 04_review/    (reviewed_en.md +\n");
        sb.append("                                                  metadata SUGGESTED_*_EN)\n");
        sb.append("    5.   cms-json-builder       -> 05_final/     (final.json unico bilingue\n");
        sb.append("                                                  con shared + locales{es,en})\n");
        sb.append("\n");
        sb.append("    sharemechat-voice se aplica transversalmente; impone tono,\n");
        sb.append("    prohibiciones de marca y registro en cada paso.\n");
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
        sb.append("      04_review/     (cms-brand-legal-review + cms-translate-en)\n");
        sb.append("      05_final/      (cms-json-builder)\n");
        sb.append("    Los artefactos intermedios (md, json) viven en disco para auditoria\n");
        sb.append("    operativa; el output del run es UNICAMENTE el JSON final.\n");
        sb.append("  </working_dir>\n");
        sb.append("\n");
        sb.append("  <brief>\n");
        sb.append("    Brief editorial entre los marcadores literales:\n");
        sb.append("\n");
        sb.append("    <<<BEGIN_BRIEF>>>\n");
        sb.append("    title_es:        ").append(safe(ctx.titleEs())).append('\n');
        sb.append("    slug_es:         ").append(safe(ctx.slugEs())).append('\n');
        sb.append("    category:        ").append(safe(ctx.category())).append('\n');
        // ADR-045 D5: keywords compartido legacy retirado del prompt tambien
        // en este bloque. Las keywords autoritativas viven en <editorial_input>
        // via <locale_input>[locale].primary_keyword / secondary_keywords.
        sb.append("    hero_image_url:  ").append(safe(ctx.heroImageUrl())).append('\n');
        sb.append("    state:           ").append(safe(ctx.currentState())).append('\n');
        sb.append("    brief:\n");
        sb.append("    ").append(safe(ctx.brief())).append('\n');
        sb.append("    <<<END_BRIEF>>>\n");
        sb.append("  </brief>\n");
        sb.append("</full_article_orchestrated_pipeline>\n\n");
    }

    private void appendOutputContract(StringBuilder sb) {
        sb.append("<output_contract>\n");
        sb.append("  Formato: UN UNICO objeto JSON estricto, sin texto fuera del JSON, sin\n");
        sb.append("  bloques de codigo Markdown alrededor.\n");
        sb.append("\n");
        sb.append("  schema_version: \"").append(ContentConstants.AI_OUTPUT_SCHEMA_VERSION).append("\"\n");
        sb.append("  run_type: \"FULL_ARTICLE_ORCHESTRATED\"\n");
        sb.append("\n");
        sb.append("  Estructura raiz:\n");
        sb.append("    {\n");
        sb.append("      \"schema_version\": \"2.0\",\n");
        sb.append("      \"run_type\": \"FULL_ARTICLE_ORCHESTRATED\",\n");
        sb.append("      \"shared\": { ... },\n");
        sb.append("      \"locales\": { \"es\": { ... }, \"en\": { ... } }\n");
        sb.append("    }\n");
        sb.append("\n");
        sb.append("  Bloque shared (locale-invariante):\n");
        sb.append("    - category (string, codigo canonico, NO null/vacio)\n");
        sb.append("    - keywords (array de strings, opcional)\n");
        sb.append("    - sources_used (array de objetos, >= 5 elementos, cada uno con url\n");
        sb.append("        http(s) valida, title, publisher, published_at, accessed_at,\n");
        sb.append("        relevance, key_points)\n");
        sb.append("    - self_check_passed (boolean, debe ser true para que el backend\n");
        sb.append("        acepte el JSON)\n");
        sb.append("    - self_check_failures (array de strings, vacio si self_check_passed=true)\n");
        sb.append("\n");
        sb.append("  Bloque locales.<es|en> (linguistico, por idioma):\n");
        sb.append("    - slug (string kebab-case, <=160 chars, distinto entre ES y EN)\n");
        sb.append("    - title (string, <=255, no vacio)\n");
        sb.append("    - seo_title (string, <=60, no null no vacio)\n");
        sb.append("    - meta_description (string, <=160, no null no vacio)\n");
        sb.append("    - draft_markdown (string Markdown literal, >=800 chars, >=1 H2 con\n");
        sb.append("        \"## \" al inicio de linea, parrafos separados por linea en blanco,\n");
        sb.append("        SIN HTML inline)\n");
        sb.append("    - search_intent (uno de: informational | transactional | navigational\n");
        sb.append("        | commercial)\n");
        sb.append("    - target_keywords (array de objetos {term, type, search_intent_match};\n");
        sb.append("        al menos un objeto con type=\"primary\")\n");
        sb.append("    - competitor_insights (array de objetos {url, what_they_cover, gap},\n");
        sb.append("        3-5 entradas)\n");
        sb.append("    - article_outline (array >= 4 secciones {level, heading, objective,\n");
        sb.append("        supporting_sources, risk_flags})\n");
        sb.append("    - risk_notes (array de objetos {kind, severity, note}, opcional)\n");
        sb.append("    - fact_check_notes (array de objetos {claim, status, source_index,\n");
        sb.append("        note}, opcional)\n");
        sb.append("\n");
        sb.append("  Merge de target_keywords (ADR-045 D4):\n");
        sb.append("    - Cada locales.<es|en>.target_keywords contiene EXACTAMENTE 1 objeto\n");
        sb.append("      con type=\"primary\" y 0..5 objetos con type=\"secondary\".\n");
        sb.append("    - Si el input operador en <editorial_input><locale_input locale=\"X\">\n");
        sb.append("      trae primary_keyword con valor no vacio, el objeto type=\"primary\"\n");
        sb.append("      del output.locales.X.target_keywords DEBE tener {term: <mismo valor\n");
        sb.append("      exacto>}. NO se admite sustitucion por otro termino: el backend hace\n");
        sb.append("      merge D4 al recibir el JSON y rechaza con REJECTED + mensaje\n");
        sb.append("      accionable si la primary IA no coincide con la del operador.\n");
        sb.append("    - Si el input operador viene con primary vacia (solo permitido en EN),\n");
        sb.append("      el pipeline SI propone una primary (derivada por cms-translate-en\n");
        sb.append("      del ES adaptando al mercado anglosajon).\n");
        sb.append("    - Los secondary_keywords del operador se preservan siempre; el pipeline\n");
        sb.append("      puede AÑADIR mas secondaries hasta un cap final de 5 por locale.\n");
        sb.append("    - search_intent_match lo aporta SIEMPRE el pipeline (research /\n");
        sb.append("      enrichment); el operador no lo edita.\n");
        sb.append('\n');
        sb.append("  Reglas duras de rechazo (el backend devuelve 422 o REJECTED si fallan):\n");
        sb.append("    - shared.sources_used >= 5 elementos\n");
        sb.append("    - shared.self_check_passed === true\n");
        sb.append("    - locales contiene EXACTAMENTE las claves \"es\" y \"en\" (ni mas ni menos)\n");
        sb.append("    - locales.es.slug !== locales.en.slug (ADR-022 D2)\n");
        sb.append("    - cada locale cumple: seo_title <=60, meta_description <=160,\n");
        sb.append("      draft_markdown >= 800 chars con sintaxis Markdown literal,\n");
        sb.append("      target_keywords con al menos un type=primary, article_outline >= 4.\n");
        sb.append("    - Coherencia primary keyword (ADR-045 D4/D8): si\n");
        sb.append("      <locale_input>[locale].primary_keyword del input no es vacio,\n");
        sb.append("      output.locales.<locale>.target_keywords contiene un objeto\n");
        sb.append("      {term: <mismo valor>, type: \"primary\"}. Case-insensitive.\n");
        sb.append("</output_contract>\n\n");
    }

    private void appendSelfCheck(StringBuilder sb) {
        sb.append("<self_check>\n");
        sb.append("  Antes de emitir el JSON final, verifica:\n");
        sb.append("    - todas las URLs de shared.sources_used son reales y accedidas en\n");
        sb.append("      este run; ninguna inventada\n");
        sb.append("    - todos los claims numericos de cada draft_markdown tienen fuente\n");
        sb.append("      en shared.sources_used (mismas fuentes para ambos locales)\n");
        sb.append("    - ningun draft contradice constraints (legal, brand, format, language)\n");
        sb.append("    - search_intent es uno de los 4 valores permitidos, por cada locale\n");
        sb.append("    - longitud de cada draft dentro del rango sugerido (1200-1800 palabras)\n");
        sb.append("    - locales.es.slug y locales.en.slug son distintos\n");
        sb.append("    - locales.es.draft_markdown y locales.en.draft_markdown tienen el mismo\n");
        sb.append("      numero de H2 (paridad estructural)\n");
        sb.append("    - cada draft_markdown:\n");
        sb.append("        * contiene al menos UN H2 literal (linea que empieza por \"## \")\n");
        sb.append("        * separa parrafos con linea en blanco\n");
        sb.append("        * NO contiene HTML inline\n");
        sb.append("        * se podria copiar y pegar tal cual al CMS\n");
        sb.append("    - coherencia keywords (ADR-045 D4/D8):\n");
        sb.append("        * por cada locale, EXACTAMENTE 1 objeto con type='primary' y\n");
        sb.append("          0..5 objetos con type='secondary' en target_keywords\n");
        sb.append("        * si <locale_input>[es].primary_keyword no es vacio,\n");
        sb.append("          output.locales.es.target_keywords contiene un objeto\n");
        sb.append("          {term: <mismo valor>, type: 'primary'} (case-insensitive)\n");
        sb.append("        * idem para <locale_input>[en].primary_keyword cuando venga\n");
        sb.append("          poblada; si viene vacia la fase 4.5 propone la primary EN\n");
        sb.append("\n");
        sb.append("  Si CUALQUIERA de los puntos anteriores falla, CORRIGE antes de emitir\n");
        sb.append("  el JSON final. Si tras corregir aun detectas problemas no resolubles,\n");
        sb.append("  marca shared.self_check_passed=false y enumera fallos en\n");
        sb.append("  shared.self_check_failures; pero ten en cuenta que el backend rechazara\n");
        sb.append("  con 422 si self_check_passed=false.\n");
        sb.append("\n");
        sb.append("  Nunca emitir parcial. Nunca mezclar texto fuera del JSON. Nunca envolver\n");
        sb.append("  el JSON en bloques de codigo Markdown (```).\n");
        sb.append("</self_check>\n");
    }

    private static String safe(Object v) {
        if (v == null) return "null";
        String s = String.valueOf(v);
        return s.replace('\n', ' ').replace('\r', ' ');
    }

    /**
     * Formatea un termino de keyword como {@code "termino"} entre comillas
     * dobles. Cadena vacia o null se emite como {@code ""} (par de comillas
     * literales) para que el lector sepa que el campo esta vacio intencionalmente.
     */
    private static String quotedOrEmpty(String v) {
        if (v == null || v.isBlank()) return "\"\"";
        return "\"" + v.replace("\"", "\\\"").replace('\n', ' ').replace('\r', ' ') + "\"";
    }

    /**
     * Formatea una lista de secondaries como array compacto entre corchetes con
     * cada termino entre comillas dobles: {@code ["a", "b", "c"]}. Lista vacia
     * o null se emite como {@code []}. Justificacion (D-detalle 2B-3): las
     * comillas evitan ambiguedad cuando un termino contiene espacios; el shape
     * compacto encaja con el resto del prompt XML-semantico.
     */
    private static String quotedArray(java.util.List<String> items) {
        if (items == null || items.isEmpty()) return "[]";
        StringBuilder sb = new StringBuilder(items.size() * 16);
        sb.append('[');
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append(quotedOrEmpty(items.get(i)));
        }
        sb.append(']');
        return sb.toString();
    }
}
