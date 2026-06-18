# ADR-039 — Pipeline social: modo `thread_comment` para warmup activo en subs externos

## Estado

Aceptada — 2026-06-18.

## Contexto

El pipeline social-ops definido en [ADR-034](adr-034-social-ops-methodology.md) cubre el caso "post propio" (X o Reddit) con 4 campos de contrato y 6 skills encadenadas por `social-orchestrator`. Funciona y se ha validado en 2 ciclos reales (commits del 2026-06-12 y 2026-06-16, ambos posts en X).

Sin embargo, el warmup en Reddit no se hace con posts propios: se hace **comentando en threads ajenos de subs target** (`r/AskReddit`, `r/CasualConversation`, `r/Showerthoughts`) para acumular `comment_karma`. Esto requiere dos capacidades nuevas que el pipeline actual no tiene:

1. **Descubrir** threads candidatos a comentar (con filtros: edad, palabras tabú, posts administrativos, autores bot). En FASE 2A se implementó el script local `ops/scripts/social-thread-finder.ps1` que usa RSS público sin auth ([ADR-038](adr-038-social-reddit-warmup-rss-not-oauth.md)).
2. **Redactar** comentarios cortos (max 250 chars, max 3 frases, casual, sin marca, sin links) para los threads elegidos por el operador.

La elección del thread es decisión humana ineludible (qué OP me llama, qué encaja con la voz). El orchestrator no puede automatizarla.

Además, en el feedback de FASE 2B-1 el operador identificó que el **output actual del pipeline social tiene UX mala**: el texto a postear queda enterrado en un JSON con prosa explicativa y checklist que mezcla acciones del operador con acciones del ledger. El diseño del nuevo output (§ 3.B del informe FASE 2B-1) corrige esto con code fences aislados, URL del destino con flecha, metadata inline pequeña, checklist con checkbox y justificación colapsable.

## Decisión

Añadir un **modo `thread_comment`** al pipeline social-ops, distinto del modo histórico `post_propio`, con las siguientes características:

1. **Discriminador en el contrato del orchestrator**: campo `modo` con valores `post_propio` (default, mantiene el flujo histórico intacto) o `thread_comment` (activa el sub-flujo nuevo).

2. **Dos skills nuevas en `docs/social/skills/`**:
   - **`social-thread-finder`**: ejecuta el script `social-thread-finder.ps1`, presenta candidatos al operador con envoltorio instructivo de cómo elegir, parsea la respuesta del operador con regex `r/(\w+)\s*#\s*(\d+)` y devuelve al orchestrator la lista de threads elegidos.
   - **`social-comment-helper`**: para cada thread elegido genera 2 variantes (A recomendada, B alternativa) con voz casual, sin marca, sin links, max 250 chars, max 3 frases. Output en el formato fijo del § 3.B (code fences aislados, metadata inline, checklist con checkbox, justificación en `<details>`).

3. **Sub-flujos del modo `thread_comment`**:
   - **Primera invocación** del orchestrator (contrato con `threads_elegidos: []`): `phase-gate` → `platform-rules` → `social-thread-finder` → **pausa humana** (el operador elige threads en su respuesta).
   - **Segunda invocación** del orchestrator (contrato con `threads_elegidos` poblados): `phase-gate` (re-evalúa ratio) → `platform-rules` (asegura tipo `comment`) → `social-comment-helper` → `social-brand-legal-review` (reglas relajadas modo comentario) → `social-packager` (incrementa `ratio.aporte` del sub + añade entry a `commented_threads`).

4. **Skip explícito de `social-translate-en`** cuando `modo: "thread_comment"`. Los subs target son anglo (r/AskReddit, r/CasualConversation, r/Showerthoughts); redactar directamente en EN ahorra una vuelta del pipeline sin pérdida de calidad. El contrato lleva `skip_translation: true` de forma automática en este modo; el operador no decide.

5. **Schema bump del ledger** `social-state.json` v0.1 → v0.2: campo opcional `commented_threads: [{url, at}]` en cada `subreddits[]`. Compatibilidad retroactiva: si el campo no existe en un sub, tratar como array vacío. Sin reescritura masiva ni migración.

6. **Reusar la arquitectura existente** para todo lo que no es específico del modo nuevo: `social-phase-gate` aplica igual (con la salvedad de que un comentario cuenta como aporte normal del sub donde se publica); `social-platform-rules` aplica con un tipo `comment` nuevo; `social-brand-legal-review` aplica con una sección nueva "modo comentario" donde se relajan reglas de disclosure / claims sobre producto; `social-packager` adapta el incremento del contador y la composición del checklist humano.

## Opciones consideradas

### Opción 1 — Orquestador separado `social-comment-orchestrator`

Crear un segundo entry point del pipeline solo para comentarios, paralelo al `social-orchestrator` actual.

Descartada porque:

- Duplica la lógica de `phase-gate`, `platform-rules`, `brand-legal-review` y `packager` (que aplican igual en ambos modos con ajustes menores).
- Fragmenta la documentación del pipeline en dos raíces (README con dos secciones independientes en lugar de una con dos modos).
- El operador no gana nada: invoca un único orchestrator y le pasa `modo: "..."`; el orchestrator se encarga del routing interno.

### Opción 2 — Extender `social-draft-writer` para que produzca comentarios además de posts

Mantener una sola skill de redacción y meter en ella la lógica de comentarios.

Descartada porque:

- El contrato JSON de `social-draft-writer` (campos `titulo`+`cuerpo` para Reddit, `posts[]` para X) no encaja con el de un comentario (no hay título, contexto del thread, tono coloquial). Mezclarlos en un solo contrato JSON rompe la convención del corpus de skills (cada skill, un contrato claro).
- El draft-writer actual está validado en 2 ciclos reales; meterle lógica nueva arriesga regresión en el flujo `post_propio` que ya funciona.
- Una skill nueva dedicada (`social-comment-helper`) es más limpia y permite que la voz "comentarios en threads ajenos" se mantenga aislada.

### Opción 3 — Que el operador haga el descubrimiento manualmente leyendo Reddit en el navegador

No automatizar el descubrimiento. El operador entra a Reddit, lee 5-10 threads, copia URLs al chat y la skill `social-comment-helper` redacta a partir de ahí.

Descartada porque:

- No escala: 3 subs × 25 threads en hot = 75 threads que el operador debería ojear para descubrir 5-10 candidatos que pasen los filtros (edad, palabras tabú, autores bot).
- Es exactamente el "tiempo de operador" que el sistema social-ops está pensado para reducir (principio ADR-034: "automatizar el pensar, no el publicar").
- El descubrimiento es decisión de filtrado mecánico; la elección final entre los candidatos sigue siendo decisión humana. La automatización del filtrado mecánico no rompe el principio.

### Opción 4 (la elegida) — Modo `thread_comment` en el orchestrator existente

Descrita en "Decisión" arriba. Se elige porque:

- Mantiene un único entry point del pipeline.
- Reusa toda la arquitectura validada (gate, rules, review, packager) con ajustes mínimos.
- Las 2 skills nuevas (`thread-finder`, `comment-helper`) tienen responsabilidades muy concretas y aisladas, sin tocar el flujo `post_propio`.
- Coherente con el patrón espejo del pipeline editorial (`FULL_ARTICLE_ORCHESTRATED` con sus 6+ skills bajo un orchestrator único; modo único por ahora pero la arquitectura admite más modos en el futuro).

## Consecuencias

### Positivas

- Unifica los dos flujos (post propio + thread comment) bajo un solo entry point Cowork, sin duplicar lógica.
- Mantiene intacto el flujo `post_propio` ya validado. No hay riesgo de regresión.
- La pausa humana entre `social-thread-finder` y `social-comment-helper` es coherente con "automatizar el pensar, no el publicar": la elección del thread es del humano, no del modelo.
- El nuevo output (§ 3.B) corrige los problemas de UX identificados en FASE 2B-1 sin que el operador tenga que pelearse con JSON ni con prosa explicativa.
- Schema bump v0.1 → v0.2 del ledger se hace sin migración: el campo `commented_threads` se trata como opcional y se crea automáticamente cuando el packager registra el primer comentario.

### Negativas

- Requiere **2 invocaciones de Cowork por sesión** (descubrir + redactar). Esto es coherente con el principio rector pero añade overhead operativo: el operador no termina una sesión con un solo "ejecuta el pipeline".
- La voz nueva "comentarios en threads ajenos" se añade a `sharemechat-voice` (skill transversal en `docs/cms/skills/`). Cualquier ajuste posterior de esa voz cruza dominio CMS ↔ social. Mitigación aceptada: la skill `sharemechat-voice` ya era transversal por diseño.
- El campo `commented_threads` empieza vacío y solo se llena con el uso real. Esto significa que la heurística "ya comenté en este thread, no proponerlo de nuevo" del finder no aplica hasta que el packager registre al menos un comentario. Mitigación: en la práctica el finder devuelve threads hot recientes (max 24 h en r/AskReddit), por lo que el solapamiento con threads ya comentados es bajo en uso normal.

## Relación con otras ADRs

- [ADR-034](adr-034-social-ops-methodology.md) — metodología social-ops base. Esta ADR es una extensión coherente con sus principios (automatizar el pensar, no publicar; fuera del producto; sistema con estado en el ledger).
- [ADR-038](adr-038-social-reddit-warmup-rss-not-oauth.md) — RSS público sin auth para descubrimiento Reddit. ADR-039 consume el script que ADR-038 justifica.

## Fases del frente

- **FASE 0 / FASE 0 bis** (sesiones anteriores): investigación + pivots de backend del descubrimiento (Cowork fetch → OAuth → RSS).
- **FASE 2A** (commit `dbb5274` + hot-fix `da6542b`): script `social-thread-finder.ps1` + ADR-038 + README.
- **FASE 2B-1** (sesión previa): investigación de problemas de UX del output actual + diseño del nuevo output (§ 3.B aprobado por el operador).
- **FASE 2B-2** (esta sesión): implementación completa del modo `thread_comment` — 2 skills nuevas + ADR-039 + actualización de 5 skills existentes + schema bump del ledger + actualización del README.
- **FASE 2C** (siguiente, no en esta sesión): validación end-to-end real con Cowork ejecutando el flujo completo contra threads reales y publicación humana de los comentarios. Si se detectan bugs operativos, se abren FASE 2B-3 / 2B-4 según corresponda.
