# Investigación: edición de keywords SEO sobre artículos PUBLISHED

**Fecha**: 2026-07-06
**Autor**: análisis asistido por IA (lectura del fuente + ADR-016)
**Alcance**: solo mapping. Cero cambios de código, cero recomendación explícita.
**Contexto**: 5 artículos PUBLISHED reales en PROD (IDs 1–5). El operador quiere poblar Primary/Secondary keywords SEO per-locale según `plan-editorial-sharemechat-v6.xlsx`. Los artículos actuales tienen `primary_keyword` y `secondary_keywords` `null` en las translations (pre-ADR-045 subpasada 2A). Sin poder editarlas, el gate readonly de ADR-016 bloquea el objetivo.

## 1. Comportamiento actual del gate readonly — evidencia del fuente

### 1.1 Gate central: `assertEditable`

Único guard consolidado, en [`ContentArticleService.java:707-719`](../../src/main/java/com/sharemechat/content/service/ContentArticleService.java:707):

```java
private void assertEditable(ContentArticle article, boolean isAdmin) {
    if (TERMINAL_STATES.contains(article.getState())) {
        throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Articulo en estado terminal " + article.getState()
                        + "; no se admite edicion. Para modificarlo, reabrelo primero.");
    }
    if (isAdmin) return;
    if (!EDITABLE_STATES.contains(article.getState())) {
        throw new ResponseStatusException(HttpStatus.CONFLICT,
                "No se puede editar en estado " + article.getState()
                        + ". Devuelve a borrador antes de modificar.");
    }
}
```

Con:
- `TERMINAL_STATES = { PUBLISHED, RETRACTED }` (línea 119).
- `EDITABLE_STATES = { DRAFT }` (línea 116).

**El chequeo terminal va ANTES del bypass ADMIN** — el gate es absoluto: **ni ADMIN puede editar un PUBLISHED**. Devuelve `HTTP 409 CONFLICT` con mensaje "Articulo en estado terminal PUBLISHED; no se admite edicion. Para modificarlo, reabrelo primero." — pero **la reapertura no está implementada** (§1.3).

### 1.2 Endpoints que invocan `assertEditable`

| # | Endpoint público | Handler service | Línea |
|---|---|---|---|
| 1 | `PATCH /api/admin/content/articles/{id}` (metadata compartida: category, keywords legacy, heroImageUrl, responsibleEditorUserId) | `updateSharedMetadata` | 248 |
| 2 | `PUT /api/admin/content/articles/{id}/translations/{locale}/body` (body markdown) | `updateTranslationBody` | 305 |
| 3 | `POST /api/admin/content/articles/{id}/translations` (bootstrap translation nueva — ADR-045 2C.0) | `createTranslation` | 378 |
| 4 | `PATCH /api/admin/content/articles/{id}/translations/{locale}` (title, slug, seoTitle, metaDescription, brief, **primaryKeyword, secondaryKeywords**) | `updateTranslationMetadata` | 503 |
| 5 | Helper genérico | `requireEditable` | 703 |

**Todos** aplican el mismo `assertEditable(article, isAdmin)`. **Cero excepciones** en el fuente actual. **Cero campos "siempre editables"**: el gate es a nivel del artículo entero, no por campo.

### 1.3 Estado del workflow y la reapertura

`ALLOWED_TRANSITIONS` en [`ContentArticleService.java:129-135`](../../src/main/java/com/sharemechat/content/service/ContentArticleService.java:129):

```java
DRAFT      → { IN_REVIEW }
IN_REVIEW  → { DRAFT, PUBLISHED }
PUBLISHED  → { RETRACTED }
RETRACTED  → { }        (implícito — no tiene entrada en el map)
```

Desde PUBLISHED **solo cabe RETRACTED**. Desde RETRACTED **no hay transición ninguna**. ADR-016 §D3 lo declara explícitamente: *"no se expone transición `RETRACTED → DRAFT` en este frente"*. Es decir, **una vez publicado, el artículo entra en un cul-de-sac editorial**.

### 1.4 Frontend admin — cómo se refleja

[`ContentArticleEditor.jsx:85-86`](../../frontend/src/pages/admin/content/ContentArticleEditor.jsx:85):

```jsx
// ADR-016: terminales bloquean edicion incluso para ADMIN.
const TERMINAL_STATES = new Set(['PUBLISHED', 'RETRACTED']);
```

Y línea 250 (comment): *"terminales: bloquean siempre (ADMIN no bypassa)"*.

Comportamiento visible del editor:

- Todos los inputs de campo tienen `disabled={fieldsLocked}` (inputs, textareas, botones "Guardar campos SEO", "Guardar cuerpo", etc.).
- `fieldsLocked = !!currentId && (stateIsTerminal || (state && state !== 'DRAFT' && !isAdmin))`.
- Se renderiza un `<ReadOnlyNotice>` con texto: *"Edición bloqueada en estado PUBLISHED. Para modificar metadata o cuerpo, primero reabre como borrador."*
- El **botón "Retractar"** sí es funcional (`PUBLISHED → RETRACTED`); mueve al artículo al cul-de-sac.
- Ningún botón "Reabrir como borrador" está implementado. El texto del `<ReadOnlyNotice>` promete algo que no existe.

### 1.5 Historial de commits

`git log --grep='published.*edit\|SEO.*hotfix'` → 0 matches semánticos. **Nunca se ha discutido explícitamente en el repo cómo permitir edición de campos SEO sobre PUBLISHED**. El paquete 6.5 (commit `3b3c849`) introdujo el endpoint PATCH metadata per-locale pero mantiene el gate terminal intacto.

### 1.6 Consecuencia práctica sobre los IDs 1–5 en PROD

- `primary_keyword` y `secondary_keywords` per-locale = `null` en las 5 filas de translation ES + 5 de translation EN (ambas locales — verificado en el smoke PROD, `GET /articles/{id}` no muestra estos campos poblados en el JSON de detalle porque el pipeline pre-ADR-045 no los emitía).
- Cualquier intento de `PATCH /translations/es` con `primaryKeyword` → **HTTP 409** por `assertEditable`.
- El plan editorial v6 no aterriza sin una vía nueva.

## 2. Opciones para permitir edición de keywords SEO sobre PUBLISHED

Sin recomendar todavía. Cada opción analizada por complejidad, impacto conceptual sobre ADR-016, auditoría y reversibilidad.

### Opción A — Excepción específica al gate para keywords SEO

**Idea**: en `assertEditable` (o antes de invocarlo en `updateTranslationMetadata`), permitir el paso si el payload solo contiene los campos `primaryKeyword` y/o `secondaryKeywords`, incluso con `article.state == PUBLISHED`.

**Superficie técnica**:
- 1 fichero (`ContentArticleService.updateTranslationMetadata`), ~10 líneas: comprobar antes del `assertEditable` si `req` toca **solo** primary/secondary y saltar el gate en ese caso.
- Sin cambio de schema BD, sin migración Flyway, sin nuevo endpoint.
- Sin cambio necesario en frontend si se activa selectivamente `disabled` en los inputs de keywords cuando el resto sigue readonly (~30 líneas en `BodyLocaleSections.jsx`).
- Sin nuevo evento — reutiliza `EVENT_EDIT_APPLIED` que el `emitEvent` del propio `updateTranslationMetadata` ya emite con `payload.target='translation_metadata'` y `payload.fields=[...]`. Auditoría inmediata sin código nuevo.

**Impacto conceptual sobre ADR-016**:
- ADR-016 §D1 declara PUBLISHED como "estado terminal salvo retracción". Una excepción para dos campos SEO **rompe la letra estricta** de ADR-016.
- Sin embargo, ADR-016 no aborda explícitamente el caso de "hotfix textual sobre metadata SEO que no genera nueva versión del contenido publicado". Es una **omisión, no una prohibición razonada**.
- Requiere anexo/nota en ADR-016 aclarando la excepción, o mini-ADR-016.1.

**Auditoría**:
- ✓ `content_review_events` sigue registrando el cambio como `EDIT_APPLIED` con `actor_user_id`, timestamp, `fields=['primaryKeyword']` o similar.
- ✓ No genera nueva versión (`content_article_versions`) — el `applyBilingual` es el único que crea versiones. Esto es coherente: no es una edición de contenido publicado, es un hotfix de metadata SEO.

**Reversibilidad**:
- ✓ El campo previo puede leerse del último `EDIT_APPLIED` con `payload.fields`, aunque no se persiste el valor previo. Reversible manualmente por el operador si tiene el valor anterior.
- ✗ Ningún UNDO automático.

### Opción B — Endpoint dedicado "hotfix SEO"

**Idea**: nuevo endpoint `PATCH /api/admin/content/articles/{id}/translations/{locale}/seo-keywords` que **no invoca `assertEditable`**. Body limitado a `{primaryKeyword?, secondaryKeywords?}`. Emite evento nuevo `EDIT_APPLIED` con `payload.target='seo_keywords_hotfix'` para distinguir del edit normal.

**Superficie técnica**:
- 1 fichero backend: nuevo método en `ContentArticleService` (~40 líneas). Nuevo endpoint en `ContentAdminController` (~20 líneas). Nuevo DTO `SeoKeywordsHotfixRequest` (~30 líneas).
- Nuevo permiso opcional `CONTENT.SEO_HOTFIX` en `Constants.BackofficePermissions` + backfill en fila de user en BD (o reutilizar `CONTENT.EDIT` — decisión abierta).
- Frontend: nuevo botón "Editar keywords SEO (hotfix)" visible cuando `state=PUBLISHED`, condicionado al nuevo permiso; llama al endpoint nuevo (~50 líneas).
- Sin migración Flyway si se reutiliza `CONTENT.EDIT`.

**Impacto conceptual sobre ADR-016**:
- Igual que A: rompe la letra estricta. Explícito en el nombre del endpoint ("hotfix"), lo que hace la excepción más visible y auditable.
- Requiere anexo en ADR-016 con la política del hotfix (qué campos, quién, cuándo).

**Auditoría**:
- ✓ Traza separada del edit normal (`payload.target='seo_keywords_hotfix'`) — filtrable en query.
- ✓ Permiso granular opcional permite exigir un rol específico para el hotfix (limitar a ADMIN, o crear ROLE_EDITOR_SENIOR).

**Reversibilidad**:
- Igual que A. Sin UNDO automático.

### Opción C — Estado intermedio `PUBLISHED_EDITABLE`

**Idea**: nuevo estado `PUBLISHED_EDITABLE` intercalado. Transición `PUBLISHED → PUBLISHED_EDITABLE` (nueva) permite edición del artículo. Al guardar cambios, transición automática de vuelta a `PUBLISHED`. El artículo público sigue sirviéndose durante el modo `PUBLISHED_EDITABLE` (no se marca 410, no se retira del sitemap).

**Superficie técnica**:
- Migración Flyway V15: añadir `PUBLISHED_EDITABLE` al `CHECK (state IN ...)` de `content_articles`.
- Backend: modificar `ALLOWED_TRANSITIONS`, añadir el estado a `EDITABLE_STATES`, distinguir `PUBLISHED_EDITABLE` de `DRAFT` en varias comprobaciones (visibilidad pública, sitemap, cache pre-render).
- Frontend: nueva UI del editor con banner "Editando publicado — cambios se aplican al vivo". Botón "Entrar en modo edición" en PUBLISHED. Botón "Salir del modo edición" desde `PUBLISHED_EDITABLE`.
- Sitemap y `BlogArticleView` públicos: verificar que `PUBLISHED_EDITABLE` se comporta como `PUBLISHED` a efectos de servir contenido.
- Al menos 4 ficheros backend y 3 frontend. ~200 líneas.

**Impacto conceptual sobre ADR-016**:
- **Rompe D1** (workflow simplificado a 4 estados). Añadir un estado nuevo es exactamente lo que ADR-016 quería evitar.
- Requiere ADR nuevo que supersede parcialmente ADR-016 §D1.

**Auditoría**:
- ✓ Trazable en `content_review_events` via transiciones `STATE_TRANSITION_APPLIED`.
- ✓ Diferencia clara entre "modo edit sobre publicado" y "edit sobre draft".

**Reversibilidad**:
- Similar a A y B. Sin UNDO automático.

### Opción D — Fork temporal `PUBLISHED_DRAFT`

**Idea**: al pulsar "editar SEO", se crea un artículo fork oculto con estado `DRAFT` que apunta al PUBLISHED original vía nueva FK `forked_from_article_id`. El operador edita el fork como si fuera un draft normal. Al "aplicar", se copian los campos editables al artículo original PUBLISHED con lock optimistic + evento en el fork como `MERGED_TO_PARENT`; el fork se marca `state=MERGED` y no vuelve a aparecer en el listado.

**Superficie técnica**:
- Migración Flyway V15: añadir `forked_from_article_id BIGINT NULL FK` a `content_articles`, añadir estado `MERGED` al CHECK.
- Backend: `createFork()`, `applyFork()`, listado admin oculta forks, política de qué campos se propagan al padre.
- Frontend: UI de "Editar sobre publicado" con banner "Modo edit fork".
- Riesgo: divergencia entre fork y padre si el padre se retracta durante la edición del fork.
- ≥8 ficheros backend + 5 frontend. ≥500 líneas.

**Impacto conceptual sobre ADR-016**:
- Rompe D1 (nuevo estado `MERGED`).
- Añade complejidad de modelo satélite adicional (forks).
- Requiere ADR nuevo.

**Auditoría**:
- ✓ Traza completa vía `content_review_events` en fork + padre.
- ✗ El histórico es más difícil de reconstruir (dos entidades).

**Reversibilidad**:
- ✓ El fork sigue existiendo como snapshot pre-merge (en MERGED). Revertir es "aplicar los campos del fork al padre".
- Complejidad no trivial de UNDO.

### Opción E — Retraer, editar, republicar

**Idea**: seguir el flujo actual: `PUBLISHED → RETRACTED` (existe). Después, operación manual sobre BD para pasar `RETRACTED → DRAFT` (no expuesto en la API pero técnicamente posible con un UPDATE). Editar en DRAFT. Volver a `IN_REVIEW → PUBLISHED`.

**Superficie técnica**:
- Cero código nuevo.
- Requiere túnel SSH + mysqlsh contra RDS PROD (ver [`docs/04-operations/access-and-tooling.md`](../04-operations/access-and-tooling.md) §"Túnel a RDS") para hacer `UPDATE content_articles SET state='DRAFT', retracted_at=NULL WHERE id=N`.

**Impacto conceptual sobre ADR-016**:
- Formalmente respeta el workflow (D3 admite "reactivación vía operación manual sobre BD, no se expone transición `RETRACTED → DRAFT`").
- Sin embargo, el artículo público **desaparece** durante la ventana: `GET /public/content/articles/{slug}` devolvería 410 Gone (ADR-016 §D3), sitemap lo excluye, Google puede desindexar. Impacto SEO real.

**Auditoría**:
- ✓ `EVENT.RETRACTED` + eventos de re-edición + `EVENT.PUBLISHED` quedan en `content_review_events`.
- ✗ El `UPDATE` manual no queda en `content_review_events` (bypass total del `emitEvent`).
- ✗ Se pierde `retracted_at` original si se hace `NULL`.

**Reversibilidad**:
- ✓ Se puede volver a retractar.
- ✗ La ventana de indisponibilidad pública ya ocurrió; no se puede deshacer el impacto SEO.

### Opción F — Cambiar la política de ADR-016

**Idea**: escribir ADR-016.1 o ADR-046 que redefina PUBLISHED como "editable con auditoría fuerte". El gate `assertEditable` desaparece o se relaja completamente.

**Superficie técnica**:
- Backend: retirar la comprobación de `TERMINAL_STATES` en `assertEditable`. ~5 líneas.
- Frontend: retirar `TERMINAL_STATES` de `fieldsLocked` y `<ReadOnlyNotice>`. ~30 líneas.
- El resto del código sigue funcionando: cualquier PATCH sobre PUBLISHED emite `EDIT_APPLIED` automáticamente.
- Redacción del ADR: 2-3 horas.

**Impacto conceptual sobre ADR-016**:
- **Supersede parcial explícito**. La invariante del workflow "PUBLISHED es terminal salvo retracción" se retira. El artículo publicado pasa a ser "always editable, always audited".

**Auditoría**:
- ✓ Ya existe `EVENT_EDIT_APPLIED` con `payload.fields`. Cualquier PATCH queda registrado.
- ✗ Sin distinción semántica entre "hotfix menor" y "reescritura mayor". Un operador con permisos podría reescribir el body markdown de un publicado sin traza específica.

**Reversibilidad**:
- Idem A/B. Sin UNDO automático.
- Complica la pregunta editorial: si el body se puede reescribir a placer, ¿qué representa `content_article_versions.v{n}`?

## 3. Tabla comparativa

| Opción | Complejidad técnica | Impacto ADR-016 | Auditoría | Reversibilidad | Frontend visible |
|---|---|---|---|---|---|
| **A** Excepción campos SEO | ~50 LOC (backend + frontend) | Anexo a ADR-016 (excepción menor) | ✓ EDIT_APPLIED reutilizado | Manual con valor previo | Inputs Primary/Secondary editables aunque el resto readonly |
| **B** Endpoint dedicado hotfix | ~120 LOC + posible nuevo permiso | Anexo a ADR-016 (excepción explícita nombrada) | ✓ Evento con target='seo_keywords_hotfix' | Manual | Botón "Editar keywords SEO (hotfix)" separado |
| **C** Estado `PUBLISHED_EDITABLE` | ~200 LOC + Flyway V15 + banner UI | Supersede parcial ADR-016 §D1 (5 estados en vez de 4) | ✓ Transiciones explícitas | Manual | Botones "Entrar modo edit" / "Salir modo edit" |
| **D** Fork `PUBLISHED_DRAFT` + merge | ~500 LOC + Flyway V15 + nuevo estado MERGED + FK forked_from | Supersede fuerte (nuevo modelo satélite) | ✓ Fork retenido como snapshot | Alta (fork inmutable como snapshot pre-merge) | Modo edit fork con banner + botón "Aplicar al publicado" |
| **E** Retraer/editar/republicar | 0 LOC (mysqlsh manual) | Formal-OK (ADR-016 §D3 admite reactivación manual BD) | ✗ UPDATE manual no queda en events | Baja (impacto SEO ya ocurrió) | Sin cambios (flujo actual) |
| **F** Redefinir política ADR-016 | ~35 LOC | Supersede fuerte (invariante workflow retirada) | ✓ EDIT_APPLIED cubre; **sin distinción semántica** entre hotfix y reescritura | Baja | Sin readonly notice, todos los inputs siempre editables |

## 4. Preguntas abiertas para el operador

Ordenadas de más urgente a menos:

1. **¿Cuál es el ámbito real de la excepción?** ¿SOLO `primary_keyword` + `secondary_keywords` per-locale, o también `seoTitle` + `metaDescription` (que también son SEO)? ¿Y el `slug`, que es SEO estructural pero rompe URLs canónicas si cambia post-publicación?
2. **¿Con qué frecuencia se espera este hotfix?** Si es "una vez para poblar el plan-v6.xlsx y luego rara vez" → Opción E (manual BD) es viable como one-shot sin código. Si es "cada semana operativamente" → hace falta código.
3. **¿El artículo público debe seguir vivo durante el hotfix?** Si sí → E queda descartada (ventana de 410 Gone). Si no → E es la más barata.
4. **¿Qué rol debe poder ejecutar el hotfix?** ¿Cualquier ADMIN, o requiere permiso adicional (`CONTENT.SEO_HOTFIX`)? Esto solo aplica a B (endpoint dedicado con permiso propio).
5. **¿Se acepta que el body del artículo se pueda editar en PUBLISHED, aunque no sea el objetivo actual?** Si sí, F es tentadora por simplicidad. Si no (queremos preservar la invariante de contenido inmutable post-publicación), F queda descartada.
6. **¿El cambio de keywords SEO debe generar una nueva versión inmutable en `content_article_versions.v{n}`?** Hoy `applyBilingual` es el único que crea versiones. Si el operador considera que un hotfix SEO justifica una nueva versión → conviene añadirlo en el diseño. Si no (solo evento de auditoría) → basta con `EDIT_APPLIED`.
7. **¿Qué hacer con el `<ReadOnlyNotice>` frontend que promete "reabre como borrador" pero nadie ha implementado?** ¿Se retira el texto, o se implementa reapertura como parte del mismo frente?
8. **¿Existe requisito SEO externo (Google) para que las URLs canonical publicadas jamás cambien?** Si sí → el hotfix nunca debe tocar `slug` ni `canonical`. Solo primary/secondary/seoTitle/metaDescription son seguros.

## 5. Recomendación

**Sin recomendación explícita en este informe** — la Fase 3 del prompt del operador pide análisis comparativo, no elección. La decisión requiere respuesta a las preguntas §4 (especialmente 1, 2 y 3) por parte del operador.

Cuando el operador responda, este informe puede convertirse en un mini-ADR (`ADR-046-edit-seo-on-published.md`) que registre la decisión y su justificación.

---

**ESTADO**: informe cerrado. Cero cambios de código aplicados.
