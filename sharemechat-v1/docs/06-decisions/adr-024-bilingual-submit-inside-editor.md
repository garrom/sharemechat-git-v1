# ADR-024 — Flujo bilingue dentro del editor: 2 JSON en una operacion atomica

## Estado

Aceptada (2026-05-15).

Reemplaza al ADR-024 anterior ("Endpoint admin para importar articulo desde JSON", eliminado el 2026-05-15 tras detectar que su UX top-level no era la correcta). Aplicabilidad: backend admin del CMS (`ContentRunAdminController`, `ContentRunService`, `ContentArticleService`), frontend admin (`ContentArticleAIPanel` dentro del editor del articulo). Cierra la pieza CMS-side de [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) (pipeline editorial bilingue) y [ADR-022](./adr-022-blog-cms-multilingual-es-en.md) (multilingue ES+EN).

## Contexto

[ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) cerro el pipeline editorial bilingue: el run produce dos ficheros (`final_es.json` y `final_en.json`) en disco. El operador necesita pegarlos en el admin del CMS.

Una primera implementacion (4C.2 inicial) introdujo un endpoint **top-level** en el listado del admin (`POST /api/admin/content/articles/import-from-json`) acompañado de un boton "Importar desde JSON" en el listado de articulos. El operador detecto que esa UX era incorrecta:

- El operador esta **mentalmente en el articulo padre ES** cuando lanza el pipeline. Salir del editor para ir a un panel top-level genera friccion cognitiva.
- Los 2 JSON forman parte del **mismo run**; no son artefactos independientes. Pegarlos en sitios separados rompe la atomicidad operativa.
- Si el JSON EN falla validacion DESPUES de haber pegado el ES, ya hay un articulo ES creado. El operador queda con un estado inconsistente que debe limpiar manualmente.
- El listado top-level introduce ruido en una superficie (listado) que el operador usa para navegar, no para crear.

La pregunta operativa correcta es: **¿como pegar los 2 JSON dentro del editor del articulo ES en una sola accion atomica?**

## Opciones consideradas

### Opcion A — Endpoint top-level + boton en el listado (descartada)

Implementacion inicial de 4C.2. Endpoint `POST /articles/import-from-json` independiente del flujo de runs. Boton "Importar desde JSON" en el listado top-level. Vista nueva con textarea unico para pegar un JSON.

Pros:
- Endpoint independiente, sin acoplamiento al flujo de runs.
- Permite importar JSON huerfanos (sin run previo).

Contras:
- UX desacoplada del modelo mental del operador.
- No atomico: ES y EN son operaciones separadas.
- Crea articulos sin run asociado (huerfanos en auditoria).

Descartada y revertida.

### Opcion B — 2 textareas dentro del editor, operacion atomica (elegida)

Modificar el panel IA del editor (`ContentArticleAIPanel`) para mostrar **2 textareas en paralelo** cuando el articulo tiene `locale="es"`. Endpoint nuevo `POST /articles/{id}/runs/{runId}/output-bilingual` que acepta `rawJsonEs` (obligatorio) + `rawJsonEn` (opcional). Si `rawJsonEn` vacio: delega al flujo monolingue ([ADR-014](./adr-014-full-article-orchestrated-pipeline.md)). Si presente: valida ambos JSON, verifica coherencia `parent_slug == suggested_slug`, aplica ES al articulo del run y crea articulo hijo EN, todo en una transaccion (`@Transactional`).

Pros:
- UX coherente con el modelo mental del operador: esta en el editor del articulo padre ES, y pega los 2 JSON aqui.
- Atomicidad real: si EN falla, ES tampoco se aplica (rollback BD).
- Reutiliza el endpoint de runs (no rompe el patron de "el JSON se pega en el run del articulo").
- En articulos EN o no-ES, el segundo textarea no se muestra (UX limpia segun contexto).
- Cero nuevo concepto en backend: sigue habiendo "submit output a un run" + accion "aplicar al articulo", solo que con rama bilingue.

Contras:
- Doble validacion de JSON antes de tocar S3 (acumula CPU pero es barato).
- Side-effects en S3 (subidas de raw + validated + body draft ES + body draft EN) NO se rollbackean si la transaccion BD falla. Aceptable: quedan huerfanos sin referencia desde BD.

Elegida.

### Opcion C — Endpoint bilingue + boton dentro del editor

Endpoint independiente como Opcion A, pero con boton dentro del editor (no en el listado). Mejor que A pero peor que B porque no aprovecha la semantica "submit output al run".

Descartada por redundancia con el flujo de runs.

## Decisión

Adoptar Opcion B con las siguientes decisiones operativas:

1. **DTO nuevo** `SubmitOutputBilingualRequest` con `rawJsonEs`, `rawJsonEn`, `modelId`, `modelVersion`. `rawJsonEs` obligatorio; `rawJsonEn` opcional.
2. **DTO salida** `BilingualSubmitResultDTO { runDetail, childArticle (nullable), bilingual }`.
3. **Endpoint nuevo** `POST /api/admin/content/articles/{articleId}/runs/{runId}/output-bilingual` en `ContentRunAdminController`. Permiso `CONTENT_EDIT` (igual que submitOutput).
4. **Service nuevo metodo** `ContentRunService.submitOutputBilingual(...)`:
   - Si `rawJsonEn` vacio: delega a `submitOutput` (flujo monolingue ADR-014, intacto). Devuelve `BilingualSubmitResultDTO(runDetail, null, false)`.
   - Si presente: valida ambos JSON con `aiProvider.validateOutput`. Acumula failures de ambos prefijados con `es:` / `en:` para distinguirlos. Si CUALQUIERA falla → 422 con detalle JSON estructurado.
   - Verifica que el articulo del run tiene `locale="es"`. Si no → 400.
   - Verifica que `parent_slug` del EN coincide LITERALMENTE con `suggested_slug` del ES. Si no → 422.
   - Verifica que JSON EN tiene los campos minimos (`language`, `suggested_slug`, `seo_title`, `meta_description`, `draft_markdown`).
   - Procesa JSON ES via `submitOutput` (sube raw + validated, marca run VALIDATED).
   - Aplica body ES al articulo del run via `applyValidatedDraftToArticle` (sube draft.md, emite evento `ai_apply`).
   - Crea articulo hijo EN via `ContentArticleService.createBilingualChildArticle` (sube body, emite evento `ai_import`).
   - Devuelve `BilingualSubmitResultDTO(runDetail, childArticle, true)`.
5. **Service nuevo metodo** `ContentArticleService.createBilingualChildArticle(parentArticleId, slug, locale, title, brief, keywordsCsv, inheritedCategory, draftMarkdown, sourceRunId, actorUserId)`:
   - Normaliza slug/locale/title/brief/keywords usando reglas existentes.
   - Verifica UNIQUE(slug, locale). Si conflicto → 409.
   - Crea `ContentArticle` con `parent_article_id` apuntando a la raiz, `state=DRAFT`, `ai_assisted=true`, `disclosure_required=true`, `category` heredada del padre cuando aplica.
   - Sube `draft_markdown` a S3 via `bodyStorageService.uploadDraftBody`.
   - Emite evento `EDIT_APPLIED` con `target="ai_import"`, `source_run_id`, `parent_article_id`, `slug`, `language`.
   - Devuelve `ArticleDetailDTO`.
6. **Atomicidad**: ambos metodos comparten transaccion REQUIRED (propagacion por defecto). Si falla la creacion del hijo, rollback BD afecta tambien al `submitOutput` y `applyValidatedDraftToArticle` invocados anteriormente. Las subidas a S3 NO se rollbackean (deuda registrada).
7. **Frontend admin** — modificar `ContentArticleAIPanel.jsx`:
   - Nueva prop `articleLocale` (pasada desde `ContentArticleEditor`).
   - Si `articleLocale === 'es'`: mostrar 2 textareas en paralelo (ES obligatorio + EN opcional). En otros locales (EN, futuros): solo el textarea ES actual.
   - `handleSubmitOutput` bifurca segun si el textarea EN esta relleno: endpoint monolingue `/output` (sin cambios) o endpoint bilingue `/output-bilingual`.
   - Tras exito bilingue: refresca el editor (callback `onAiDraftApplied`) y muestra mensaje con `id` y `slug` del articulo hijo creado.
8. **Cero migracion SQL**: `parent_article_id` ya existe desde 4A; evento `EDIT_APPLIED` ya esta en el CHECK del schema.

## Justificación

La pregunta "donde pega el operador los 2 JSON" determina la arquitectura. La respuesta correcta es **donde el operador esta mentalmente**: en el editor del articulo padre, justo despues de leer el reporte del pipeline. Cualquier otra ubicacion fuerza al operador a "salir y volver".

Sobre las subdecisiones:

- **Endpoint bilingue separado del monolingue**: el flujo monolingue (`POST /output` + accion "Aplicar al articulo" en dos pasos) sigue vivo para runs no bilingues y para flujos donde el operador quiere revisar el JSON antes de aplicar. El bilingue es atomico porque atomicidad es el valor diferencial.
- **Delegacion al monolingue cuando `rawJsonEn` esta vacio**: evita duplicar la logica del flujo de runs y garantiza que el comportamiento por defecto sea el establecido en ADR-014.
- **Validacion estricta `parent_slug == suggested_slug`**: es el contrato editorial de [ADR-022](./adr-022-blog-cms-multilingual-es-en.md). Sin ese check, el hijo podria quedar con `parent_article_id` apuntando a un articulo ES distinto, rompiendo la relacion bilingue.
- **Solo en articulos ES (el segundo textarea)**: en articulos EN, el `parent_article_id` ya esta resuelto desde su propia creacion bilingue inicial; no tiene sentido pegar otro JSON EN para crear un "hijo de hijo".
- **Aplicar el ES en la misma operacion (no esperar "Aplicar al articulo")**: la atomicidad de la accion del operador es "valido ambos y los aplico". Forzarle a pulsar dos botones rompe la coherencia transaccional desde su punto de vista.

## Impacto

### Backend (Java)

| Fichero | Cambio |
|---|---|
| `src/main/java/com/sharemechat/content/dto/SubmitOutputBilingualRequest.java` | **CREADO**. DTO entrada. |
| `src/main/java/com/sharemechat/content/dto/BilingualSubmitResultDTO.java` | **CREADO**. DTO salida (record). |
| `src/main/java/com/sharemechat/content/service/ContentArticleService.java` | Metodo publico nuevo `createBilingualChildArticle(...)`. Sin modificacion de `createArticle`, `applyAiDraftToArticle`, ni otros existentes. |
| `src/main/java/com/sharemechat/content/service/ContentRunService.java` | Metodo publico nuevo `submitOutputBilingual(...)`. Helpers privados `textOrNull`, `extractKeywordsCsv`. Sin modificacion de `submitOutput` ni `applyValidatedDraftToArticle`. |
| `src/main/java/com/sharemechat/content/controller/ContentRunAdminController.java` | Endpoint nuevo `POST .../runs/{runId}/output-bilingual`. |

### Frontend (React)

| Fichero | Cambio |
|---|---|
| `frontend/src/pages/admin/content/ContentArticleEditor.jsx` | Propaga `articleLocale={meta.locale}` al `ContentArticleAIPanel`. Una linea cambiada. |
| `frontend/src/pages/admin/content/ContentArticleAIPanel.jsx` | Nueva prop `articleLocale`. Nuevo state `rawOutputEn`. Bifurcacion en `handleSubmitOutput`. Segundo textarea condicional en UI. |

### Operaciones

- Cero migraciones SQL.
- Cero cambios en endpoints publicos del blog.
- Cero cambios en `submitOutput` o `applyValidatedDraftToArticle`.
- Empaquetado + deploy estandar (responsabilidad del operador).

## Consecuencias

### Positivas

- Operador pega los 2 JSON donde esta mentalmente (en el editor del articulo padre).
- Operacion atomica BD: si EN falla, ES tampoco se aplica.
- Reutiliza al maximo: validador del adapter, `submitOutput`, `applyValidatedDraftToArticle`, `uploadDraftBody`, `emitEvent`.
- En articulos no-ES, la UI no muestra textarea EN (cero ruido).
- Patron extensible: futuros locales (fr, de, it) pueden añadirse anadiendo textareas adicionales en raices ES.

### Negativas / aceptadas

- Subidas a S3 NO se rollbackean si rollback BD ocurre despues. Quedan ficheros huerfanos sin referencia. Aceptado: limpieza periodica con script de mantenimiento si crece el volumen.
- Doble validacion de JSON antes de tocar S3 (acumula CPU). Despreciable.
- Lectura del DTO salida `BilingualSubmitResultDTO` agrega un nivel de anidamiento en el frontend (`result.runDetail` vs `updated` plano). Aceptable.

### Trade-offs

- Endpoint nuevo `/output-bilingual` (Opcion B) frente a ampliar `/output` (cambio de comportamiento): se renuncia a "un solo endpoint" a cambio de NO modificar el contrato del monolingue. La estabilidad del flujo monolingue es prioridad.
- Atomicidad BD pero no atomicidad S3: se renuncia a atomicidad perfecta de los side-effects a cambio de simplicidad. Compensado por que los huerfanos no afectan al servicio (solo ocupan espacio).

## Notas

### Notas operativas

- **Verificacion post-deploy**: abrir un articulo ES en el editor; en el panel del run con status PENDING, deben aparecer 2 textareas (ES obligatorio + EN opcional). En un articulo EN, debe aparecer solo 1.
- **Smoke test bilingue**:
  1. Lanzar pipeline bilingue ([ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md)) desde el articulo padre ES.
  2. Pegar `final_es.json` en el textarea ES, `final_en.json` en el textarea EN.
  3. Pulsar "Validar y guardar". Esperado: articulo ES actualiza body + articulo hijo EN creado en DRAFT con `parent_article_id` apuntando al ES.
- **Smoke test monolingue**:
  1. Pegar solo el JSON ES, dejar el textarea EN vacio. Pulsar "Validar y guardar".
  2. Esperado: comportamiento monolingue ADR-014 (validar + guardar, sin crear hijo). Sigue siendo posible aplicar el draft despues con el boton "Aplicar al articulo".
- **Smoke test error**:
  - Pegar JSON EN con `parent_slug` que NO coincide con `suggested_slug` del ES → 422 con mensaje claro.
  - Pegar 2 JSON cuando el articulo es EN → el textarea EN no debe aparecer.

### Alternativas futuras consideradas

- **Subidas S3 transaccionales** (rollback de objetos si falla BD): complejo, requiere two-phase commit con S3. No justificado al volumen actual.
- **Endpoint bilingue para articulos hijos** (crear nietos): rechazado. La relacion bilingue es ES (raiz) -> otros (hijos), no en cascada. Si en el futuro hay raices multilingues (fr, de), reabrir la conversacion.
- **`source_run_id` persistido en `content_articles`**: hoy queda en el evento `EDIT_APPLIED` payload. Si en el futuro se quiere busqueda directa "que articulos vienen del run X", añadir columna BD.

### Deuda registrada

- **Ficheros S3 huerfanos** tras rollback BD: limpieza periodica con script de mantenimiento si crece el volumen.
- **Sin auditoria del JSON EN crudo**: el JSON EN no se persiste como `output_validated_en.json` en S3 separado; sus datos se materializan en el articulo hijo creado. Si en el futuro se quiere auditoria del JSON crudo EN, ampliar `ContentBodyStorageService` con un método paralelo.
- **`category` no canonica en el JSON**: heredamos del padre cuando existe. Si en el futuro el pipeline emite `category` propia, simplificar.
- **`heroImageUrl` no canonica**: queda `null` en el hijo creado; el editor la fija manualmente despues.

## Referencias

- [ADR-022](./adr-022-blog-cms-multilingual-es-en.md) — Blog y CMS multilingue ES+EN. Define `parent_article_id` y convencion de locale base ES.
- [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) — Pipeline editorial bilingue. ADR-024 cierra la pieza CMS-side dentro del editor.
- [ADR-014](./adr-014-full-article-orchestrated-pipeline.md) — Pipeline orquestado monolingue. Endpoint `/output` intacto; el bilingue es un endpoint paralelo.
- [ADR-010](./adr-010-internal-content-cms-ai-assisted-workflow.md) — Workflow AI-assisted (sec 6: `ai_assisted=true => disclosure_required=true`).
- [ADR-016](./adr-016-content-workflow-simplification-and-retraction.md) — Workflow editorial (estado inicial DRAFT del hijo).
- `src/main/java/com/sharemechat/content/controller/ContentRunAdminController.java` — Endpoint nuevo `/output-bilingual`.
- `src/main/java/com/sharemechat/content/service/ContentRunService.java` — Metodo `submitOutputBilingual`.
- `src/main/java/com/sharemechat/content/service/ContentArticleService.java` — Metodo `createBilingualChildArticle`.
- `src/main/java/com/sharemechat/content/dto/SubmitOutputBilingualRequest.java` — DTO entrada (creado).
- `src/main/java/com/sharemechat/content/dto/BilingualSubmitResultDTO.java` — DTO salida (creado).
- `frontend/src/pages/admin/content/ContentArticleAIPanel.jsx` — UI con 2 textareas condicional.
- `frontend/src/pages/admin/content/ContentArticleEditor.jsx` — Propaga `articleLocale` al panel.
