# ADR-023 — Pipeline editorial bilingue ES+EN: fase 4.5 cms-translate-en + outputs duales

## Estado

Aceptada (2026-05-14).

Aplicabilidad: orquestador editorial backend (`ContentPromptBuilder`), skills personales del editor en Claude Cowork, documentacion del pipeline editorial. Extiende a [ADR-014](./adr-014-full-article-orchestrated-pipeline.md) sin reemplazarlo (los runs con "skip translate-en" siguen el flujo descrito en ADR-014). Cierra la pieza editorial pendiente de [ADR-022](./adr-022-blog-cms-multilingual-es-en.md) sobre como producir simultaneamente las dos versiones de un articulo (ES + EN) desde un unico run.

## Contexto

[ADR-022](./adr-022-blog-cms-multilingual-es-en.md) definio que el blog y el CMS soportan multilingue ES + EN con:

- Slugs distintos por locale (no traduccion literal).
- URLs con prefijo `/en/` para el locale no-default.
- `parent_article_id` (BD existente, reutilizada en 4A) como mecanismo de vinculacion entre versiones del mismo grupo.
- Generacion EN via IA con revision editorial humana antes de publicar.

[ADR-014](./adr-014-full-article-orchestrated-pipeline.md) definio el pipeline editorial orquestado monolingue con cinco fases secuenciales (`cms-research-seo`, `cms-draft-writer`, `cms-editorial-polish`, `cms-brand-legal-review`, `cms-json-builder`) mas la skill transversal `sharemechat-voice`. El backend (`ContentPromptBuilder.java`) genera un prompt orquestador que el editor copia a Claude Cowork; el output es un unico `final.json` que el operador pega manualmente en el admin del CMS.

Tras 4A (backend multilingue con `parent_article_id` y `alternates`), 4B (frontend con basename estatico, switcher URL-based y namespace blog en i18n) y 4B.5 (locale activo propagado al backend en las llamadas API), **falta cerrar el lado editorial**: que el pipeline produzca ambas versiones (ES + EN) en un solo run, sin obligar al editor a ejecutar el pipeline dos veces ni a redactar EN desde cero.

La pregunta concreta es: ¿como inyectar la traduccion EN en el flujo orquestado sin romper la option de generar solo ES cuando el contenido no debe internacionalizarse (anuncios locales, contenido editorial especifico de mercado hispano, etc.)?

## Opciones consideradas

### Opcion A — Backend importa los dos JSON en una sola operacion

Modificar `ContentAdminController` para aceptar dos JSON (`final_es.json` + `final_en.json`) en un unico endpoint, validar ambos, persistir las dos versiones y vincularlas via `parent_article_id` automaticamente.

Pros:
- Atomicidad: ES y EN se crean a la vez o ninguno.
- Cero fricción operativa para el editor (una sola accion en admin).

Contras:
- Complejidad significativa en el endpoint y en el frontend admin (que hoy solo sabe pegar un JSON cada vez).
- Rompe el patron del admin actual, validado en TEST.
- Requiere validacion cruzada (parent_slug coherente, sources_used identicos, etc.) en el endpoint, duplicando logica que ya hace `cms-json-builder` en Cowork.
- El acoplamiento entre los dos JSON sale del campo de la skill IA hacia el backend; mover esa logica a Java es prematuro.

Descartada por complejidad desproporcionada al valor.

### Opcion B — Pipeline monolingue + run manual EN posterior

Mantener el pipeline actual (monolingue) y, cuando se quiera version EN, lanzar un segundo run con el mismo brief y prompt ad hoc al editor pidiendo traduccion.

Pros:
- Cero cambio en el backend.

Contras:
- El editor lanza el pipeline dos veces por articulo bilingue, duplicando coste editorial (tiempo y tokens).
- Riesgo alto de divergencia editorial: el segundo run podria producir `sources_used` distintos, `article_outline` distinto, etc., al investigar de nuevo desde cero.
- No garantiza vinculacion: el operador tiene que recordar setear `parent_article_id` manualmente al importar el EN.

Descartada por coste operativo y riesgo de incoherencia.

### Opcion C — Fase 4.5 cms-translate-en + outputs duales (elegida)

Introducir una nueva fase **4.5** en el pipeline orquestado, entre `cms-brand-legal-review` (4) y `cms-json-builder` (5), que traduce el `reviewed.md` (ES) al ingles y produce `reviewed_en.md` con un bloque de metadatos al final (slug EN, seo title EN, meta description EN). La fase 5 (`cms-json-builder`) lee ambos `reviewed*.md` y emite dos JSON: `final_es.json` (raiz, `parent_slug=null`) y `final_en.json` (`parent_slug = suggested_slug` del ES). El run del pipeline deja de emitir un JSON puro como output y pasa a emitir un **reporte estructurado** con los datos clave del run; el operador abre los dos JSON desde disco y los pega manualmente en el admin del CMS, uno cada vez, **sin cambios en el endpoint admin**.

La fase 4.5 se ejecuta **por defecto**. Si el operador incluye "skip translate-en" en su mensaje al lanzar el pipeline, la 4.5 se salta y la fase 5 emite solo `final_es.json` (comportamiento equivalente a ADR-014).

La orquestacion concreta de las fases la encapsula la skill `cms-orchestrator` en Cowork (Claude.ai), ya creada por el operador. El backend solo genera el prompt y delega ejecucion.

Pros:
- Una sola pasada del pipeline genera ambas versiones, garantizando coherencia editorial (mismos `sources_used`, `article_outline`, `search_intent`, `target_keywords`).
- Cero cambios en el endpoint admin: el operador sigue pegando un JSON cada vez (flujo conocido).
- Reversible: "skip translate-en" devuelve al pipeline monolingue para contenido no bilingue.
- Extensible: añadir un cuarto locale (fr, de, it) en el futuro es estrictamente operativo (nueva fase 4.6, 4.7, etc.) sin cambiar el modelo.

Contras:
- Doble coste de tokens por run bilingue (la fase 4.5 procesa el `reviewed.md` completo).
- El operador tiene que importar dos JSON manualmente en lugar de uno (fricción aceptada para evitar la complejidad de la Opcion A).
- El run del pipeline emite ahora un reporte estructurado en lugar de un JSON puro, lo cual rompe la simetria con runs no-orquestados (DRAFT, RESEARCH, etc., que siguen emitiendo JSON).

Elegida.

## Decisión

Adoptar la Opcion C con las decisiones operativas concretas listadas abajo. Implementacion en una sola fase (4C.1) acotada a backend prompt builder + documentacion de skills, sin tocar el endpoint admin ni el frontend.

1. **Nueva fase 4.5 `cms-translate-en`** insertada entre la fase 4 (`cms-brand-legal-review`) y la fase 5 (`cms-json-builder`).
2. **Inputs de la fase 4.5**: `04_review/reviewed.md` (ES revisado y aprobado), `04_review/review_notes.md` (contexto interno, no se traduce), `00_input/brief.md` (contexto del tema).
3. **Outputs de la fase 4.5**: `04_review/reviewed_en.md` con el articulo traducido y, al final del fichero, un bloque de metadatos con `SUGGESTED_SLUG_EN`, `SUGGESTED_SEO_TITLE_EN`, `SUGGESTED_META_DESC_EN`.
4. **Fase 5 (`cms-json-builder`) emite dos ficheros**: `final_es.json` (raiz, `parent_slug=null`) y `final_en.json` (`parent_slug = suggested_slug` del ES, leido literalmente del bloque metadata del `reviewed_en.md`). Si la fase 4.5 no se ejecuto, emite solo `final_es.json`.
5. **Comportamiento por defecto**: la fase 4.5 se ejecuta automaticamente. **Opt-out**: si el operador incluye la cadena "skip translate-en" en su mensaje al lanzar el pipeline, la 4.5 se salta y la 5 emite solo el JSON ES.
6. **Output del run del pipeline orquestado**: deja de ser JSON puro; pasa a ser un **reporte estructurado en texto plano** que la skill `cms-orchestrator` (Cowork) emite resumiendo: title, slug ES, slug EN (si aplica), ficheros generados, self_check_passed de cada JSON, validaciones clave y proximos pasos para el operador.
7. **Importacion al CMS**: sigue siendo manual y monolingue, **uno cada vez**, con el flujo de admin existente. El operador abre `final_es.json`, lo pega y guarda. Luego abre `final_en.json`, lo pega y guarda. Sin cambios en `ContentAdminController` ni en el frontend admin.
8. **Orquestacion de las fases**: encapsulada en la skill personal `cms-orchestrator` de Claude Cowork (creada por el operador). El backend (`ContentPromptBuilder`) **solo genera el prompt** y delega la ejecucion en cadena a Cowork.

## Justificación

La pregunta central es por que Opcion C frente a A y B:

- **Frente a Opcion A**: A traslada la complejidad de coherencia (parent_slug, sources_used, article_outline coincidentes entre ES y EN) al backend Java, donde duplica logica que ya tiene la skill `cms-json-builder` en Cowork. Ademas obliga a cambiar el frontend admin para subir dos JSON. El coste es desproporcionado al valor: el editor pega dos JSON en lugar de uno, mismo dia, misma sesion; la fricción real es minima.
- **Frente a Opcion B**: B introduce divergencia editorial inevitable al ejecutar dos pipelines independientes. Aunque el editor sea cuidadoso, el modelo de lenguaje generara `sources_used` ligeramente distintos en cada run (mismos temas, distinta seleccion). Esto rompe la garantia de paridad de hechos entre versiones que ADR-022 pide explicitamente.

Sobre las decisiones internas de Opcion C:

- **Fase 4.5 entre 4 y 5, no entre 3 y 4**: la traduccion debe partir del `reviewed.md` (post-revision brand/legal/DSA/GDPR), no del `polished.md` (pre-revision). Si la fase 4 detectara claims problematicos y los corrigiera, la traduccion debe reflejar esa correccion; traducir antes de la 4 obligaria a re-traducir si la revision modifica el texto.
- **Slugs distintos por locale, no traduccion literal**: respeta la decision de [ADR-022](./adr-022-blog-cms-multilingual-es-en.md) D2. La skill 4.5 piensa el slug EN para SEO anglosajon, no traduce el slug ES palabra a palabra.
- **`SUGGESTED_*_EN` como bloque de metadata al final de `reviewed_en.md`**, no en un fichero JSON aparte: minimiza artefactos y mantiene el `cms-json-builder` con una sola fuente de truth para construir cada JSON (lee `reviewed.md` para el ES y `reviewed_en.md` (cuerpo + bloque metadata final) para el EN).
- **Output del run pasa de JSON a reporte estructurado**: con dos JSON en disco, el output ya no puede ser "el contenido literal de un JSON". El reporte es lo que el operador necesita para decidir si hace falta intervencion humana antes de importar.
- **"skip translate-en" como opt-out, no como opt-in**: el caso por defecto sera bilingue (mercado PRO ES + EN). El monolingue queda como excepcion explicita.
- **Orquestacion delegada a `cms-orchestrator` skill en Cowork**: el backend Java no debe orquestar timing de skills (no las ejecuta directamente; copia-pega manual). Es Cowork quien encadena fases. El backend solo declara que orden esperar.

## Impacto

### Arquitectura

- Cero cambios en BD, en endpoints del CMS publico (`/api/public/content/**`), en `ContentAdminController`, en repositorios o en DTOs.
- Cero migraciones SQL.
- Cero dependencias nuevas (Maven o npm).

### Codigo backend

- **`src/main/java/com/sharemechat/content/service/ContentPromptBuilder.java`**: 6 referencias literales a `final.json` (singular) y dos bloques (`<skills_pipeline>` y `<output_rules>`) reescritos para reflejar el pipeline bilingue. Comentario superior del metodo `appendFullArticleOrchestratedPipeline` actualizado para citar ADR-023.

### Documentacion (stubs de skill personal)

- **`docs/cms/skills/cms-translate-en.md`**: nuevo stub que describe la skill personal de Cowork. Aporta sincronia documental con la skill real del editor.
- **`docs/cms/skills/cms-json-builder.md`**: seccion "OUTPUT QUE ESCRIBES" actualizada para output dual; nueva seccion "Cambios introducidos por ADR-023" con reglas 14 y 15 que el operador ya inyecto en la skill real (Cowork).
- **`docs/cms/skills/README.md`**: tabla canonica con fila 4.5 + nota sobre "skip translate-en".

### Operaciones

- El operador empaqueta JAR localmente y despliega a TEST (responsabilidad del operador, fuera de alcance 4C.1).
- Tras deploy, el siguiente run del CMS generara un prompt con el bloque `<skills_pipeline>` ampliado. La skill `cms-orchestrator` en Cowork (ya creada) detectara el cambio y ejecutara las 6 fases en cadena.

### Riesgos asumidos

- **Reportes de error de Cowork son ahora texto libre, no JSON**: si la skill `cms-orchestrator` falla en una fase, el operador debe leer un reporte humano en lugar de tener un JSON estructurado de fallos. Aceptable porque el reporte es responsabilidad de Cowork y el operador puede iterar sobre la skill.
- **Coste de tokens crece 30-50% por run bilingue** (la fase 4.5 procesa el reviewed.md completo + emite el reviewed_en.md). Aceptado: cubrir mercado EN justifica el coste.
- **El operador olvida ejecutar uno de los dos imports**: si tras un run bilingue solo pega `final_es.json` y olvida `final_en.json`, queda un articulo solo ES con `parent_article_id` huerfano. Mitigado por el reporte estructurado del paso 6 que enumera explicitamente "proximos pasos para el operador".

## Consecuencias

### Positivas

- **Una sola pasada del pipeline produce ambas versiones**, garantizando coherencia editorial entre ES y EN (mismo research, mismo outline, mismas keywords compartidas).
- **Cero cambios en el endpoint admin**: el flujo de import sigue siendo familiar para el operador. La friccion de "pegar dos veces" es pequeña frente al beneficio de coherencia.
- **Patron extensible**: añadir un cuarto locale (fr/de/it) en el futuro requiere una skill 4.6/4.7 mas y una linea adicional en `output_rules`. Cero cambios estructurales.
- **Reversibilidad por flag de texto**: "skip translate-en" devuelve al pipeline monolingue para contenido especifico de mercado hispano (ej. "anuncio operativo regional"). Sin necesidad de runs ad hoc.
- **Documentacion sincrona con codigo**: los stubs de skill actualizados sirven de auditoria entre lo que el editor ejecuta en Cowork y lo que el repositorio dice que se ejecuta.

### Negativas / aceptadas

- **Doble coste de tokens por run bilingue** (~+30-50%). Aceptado.
- **El operador importa dos JSON en lugar de uno** por articulo bilingue. Friccion minima (mismo flujo de admin).
- **El output del run del pipeline orquestado deja de ser JSON puro**: pasa a ser un reporte estructurado de texto. Asimetria con otros run_type del CMS (DRAFT, RESEARCH, etc.). Aceptada porque el pipeline orquestado es operativamente distinto (produce ficheros, no un objeto).
- **Mantenimiento de paridad ES↔EN al editar**: si el operador edita la version ES tras publicarla, la EN no se sincroniza automaticamente. Deuda heredada de [ADR-022](./adr-022-blog-cms-multilingual-es-en.md), no resuelta aqui.

### Trade-offs

- Una sola pasada coherente con dos JSON manuales (Opcion C) frente a una sola operacion de import (Opcion A): se renuncia a la atomicidad del import a cambio de no modificar el endpoint admin. El balance favorece C mientras el volumen sea bajo (operador unico, articulos esporadicos).
- Traduccion derivada de revisado (Opcion C) frente a redaccion EN independiente: se renuncia a una version EN potencialmente mejor calibrada al mercado anglosajon a cambio de coherencia editorial garantizada. Si la calidad EN se vuelve un problema, se reabre la conversacion (deuda registrada en [ADR-022](./adr-022-blog-cms-multilingual-es-en.md)).

## Notas

### Notas operativas

- **Activacion**: tras deploy, los siguientes runs del CMS generan el prompt nuevo automaticamente. La skill `cms-orchestrator` (Cowork) ya esta preparada para reconocer el bloque ampliado.
- **Sintaxis del opt-out**: el operador incluye la cadena literal `"skip translate-en"` en su mensaje a Cowork al pegar el prompt. La skill `cms-orchestrator` reconoce esa marca y omite la fase 4.5.
- **Verificacion del prompt generado**: tras deploy, el operador puede inspeccionar el prompt antes de pegarlo a Cowork; debe contener la fila `4.5. cms-translate-en` en el bloque `<skills_pipeline>` y la mencion a `final_es.json`/`final_en.json` en `<output_rules>`.
- **Reporte del run**: la skill `cms-orchestrator` emite un reporte estructurado al final del run con `title`, `slug ES`, `slug EN`, ficheros generados (rutas absolutas dentro del working_dir), `self_check_passed` de cada JSON, validaciones clave y "proximos pasos" (que JSON pegar primero, donde).
- **Auditoria del flujo**: ejecutar `grep -n "translate-en\|final_es\|final_en" src/main/java/com/sharemechat/content/service/ContentPromptBuilder.java` debe devolver multiples matches; si devuelve cero, el deploy no aplico los cambios.

### Alternativas futuras consideradas

- **Generacion EN desde el research (no derivada del ES revisado)**: rechazada en [ADR-022](./adr-022-blog-cms-multilingual-es-en.md). Si la calidad de traduccion IA se vuelve un problema sistemático, reconsiderar.
- **Import atomico de los dos JSON (Opcion A)**: rechazada por complejidad desproporcionada. Reconsiderar cuando el volumen de articulos bilingues justifique la inversion en backend/frontend.
- **Locales adicionales (fr, de, it)**: pospuestos a traccion real. El modelo elegido en este ADR los soporta sin cambios estructurales; añadirlos es operativo (nueva skill 4.6/4.7 y entradas en `<skills_pipeline>` / `<output_rules>`).
- **Sincronizacion automatica ES->EN al editar**: deuda heredada de [ADR-022](./adr-022-blog-cms-multilingual-es-en.md). Sub-pasada futura.

### Deuda registrada

- **Politica de sincronizacion ES->EN cuando se edita la version ES**: sin resolver. Opciones futuras: re-run del pipeline solo para la fase 4.5 (re-traducir), marca "outdated" automatica en EN, sincronizacion manual bajo demanda.
- **Validacion cruzada en el endpoint admin**: hoy el backend valida cada JSON individualmente. No comprueba que `parent_slug` de un EN apunte realmente a un slug ES PUBLISHED existente. Riesgo de huerfano si el operador importa el EN antes que el ES. Mitigable con check en import (sub-pasada futura).
- **Output del pipeline en formato no-JSON**: rompe simetria con otros runs. Si el frontend admin evolucionara a parsear el output, habria que estandarizar el formato del reporte.
- **El stub `cms-orchestrator` no esta en `docs/cms/skills/`**: la skill vive solo en Cowork (Claude.ai) sin contraparte versionada en el repo. Es la skill que orquesta todas las demas; convendria stub para auditoria. Sub-pasada futura.

## Referencias

- [ADR-014](./adr-014-full-article-orchestrated-pipeline.md) — Pipeline editorial orquestado monolingue. ADR-023 lo extiende sin reemplazarlo.
- [ADR-022](./adr-022-blog-cms-multilingual-es-en.md) — Blog y CMS multilingue ES+EN. ADR-023 cierra la pieza editorial de su plan.
- [ADR-020](./adr-020-blog-spa-seo.md) — SEO industrial en SPA del blog. Contexto adyacente (hreflang, alternates).
- [ADR-013](./adr-013-full-article-run-phase3b.md) — Version monolitica inicial del pipeline (superseded por ADR-014, contexto historico).
- [ADR-016](./adr-016-content-workflow-simplification-and-retraction.md) — Workflow editorial (DRAFT->IN_REVIEW->PUBLISHED->RETRACTED). El workflow se aplica por locale: cada version transiciona independientemente.
- [ADR-017](./adr-017-state-snapshots-and-docs-coexistence.md) — Coexistencia de snapshots y documentacion narrativa. Patron aplicado al documentar 4C.1.
- `src/main/java/com/sharemechat/content/service/ContentPromptBuilder.java` — Generador del prompt orquestador. Metodo `appendFullArticleOrchestratedPipeline` modificado por este ADR.
- `docs/cms/skills/cms-translate-en.md` — Stub de la nueva skill personal (creado por este ADR).
- `docs/cms/skills/cms-json-builder.md` — Stub de la skill empaquetadora (actualizado por este ADR).
- `docs/cms/skills/README.md` — Tabla canonica de skills del pipeline (actualizada con fila 4.5).
- Skill `cms-orchestrator` en Claude Cowork (Claude.ai): orquesta la ejecucion de fases. Sin contraparte versionada en el repo (deuda registrada).
