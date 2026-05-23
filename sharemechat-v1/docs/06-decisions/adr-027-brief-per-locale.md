# ADR-027 — Reubicación del campo `brief` de artículo lógico a traducción per-locale

## Estado

Aceptada (2026-05-23).

Aplicabilidad: schema BD del módulo CMS, entidades JPA del backend, DTOs públicos y admin, validador de transición DRAFT→IN_REVIEW, skills del pipeline editorial (`cms-orchestrator`, `cms-json-builder`, `cms-json-validator`, `cms-translate-en`), editor admin del frontend. Refina sin reemplazar a [ADR-022](./adr-022-blog-cms-multilingual-es-en.md), [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md), [ADR-024](./adr-024-bilingual-submit-inside-editor.md), [ADR-025](./adr-025-flyway-introduction-and-cms-v2-schema.md) y [ADR-026](./adr-026-cms-builder-validator-split.md). Cierra un bug detectado en producción de blog público AUDIT durante el paquete 10.A.

## Contexto

### El bug observado

Tras finalizar el frente 10.A (nivelación AUDIT) y completar el pipeline editorial bilingüe sobre un artículo de prueba en AUDIT, el operador inspeccionó la versión EN del blog público y observó que el campo `brief` (texto descriptivo bajo el título del artículo, visible tanto en cards de listado como en la cabecera del detalle) aparecía en español incluso cuando el resto del contenido — `title`, `seo_title`, `meta_description`, body completo — sí estaba correctamente traducido al inglés.

### Causa raíz

La causa no es un bug de pipeline ni de renderizado. Es un **defecto de modelado del schema CMS v2** introducido en [ADR-025](./adr-025-flyway-introduction-and-cms-v2-schema.md):

- `content_articles.brief TEXT` se declaró como **campo compartido del artículo lógico**, en la misma categoría que `category`, `keywords` o `hero_image_url`.
- `content_article_translations` (slug, title, seo_title, meta_description, body_s3_key, target_keywords) contiene el resto de campos lingüísticos per-locale.
- El JSON 2.0 que las skills emiten al backend respeta esa separación: `shared.brief` está en la sección compartida, no en `locales.{es,en}`.
- Resultado: el editor humano fija `brief` al crear el artículo en ES; el pipeline IA traduce title/body/SEO al inglés, pero como `brief` es compartido nunca se traduce. La vista pública EN sirve el brief ES.

El campo `brief` es semánticamente lingüístico (es un párrafo de 1-2 frases en español visible al lector), no un atributo invariante por idioma. Su clasificación inicial como compartido fue un error de catalogación en la ADR-025, no una decisión deliberada con trade-offs analizados.

### Por qué resolverlo ahora

Aunque el blog público en producción todavía no existe (PROD se desplegará el 2026-07-01), AUDIT ya sirve tráfico de validación editorial y SEO. Cada artículo publicado con brief no traducido es un activo SEO degradado en EN. Más importante: las skills (`cms-translate-en`, `cms-json-builder`) ya están en producción y cualquier corrección future-proof exige cambiar el contrato JSON, lo que implica refactorizar skills, backend y frontend en coordinación.

Tres opciones quedaron sobre la mesa durante la sesión de diagnóstico:

- **A.** Aceptar como limitación documentada (brief solo en ES, EN hereda el ES).
- **B.** Traducir `brief` en el adaptador del backend al persistir (mantiene un solo campo compartido, pero el backend asume traducción on-the-fly).
- **C.** Duplicar `brief` en `shared.brief` + `locales.{es,en}.brief` del JSON, exigiendo que ambos coincidan en ES (transición conservadora).
- **D.** Reubicar `brief` al modelo per-locale en toda la pila (decisión final).

La opción D es la única que resuelve el problema en la raíz; el resto son parches que dejan el modelo inconsistente con su semántica.

## Decisión

### D1 — Reubicar `brief` a `content_article_translations`

Añadir columna `brief TEXT NULL` a `content_article_translations` (per-locale). Eliminar columna `brief TEXT NULL` de `content_articles` (artículo lógico).

Migración Flyway `V3__brief_per_locale.sql` en tres pasos transaccionales:

1. `ALTER TABLE content_article_translations ADD COLUMN brief TEXT NULL AFTER meta_description;`
2. `UPDATE content_article_translations t INNER JOIN content_articles a ON a.id = t.article_id SET t.brief = a.brief WHERE t.locale = 'es' AND a.brief IS NOT NULL;` — backfill: las translations ES heredan el brief actual del artículo lógico.
3. `ALTER TABLE content_articles DROP COLUMN brief;`

Las translations EN existentes en BD quedan con `brief = NULL` post-migración. El pipeline editorial debe re-ejecutar la fase de traducción para esos artículos si se quiere brief EN poblado; alternativamente, el operador edita a mano el brief EN desde el admin (10.A.10).

### D2 — `brief` NO snapshotea en las tablas `_versions`

Las tablas snapshot `content_article_versions` y `content_article_translation_versions` mantienen su estructura actual sin añadir `brief`. Razones:

- Las versiones existen para garantizar reproducibilidad del cuerpo publicado (body_s3_key, body_content_hash) y de las decisiones editoriales auditables (state transitions, autoría). `brief` es metadata de presentación, no contenido auditado.
- Añadir columna implicaría una segunda migración + cambio en el código que crea snapshots durante DRAFT→IN_REVIEW. Sin necesidad clara.
- El histórico de cambios del brief queda implícito en `updated_at` de la translation; si en el futuro se necesita reversión, se rehidrata desde el current state.

Decisión consciente: el brief no es "código fuente del artículo", es texto descriptivo editable libremente sin auditoría histórica.

### D3 — Validación de transición DRAFT→IN_REVIEW: exigir brief en locale primario (ES)

El método `ContentArticleService#assertReadyForReview` exigía hasta ahora `article.getBrief()` no vacío como precondición para enviar a revisión. Tras la reubicación, la regla equivalente per-locale es:

- **Brief obligatorio en la translation del locale primario (`es`)** para enviar el artículo a revisión.
- **Brief NO obligatorio en otros locales** (`en` en particular).

Justificación: el locale primario es siempre ES (es el que crea el editor humano y el que dispara el pipeline). Si el ES no tiene brief, el artículo está incompleto editorialmente. El EN puede llegar a IN_REVIEW sin brief porque la cadena `cms-translate-en` quizá no se ha ejecutado todavía o porque el editor decidió publicar EN sin brief (cards EN sin texto descriptivo es admisible; no romper la publicación por ello).

Mensaje de error: `Pendiente para revision: locales.es.brief` (formato consistente con los mensajes de validación de otros campos per-locale).

### D4 — DTOs públicos y admin: brief lee del locale solicitado

- `ArticlePublicDetailDTO.brief` y `ArticlePublicSummaryDTO.brief` siguen existiendo como campos top-level, pero ahora se pueblan desde `translation.brief` del locale solicitado, no desde `article.brief`. El contrato JSON al frontend público no cambia (mismo campo, misma posición); el frontend público no necesita cambios.
- `ArticleDetailDTO` (admin) deja de tener `brief` en la raíz. `TranslationDetailDTO` (subobjeto per-locale dentro de `translations[]`) gana el campo `brief`. El frontend admin debe consumir `translations[i].brief` en lugar de `detail.brief`.
- `ArticleUpdateRequest` (PATCH compartido del artículo lógico) pierde el campo `brief`. `TranslationMetadataUpdateRequest` (PATCH per-locale de translation) gana `brief` con la misma semántica de validación que `title` o `slug`: si llega `null` se ignora, si llega string vacío dispara 400, si llega no vacío se normaliza y persiste.
- `ArticleCreateRequest` mantiene `brief` (parte de los campos lingüísticos del locale primario que se persisten en la primera translation, igual que slug y title); el servicio escribe ese brief en la translation ES recién creada, no en la entidad padre.

### D5 — Pipeline editorial: introducir `brief` per-locale en el JSON 2.0 (cambio ADITIVO)

La inspección de 10.A.9 revela un detalle no anticipado durante el diagnóstico inicial: **el JSON 2.0 actual no contiene brief en absoluto**, ni bajo `shared` ni bajo `locales`. Las skills no lo emiten, el adaptador no lo valida, y `ContentRunService.applyTranslationFromJson` no lo aplica. El brief siempre se ha establecido únicamente al crear el artículo (POST `/api/admin/content/articles`); cualquier run IA posterior es ciego al campo. Esto explica directamente el bug observado: cuando el pipeline crea la translation EN por primera vez via apply-bilingual, lo hace con `brief=NULL` porque nunca lo recibe del JSON.

El cambio en el pipeline es por tanto **aditivo**, no de movimiento. La frase original "se elimina `shared.brief`" en versiones tempranas de esta ADR era una asunción sobre el estado del JSON que el inventario desmiente. La forma final del JSON 2.0 (con brief en `locales.{es,en}`) es la misma; el delta diferente es que partimos de un campo inexistente, no de uno mal ubicado.

Las skills del pipeline editorial se actualizan así:

- **`cms-json-builder`**: añade `brief` a la lista de campos obligatorios per-locale (entre `meta_description` y `draft_markdown`). Regla de obtención: `locales.es.brief` se copia LITERAL del campo `<brief>...</brief>` del `<editorial_input>` del prompt CMS; `locales.en.brief` se lee del bloque metadata final de `04_review/reviewed_en.md` (campo nuevo `SUGGESTED_BRIEF_EN`). El self-check incluye una verificación adicional de brief no vacío y longitud ≤ 8192 por locale.
- **`cms-translate-en`** (fase 4.5): añade brief a la lista de "campos PER-LOCALE que SÍ se traducen al inglés". El bloque metadata final del `reviewed_en.md` crece de 3 a 4 campos con `SUGGESTED_BRIEF_EN`. Reglas editoriales: longitud ≤ 8192, voz EN consistente con `sharemechat-voice` sección EN, adaptación al mercado anglosajón (no traducción literal), comillas dobles curvas obligatorias.
- **`cms-json-validator`** (fase 5.5): única línea cambiada — la lista "CAMPOS DE RIESGO ALTO" para escape de comillas pasa de mencionar `shared.brief (si está presente)` a `locales.{es,en}.brief`. Es un cambio referencial, no estructural: el validator no inspecciona schema, solo sintaxis JSON.
- **`cms-orchestrator`**: el reporte final del pipeline gana dos bullets en la sección "Validaciones clave" sobre brief no vacío en ambos locales.
- **`cms-research-seo`, `cms-draft-writer`, `cms-editorial-polish`, `cms-brand-legal-review`, `sharemechat-voice`**: sin cambios. Estas skills consumen brief como input contextual (`00_input/brief.md`) pero no lo emiten al JSON.

Backend Java:

- **`ManualClipboardClaudeAdapter`**: `brief` se añade a `LOCALE_REQUIRED_FIELDS` (la lista crece de 9 a 10 campos). `validateLocaleEntry` gana una rama de validación con la misma forma que las de `seo_title` y `meta_description`: requerido, no vacío, longitud ≤ 8192. Defensivamente, `validateSharedSection` rechaza con error explícito cualquier JSON que coloque `brief` bajo `shared` (mensaje: "schema obsoleto: brief es per-locale por ADR-027").
- **`ContentRunService.applyTranslationFromJson`**: gana una línea para leer `loc.brief` del JSON y persistirlo via `tr.setBrief(...)`. Sin este cambio el adaptador validaría brief pero el backend lo descartaría al persistir, dejando la translation con `NULL` y haciendo inútil todo el frente. La línea es defensivamente neutra porque el adapter ya valida que brief es no vacío.

Este cambio se materializa en el paquete 10.A.9 (las skills, el adapter y el servicio en el mismo paquete; el operador confirmó que tocar `applyTranslationFromJson` cabe dentro del paquete porque su omisión rompería el frente).

### D5.1 — Comportamiento defensivo durante la transición

Entre el cierre de 10.A.9 (skills + backend refactorizados localmente) y el despliegue en 10.A.11, el repo contiene un backend que exige brief per-locale pero que aún no corre en TEST ni AUDIT. Cualquier run editorial ejecutado durante esa ventana usa skills viejas (sin brief) y backends viejos (sin validar brief); sigue funcionando como antes. El día del despliegue las tres piezas se actualizan juntas. Runs IA antiguos generados con skills pre-10.A.9 que el operador intente reaplicar tras el despliegue serán rechazados por el adapter con error `locales.{es,en}.brief: campo obligatorio ausente`. El operador debe regenerar el JSON con el pipeline nuevo o editar manualmente el brief desde el editor admin (10.A.10).

### D6 — Frontend admin: editor de translation gana campo brief

`ContentArticleEditor` debe mover el input de `brief` de la sección "Datos compartidos del artículo" a la sección "Traducción por locale", repetido por cada locale presente (igual que title, slug, seo_title, meta_description). El submit del PATCH per-locale debe incluir el `brief` editado.

Este cambio se aborda en el paquete 10.A.10.

### D7 — Despliegue coordinado en ventana de mantenimiento (TEST → AUDIT)

El cambio toca BD + backend + skills + frontend simultáneamente. Para evitar drift entre ellos durante la propagación:

1. **TEST** primero: Flyway V3 + JAR refactorizado + frontend rebuild + skills actualizadas. Validación funcional completa.
2. **AUDIT** después con ventana de mantenimiento (página overlay `MaintenanceProvider` activa, paquete 10.A.3.pre): backup BD, Flyway V3, JAR, frontend, skills actualizadas. Ventana objetivo <2 minutos.

PRO no aplica todavía (no existe a 2026-05-23). Cuando se monte PRO (2026-07-01 objetivo) la migración V3 se aplicará junto con el resto al inicializar desde cero, sin ventana ad-hoc.

Este despliegue se aborda en el paquete 10.A.11.

## Schema JSON 2.0: brief per-locale (diff explícito tras 10.A.9)

Esta sección documenta el contrato JSON que el pipeline editorial emite y que el adapter `ManualClipboardClaudeAdapter` valida, tras el refactor de 10.A.9. Se incluye aquí, dentro del propio ADR-027, en lugar de crear un ADR separado: el cambio de schema es subordinado a la decisión de fondo (brief per-locale), no una decisión estructural autónoma. Si en un futuro hay otros campos lingüísticos que migrar, cada uno justifica su propio ADR.

### Antes (schema 2.0 hasta 10.A.8)

```json
{
  "schema_version": "2.0",
  "run_type": "FULL_ARTICLE_ORCHESTRATED",
  "shared": {
    "hero_image_url": "...",
    "category": "...",
    "keywords": [...],
    "sources_used": [...],
    "self_check_passed": true,
    "self_check_failures": []
  },
  "locales": {
    "es": {
      "slug": "...", "title": "...",
      "seo_title": "...", "meta_description": "...",
      "draft_markdown": "...",
      ...resto de campos per-locale...
    },
    "en": {
      "slug": "...", "title": "...",
      "seo_title": "...", "meta_description": "...",
      "draft_markdown": "...",
      ...resto de campos per-locale...
    }
  }
}
```

`brief` no aparecía: ni en `shared` ni en `locales`. El campo existía en la BD (`content_articles.brief` hasta 10.A.8) pero el pipeline IA era ciego a él.

### Después (schema 2.0 tras 10.A.9)

```json
{
  "schema_version": "2.0",
  "run_type": "FULL_ARTICLE_ORCHESTRATED",
  "shared": {
    "hero_image_url": "...",
    "category": "...",
    "keywords": [...],
    "sources_used": [...],
    "self_check_passed": true,
    "self_check_failures": []
  },
  "locales": {
    "es": {
      "slug": "...", "title": "...",
      "seo_title": "...", "meta_description": "...",
      "brief": "...",
      "draft_markdown": "...",
      ...resto de campos per-locale...
    },
    "en": {
      "slug": "...", "title": "...",
      "seo_title": "...", "meta_description": "...",
      "brief": "...",
      "draft_markdown": "...",
      ...resto de campos per-locale...
    }
  }
}
```

`brief` se introduce per-locale con la misma semántica que `seo_title` y `meta_description`: requerido, no vacío, longitud ≤ 8192. El número de versión del schema **no se incrementa** (sigue siendo `2.0`): el cambio es backward-incompatible solo en una dirección (el backend nuevo rechaza JSON viejo sin brief; pero el JSON nuevo con brief no se entrega al backend viejo porque skills, adapter y servicio se despliegan juntos en 10.A.11). La bump a `2.1` o `3.0` se reserva para un cambio de contrato más amplio si surge en el futuro.

### Skills tocadas (en una pasada)

- `cms-json-builder.md` — schema, self-check y resumen final.
- `cms-translate-en.md` — campos a traducir, regla del bloque metadata (`SUGGESTED_BRIEF_EN`) y reglas tipográficas del brief EN.
- `cms-json-validator.md` — lista CAMPOS DE RIESGO ALTO (cambio referencial).
- `cms-orchestrator.md` — validaciones del reporte final del pipeline.

Skills NO tocadas: `cms-research-seo`, `cms-draft-writer`, `cms-editorial-polish`, `cms-brand-legal-review`, `sharemechat-voice`. Todas consumen brief como contexto de input pero no lo emiten al JSON.

### Impacto en runs IA anteriores

Cualquier `final.json` generado con skills pre-10.A.9 (sin brief en `locales`) y reaplicado contra un backend post-10.A.11 será rechazado por el adapter con `locales.{es,en}.brief: campo obligatorio ausente`. El operador tiene dos salidas: (a) regenerar el JSON con el pipeline nuevo (recomendado, garantiza calidad editorial del brief en ambos locales) o (b) usar el editor admin de translation per-locale (10.A.10) para introducir manualmente los briefs ES y EN antes de aplicar el run.

A 2026-05-23 hay un único artículo afectado (test editorial sobre AUDIT). Coste de re-procesado despreciable.

## Consecuencias

### Positivas

- Modelo coherente con la semántica: campos lingüísticos viven en `content_article_translations`, no mezclados con campos compartidos.
- El blog público EN sirve un brief correcto en inglés tras re-ejecutar el pipeline (o tras edición manual del editor en el admin).
- El validador `assertReadyForReview` da feedback localizado por locale (`locales.es.brief` vs el genérico `brief` actual), consistente con el resto de validaciones per-locale.
- Schema preparado para nuevos locales futuros sin re-tocar el catalogación de campos.

### Negativas

- Cuatro paquetes secuenciales (10.A.8 backend, 10.A.9 skills, 10.A.10 frontend, 10.A.11 deploy) para un cambio que aparenta cosmético desde fuera.
- Las translations EN existentes pre-migración quedan con `brief = NULL`. Requiere re-ejecutar `cms-translate-en` o edición manual por cada artículo ya publicado con EN. A 2026-05-23 hay un único artículo en este estado (test editorial sobre AUDIT), coste de re-traducción despreciable.
- El JSON 2.0 gana un campo per-locale obligatorio (`brief`) sin bumpear su versión. Si en algún momento se ejecuta un run editorial con la versión vieja de las skills contra el backend nuevo, el adaptador rechaza el JSON con `locales.{es,en}.brief: campo obligatorio ausente`. La elección por rechazo estricto (en lugar de tolerancia al campo ausente con brief en blanco) se justifica porque el bug que motivó el frente es precisamente translations con brief NULL llegando a producción; permitir el agujero por compatibilidad lo perpetúa.

### Neutras

- El contrato del blog público (`ArticlePublicSummaryDTO`, `ArticlePublicDetailDTO`) no cambia en su forma externa; el frontend público no requiere ningún cambio.
- El histórico en `content_article_versions` queda sin información de brief. Aceptado en D2.

## Referencias

- [ADR-022 — Blog CMS multilingüe ES+EN](./adr-022-blog-cms-multilingual-es-en.md)
- [ADR-023 — Pipeline editorial bilingüe](./adr-023-bilingual-editorial-pipeline-es-en.md)
- [ADR-024 — Apply-bilingual atómico dentro del editor](./adr-024-bilingual-submit-inside-editor.md)
- [ADR-025 — Introducción de Flyway y schema CMS v2](./adr-025-flyway-introduction-and-cms-v2-schema.md)
- [ADR-026 — Separación cms-json-builder y cms-json-validator](./adr-026-cms-builder-validator-split.md)
- Migración: `src/main/resources/db/migration/V3__brief_per_locale.sql`
- Paquetes asociados: 10.A.8 (backend), 10.A.9 (skills), 10.A.10 (frontend), 10.A.11 (deploy).
