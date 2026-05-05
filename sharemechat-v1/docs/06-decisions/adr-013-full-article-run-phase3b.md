# ADR-013 — FULL_ARTICLE run (Fase 3B evolución)

## Estado

Aceptada — Fase 3B evolución del CMS interno.

- decisión arquitectónica aceptada;
- implementación inicial activada en TEST sobre la infraestructura ya validada de Fase 3A (`ContentAIProvider`, `ManualClipboardClaudeAdapter`, `ContentRunService`, `ContentRunAdminController`, panel IA en backoffice);
- los cinco run types previos (`RESEARCH`, `OUTLINE`, `DRAFT`, `REVIEW`, `SEO`) se mantienen para casos avanzados, debugging y reuso de research; **FULL_ARTICLE pasa a ser el flujo principal recomendado**.

## Contexto

Fase 3A introdujo runs IA discretos en `content_generation_runs` con cinco tipos (`RESEARCH`, `OUTLINE`, `DRAFT`, `REVIEW`, `SEO`), ejecutados manualmente desde Claude Cowork bajo el modo `MANUAL_STRUCTURED` (ver [ADR-010](adr-010-internal-content-cms-ai-assisted-workflow.md) y la documentación de Fase 3A en [test.md](../03-environments/test.md)).

El modelo discreto cumple sus objetivos de trazabilidad y control humano, pero introduce fricción operativa real:

- el editor debe orquestar manualmente la cadena `RESEARCH → OUTLINE → DRAFT → REVIEW → SEO`, con copia/pegado y validación independiente en cada paso;
- el coste agregado en tokens de cinco runs separados es mayor que un único run que comparta contexto interno;
- aparece **drift** entre runs: la `RESEARCH` se enfría, el `OUTLINE` interpreta la research a su manera, el `DRAFT` reinterpreta el outline, y la coherencia final depende del cuidado del editor;
- el potencial real de Claude Cowork como sistema multi-rol queda infrautilizado.

Al mismo tiempo, la infraestructura técnica de Fase 3A (entidad `ContentGenerationRun`, validador de output JSON contra schema 1.0, almacenamiento de prompt/output en S3 privado bajo `content/runs/{runId}/`, panel IA en backoffice) **ya soporta cualquier run type sin cambios estructurales**: el tipo se codifica como prefijo en `prompt_template_id` y el output schema 1.0 contiene todos los campos necesarios para describir un artículo completo.

Esto permite introducir un sexto run sin migración, sin schema bump y sin tocar la dirección arquitectónica establecida en ADR-010.

## Problema

¿Cómo aprovechar el potencial multi-rol de Claude Cowork manteniendo la trazabilidad y el control editorial humano que la Fase 3A garantiza?

Concretamente:

- ¿Debe el flujo principal seguir siendo discreto o debe consolidarse en un único run estructurado?
- ¿Cómo garantizar coherencia entre subfases (research, SEO, outline, redacción, fact-check, edición) sin volver a construir capas redundantes en backend?
- ¿Cómo mantener el control humano editorial cuando el run produce el artefacto completo de una sola vez?
- ¿Cómo evitar que un único error de calidad obligue a re-ejecutar todo el pipeline?

## Decisión

Se introduce un **sexto run type**: `FULL_ARTICLE`.

Un run `FULL_ARTICLE` ejecuta internamente, dentro de un único prompt estructurado entregado a Claude Cowork, las seis subfases de un pipeline editorial completo:

1. **RESEARCH** — investigación web real, identificación y citación de fuentes primarias.
2. **SEO** — análisis SERP, intención de búsqueda, target keywords, competitor insights.
3. **OUTLINE** — estructura editorial H2/H3 con objetivos por sección.
4. **WRITER** — redacción del cuerpo completo en Markdown con citas inline a `sources_used`.
5. **FACT_CHECK** — verificación cruzada de claims numéricos contra fuentes citadas.
6. **EDITOR** — pase final de coherencia, tono, longitud, formato, riesgos editoriales.

El prompt invoca explícitamente cada rol como sub-fase obligatoria del pipeline interno. Claude debe completar las seis antes de emitir el JSON final.

`FULL_ARTICLE` reutiliza íntegra la infraestructura de Fase 3A:

- entidad `ContentGenerationRun` sin cambios;
- mismo schema de output 1.0;
- mismo `ContentRunService.createRun(...)` y `submitOutput(...)`;
- mismo layout S3 `content/runs/{runId}/[prompt.txt|output_raw.md|output_validated.json|validation_errors.json]`;
- mismo bucket privado `sharemechat-content-private-test`;
- mismas reglas de permiso (`CONTENT.EDIT` para crear y enviar output; `CONTENT.VIEW` para listar).

La validación del output se **refuerza** específicamente cuando `run_type = FULL_ARTICLE`. Los runs discretos mantienen su validación actual sin cambios.

Como en Fase 3A: en esta iteración el output **no se aplica al artículo automáticamente**. El editor inspecciona el JSON validado y decide en otra acción manual (fuera del alcance de esta ADR).

### Validación reforzada de FULL_ARTICLE

Sobre la validación común del schema 1.0, FULL_ARTICLE exige los siguientes mínimos. Si cualquiera falla, el run se marca `REJECTED`:

- `sources_used` con al menos **5** elementos válidos (no se pasa el filtro genérico de RESEARCH/DRAFT que ya exige no-vacío; aquí 5 mínimo);
- `article_outline` con al menos **4 secciones** H2/H3;
- `draft_markdown` con longitud ≥ **800 caracteres**;
- `seo_title` no null, no vacío, ≤ 60 caracteres (en discretos era opcional ≤ 60);
- `meta_description` no null, no vacía, ≤ 160 caracteres (en discretos era opcional);
- `target_keywords` con al menos **un elemento `type = "primary"`**;
- `self_check_passed = true` obligatorio (en discretos puede ser `false` con `self_check_failures` rellenos; en FULL_ARTICLE no, dado que es atómico — un editor no puede dividir y re-ejecutar parcialmente).

Esto garantiza que un FULL_ARTICLE validado sea aplicable al artículo sin componer fragmentos de runs distintos.

### Permisos y coste

- `CONTENT.EDIT` suficiente para crear y enviar output, igual que el resto.
- **No se introduce permiso nuevo** para FULL_ARTICLE.
- El control de coste no es duro en esta iteración. La presión natural viene de ser el run más caro: tokens × densidad de prompt elevada. Métricas observables (count de runs por usuario / mes / tipo) ya disponibles vía `content_generation_runs`.

## Consecuencias

### Positivas

- **Reducción drástica de fricción operativa**: 1 run en lugar de 5, sin orquestación manual de cadena.
- **Mejor relación coste/resultado**: el research, el SEO, el outline y la redacción comparten contexto en un único prompt, evitando re-explicar el tema en cada paso.
- **Mayor coherencia entre fases**: el modelo no recarga ni reinterpreta entre subfases, eliminando drift.
- **Aprovechamiento real de Claude Cowork como sistema multi-rol**: el prompt obliga al pipeline interno explícito.
- **Cero impacto sobre Fase 3A**: aditivo. Los runs discretos siguen funcionando para casos donde se necesita inspección granular.
- **Sin migración**: `prompt_template_id = "FULL_ARTICLE/v1"` reutiliza la convención existente.

### Negativas

- **Menor granularidad de control intermedio**: el editor no puede aprobar el outline antes de que se redacte. Si la dirección editorial es errónea, se pierde el coste completo del run.
- **Mayor dependencia de la calidad del prompt**: el prompt FULL_ARTICLE concentra todas las directivas de research, SEO, redacción, fact-check y edición; un fallo de prompt produce fallo en todo el run.
- **Validación backend más crítica**: un único run produce un artefacto pesado; los errores se detectan al final, no entre subfases. La mitigación es la validación reforzada de la sección anterior.
- **Coste por run individual más alto**: aunque el coste agregado disminuye, el coste de un único run FULL_ARTICLE es superior al de un `RESEARCH` aislado. Esto reduce el "fail cheap" del flujo discreto.
- **Reentrenar criterio editorial**: los editores que dominan el flujo discreto deben aprender a redactar briefs más completos para que un único run produzca output utilizable.

## Riesgos

### R1 — Fail expensive
Un FULL_ARTICLE rechazado obliga a re-ejecutar todo el pipeline.

**Mitigación**: el prompt admite `prior_research_run_id` apuntando a un `RESEARCH` previo del mismo cluster, instruyendo a Claude a reusar fuentes ya identificadas. En la práctica, el editor que prevé alto riesgo puede ejecutar `RESEARCH` discreto primero y luego `FULL_ARTICLE` con esa research como contexto. Diseño previsto en ADR-010 sec 8 (palanca B — reutilización de research).

### R2 — Sobrecarga del prompt
Concentrar 6 subfases en un único prompt produce un prompt extenso que puede degradar la calidad si Claude no equilibra bien las subfases.

**Mitigación**: el prompt enumera explícitamente las 6 subfases como bloques numerados (`<phase_1_research>`, ..., `<phase_6_editor>`) y exige completar cada una antes de avanzar. La estructura forzada compensa la longitud.

### R3 — Falsa sensación de completitud
Un editor puede aceptar el output FULL_ARTICLE sin revisar críticamente porque "ya viene fact-checkeado".

**Mitigación**: la aplicación al artículo seguirá siendo una decisión humana explícita en futuras iteraciones (post-Fase 3B). Mientras esa pieza no exista, el FULL_ARTICLE solo deja artefactos auditables sin tocar el artículo. La revisión humana sigue siendo invariante de diseño (ADR-010).

### R4 — Drift de calidad entre versiones del prompt
Cambiar el prompt FULL_ARTICLE entre `v1` y `v2` produce outputs no comparables retroactivamente.

**Mitigación**: el `prompt_template_id` codifica versión (`FULL_ARTICLE/v1`, `FULL_ARTICLE/v2`). Auditoría futura puede agrupar runs por versión.

### R5 — Outputs inválidos por superar tope de bytes
Un FULL_ARTICLE puede generar outputs cercanos al tope de 1 MiB ya impuesto por `ContentRunService`.

**Mitigación**: el tope existe deliberadamente. Si un editor supera 1 MiB, sugerir reducir el alcance editorial (acotar `brief`) o regresar al flujo discreto para investigaciones masivas.

### R6 — Concentración del riesgo editorial en un único validador
La validación reforzada vive en `ManualClipboardClaudeAdapter`. Un bug ahí afecta a todos los FULL_ARTICLE.

**Mitigación**: validación implementada con checks aditivos sobre la base común (los discretos siguen funcionando con su validación original); fácil de probar y de extender. Coverage tests cuando entren testing en el módulo content.

## Alternativas consideradas

### Mantener solo runs discretos

Continuar con el modelo Fase 3A puro y educar a editores en orquestar la cadena.

Rechazada por la fricción operativa documentada y por el desaprovechamiento del potencial multi-rol de Claude Cowork.

### Sustituir runs discretos por FULL_ARTICLE

Eliminar `RESEARCH`, `OUTLINE`, `DRAFT`, `REVIEW`, `SEO` y dejar solo `FULL_ARTICLE`.

Rechazada porque los runs discretos siguen siendo útiles para:
- debugging de un fallo aislado en una subfase;
- reuso de `RESEARCH` entre artículos del mismo cluster;
- casos avanzados donde el editor quiere control granular del outline antes de redactar.

Mantenerlos no añade complejidad: comparten infraestructura, panel y validador.

### Pipeline backend orquestado (multi-call)

Implementar un servicio backend que invoque Claude vía API en cadena, ejecutando cada subfase como llamada separada y encadenando contexto.

Rechazada en esta fase porque:
- requiere integración API real, decisión que ADR-010 difiere a fase post-API;
- introduce coste automático no controlado;
- contradice la decisión Fase 3 de mantener `MANUAL_STRUCTURED` como modo activo;
- reabre la complejidad operativa de gestionar quotas, errors API, rate limits — fuera de alcance.

Esta alternativa puede revaluarse en una fase futura (Fase 3C o equivalente) cuando exista decisión explícita de activar el modo `API_HYBRID` ya reservado en `ContentConstants.MODE_API_HYBRID` y en el flag `CONTENT_AI_MODE`.

## Implementación

Implementación aditiva sin migración:

- `ContentConstants` añade `RUN_TYPE_FULL_ARTICLE = "FULL_ARTICLE"`.
- `ManualClipboardClaudeAdapter` añade `FULL_ARTICLE` a `ALLOWED_RUN_TYPES` y un bloque adicional de validación reforzada que se ejecuta solo cuando `runType == FULL_ARTICLE`.
- `ContentPromptBuilder` añade rama dedicada con el prompt multi-rol explícito: `<phase_1_research>`, `<phase_2_seo>`, `<phase_3_outline>`, `<phase_4_writer>`, `<phase_5_fact_check>`, `<phase_6_editor>`.
- `ContentRunService` añade `FULL_ARTICLE` a su `ALLOWED_RUN_TYPES`.
- `ContentArticleAIPanel` añade `FULL_ARTICLE` a la lista de botones del panel IA.

Sin cambios en schema MySQL, sin cambios en bucket S3, sin cambios en `SecurityConfig`, sin tocar el dominio editorial (`ContentArticleService`, workflow, versions, events).

## Relación con otras ADRs

- [ADR-010](adr-010-internal-content-cms-ai-assisted-workflow.md) — esta ADR ejerce la fase prevista de uso de IA bajo modo `MANUAL_STRUCTURED` con interfaz `ContentAIProvider` provider-agnostic. Cumple las decisiones estructurales de ADR-010 sec 6 (trazabilidad IA) y sec 7 (integración manual estructurada). El alcance específico de cuándo y cómo aplicar el output al artículo queda fuera de esta ADR y se decidirá en una iteración posterior (Fase 3B+ o Fase 4).

## Notas

- los runs discretos `RESEARCH`, `OUTLINE`, `DRAFT`, `REVIEW`, `SEO` **se mantienen operativos** para casos avanzados o debugging, pero dejan de ser el flujo principal recomendado;
- la validación reforzada de FULL_ARTICLE es deliberadamente estricta: prefiere rechazar un output que aceptar uno mediocre, dado que es el run más caro y el que tiene más impacto editorial agregado;
- esta ADR no decide sobre activación API automática (`API_HYBRID`/`API_AUTO`), que sigue diferida a fase posterior;
- como en Fase 3A, el editor sigue siendo el responsable final de aplicar el output al artículo en una acción manual separada; el sistema solo deja artefactos auditables.
