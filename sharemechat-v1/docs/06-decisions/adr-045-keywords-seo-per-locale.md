# ADR-045 — Keywords SEO per-locale editables por el operador

## Estado

Aceptada (2026-07-04).

Aplicabilidad: contrato de `content_article_translations.target_keywords`, editor admin del CMS, `ContentPromptBuilder`, `ContentRunService.applyBilingual`, skills del pipeline editorial (`cms-research-seo`, `cms-translate-en`, `cms-json-builder`, `cms-json-validator`), workflow editorial `DRAFT → IN_REVIEW`, migraciones Flyway del módulo CMS. Encadena a [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) (pipeline bilingüe fase 4.5), [ADR-025](./adr-025-flyway-introduction-and-cms-v2-schema.md) (rediseño CMS v2, modelo satélite bilingüe) y [ADR-027](./adr-027-brief-per-locale.md) (brief per-locale). Base factual: `docs/analysis/2026-07-04-cms-articulo-keywords-por-locale.md`.

## Contexto

### Estado antes de este ADR

Tras [ADR-025](./adr-025-flyway-introduction-and-cms-v2-schema.md) (Flyway V2) y [ADR-027](./adr-027-brief-per-locale.md) (Flyway V3), el subsistema CMS bilingüe tiene dos sitios donde viven "keywords":

- **`content_articles.keywords`** (JSON, compartido entre locales). Introducido por el operador desde la UI en un input plano coma-separado. Ejemplo real: `["video chat dating", "video chat vs swipe", "alternative to dating apps"]`.
- **`content_article_translations.target_keywords`** (JSON, per-locale). Array de objetos `{term, type, search_intent_match}` con `type` en `primary | secondary`. Poblado exclusivamente por el pipeline IA en la fase 5 (`cms-json-builder`) y persistido por `ContentRunService.applyBilingual`. **No visible ni editable en la UI**.

El flujo bilingüe actual es asimétrico: el operador rellena todo en ES; la fase 4.5 `cms-translate-en` genera EN por traducción automática y emite metadata `SUGGESTED_*_EN` (slug, seo_title, meta_description, brief). Para keywords no existe hoy un mecanismo diferenciado por idioma: `content_articles.keywords` es un único campo que sirve al pipeline para ambos locales.

### Problema detectado

Trabajo de research SEO US (`keyword-research-sharemechat-us-2026-06-24.xlsx`, 155 keywords) y análisis del plan editorial v5 revelan tres fallos operativos causados por la falta de separación:

1. **Mezcla de idiomas en el mismo artículo**. El plan editorial v5 tiene 37 artículos, todos con `locale=es`, pero muchos declaran en el campo `keywords` términos EN (`1v1 chat`, `what to expect 1v1 video chat`, `omegle alternative`) que un artículo en español no puede rankear en Google. Un artículo con idioma detectado ES intentando posicionar keywords EN es intent mismatch garantizado.
2. **Canibalización por ausencia de mapa 1 a 1 keyword→URL**. Sin distinguir primaria de secundarias y sin garantía de unicidad de la primaria por locale, varios artículos declaran las mismas keywords y compiten entre sí en la SERP (casos detectados: pareja duplicada #28/#37 con misma keyword `1v1 video chat`; trío #14/#15/#34 pelean por `videochat seguro` + `safe video chat strangers`; cluster Omegle #31/#35/#36 sin arquitectura pillar/spoke declarada).
3. **Sin control del operador sobre SEO EN**. La primary keyword EN del artículo la elige la fase 4.5 en función del contenido ES; el operador no puede fijar el término alrededor del cual quiere que se optimice el borrador anglosajón, aunque el equipo SEO haya identificado el término correcto en el research US.

### Motivación estratégica

Ver `docs/analysis/2026-07-04-cms-articulo-keywords-por-locale.md` para el análisis completo. Resumen: la doctrina SEO moderna es **una keyword primaria única por URL más 3-5 secundarias semánticas de apoyo**, con la primaria siendo el eje del research, del título, de la meta description y de la estructura de encabezados. En un CMS bilingüe, esa primaria es por locale, no compartida.

## Decisión

### D1 — Cambio de semántica de `target_keywords`

`content_article_translations.target_keywords` deja de ser **output-only de la IA** y pasa a ser **input del operador con enriquecimiento de la IA vía merge**.

- **Antes**: solo el pipeline escribe este campo. La UI no lo muestra ni lo edita.
- **Después**: el operador declara `primary` y hasta 5 `secondary` en la UI antes de lanzar el pipeline. La IA respeta lo declarado y añade el enriquecimiento `search_intent_match` en cada objeto (y opcionalmente más secondaries si el operador declaró menos de 5).

El formato JSON del campo no cambia. Sigue siendo un array de `{term, type, search_intent_match}`. Lo que cambia es quién puede escribirlo y cuándo.

### D2 — Cardinalidad

Por locale y por artículo:

- **Exactamente 1** objeto con `type=primary`. Nunca cero, nunca dos.
- **0 a 5** objetos con `type=secondary`. Cap duro en 5 (aplicado tanto en la UI como en el backend en la normalización previa a persistir).

### D3 — Obligatoriedad diferencial ES/EN

- **Primary ES**: obligatoria para poder lanzar el run IA `FULL_ARTICLE_ORCHESTRATED` y para transicionar `DRAFT → IN_REVIEW`. Es el nuevo gate del flujo editorial.
- **Primary EN**: opcional. Si el operador la deja vacía, la fase 4.5 (`cms-translate-en`) la deriva del ES adaptando al mercado anglosajón, no traduciendo literalmente. Si el operador la rellena, la fase 4.5 la honra sin sustituir.
- **Secondaries ES y EN**: opcionales, hasta 5 por locale.

Esta asimetría deriva de la Opción E-2 del informe de análisis y refleja la realidad operativa: el equipo edita en ES y no siempre tiene conocimiento SEO en inglés a mano.

### D4 — Merge en `applyBilingual`, no overwrite

Cuando el backend recibe el JSON del pipeline vía `POST /admin/content/articles/{id}/runs/{runId}/apply-bilingual`, la persistencia de `target_keywords` per-locale opera con las siguientes reglas:

1. **Primary `type=primary` con `term` no vacío en el input del operador**: se mantiene el término del operador tal cual. Si el JSON de la IA propone un `term` distinto en `type=primary`, se rechaza el run con 422 (violación del contrato).
2. **Primary vacía en el input del operador (solo permitido en EN)**: se acepta la primary propuesta por la IA. Se anota trazabilidad en un campo lateral del JSON de auditoría (`primary_keyword_source: "operator" | "ai_derived"`) para poder distinguir el origen a posteriori.
3. **Secondaries**: unión de las declaradas por el operador y las propuestas por la IA, deduplicadas por `term` (case-insensitive, trim), con cap final en 5 por locale. En caso de superar el cap, se priorizan las del operador.
4. **`search_intent_match`**: siempre lo aporta la IA. El operador no lo edita.

### D5 — Retirada progresiva de `content_articles.keywords`

El campo compartido `content_articles.keywords` queda marcado como **legacy** y se planifica su retirada en una migración posterior (no en esta):

- **En este ADR**: se marca `@Deprecated` en la entidad JPA con javadoc explicando su reemplazo. La UI deja de escribirlo (los inputs de la metadata compartida no lo incluyen). El `ContentPromptBuilder` deja de inyectarlo en el prompt. Se mantiene en BD por compatibilidad con los 5 artículos ya publicados.
- **En un ADR futuro**: migración de retirada. Backfill retroactivo a `target_keywords` per-locale para los publicados (con NULL para EN en los que no lo tuvieran), y Flyway destructiva que elimina la columna.

Justificación de no eliminarlo ahora: no hay urgencia técnica, hay 5 artículos vivos que dependen de él, y separar la deprecación de la eliminación reduce el blast radius de esta iteración.

### D6 — UI: las keywords viven en las pestañas ES/EN, no en la metadata compartida

- En **"Crear artículo"** (pantalla de creación inicial): no aparece ningún input de keywords. Se pide solo lo mínimo para tener un `article_id`.
- En **"Metadata compartida"** (bloque después de crear): se retira el input actual `Keywords`. Este bloque queda solo con Categoría y Hero URL.
- En **"Contenido por idioma"** (pestañas ES/EN): se añade al inicio de cada pestaña un bloque **Keywords SEO** con dos campos:
  - `Primary keyword`: input simple, límite 120 caracteres, contador inline. Obligatorio con asterisco visual en ES; opcional en EN con nota "Si lo dejas vacío, la IA lo derivará del ES adaptándolo al mercado anglosajón".
  - `Secondary keywords`: input coma-separado, con normalización backend (trim, deduplicación case-insensitive, cap a 5). Máximo 120 caracteres por término. Mismo patrón que el operador ya usa hoy con el campo `keywords` compartido, sin dependencia nueva.
- El botón **"Guardar campos SEO"** existente absorbe los dos campos nuevos. No se añade botón separado.

### D7 — Nuevo paso en el flujo editorial

El indicador visual del flujo editorial (bloque **"Flujo editorial"** en la ficha del artículo) gana un paso entre "Crear artículo" y "Generar artículo completo con IA":

1. Crear artículo
2. **Definir keywords SEO** (nuevo; se marca completado cuando existe `primary` ES no vacía)
3. Generar artículo completo con IA
4. Validar JSON y revisar vista previa
5. Enviar a revisión
6. Publicar

Sin el paso 2 completado, el botón **"Generar artículo completo"** del panel IA queda deshabilitado con tooltip explicativo. Esa validación se aplica también en backend en el endpoint que crea el run.

### D8 — Cambio de contrato del `ContentPromptBuilder`

`ContentPromptBuilder.appendEditorialInput` deja de emitir `keywords: <compartido>`. Pasa a emitir dos bloques `<locale_input>` anidados con la estructura de keywords ya limpia:

```
<editorial_input>
  Datos compartidos:
    category:       ...
    hero_image_url: ...
    current_state:  ...
  <locale_input locale="es">
    title:              ...
    slug:               ...
    brief:              ...
    primary_keyword:    ...
    secondary_keywords: [...]
  </locale_input>
  <locale_input locale="en">
    primary_keyword:    ...   (vacío permitido; la IA lo derivará)
    secondary_keywords: [...] (vacío permitido)
  </locale_input>
</editorial_input>
```

El bloque `<output_contract>` se refuerza para declarar la regla de merge (D4) y exigir que el JSON emitido respete la primary del operador cuando venga poblada. El `<self_check>` añade la verificación explícita "si input.primary_keyword_es está poblada, output.locales.es.target_keywords contiene un objeto {term: <mismo valor>, type: 'primary'}".

### D9 — Skills del pipeline editorial afectadas

Las siguientes skills reciben un contrato de input nuevo. Sus stubs en `docs/cms/skills/` se actualizan en el mismo commit del ADR.

- **`cms-research-seo`**: acepta `primary_keyword` como input autoritativo por locale. El research se ancla a ese término, no lo elige la skill.
- **`cms-draft-writer`**: sin cambios estructurales. Consume el research.
- **`cms-editorial-polish`**: sin cambios.
- **`cms-brand-legal-review`**: sin cambios.
- **`cms-translate-en`**: comportamiento condicional. Si input trae `primary_keyword_en` no vacío, honra el término del operador (adapta el cuerpo EN alrededor de esa keyword). Si viene vacío, deriva la primary EN del ES adaptando al mercado anglosajón, comportamiento actual. En ambos casos añade al bloque metadata final `SUGGESTED_PRIMARY_KEYWORD_EN` y `SUGGESTED_SECONDARY_KEYWORDS_EN` para trazabilidad, incluso cuando la primary EN fue autoritativa del operador (ahí el valor de `SUGGESTED_PRIMARY_KEYWORD_EN` coincide con el input).
- **`cms-json-builder`**: emite `locales.{es,en}.target_keywords` respetando la primary autoritativa del operador cuando aplique.
- **`cms-json-validator`**: añade dos checks: exactamente un `type=primary` por locale; si el input operador venía con primary, coincide con la del output.

### D10 — Migración BD

**No hay migración destructiva.** Los campos `target_keywords` en `content_article_translations` ya existen y ya son JSON. No se añaden columnas nuevas.

Se emite una **Flyway V4 cosmética** que:

1. Actualiza el comentario SQL de la columna `content_article_translations.target_keywords` para reflejar la nueva semántica.
2. Actualiza el comentario SQL de `content_articles.keywords` marcándolo como legacy.

Ambos comentarios son informativos, no afectan estructura ni datos. La razón de emitirlo como Flyway y no como cambio suelto es dejar trazabilidad histórica del cambio de semántica en el propio historial de migraciones.

## Consecuencias

### Positivas

- **Control SEO real por locale para el operador.** Puede dirigir el eje del artículo en ES e EN por separado, alineado con research de mercado independiente.
- **Cero duplicación de campos.** La estructura existente `target_keywords` sirve. No se añaden columnas, no se introducen dos representaciones parciales de lo mismo.
- **Migración BD mínima.** Un Flyway cosmético, sin backfill destructivo, sin blast radius.
- **UX consistente.** Las keywords quedan al lado del título/slug/brief de cada locale, exactamente donde el operador ya edita el resto del SEO per-locale. No se inventa una ubicación nueva.
- **Compatibilidad con lo publicado.** Los 5 artículos ya PUBLISHED conservan su `target_keywords` intacto (que ya trae la primary de la IA). Cuando el operador edite uno, verá los valores y podrá ajustarlos.
- **Gate operativo claro.** El operador no puede lanzar el pipeline sin haber declarado primary ES. Los errores de "keywords vacías o irrelevantes" del plan v5 dejan de ser posibles.
- **Aditivo en el pipeline.** Las skills existentes se extienden, no se reescriben. La fase 4.5 gana comportamiento condicional pero mantiene su fallback actual.

### Negativas y trade-offs

- **Doble semántica en la fase 4.5** (deriva vs honra). Requiere test explícito de ambas ramas. Se mitiga con el flag de auditoría `primary_keyword_source` que deja rastro del comportamiento aplicado.
- **`content_articles.keywords` queda como legacy vivo** hasta el ADR futuro que lo retire. Cualquier lectura de ese campo desde código nuevo debe considerarse deuda inmediata.
- **Cambio de contrato en `applyBilingual`** requiere migrar mentalmente de "overwrite total con lo que trae la IA" a "merge con lo que el operador ya declaró". Hay que ser explícito en el service y cubrir con test unitario los tres casos: (a) operador vacío + IA propone; (b) operador poblado + IA respeta; (c) operador poblado + IA intenta sustituir (rechazo 422).
- **UI de la creación inicial y de la metadata compartida cambia visualmente** (retirada del input Keywords en dos sitios). Impacto formativo bajo pero no cero; documentar en el CHANGELOG operativo.
- **Discrepancia temporal en artículos legacy**. Los 5 artículos publicados conservan `content_articles.keywords` poblado y `target_keywords` per-locale poblado por IA. Coexistencia acotada, se resuelve cuando el operador los edite (paso 3 del plan operativo) o en el ADR de retirada.

### Riesgos que este ADR no cierra

- **Consistencia entre research SEO externo y lo que se declara en la UI**. Este ADR permite declarar keywords per-locale pero no valida que sean buenas keywords. La calidad del research sigue siendo responsabilidad del operador (o de un skill futuro `seo-council` sobre el que hay conversación pendiente).
- **Estrategia de clusters pillar/spoke**. El ADR habilita 1 primary única por URL como estructura, pero no impone unicidad global entre URLs del propio sitio. La canibalización sigue siendo posible si el operador declara la misma primary en dos artículos. Se contempla añadir validación de unicidad global de primary en un ADR posterior si se detecta que es fricción real.

## Alternativas consideradas y descartadas

### Añadir columnas dedicadas `primary_keyword` y `secondary_keywords` per-locale en `content_article_translations`

Fue la primera opción considerada. Se descartó porque:

- Duplica semánticamente lo que ya vive en `target_keywords`.
- Fuerza sincronización obligatoria entre dos representaciones (`primary_keyword` VARCHAR + `target_keywords[type=primary].term`) en cada write.
- Introduce riesgo de desalineación silenciosa (Google indexa una representación, el backend valida otra).
- Requiere Flyway destructiva para añadir columnas cuando el modelo actual ya cubre la necesidad con cambio de semántica.

### Añadir columnas `kw_primaria_es`, `kw_secundarias_es`, `kw_primaria_en`, `kw_secundarias_en` en `content_articles`

Descartada de plano por romper el modelo satélite de [ADR-025](./adr-025-flyway-introduction-and-cms-v2-schema.md): mete campos con dimensión locale en la tabla compartida.

### Extender el JSON `content_articles.keywords` compartido con estructura tipada por locale

Descartada porque:

- Pierde tipado real en BD.
- Complica consultas SQL de auditoría SEO.
- Contradice el principio del modelo satélite (todo lo per-locale vive en translations).
- Solo pospone la decisión: tarde o temprano hay que mover a translations.

### Opción E-1: manual completo por locale, obligatorio ambos

Descartada. Fricción alta para el operador, asume conocimiento SEO EN que no siempre está disponible, y rompe el eje asistivo del CMS ("operador vive en ES, EN es derivado").

### Opción E-3: solo ES manual, EN totalmente derivado por IA sin campos EN en la UI

Descartada. Contradice el objetivo declarado del proyecto de dar control SEO EN al operador. Deja `target_keywords_en` como campo "solo escritura IA" con una UI que lo muestra pero no lo edita, patrón raro y contraintuitivo.

### Opción E-4: EN se traduce y luego el operador puede editar post-hoc

Descartada. La primary keyword EN condiciona todo el borrador EN (cuerpo, seo_title, meta_description). Si el operador la cambia después de aplicar el JSON, el cuerpo EN queda desalineado con la keyword y hay que re-generar. Coste operativo alto y no evidente para el operador.

## Trabajo derivado por capa

Esta sección no es parte de la decisión (que ya está cerrada arriba) sino guía para la implementación. Ordenada por capa, no por prioridad de ejecución.

### Backend Java

- `ContentArticleTranslation.java`: sin cambios estructurales. Añadir javadoc a `targetKeywords` explicando nueva semántica.
- `ContentArticle.java`: `keywords` marcado `@Deprecated` con javadoc que apunta a este ADR.
- `TranslationMetadataUpdateRequest.java`: aceptar `targetKeywords` como estructura tipada (o preferiblemente dos campos aparte `primaryKeyword`, `secondaryKeywords` que el service compone). Decisión de detalle a resolver en la implementación.
- `ArticleUpdateRequest.java`: retirar `keywords` del contrato de update de metadata compartida (o mantenerlo aceptando el valor pero sin persistir, si hay clientes viejos). Preferir retirada limpia.
- `ContentArticleService.java`: nueva validación "primary ES no vacía" para permitir DRAFT→IN_REVIEW y para permitir crear run IA. Normalización de secondaries (trim, dedup case-insensitive, cap 5, max 120 chars por término).
- `ContentRunService.applyBilingual`: reimplementar persistencia de `target_keywords` como merge según D4, con rechazo 422 explícito si la IA propone primary distinta a la del operador cuando esta venía poblada.
- `ContentPromptBuilder.java`: reescribir `appendEditorialInput` según D8. Reforzar `appendOutputContract` y `appendSelfCheck` con las reglas nuevas.
- `ContentAdminController.java`: exponer PATCH de translation aceptando los campos nuevos. Endpoint existente basta.

### Frontend admin

- `ContentArticleEditor.jsx`: retirar input Keywords del bloque metadata compartida.
- `BodyLocaleTabs.jsx`: añadir bloque "Keywords SEO" al inicio de cada pestaña. Dos campos según D6.
- `ContentArticleAIPanel.jsx`: (a) el prompt expandido mostrado en la UI reflejará el nuevo formato porque viene del backend, no requiere cambio front; (b) botón "Generar artículo completo" queda deshabilitado si falta primary ES, con tooltip explicativo.
- `ReviewChecklist.jsx`: añadir "primary keyword ES presente" a la lista visual del checklist.
- El bloque "Flujo editorial" muestra el paso nuevo "Definir keywords SEO" según D7.
- `i18n/locales/cms/*`: literales nuevos.

### Documentación y skills

- Actualizar stubs de skill afectados en `docs/cms/skills/`: `cms-research-seo`, `cms-translate-en`, `cms-json-builder`, `cms-json-validator`.
- Añadir a `docs/02-architecture/cms-seo-overview.md` una sección "Keywords per-locale editables" que explique el modelo mental para futuros contribuidores.
- Añadir al `known-debt.md` las discrepancias D-1 a D-7 del informe de análisis, con referencia a este ADR-045 en las que este ADR ayuda a cerrar (D-2 en particular queda superseded porque este ADR redefine el contrato de la fase 4.5 y elimina la ambigüedad del opt-out).

### Migraciones

- Flyway `V4__keywords_semantic_clarification.sql`: solo comentarios de columna, sin cambios de esquema.

### Base de datos

Ninguna acción operativa. Los datos existentes son compatibles.

## Impacto sobre ADRs anteriores

- **[ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md)** (`cms-translate-en`, fase 4.5): parcialmente superseded. La fase 4.5 mantiene su rol, pero pasa a operar con comportamiento condicional según D3+D9. El opt-out "skip translate-en" descrito en ADR-023 D3 y no vivo en la skill queda formalmente retirado por este ADR (discrepancia D-2 del informe resuelta).
- **[ADR-025](./adr-025-flyway-introduction-and-cms-v2-schema.md)** (rediseño CMS v2): reforzado. Este ADR se apoya en el modelo satélite y no lo altera.
- **[ADR-027](./adr-027-brief-per-locale.md)** (brief per-locale): reforzado. Este ADR aplica el mismo principio (campos lingüísticamente sensibles viven en `content_article_translations`, no en `content_articles`).

## Referencias

- Análisis de trabajo: `docs/analysis/2026-07-04-cms-articulo-keywords-por-locale.md`
- Research SEO US: `keyword-research-sharemechat-us-2026-06-24.xlsx` (2026-06-24)
- Plan editorial: `plan-editorial-sharemechat-v6.xlsx` (2026-07-04, columnas keyword per-locale añadidas como preparación operativa a este ADR)
- Código fuente ancla:
  - `sharemechat-v1/src/main/java/com/sharemechat/content/entity/ContentArticle.java`
  - `sharemechat-v1/src/main/java/com/sharemechat/content/entity/ContentArticleTranslation.java`
  - `sharemechat-v1/src/main/java/com/sharemechat/content/service/ContentPromptBuilder.java`
  - `sharemechat-v1/src/main/java/com/sharemechat/content/service/ContentRunService.java`
  - `sharemechat-v1/frontend/src/pages/admin/content/BodyLocaleTabs.jsx`

---

**Pendiente**: implementación por Claude Code desktop en un commit posterior.
