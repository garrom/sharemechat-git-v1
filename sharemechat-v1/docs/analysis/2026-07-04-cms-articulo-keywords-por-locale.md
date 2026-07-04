# Análisis: flujo de creación de artículos del CMS + impacto de añadir keywords por locale

**Fecha**: 2026-07-04
**Autor**: análisis asistido por IA (sesión de trabajo con el operador)
**Estado**: informe de trabajo, no ADR. Preparatorio de una futura iteración de código.
**Alcance**: análisis de sólo lectura. No modifica código, esquema ni pipeline.

## 1. Objetivo y no-objetivo

**Objetivo del informe**: entender exhaustivamente cómo funciona hoy el flujo de creación de un artículo de blog en el CMS interno de SharemeChat, con foco en (a) el generador del prompt del pipeline editorial y (b) el manejo actual del bilingüismo ES/EN, para poder decidir con criterio cómo introducir en una futura iteración cuatro campos nuevos de keywords separados por idioma:

- `kw_primaria_es`
- `kw_secundarias_es`
- `kw_primaria_en`
- `kw_secundarias_en`

**No-objetivo**: no se implementa nada. Se detectan puntos de impacto y se enumeran opciones para el problema EN.

## 2. Mapa del flujo end-to-end

Diagrama textual del flujo completo desde que el operador entra al panel admin hasta que el artículo bilingüe queda persistido en base de datos.

```
┌──────────────────────────────────────────────────────────────────────┐
│ FRONTEND (admin bundle)                                              │
│                                                                      │
│   AdminContentPanel.jsx      ── listado + filtro por state           │
│         │                                                            │
│         │ click "Nuevo" / "Abrir"                                    │
│         ▼                                                            │
│   ContentArticleEditor.jsx   ── formulario principal                 │
│     ├─ metadata compartida:   category, keywords, heroImageUrl       │
│     ├─ BodyLocaleTabs.jsx:    ES | EN                                │
│     │    para cada locale:    title, slug, seoTitle, metaDescription,│
│     │                         brief, body markdown                   │
│     ├─ ReviewChecklist.jsx    (gate DRAFT→IN_REVIEW)                 │
│     └─ ContentArticleAIPanel.jsx  ── piloto del pipeline IA          │
│           │  [1] click "Generar artículo completo"                   │
│           │  [2] POST /admin/content/articles/{id}/runs              │
│           │      body: { runType: FULL_ARTICLE_ORCHESTRATED }        │
│           │  [3] backend responde con prompt de ~4 KB (texto plano)  │
│           │  [4] operador copia el prompt manualmente                │
│           ▼                                                          │
│                                                                      │
│ ═══ SALTO FUERA DEL STACK ═══                                        │
│                                                                      │
│           [5] operador pega prompt en Claude Cowork                  │
│           [6] cms-orchestrator (skill) ejecuta 7 fases:              │
│                 1  cms-research-seo      → 01_research/research.md   │
│                 2  cms-draft-writer      → 02_draft/draft.md         │
│                 3  cms-editorial-polish  → 03_polish/polished.md     │
│                 4  cms-brand-legal-review→ 04_review/reviewed.md     │
│                4.5 cms-translate-en      → 04_review/reviewed_en.md  │
│                                            + SUGGESTED_*_EN metadata │
│                 5  cms-json-builder      → 05_final/final.json       │
│                5.5 cms-json-validator    (sobreescribe o .broken)    │
│           [7] cms-orchestrator pinta final.json en el chat           │
│           [8] operador copia el JSON completo                        │
│                                                                      │
│ ═══ VUELVE AL STACK ═══                                              │
│                                                                      │
│   ContentArticleAIPanel.jsx                                          │
│     [9]  operador pega JSON en textarea                              │
│     [10] click "Validar y aplicar"                                   │
│          POST /admin/content/articles/{id}/runs/{runId}/             │
│               apply-bilingual                                        │
│          body: { rawJson, modelId, modelVersion? }                   │
│                                                                      │
│ BACKEND (Spring Boot)                                                │
│                                                                      │
│   ContentRunAdminController                                          │
│         │                                                            │
│         ▼                                                            │
│   ContentRunService.applyBilingual(articleId, runId, json, userId)   │
│     ├─ valida schema 2.0 (shared + locales.{es,en})                  │
│     ├─ persiste ambas traducciones atómicamente                      │
│     │    → content_article_translations (locale='es')                │
│     │    → content_article_translations (locale='en')                │
│     ├─ persiste target_keywords por locale                           │
│     ├─ actualiza content_articles.keywords si viene en shared        │
│     └─ status del run: PENDING → VALIDATED / REJECTED                │
│                                                                      │
│ BD (MySQL, gestionada por Flyway)                                    │
│   content_articles           (metadata compartida + workflow)        │
│   content_article_translations (per-locale, incluye brief y          │
│                                 target_keywords desde ADR-027)       │
│   content_generation_runs    (histórico de invocaciones IA)          │
│   content_article_versions,                                          │
│   content_article_translation_versions (snapshots)                   │
│   content_review_events      (auditoría editorial)                   │
└──────────────────────────────────────────────────────────────────────┘
```

## 3. Inventario de ficheros clave

### 3.1 Documentación relevante

| Ruta | Rol |
|---|---|
| `sharemechat-v1/docs/06-decisions/adr-010-*.md` | Decisión de fundar el CMS con IA asistida (vigente a nivel de intención, workflow superseded) |
| `sharemechat-v1/docs/06-decisions/adr-014-*.md` | `FULL_ARTICLE_ORCHESTRATED`: sustituye pipeline monolítico por skills orquestadas |
| `sharemechat-v1/docs/06-decisions/adr-016-*.md` | Workflow simplificado 4 estados: DRAFT → IN_REVIEW → PUBLISHED → RETRACTED |
| `sharemechat-v1/docs/06-decisions/adr-022-*.md` | Blog bilingüe ES/EN (superseded en modelado por ADR-025) |
| `sharemechat-v1/docs/06-decisions/adr-023-*.md` | Introducción de fase 4.5 `cms-translate-en` |
| `sharemechat-v1/docs/06-decisions/adr-024-*.md` | Endpoint bilingüe dentro del editor (semántica superseded por ADR-025) |
| `sharemechat-v1/docs/06-decisions/adr-025-*.md` | Flyway + rediseño CMS v2 (modelo satélite `content_article_translations`) |
| `sharemechat-v1/docs/06-decisions/adr-026-*.md` | Split `cms-json-builder` / `cms-json-validator` (fases 5 y 5.5) |
| `sharemechat-v1/docs/06-decisions/adr-027-*.md` | Reubica `brief` a per-locale (Flyway V3) |
| `sharemechat-v1/docs/cms/skills/*.md` | Stubs versionados de las skills reales que ejecuta Cowork |

### 3.2 Backend Java (Spring Boot)

| Ruta relativa (bajo `sharemechat-v1/`) | Rol |
|---|---|
| `src/main/resources/db/migration/V2__cms_v2_schema.sql` | DDL del rediseño CMS v2 (ADR-025) |
| `src/main/resources/db/migration/V3__brief_per_locale.sql` | Mueve `brief` a translation (ADR-027) |
| `src/main/java/com/sharemechat/content/entity/ContentArticle.java` | Entidad JPA principal (metadata compartida) |
| `src/main/java/com/sharemechat/content/entity/ContentArticleTranslation.java` | Entidad JPA per-locale |
| `src/main/java/com/sharemechat/content/entity/ContentGenerationRun.java` | Entidad de un run IA |
| `src/main/java/com/sharemechat/content/dto/ArticleCreateRequest.java` | DTO de creación (POST) |
| `src/main/java/com/sharemechat/content/dto/ArticleUpdateRequest.java` | DTO de PATCH sobre metadata compartida |
| `src/main/java/com/sharemechat/content/dto/TranslationMetadataUpdateRequest.java` | DTO de PATCH per-locale (title, slug, seoTitle, metaDescription, brief) |
| `src/main/java/com/sharemechat/content/dto/ArticleDetailDTO.java`, `TranslationDetailDTO.java`, `RunDetailDTO.java` | DTOs de respuesta |
| `src/main/java/com/sharemechat/content/controller/ContentAdminController.java` | REST admin del artículo |
| `src/main/java/com/sharemechat/content/controller/ContentRunAdminController.java` | REST admin de runs IA |
| `src/main/java/com/sharemechat/content/service/ContentArticleService.java` | Orquestador de creación/edición/workflow |
| `src/main/java/com/sharemechat/content/service/ContentRunService.java` | Orquestador de runs IA (crear + apply-bilingual) |
| **`src/main/java/com/sharemechat/content/service/ContentPromptBuilder.java`** | **Generador del prompt (~4 KB, 7 bloques XML-semánticos)** |
| Repos JPA: `ContentArticleRepository`, `ContentArticleTranslationRepository`, `ContentGenerationRunRepository`, versiones, `ContentReviewEventRepository` | Persistencia |

### 3.3 Frontend admin (React)

| Ruta relativa (bajo `sharemechat-v1/frontend/src/`) | Rol |
|---|---|
| `pages/admin/content/AdminContentPanel.jsx` | Listado paginado + filtros por estado |
| `pages/admin/content/ContentArticleEditor.jsx` | Formulario principal del artículo |
| `pages/admin/content/BodyLocaleTabs.jsx` | Pestañas ES / EN para campos per-locale |
| `pages/admin/content/ContentArticleAIPanel.jsx` | Piloto del pipeline IA: genera prompt, recibe JSON |
| `pages/admin/content/ReviewChecklist.jsx` | Gate visual DRAFT→IN_REVIEW |
| `pages/admin/content/ContentArticleHistory.jsx` | Historial editorial |
| `pages/admin/content/ConfirmModal.jsx` | Diálogo de confirmación de transiciones |

### 3.4 Skills del pipeline editorial (docs/cms/skills — stubs vivos)

`cms-orchestrator`, `cms-research-seo`, `cms-draft-writer`, `cms-editorial-polish`, `cms-brand-legal-review`, `cms-translate-en`, `cms-json-builder`, `cms-json-validator`, más `sharemechat-voice` (transversal).

## 4. Estado real del schema (post-ADR-025 + ADR-027)

### 4.1 `content_articles` — compartido por locale

Columnas relevantes: `id`, `hero_image_url`, `category`, `keywords` (**JSON, compartido**), `state`, `ai_assisted`, `disclosure_required`, `published_at`, `scheduled_for`, `retracted_at`, `current_version_id`, `responsible_editor_user_id`, `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`.

Nota importante: `keywords` es un **campo único, no separado por locale y no separado en primary/secondary**. El operador introduce un string en la UI que se persiste como JSON.

### 4.2 `content_article_translations` — per-locale

Columnas relevantes: `id`, `article_id` (FK → `content_articles`, CASCADE), `locale` ('es' | 'en'), `slug` (UNIQUE `(article_id, locale)`), `title`, `seo_title`, `meta_description`, `brief` (TEXT, **movido aquí en V3 por ADR-027**), `body_s3_key`, `body_content_hash`, `target_keywords` (**JSON, per-locale, generado por IA**), `created_at`, `updated_at`.

`target_keywords` es un array de objetos `{term, type, search_intent_match}` donde `type` puede valer `primary` o `secondary`. Hoy este campo **NO es editable por el operador desde la UI**; se puebla exclusivamente cuando llega el JSON del pipeline y `ContentRunService.applyBilingual` persiste ambas traducciones.

### 4.3 Otras tablas del subsistema

`content_generation_runs` (PENDING | VALIDATED | REJECTED | FAILED, `promptTemplateId`, `promptS3Key`, `outputS3Key`, `mode` = MANUAL_STRUCTURED | API_HYBRID | API_AUTO), `content_review_events`, `content_article_versions`, `content_article_translation_versions`.

### 4.4 Workflow real

`DRAFT` → `IN_REVIEW` → `PUBLISHED` | `RETRACTED`. Cuatro estados. `SCHEDULED` aparece en el `CHECK` de `state` en V2 pero **no está en las transiciones permitidas del servicio** (deuda documental, ver §6).

## 5. Cómo se maneja ES / EN hoy

**Hipótesis del operador (a validar)**: EN se genera por traducción automática desde ES en la fase 4.5 (`cms-translate-en`), no rellenando campos manualmente por locale.

**Veredicto: CONFIRMADA** — con matices.

Evidencia:

1. `docs/cms/skills/cms-translate-en.md` describe explícitamente el rol como "Leer el artículo en español revisado y aprobado y producir una traducción al inglés adaptada" ("único trabajo"; "NO investigas, NO añades fuentes").
2. `cms-orchestrator.md` fuerza la ejecución de la fase 4.5 en todos los runs (no hay opt-out vivo en el stub, aunque ADR-023 sí describía uno con "skip translate-en" — ver §6).
3. `ContentPromptBuilder.java` incluye en `<editorial_input>` únicamente los campos ES del artículo (título ES, slug ES, brief ES, keywords compartidas). No hay campos EN de entrada.
4. Los campos SEO EN se derivan del bloque de metadata final que emite `cms-translate-en`:
   - `SUGGESTED_SLUG_EN` (kebab-case)
   - `SUGGESTED_SEO_TITLE_EN` (≤60 chars)
   - `SUGGESTED_META_DESC_EN` (≤160 chars)
   - `SUGGESTED_BRIEF_EN` (≤8192 chars, comillas curvas)
5. `cms-json-builder.md` afirma que `locales.en.draft_markdown` debe ser el contenido LITERAL del cuerpo de `04_review/reviewed_en.md`.
6. El operador puede editar cualquier campo EN en `BodyLocaleTabs.jsx` **después** de aplicar el JSON — pero la creación bilingüe pura es 100% automática desde ES.

**Matices**:

- No hay `parent_article_id` (ADR-024 lo previó, ADR-025 lo eliminó). Ambos locales son satélites del mismo `content_articles.id`.
- No hay `group_id UUID` como preveía ADR-022 D1; se usa la propia `article_id` como vínculo.
- No se emiten dos JSONs `final_es.json` + `final_en.json` como preveía ADR-022 D9 / ADR-023: se emite un único `final.json` schema 2.0 con `shared` + `locales.{es,en}`.

## 6. Discrepancias documentación vs código (candidatos a `known-debt.md`)

Estas discrepancias son candidatos a añadir en una sesión futura al registro de deuda técnica. **No las añado aquí**; solo las listo.

**D-1. Modelo satélite en lugar de padre/hijo (superseded silente).**
ADR-022 y ADR-024 describen un modelo con `group_id UUID` (ADR-022) y `parent_article_id` (ADR-024) que fue **rediseñado** por ADR-025 al modelo satélite `content_article_translations`. Los ADRs 022 y 024 no llevan cabecera "Supersedes / Superseded by" que lo indique. Cualquiera que lea 022 hoy sin conocer 025 saca conclusiones equivocadas sobre el modelo. **Impacto documental medio**; corregir con marcadores de superseded en las cabeceras de 022 y 024.

**D-2. Opt-out "skip translate-en" documentado en ADR-023 pero no vivo en la skill.**
ADR-023 D3 describe una salida de emergencia: si el operador pone "skip translate-en" al lanzar el pipeline, sólo se genera JSON ES. La skill actual (`cms-orchestrator.md`) declara que la fase 4.5 se ejecuta SIEMPRE sin opt-out. Dos posibilidades: (a) opt-out se abandonó implícitamente; (b) opt-out se mantiene por convención humana pero no está en la skill. En cualquier caso, el ADR y la skill se han desincronizado. **Impacto operativo bajo, documental medio**.

**D-3. `SCHEDULED` modelado en BD pero muerto en código.**
`content_articles.state` acepta `SCHEDULED` según el `CHECK` de V2. `ContentArticleService.transition` no lo tiene en las transiciones válidas. ADR-016 D5 confirma que "SCHEDULED se modela pero se difiere". Deuda técnica ya conocida a nivel intencional pero no documentada como tal.

**D-4. `sources_used` como columna implicada pero no existe.**
ADR-025 lista `sources_used` como columna esperada en `content_articles`. En V2 no existe: `sources_used` sólo vive dentro del JSON del pipeline en el bloque `shared`. No hay persistencia dedicada. Puede ser decisión posterior no anotada en ADR.

**D-5. Dos JSONs vs un JSON.**
ADR-022 D9 y ADR-023 D2 hablan de emitir `final_es.json` + `final_en.json`. El pipeline real emite un único `final.json` con `shared` + `locales.{es,en}`. Esta simplificación probablemente vino con el schema 2.0 (mencionado en `cms-orchestrator` y `cms-json-builder`) pero no encuentro ADR que la declare explícitamente.

**D-6. Nombre del endpoint bilingüe.**
ADR-024 lo llamó `POST /articles/{id}/runs/{runId}/output-bilingual` con DTO `SubmitOutputBilingualRequest(rawJsonEs, rawJsonEn, ...)`. El endpoint real es `POST /articles/{id}/runs/{runId}/apply-bilingual` con `{ rawJson, modelId, modelVersion? }` — un solo JSON. Renombrado y simplificado sin ADR de corrección.

**D-7. Workflow de 6 estados en ADR-010 nunca aterrizó.**
ADR-010 pintó IDEA → OUTLINE_READY → DRAFT_GENERATED → IN_REVIEW → APPROVED → PUBLISHED. Nunca se implementó tal cual; ADR-016 rebajó a 4 estados. Deuda documental por resolución de refactor sin marcar el ADR-010 como parcialmente superseded.

## 7. Puntos de impacto para añadir los cuatro campos de keywords por locale

**Meta de la iteración futura**: introducir `kw_primaria_es`, `kw_secundarias_es`, `kw_primaria_en`, `kw_secundarias_en` como campos editables por el operador, separados por locale, con distinción explícita primary vs secondary.

**Nota previa**: hoy ya existe `content_article_translations.target_keywords` como JSON per-locale con `type=primary|secondary`. Los cuatro campos nuevos **solapan conceptualmente** con `target_keywords`. Antes de decidir schema hay que aclarar si:

- (a) los nuevos campos **reemplazan** a `target_keywords` (el operador toma control total y la IA sólo respeta lo que el operador definió);
- (b) los nuevos campos **conviven** con `target_keywords` (el operador declara sus intenciones; la IA sigue emitiendo su propuesta detallada con `search_intent_match`);
- (c) los nuevos campos son **el input del operador** al pipeline y `target_keywords` pasa a ser **el output enriquecido** de la IA (input humano + enriquecimiento IA — este es el patrón limpio).

Recomendación implícita: (c). El resto del informe asume (c) sin cerrarla.

Puntos de impacto por capa, priorizados de más pesado a más ligero:

### 7.1 Schema BD (Flyway)

Opciones de modelado:

- **Opción A (columnas dedicadas per-locale en la tabla translation)**: añadir a `content_article_translations` las columnas `primary_keyword VARCHAR(120)` y `secondary_keywords JSON` (o `TEXT` con lista separada por comas). Es lo más limpio: aprovecha que la tabla ya está partida por locale.
- **Opción B (columnas hardcoded en `content_articles`)**: añadir cuatro columnas `kw_primaria_es`, `kw_secundarias_es`, `kw_primaria_en`, `kw_secundarias_en` en `content_articles`. Rompe el modelo satélite (mete lengua en tabla compartida). **Desaconsejada**.
- **Opción C (extender el JSON `content_articles.keywords`)**: pasar `keywords` de string plano a un objeto tipado por locale/tipo. Barato pero pierde tipado en BD; hace más difíciles consultas SEO.

**Recomendación**: Opción A. Añade una nueva Flyway `V4__keywords_per_locale.sql` que crea las dos columnas nuevas en `content_article_translations`, con backfill desde el `keywords` compartido cuando exista (opcional: sólo para ES) y NULL en EN. Deja `content_articles.keywords` en su sitio como campo legacy hasta decidir su retirada.

### 7.2 Entidades JPA y DTOs

- `ContentArticleTranslation.java`: dos campos nuevos `primaryKeyword` y `secondaryKeywords` (String o `List<String>` con `@Convert`).
- `TranslationDetailDTO.java`: exponer ambos en respuestas.
- `TranslationMetadataUpdateRequest.java`: aceptar ambos en el PATCH per-locale.
- `ArticleCreateRequest.java`: el POST inicial acepta ambos para la locale ES (paralelo a cómo hoy acepta `slug` / `title` / `brief` iniciales).
- `ArticleDetailDTO.java`: los emite dentro de cada `TranslationDetailDTO`.
- Considerar deprecar `content_articles.keywords` en el DTO compartido, migrando la UI al par per-locale. Marcar como legacy hasta que la ficha del artículo lo confirme.

### 7.3 Endpoints y validaciones backend

- `PATCH /admin/content/articles/{id}/translations/{locale}` (`ContentAdminController` → `ContentArticleService`): acepta y persiste los dos campos nuevos con reglas: `primaryKeyword` obligatorio en ES para transicionar a `IN_REVIEW`, opcional en EN; `secondaryKeywords` ≤N elementos (definir N, sugerencia: 5), cada elemento ≤120 chars.
- `POST /admin/content/articles`: acepta los dos campos para el locale ES inicial.
- `POST /admin/content/articles/{id}/runs/{runId}/apply-bilingual`: el JSON de retorno del pipeline debería poder actualizar `primary_keyword` / `secondary_keywords` per-locale si el operador quiere que la IA los enriquezca — o **no tocarlos** si son autoritativos del humano. Es la decisión clave. Ver §8.
- `ReviewChecklist` (frontend + posiblemente validación espejo backend): añadir `primary_keyword ES no vacío` como precondición.

### 7.4 Formulario del admin (React)

- `ContentArticleEditor.jsx`: sacar `keywords` del bloque compartido superior.
- `BodyLocaleTabs.jsx`: añadir en cada pestaña (ES y EN) dos inputs nuevos: `primaryKeyword` (input simple, ≤120 chars, contador inline) y `secondaryKeywords` (tag input o textarea coma-separada). Persistencia vía PATCH per-locale existente.
- `ReviewChecklist.jsx`: nueva línea "primary keyword ES presente" en el checklist.
- `ContentArticleAIPanel.jsx`: no necesita cambios estructurales si el prompt los recoge desde el backend (ver §7.5), pero conviene mostrar en el panel qué keywords se enviaron al prompt como confirmación visual antes de que el operador copie.

### 7.5 Generador del prompt (`ContentPromptBuilder.java`)

Este es el punto de mayor sensibilidad. Hoy el bloque `<editorial_input>` inyecta:

- `slug_es`, `title_es`, `category`, `brief` (ES), `keywords` (compartido), `hero_image_url`, `state`, ...

Nueva forma sugerida:

- **Cambiar** `keywords: <compartido>` por dos bloques anidados por locale:
  ```
  <editorial_input>
    ...
    <locale_input locale="es">
      title:              ...
      slug:               ...
      brief:              ...
      primary_keyword:    ...
      secondary_keywords: [...]
    </locale_input>
    <locale_input locale="en">
      primary_keyword:    ...    (puede venir vacío — ver §8)
      secondary_keywords: [...]  (puede venir vacío)
    </locale_input>
    category:             ...
    hero_image_url:       ...
  </editorial_input>
  ```
- **Reescribir el `<output_contract>`** para dejar claro que:
  - Si el operador aportó `primary_keyword` en EN, la fase `cms-translate-en` debe HONRARLO (no proponer otro).
  - Si no lo aportó, la fase 4.5 puede derivarlo del ES y adaptar (mecanismo actual, con `SUGGESTED_PRIMARY_KEYWORD_EN` como nuevo campo del bloque de metadata final).
  - `target_keywords` per-locale del JSON de salida sigue emitiéndose como enriquecimiento (con `type=primary` alineado al `primary_keyword` autoritativo del humano).
- **Actualizar `<self_check>`** para exigir consistencia: `locales.es.target_keywords` debe contener un objeto con `term = <primary_keyword ES> AND type=primary`; ídem EN.

### 7.6 Skills del pipeline editorial

- `cms-research-seo`: aceptar `primary_keyword` como INPUT autoritativo por locale y hacer research alrededor de esa keyword. Hoy lo elige la propia skill; pasa a ser input.
- `cms-draft-writer`, `cms-editorial-polish`, `cms-brand-legal-review`: sin cambios estructurales.
- `cms-translate-en`: comportamiento nuevo condicional:
  - Si `primary_keyword_en` viene poblado → honra el término del operador. Traduce/adapta el cuerpo pero fija el `primary_keyword` como se recibió.
  - Si viene vacío → deriva `SUGGESTED_PRIMARY_KEYWORD_EN` del research + traducción, como hoy.
  - Extender el bloque de metadata final: añadir `SUGGESTED_PRIMARY_KEYWORD_EN` y `SUGGESTED_SECONDARY_KEYWORDS_EN`.
- `cms-json-builder`: emitir `locales.{es,en}.primary_keyword` y `locales.{es,en}.secondary_keywords` como campos de primer nivel en cada locale (en paralelo a `target_keywords`). Mantener `target_keywords` como enriquecimiento IA con `search_intent_match`.
- `cms-json-validator`: añadir los dos nuevos campos por locale a la lista de campos de riesgo (los valida como string / lista de strings).

### 7.7 Documentación y ADRs

- Nuevo ADR "keywords per-locale editable por operador" que:
  1. Justifique el cambio SEO (dar control al humano por locale).
  2. Cierre la ambigüedad `keywords` compartido vs `target_keywords` IA vs nuevos campos.
  3. Marque `content_articles.keywords` como legacy o defina su retirada.
  4. Actualice `docs/02-architecture/cms-seo-overview.md` y `docs/cms/skills/*` afectados.
- Actualizar los stubs de skill de `docs/cms/skills/` para reflejar el nuevo contrato de input.

## 8. El "problema del inglés" — opciones y recomendación

El nudo del ejercicio: hoy EN se traduce automáticamente. Los cuatro campos nuevos incluyen dos EN que un operador podría o no querer rellenar. ¿Cómo conviven campos EN manuales con la traducción automática?

### Opción E-1: Manual completo por locale — obligatorio en ambos
El operador introduce `primary_keyword` y `secondary_keywords` en ES y EN, obligatorios en ambos antes de correr el pipeline. `cms-translate-en` sólo traduce el cuerpo; las keywords las honra tal cual.
- **Pros**: control total; SEO EN queda dirigido por humano; no hay riesgo de que la IA elija una keyword mal-adaptada.
- **Contras**: fricción alta para el operador; asume que el operador sabe SEO en inglés (no siempre cierto); rompe uno de los ejes de valor del CMS (asistencia IA). Impide arrancar con EN vacío mientras se explora un tema.

### Opción E-2: Manual completo por locale — obligatorio ES, opcional EN
El operador introduce ES obligatorio; EN opcional. Si EN vacío, la fase 4.5 los deriva del ES adaptándolos al mercado anglosajón (traducción + reajuste SEO local, no traducción literal). Si EN presente, la fase 4.5 los honra.
- **Pros**: mismo control cuando lo quieres; carga baja cuando no; encaja bien con la arquitectura actual (fase 4.5 ya adapta cuerpo, ya emite `SUGGESTED_*_EN` para SEO); mantiene el CMS como asistente sin quitar poder al humano.
- **Contras**: dos comportamientos en el mismo campo (semántica condicional); necesita test explícito de "override manual respeta valores".

### Opción E-3: Solo ES manual, EN derivado por IA sin campos EN en la UI
No se añaden `kw_primaria_en` y `kw_secundarias_en` como campos editables por el operador. Se añaden sólo los dos ES. La IA deriva los EN automáticamente en 4.5 y los persiste como el resto de campos EN.
- **Pros**: cero fricción operador; alinea 100% con la filosofía "operador vive en ES, EN es derivado".
- **Contras**: contradice literalmente lo que pide el operador (cuatro campos, dos EN); el operador pierde control fino sobre SEO EN; deja `content_article_translations.primary_keyword` EN como campo "solo escritura por IA", que en la UI debería mostrarse pero no editarse (patrón raro).

### Opción E-4: EN se traduce y luego el operador puede editar el resultado post-hoc
No hay campos EN en el input al pipeline. Post-aplicación del JSON, el operador tiene un panel para editar `primary_keyword_en` y `secondary_keywords_en` como campos independientes.
- **Pros**: híbrido pragmático; no cambia el prompt; no cambia las skills.
- **Contras**: la keyword EN elegida por la IA condiciona el borrador EN completo (todo el cuerpo, seo_title, meta_description); si el operador quiere cambiarla después, el cuerpo EN queda desalineado con la keyword real y hay que re-generar. Coste operativo alto y no evidente.

### Recomendación

**Opción E-2** (manual ES obligatorio, EN opcional con override sobre traducción).

Razones:

1. Encaja con la arquitectura actual sin romper el modelo satélite ni el pipeline. `cms-translate-en` ya emite hoy `SUGGESTED_*_EN` para varios campos; añadirle dos más (`SUGGESTED_PRIMARY_KEYWORD_EN`, `SUGGESTED_SECONDARY_KEYWORDS_EN`) es aditivo.
2. Respeta el diseño mental del CMS ("operador vive en ES, EN es asistido").
3. Permite arrancar con EN vacío y evolucionar caso a caso: si el equipo SEO no habla inglés, todo lo EN se deriva; si en algún tema hay conocimiento local, se rellena.
4. Da control quirúrgico donde importa (la primary keyword EN es el eje de todo el SEO del artículo en el mercado anglosajón).
5. No obliga a re-hacer el borrador EN cuando el operador quiere afinar (a diferencia de E-4).

Riesgos a mitigar en implementación:

- **Coherencia**: si `primary_keyword_en` viene poblado, todo el pipeline EN debe usarlo (research seo local ES/EN diferenciado, draft, seo_title, meta_description). No basta con "honrarlo" en el output.
- **Fallback silencioso**: cuando EN se derive, dejar rastro en el JSON de que se derivó (`primary_keyword_en_source: "operator" | "ai_derived"`) para que la auditoría vea el origen.
- **UI clara**: en `BodyLocaleTabs.jsx` los inputs EN deben etiquetar visualmente "opcional — si vacío, la IA lo deriva del ES".

## 9. Preguntas abiertas — decisiones que pide el operador

Estas preguntas necesitan resolución humana antes de implementar. **No las decido aquí**.

**P-1. Relación con `target_keywords` existente**. ¿Los nuevos campos `primary_keyword` y `secondary_keywords` per-locale **reemplazan** a `target_keywords`, **conviven** con él (input humano + enriquecimiento IA), o `target_keywords` desaparece?

**P-2. Relación con `content_articles.keywords` compartido**. ¿Se mantiene como legacy (con backfill al nuevo modelo per-locale ES) o se elimina en la misma migración? Si se elimina, ¿qué endpoints/consumidores externos dependen de él hoy? (Verificar antes de tocar; el frontend hace un PATCH de metadata compartida que lo incluye.)

**P-3. Cantidad máxima de secondary keywords**. ¿Cuántas? Sugerencia: 5, alineado con la práctica SEO estándar. Requiere validación operativa.

**P-4. Formato del input de secondary keywords en la UI**. ¿Tag input con chips, textarea con comas, o lista dinámica de N inputs individuales? Impacta UX y complejidad de `BodyLocaleTabs.jsx`.

**P-5. ¿Se añade la primary keyword ES al `ReviewChecklist`?** El checklist hoy fuerza brief/title/slug/body/hero. Si primary keyword ES pasa a ser gate a IN_REVIEW, la incorporación debe declararse.

**P-6. ¿Comportamiento con contenido ya publicado?** Artículos ya PUBLISHED / RETRACTED no se pueden editar. Los nuevos campos quedarán NULL en histórico. ¿Backfill batch, o se acepta NULL como estado legítimo?

**P-7. ¿Sitio único donde vive el "primary keyword" en el JSON output?** Sugerencia arriba: `locales.{es,en}.primary_keyword` en paralelo a `target_keywords`. Alternativa: `target_keywords` gana un flag `authoritative: true` en el primer objeto. Impacta el schema del pipeline.

**P-8. ¿Se toca el ADR-023 o se emite uno nuevo?** Recomiendo ADR nuevo (encadenado a 023 y 027) por trazabilidad. El operador decide.

## 10. Hallazgos no esperados

Ninguno de gravedad. Todo el subsistema CMS está sanamente organizado y el pipeline editorial es coherente. Los apuntes de esta sección son sólo observaciones colaterales al análisis, no bugs.

**H-1. Nombre del run type**. La constante `FULL_ARTICLE_ORCHESTRATED` viaja como texto plano entre frontend, backend y skills. Cualquier renombre requiere coordinación cross-capa. Vale la pena documentarlo en un solo sitio (probablemente el ADR-014) para no perder trazabilidad. No es bug.

**H-2. El prompt vive dentro del stack, la ejecución no**. El diseño actual es "backend genera prompt → operador copia manualmente → Cowork ejecuta → operador copia JSON manualmente → backend valida". Es correcto por decisión (MANUAL_STRUCTURED, ADR-010) pero introduce un ritual manual con dos copiapegas. Cualquier futura evolución hacia `API_HYBRID` o `API_AUTO` (ya modelados en `content_generation_runs.mode`) impactará este flujo. Los cuatro campos de keywords por locale no bloquean esa evolución, pero conviene tenerla presente al diseñar el contrato input/output.

**H-3. `target_keywords` es un campo per-locale que el operador nunca ve ni edita**. Sólo se puebla vía apply-bilingual desde el JSON del pipeline. Un panel admin que exponga qué keywords SEO acabaron aplicándose (aunque sea sólo lectura) reduciría la sensación de caja negra del pipeline. No es objetivo de este análisis, pero encaja con la iteración de introducción de campos manuales.

**H-4. Fase 4.5 sin opt-out real**. Reafirma D-2 en §6. En un contexto donde el operador quiera un artículo sólo ES (por ejemplo, por embargo geográfico), hoy no hay forma limpia de saltarse EN. Esto no bloquea el trabajo de keywords, pero sí es fricción operativa acumulada.

---

**Estado del análisis**: completo. Listo para revisión operador antes de decidir siguientes pasos.

**ESTADO: COMPLETADO**
