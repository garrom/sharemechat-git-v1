# ADR-014 — FULL_ARTICLE_ORCHESTRATED: pipeline editorial orquestado por skills

## Estado

Aceptada e implementada (TEST).

Reemplaza a [ADR-013](adr-013-full-article-run-phase3b.md) como flujo
principal del CMS. ADR-013 queda **superseded by ADR-014**: el run type
`FULL_ARTICLE` (pipeline monolítico inline en un único prompt) deja de estar
soportado y es sustituido por `FULL_ARTICLE_ORCHESTRATED` (pipeline delegado
en seis skills personales de Claude Cowork). Los runs históricos creados con
el run type antiguo se conservan en `content_generation_runs` con su
`prompt_template_id="FULL_ARTICLE/v1"` original; solo se prohíben runs nuevos
con ese tipo.

## Supersedes

- [ADR-013](adr-013-full-article-run-phase3b.md) — `FULL_ARTICLE` run (Fase 3B
  evolución). La decisión estructural de tener un único run editorial de
  punta a punta se mantiene. Lo que cambia es **cómo** se ejecuta.

## Contexto

ADR-013 introdujo `FULL_ARTICLE` como evolución de los cinco runs discretos
de Fase 3A: un único run que ejecutaba internamente las seis subfases del
pipeline editorial (research, SEO, outline, redacción, fact-check, edición)
dentro de un prompt monolítico generado por `ContentPromptBuilder`. La
infraestructura técnica (entidad `ContentGenerationRun`, validador de output
JSON contra schema 1.0, almacenamiento de prompt/output en S3 privado bajo
`content/runs/{runId}/`, panel IA en backoffice) siguió intacta.

El modelo monolítico funcionó: la Fase 3B se cerró con `FULL_ARTICLE`
operativo y la Fase 4A (publicación pública dinámica) lo consumió como
fuente principal de drafts. Pero, durante la operación real, se observaron
limitaciones estructurales:

- el prompt era extenso y concentraba directrices muy heterogéneas
  (investigación web, SEO, outline, redacción literal Markdown, fact-check,
  edición de marca/legal, voz SharemeChat) en un único bloque XML-like
  generado por código Java. Cada cambio en una subfase obligaba a recompilar
  el backend;
- las skills personales de Claude Cowork (donde el editor mantiene su
  conocimiento operativo: voz de marca, plantillas SEO, criterios de
  fact-check) se infrautilizaban, porque el prompt monolítico ya describía
  todo el pipeline y dejaba a Claude Cowork sin razón de invocar sus skills
  versionadas;
- no existía un working directory en disco donde quedaran los artefactos
  intermedios (research, draft pulido, review brand/legal). Si el output
  final fallaba la validación, no había trazas reutilizables: el editor
  perdía toda la investigación.

Al mismo tiempo, las skills personales del editor en Claude Cowork han
madurado en cinco roles editoriales más una skill transversal de voz de
marca, que ya cubren, mejor que el prompt monolítico, las seis subfases del
pipeline. Tiene sentido **delegar** el pipeline en esas skills y reducir el
prompt del CMS a un orquestador ligero.

## Decisión

Se introduce un nuevo run type `FULL_ARTICLE_ORCHESTRATED` y se retira el
run type `FULL_ARTICLE`. La infraestructura técnica del CMS no cambia.

### Pipeline orquestado

`FULL_ARTICLE_ORCHESTRATED` delega el pipeline en seis skills personales
versionadas (en stubs) bajo
[`docs/cms/skills/`](../cms/skills/):

| Orden | Skill | Artefactos en `working_dir/` |
|------:|-------|------------------------------|
| 1 | `cms-research-seo`         | `01_research/research.json`, `01_research/sources.md`, `01_research/intent.json`, `01_research/outline.json` |
| 2 | `cms-draft-writer`         | `02_draft/draft.md` |
| 3 | `cms-editorial-polish`     | `03_polish/draft.polished.md` |
| 4 | `cms-brand-legal-review`   | `04_review/risk_notes.json`, `04_review/fact_check_notes.json`, `04_review/draft.reviewed.md` |
| 5 | `cms-json-builder`         | `05_final/final.json` |
| — | `sharemechat-voice`        | transversal: tono, prohibiciones de marca, registro |

El backend **no** ejecuta las skills: solo nombra cuáles invocar y en qué
orden. Quien las invoca es Claude Cowork al recibir el prompt copiado por el
editor.

### Working directory en disco

El prompt fija un working_dir explícito por run:

```text
cowork/sharemechat/article-{articleId}/run-{epochMillis}/
  01_research/
  02_draft/
  03_polish/
  04_review/
  05_final/
```

Cada skill escribe sus artefactos en su subdirectorio. La salida del run
**es exactamente el contenido literal de `05_final/final.json`** y nada más.
Cualquier explicación, bloque de código Markdown alrededor o texto fuera del
JSON invalida el output.

### Brief embebido

El brief editorial completo se embebe en el prompt entre marcadores
literales:

```text
<<<BEGIN_BRIEF>>>
title:    ...
slug:     ...
locale:   ...
category: ...
keywords: ...
state:    ...
brief:    ...
<<<END_BRIEF>>>
```

`cms-research-seo` lee el bloque como entrada principal de la fase 1; las
skills posteriores tienen acceso al brief vía working_dir o vía la memoria
de la conversación de Cowork.

### Compatibilidad con skills antiguas

Si las skills personales del editor todavía contienen referencias a un
bloque `<full_article_pipeline>` con seis fases inline (estilo ADR-013), el
prompt instruye explícitamente a Claude Cowork a **ignorar esa orquestación
antigua** y usar la del bloque `<full_article_orchestrated_pipeline>` que
genera ADR-014. Esto evita que skills no totalmente actualizadas reactiven
el flujo monolítico y simplifica la transición sin obligar a reescribir todas
las skills en un único commit.

### Validación reforzada (heredada de ADR-013)

Los umbrales que ADR-013 estableció para `FULL_ARTICLE` se mantienen
**idénticos** para `FULL_ARTICLE_ORCHESTRATED`. El método de generación
cambia, las garantías de calidad sobre el output no:

- `sources_used` ≥ 5 elementos válidos;
- `article_outline` ≥ 4 secciones;
- `draft_markdown` ≥ 800 caracteres y NO null;
- `seo_title` no null, no vacío, ≤ 60 caracteres;
- `meta_description` no null, no vacía, ≤ 160 caracteres;
- `target_keywords` con al menos un elemento `type = "primary"`;
- `self_check_passed = true` obligatorio (run atómico);
- chequeos heurísticos de Markdown literal: ≥ 1 H2 con `## `, doble salto de
  línea entre párrafos, sin HTML inline.

La validación vive en `ManualClipboardClaudeAdapter.validateFullArticleOrchestratedSpecifics`,
heredera directa del `validateFullArticleSpecifics` original de ADR-013.

### Reutilización de infraestructura

`FULL_ARTICLE_ORCHESTRATED` reutiliza íntegra la infraestructura de Fase 3A
y 3B:

- entidad `ContentGenerationRun` sin cambios;
- mismo schema de output 1.0;
- mismo `ContentRunService.createRun(...)`, `submitOutput(...)` y
  `applyValidatedDraftToArticle(...)` (Fase 4A apply);
- mismo layout S3 `content/runs/{runId}/[prompt.txt|output_raw.md|output_validated.json|validation_errors.json]`;
- mismo bucket privado `sharemechat-content-private-test`;
- mismas reglas de permiso (`CONTENT.EDIT` para crear y enviar output;
  `CONTENT.VIEW` para listar);
- `prompt_template_id = "FULL_ARTICLE_ORCHESTRATED/v1"`.

Sin migración de schema, sin cambio en `SecurityConfig`, sin tocar el
dominio editorial (`ContentArticleService`, workflow, versions, events).

## Consecuencias positivas

- **Versionado real del know-how editorial**: las decisiones de voz, SEO y
  fact-check viven donde son editables sin recompilar el backend (skills
  personales + stubs en `docs/cms/skills/`), no enterradas en código Java.
- **Pipeline más corto en el prompt**: el `ContentPromptBuilder` reduce
  drásticamente la sección dedicada al pipeline; las skills llevan el peso.
  El prompt resultante es más mantenible y menos frágil ante cambios.
- **Working_dir reutilizable**: si el run falla la validación, los
  artefactos intermedios (research, draft polish, review) quedan en disco
  para que el editor los recupere o reuse en un nuevo run sin volver a
  investigar.
- **Coste editorial menor por iteración**: corregir voz de marca o un
  criterio SEO ya no exige nuevo PR de backend; basta editar la skill
  personal y commitear el stub correspondiente con el motivo.
- **Mejor aprovechamiento de Claude Cowork**: las skills personales son
  **el** mecanismo de Cowork para sostener un pipeline multi-rol; este
  cambio las pone en el centro.
- **Cero impacto en la infraestructura técnica**: aditivo a nivel de tabla,
  controllers, S3 layout y panel IA.

## Consecuencias negativas

- **Dependencia operativa de las skills personales del editor**: si un
  editor nuevo no tiene cargadas las seis skills en su Cowork, el pipeline
  no se ejecuta correctamente. Mitigación: stubs versionados en
  `docs/cms/skills/` con instrucciones para sincronizar.
- **Ventana de inconsistencia entre skills personales y stubs versionados**:
  una skill puede evolucionar en Cowork sin que se actualice el stub en el
  repo (y viceversa). Mitigación: convención en
  [`docs/cms/skills/README.md`](../cms/skills/README.md) de commitear el
  stub cuando se cambia la skill, con mensaje explícito (`cms: bump
  cms-research-seo skill (motivo)`).
- **Trazabilidad parcial del pipeline**: los artefactos intermedios viven
  en disco local del editor, no en S3 ni en RDS. Solo el output final
  entra en `content_generation_runs`. Si se requiere auditoría completa
  del pipeline editorial, hay que conservar el `working_dir` manualmente.
  Aceptado en esta fase: el output final ya es auditable y aplicable; los
  intermedios son utilidad operativa, no requisito de compliance.
- **Riesgo de drift entre skills y validación backend**: si las skills
  cambian por su cuenta, el output puede dejar de cumplir los umbrales
  reforzados (≥5 sources, ≥4 outline, ≥800 chars, etc.). Mitigación: la
  validación backend rechaza con errores explícitos; las skills se ajustan
  hasta volver a pasar.
- **Migración de mentalidad**: el editor que dominaba `FULL_ARTICLE`
  monolítico debe entender que ahora el pipeline lo gobiernan sus skills,
  no el prompt del CMS.

## Alternativas consideradas

### Mantener `FULL_ARTICLE` monolítico (statu quo ADR-013)

Continuar generando todo el pipeline desde `ContentPromptBuilder.appendFullArticlePipeline()`.

Rechazada por las limitaciones documentadas en Contexto: prompt extenso,
skills personales infrautilizadas, sin trazas intermedias. Resolver cualquier
de las tres exige cambios estructurales similares a esta ADR.

### Dual-run: ofrecer `FULL_ARTICLE` y `FULL_ARTICLE_ORCHESTRATED` en paralelo

Mantener ambos run types como opciones del editor.

Rechazada porque:

- duplica la superficie de validación (dos métodos `validateFullArticleX`
  con la misma lógica reforzada);
- duplica la documentación (dos ADRs activas que decir lo mismo);
- multiplica la deuda de mantener vivo el prompt monolítico cuando la
  intención es retirarlo;
- no aporta cobertura adicional: `FULL_ARTICLE_ORCHESTRATED` produce el
  mismo schema 1.0 y cumple los mismos umbrales reforzados.

Los runs históricos `FULL_ARTICLE` se conservan en BD como huella
auditable, pero no se pueden generar nuevos.

### Pipeline backend orquestado con API automática

Implementar el pipeline en el backend invocando Claude vía API en cadena
(modo `API_HYBRID`).

Rechazada por la misma razón que ADR-013 sec "Alternativas consideradas":
introduce coste automático no controlado y reabre la complejidad de gestionar
quotas, errores API y rate limits. Sigue diferida a una fase posterior con
decisión explícita de activar `MODE_API_HYBRID`.

## Pendiente residual

- **Sincronizar el cuerpo de los stubs**: los seis ficheros bajo
  `docs/cms/skills/*.md` se han creado con frontmatter (`name:`,
  `description:`) y un placeholder `TODO: pegar contenido de la skill
  personal`. El editor responsable los completa con el cuerpo real de cada
  skill antes del primer run productivo en TEST. Hasta entonces, la
  ejecución se basa solo en las skills personales en Cowork.
- **Ejecutar un run de validación end-to-end en TEST**: crear un nuevo
  artículo IDEA, lanzar `FULL_ARTICLE_ORCHESTRATED`, verificar que las
  skills se invocan en orden, que se materializan los artefactos en
  `working_dir/`, y que `final.json` pasa la validación reforzada del
  backend.
- **Auditoría completa del pipeline editorial**: si en una fase futura se
  exige conservar también los artefactos intermedios (no solo el final),
  evaluar promoverlos a S3 con un layout `content/runs/{runId}/working/...`.
  Fuera de alcance de esta ADR.
- **Activación API automática (`MODE_API_HYBRID`)**: el flujo orquestado
  manual sigue siendo el canónico hasta que se decida explícitamente abrir
  el modo API. Esta ADR no decide sobre ello.

## Relación con otras ADRs

- [ADR-010](adr-010-internal-content-cms-ai-assisted-workflow.md) — esta
  ADR sigue ejerciendo el modo `MANUAL_STRUCTURED` con interfaz
  `ContentAIProvider` provider-agnostic. Las decisiones estructurales del
  cuerpo de ADR-010 se mantienen.
- [ADR-013](adr-013-full-article-run-phase3b.md) — superseded by ADR-014.
  El cuerpo de ADR-013 se conserva como traza histórica de la decisión
  monolítica original.
