# ADR-016 — Workflow editorial simplificado y retracción operativa

## Estado

Propuesta (pendiente de aprobación del owner).

Si se aprueba, **supersedes parcialmente ADR-010** en lo relativo al diagrama de estados editorial, y **redefine el alcance del frente conocido como "CMS Fase 4B"** en `docs/07-roadmap/current-phase.md`.

## Contexto

El CMS interno de SharemeChat está operativo en TEST con el pipeline editorial multi-rol definido en ADR-014 (`FULL_ARTICLE_ORCHESTRATED`). El frente SEO mínimo (sitemap dinámico, robots.txt, Open Graph, JSON-LD, canonical) quedó cerrado end-to-end el 2026-05-08 tras la coordinación nginx + CloudFront documentada en `incident-notes.md`.

El siguiente bloque pendiente, conocido informalmente como "Fase 4B", está descrito en una sola frase de `current-phase.md:112` y una lista de limitaciones en `test.md:202-208`. **No existe ADR previo que cierre las decisiones de ese frente.** ADR-010 menciona el workflow editorial pero su cuerpo termina abruptamente en el diagrama de estados sin justificar la cadena de seis estados implementada en Fase 2 (`IDEA → OUTLINE_READY → DRAFT_GENERATED → IN_REVIEW → APPROVED → PUBLISHED`). Las referencias de `ContentConstants.java` a "ADR-010, sec 5/6/7" apuntan a secciones que no existen en el archivo actual.

Tras un análisis exhaustivo del repositorio (skill `cms-research` ejecutada por Claude Code el 2026-05-08), se identifican tres problemas reales que este ADR debe resolver:

1. **Workflow sobredimensionado para operación 1-persona.** La cadena de seis estados se diseñó pensando en un equipo editorial con generador y revisor distintos. Como SharemeChat opera con un único editor (rol ADMIN), la segregación generador↔aprobador requiere bypass permanente, lo cual rompe la lógica de seguridad y genera eventos de auditoría irrelevantes (`OUTLINE_APPROVED` y `REVIEW_APPROVED` sobre uno mismo). De `IDEA` a `PUBLISHED` se requieren 5 transiciones manuales que no aportan valor editorial real.

2. **Estados terminales modelados pero inalcanzables.** `RETRACTED` y `SCHEDULED` están en `ContentConstants.java`, en el `CHECK (state IN ...)` de la tabla `content_articles`, y los campos `retracted_at` y `scheduled_for` existen en la entidad. Sin embargo, ninguna ruta de código permite alcanzar esos estados; `transitionState()` rechaza con 409 cualquier intento. La consecuencia práctica es que **un artículo publicado por error no se puede retirar** sin operación manual sobre BD.

3. **Ambigüedad sobre publicación estática.** El roadmap menciona "publicación estática a S3+CloudFront" como objetivo de Fase 4B sin diseño técnico. Hoy `BlogArticleView.jsx` hace fetch a la API y renderiza con React. Una estatización completa con pre-render server-side o build-time es una re-arquitectura del SPA cuya justificación con un volumen actual de cuatro artículos es nula. El término "Fase 4B" tal como aparece en el roadmap mezcla decisiones operativas urgentes (retracción) con re-arquitectura especulativa (pre-render).

Este ADR cierra las decisiones de los problemas 1 y 2, y declara el problema 3 como **diferido sin fecha** a un futuro ADR-NN cuando exista justificación de volumen.

## Decisión

### D1 — Workflow editorial simplificado a tres estados

El workflow editorial pasa a:

DRAFT → IN_REVIEW → PUBLISHED → RETRACTED

↓

DRAFT  (rechazo)

Estados:

- **`DRAFT`**: estado inicial y editable. Sustituye a `IDEA`, `OUTLINE_READY` y `DRAFT_GENERATED` actuales. El campo libre `brief` y los runs IA del CMS cubren la documentación del progreso que antes hacían los estados intermedios.
- **`IN_REVIEW`**: revisión humana antes de publicar. Crea v{n}.md inmutable en S3. Mantiene la invariante de revisión humana exigida por ADR-014.
- **`PUBLISHED`**: artículo publicado, visible en `/blog/<slug>`. Estado terminal salvo retracción.
- **`RETRACTED`**: artículo retirado. Estado terminal. Ver D3.

`APPROVED` desaparece. `IN_REVIEW → PUBLISHED` cumple el mismo rol con una transición menos.

`SCHEDULED` se mantiene **modelado en BD pero inalcanzable** (igual que hoy). No se elimina del `CHECK` para evitar pérdida de información si en el futuro se decide implementarlo. Ver D5.

### D2 — Eliminación de la segregación generador↔aprobador

Se elimina del código la lógica que distingue entre el usuario que generó el draft y el que lo aprueba. El permiso `CONTENT.REVIEW` deja de exigir que `actor != creador`. La constante `SEGREGATED_TRANSITIONS` (o equivalente en `ContentArticleService`) y su comprobación se borran.

Justificación: SharemeChat opera con un único editor humano. El bypass que hoy aplica ADMIN es la ruta de hecho 100% del tiempo. Mantener la lógica latente añade complejidad sin valor.

Si en el futuro se incorpora un equipo editorial con roles separados, se podrá reintroducir vía nuevo ADR. La estructura de eventos en `content_review_events` mantiene el campo `actor_user_id`, así que la trazabilidad histórica no se pierde.

### D3 — Retracción operativa con `410 Gone` y tombstone

Transición `PUBLISHED → RETRACTED`:

- Permiso requerido: `CONTENT.PUBLISH` (no se crea `CONTENT.RETRACT` granular; quien publica puede retirar).
- Evento emitido: `RETRACTED` (ya permitido por el `CHECK event_type` actual).
- Side-effect en BD: `retracted_at = now()`, `state = 'RETRACTED'`.
- Side-effect en S3: **ningún borrado**. Las versiones v{n}.md inmutables permanecen en su key original. La fila en `content_articles` queda como tombstone.

Comportamiento público:

- `GET /api/public/content/articles/{slug}` con artículo en estado `RETRACTED` devuelve **`410 Gone`** con body JSON mínimo `{"error": "retracted", "slug": "...", "retracted_at": "..."}`.
- `GET /api/public/content/articles` (listado) **excluye** artículos retractados.
- `SitemapController` ya filtra por `state = 'PUBLISHED'`, así que los retractados desaparecen automáticamente del sitemap.
- Frontend `/blog/:slug` maneja la respuesta `410` mostrando un mensaje breve: "Este artículo ya no está disponible." Sin redirect, sin sustituto sugerido (en este frente).

Justificación de `410 Gone`: Google interpreta `410` como señal fuerte de eliminación intencionada y desindexa más rápido que con `404`. El tombstone en BD permite auditoría posterior y, si fuera necesario, reactivación vía operación manual sobre BD (no se expone transición `RETRACTED → DRAFT` en este frente).

### D4 — Migración consolidada

> Nota terminológica (2026-05-16, [ADR-025](./adr-025-flyway-introduction-and-cms-v2-schema.md)): este apartado hablaba originalmente de "migración Flyway". En el momento de su redacción el proyecto no tenía Flyway: la palabra reflejaba la convención visual de naming `V<YYYYMMDD>__...sql` heredada de Flyway, no la herramienta. La aplicación real de esta migración fue manual con `mysql` CLI sobre el bastión RDS. ADR-025 introduce Flyway de verdad; esta migración queda archivada en `docs/_archive/db-manual-pre-flyway/`.

Una única migración `V<YYYYMMDD>__content_workflow_simplification.sql` aplica de forma atómica:

1. **Reescribe el `CHECK (state IN ...)`** en `content_articles`:
    - Eliminados: `IDEA`, `OUTLINE_READY`, `DRAFT_GENERATED`, `APPROVED`.
    - Añadido: `DRAFT`.
    - Mantenidos: `SCHEDULED` (inalcanzable), `PUBLISHED`, `RETRACTED`.

2. **Reescribe el `CHECK (event_type IN ...)`** en `content_review_events`:
    - Eliminados: `OUTLINE_APPROVED`, `REVIEW_APPROVED`, `REVIEW_REJECTED`.
    - Mantenidos: `DRAFT_REQUESTED`, `PUBLISHED`, `RETRACTED`, `SCHEDULED`, `DISCLOSURE_OVERRIDE`.
    - Filas históricas con event_types eliminados **se preservan tal cual** (el `CHECK` aplica solo a INSERT).

3. **DELETE de artículos no publicados** en `content_articles`:
    - Se borran todas las filas con `state IN ('IDEA', 'OUTLINE_READY', 'DRAFT_GENERATED', 'IN_REVIEW', 'APPROVED')`. Decisión del owner (2026-05-08): los artículos no publicados son trabajo en curso descartable; no merece la pena mapearlos a la nueva enum.
    - Borrado en cascada de filas relacionadas: `content_article_versions`, `content_review_events`, runs IA en `content_generation_runs` asociados a esos `article_id` (verificar FKs y orden de borrado en la migración).
    - Borrado de objetos S3 asociados (v{n}.md de los artículos eliminados): **NO se hace en la migración SQL**. Se documenta como tarea operativa manual posterior, ejecutable con AWS CLI sobre el bucket de cada entorno. El coste de almacenamiento es despreciable y bloquear la migración por una operación de S3 es mal diseño.
    - `PUBLISHED`, `RETRACTED`, `SCHEDULED`: sin cambio.

4. **Sin migración de `content_review_events` por event_type**: las filas que sobrevivan al DELETE (las asociadas a artículos `PUBLISHED`) se mantienen tal cual para auditoría.

La migración **no es reversible**. El rollback requiere restore de BD. Antes de aplicar en TEST, hacer dump SQL de las tablas `content_*` por si fuera necesario revertir. (En el momento de redacción el proyecto no tenía tooling de migración: la aplicación era manual y la idempotencia entre re-ejecuciones quedaba al cuidado del operador. [ADR-025](./adr-025-flyway-introduction-and-cms-v2-schema.md) cierra esa deuda.)

### D5 — `SCHEDULED` se difiere sin fecha

Se mantiene en `CHECK (state)` pero queda explícitamente fuera de `ALLOWED_TRANSITIONS`. La columna `scheduled_for` permanece nullable y sin uso. Si en el futuro se implementa publicación programada, se hará en un ADR posterior que cubrirá:

- el job recurrente,
- la casuística de zonas horarias,
- la transición `IN_REVIEW → SCHEDULED → PUBLISHED`,
- la cancelación (`SCHEDULED → DRAFT`).

Sin caso de uso real hoy, implementarlo es ingeniería especulativa.

### D6 — `publish-now` no se implementa

El endpoint compuesto `publish-now` mencionado en el roadmap viejo desaparece como objetivo. Razón: con tres estados, `DRAFT → IN_REVIEW → PUBLISHED` son dos clicks. La composición atómica no añade valor real. Si en el futuro se quiere atajo `DRAFT → PUBLISHED` directo (saltándose review), se valorará entonces.

### D7 — Publicación estática a S3+CloudFront se difiere sin fecha

El frente "publicación estática" tal como aparecía en `current-phase.md` queda **diferido sin fecha** y fuera del alcance de este ADR. Razones:

- Volumen actual: 4 artículos. Sin justificación de coste o latencia.
- Complejidad: re-arquitectura del SPA (pre-render server-side o a build-time).
- ADR-015 ya garantiza que la URL canónica (`/blog/<slug>`) es independiente de si el HTML se sirve dinámicamente o estáticamente; cuando se decida estatizar, no requerirá cambio de URLs públicas ni invalidación de SEO.

Cuando exista justificación de volumen (>50 artículos publicados, o latencia medida problemática), se abrirá un ADR específico.

### D8 — `heroImageUrl` y `og:image` propios se difieren

Sub-frente independiente con upload de imágenes, almacenamiento S3 público, columna nueva, DTO nuevo y UI de admin. Merece su propio ADR. Hasta entonces, las previsualizaciones sociales muestran solo título + descripción derivada del `brief`.

### D9 — Tarea operativa: `HEAD` en endpoints SEO

Aprovechando que este frente toca `SecurityConfig` para ajustar permisos del workflow, se añade `HttpMethod.HEAD` a las reglas de `/sitemap.xml` y `/robots.txt` para cerrar la deuda residual documentada en `incident-notes.md`. No bloqueante (Google y Bing usan GET para indexar sitemaps), pero coste 1 línea.

## Consecuencias

### Positivas

- Workflow editorial coherente con la realidad de operación 1-persona: 2 transiciones manuales en lugar de 5.
- Retracción operativa real: un artículo publicado por error puede retirarse desde la UI sin tocar BD.
- `410 Gone` mejora la velocidad de desindexación SEO frente a `404`.
- Migración consolidada: un único cambio del `CHECK (state)` en lugar de tres encadenados.
- Eventos de auditoría limpios: desaparecen `OUTLINE_APPROVED` y `REVIEW_APPROVED` que no aportan información.
- ADR-016 cierra explícitamente el alcance de "Fase 4B" y diferencia lo urgente (retracción) de lo especulativo (pre-render).

### Negativas

- **Pérdida de flexibilidad para crecer a equipo editorial.** Si se incorpora un revisor distinto del generador, habrá que reintroducir la segregación. Mitigación: el campo `actor_user_id` en `content_review_events` preserva la trazabilidad histórica; reintroducir la lógica es un ADR posterior, no un cambio destructivo.
- **Migración no reversible y destructiva.** Se borran los artículos no publicados (trabajo en curso) y sus versiones, eventos y runs IA asociados. No se puede deshacer sin restore de BD. Mitigación: el inventario actual confirma que solo hay artículos publicados de valor (los 2-4 visibles en sitemap); cualquier borrador en curso se considera descartable por decisión explícita del owner.
- **Eventos históricos con `event_type` obsoletos.** Las filas de `content_review_events` con `OUTLINE_APPROVED`, `REVIEW_APPROVED`, `REVIEW_REJECTED` se preservan pero ya no se generan. Cualquier query analítica futura debe contemplarlo.
- **Versiones v{n}.md de artículos retractados ocupan S3 indefinidamente.** Decisión consciente (tombstone). Si en el futuro se quiere purga automática, será otro ADR.

### Neutras

- `SCHEDULED` queda como deuda latente conocida. No molesta hoy.
- `publish-now` desaparece del roadmap. Si reaparece la necesidad, se valorará entonces.

## Plan de implementación

Una vez aprobado este ADR, el frente se implementa como **Frente 3 — Workflow simplificado y retracción operativa**, con el siguiente alcance:

1. Migración `V<YYYYMMDD>__content_workflow_simplification.sql` (D4). Aplicada manualmente en TEST/AUDIT en su momento; archivada en `docs/_archive/db-manual-pre-flyway/` tras ADR-025.
2. Backend:
    - `ContentConstants.java`: nuevos estados y events.
    - `ContentArticleService.java`: reescritura de `EDITABLE_STATES`, `TERMINAL_STATES`, `PHASE2_REACHABLE_STATES`, `ALLOWED_TRANSITIONS`. Eliminación de `SEGREGATED_TRANSITIONS`.
    - `ContentPublicController`: `410 Gone` para `RETRACTED`.
    - `SecurityConfig`: añadir `HttpMethod.HEAD` para `/sitemap.xml` y `/robots.txt` (D9).
3. Frontend admin:
    - `ContentArticleEditor.jsx`: `TRANSITIONS_BY_STATE` con los nuevos estados, botón "Retractar" en estado `PUBLISHED`.
    - `ContentArticleAIPanel.jsx`: actualizar `TERMINAL_STATES_FOR_APPLY`.
4. Frontend público:
    - `BlogArticleView.jsx`: manejar respuesta `410` con mensaje "este artículo ya no está disponible".
5. Documentación:
    - Actualizar `current-phase.md`, `test.md` (sección CMS), `cms-seo-overview.md`.
    - Marcar ADR-010 como "parcialmente superseded por ADR-016 en lo relativo al workflow editorial".

### Validación al cerrar el frente

- Ciclo `DRAFT → IN_REVIEW → PUBLISHED → RETRACTED` end-to-end en TEST sobre un artículo nuevo.
- Artículo retractado responde `410 Gone` en `/api/public/content/articles/{slug}` y desaparece del listado.
- Sitemap.xml ya no incluye retractados (validación: retractar uno y verificar el XML).
- Los artículos publicados existentes siguen accesibles tras la migración. Los no publicados desaparecen de BD (comportamiento esperado por D4 punto 3).
- Frontend público maneja `410` con el mensaje definido.
- `HEAD /sitemap.xml` devuelve `200` (cierre de deuda residual).
- `mvn -DskipTests compile` pasa.
- Nginx y CloudFront no requieren cambios (routing ya cerrado en Frente 2).

## Decisiones explícitamente fuera de alcance

Este ADR **no decide** sobre:

- Publicación estática a S3+CloudFront (D7).
- `heroImageUrl` y `og:image` propios (D8).
- `SCHEDULED` operativo (D5).
- `publish-now` endpoint compuesto (D6).
- `disclosure_override` (DSA gating). Sin caso de uso urgente.
- `seoTitle` / `metaDescription` como columnas dedicadas (limitación documentada en `cms-seo-overview.md:78-88`).
- Sitemap-index para >50.000 entradas (limitación conocida).

Cada uno de estos frentes, si llega a justificarse, abrirá su propio ADR.

## Referencias

- ADR-010 — Internal Content CMS / AI-Assisted Workflow (parcialmente superseded por este ADR).
- ADR-014 — `FULL_ARTICLE_ORCHESTRATED` (invariante de revisión humana preservada).
- ADR-015 — Canonical Domains per Environment (URL canónica independiente del modo de servicio).
- `docs/07-roadmap/current-phase.md:112` (cita original de "Fase 4B" — queda redefinida por este ADR).
- `docs/03-environments/test.md:202-208` (limitaciones Fase 4A — se cierran las relativas a workflow y retracción).
- `docs/02-architecture/cms-seo-overview.md` (limitaciones SEO mínimo — se mantienen las no cubiertas aquí).
- `docs/04-operations/incident-notes.md` (deuda residual `HEAD 401` cerrada por D9).
- Análisis de Fase 4B (Claude Code, 2026-05-08): informe interno del owner.