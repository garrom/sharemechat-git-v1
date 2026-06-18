---
name: social-orchestrator
description: Director del pipeline de social-ops de SharemeChat. Recibe el contrato de entrada (plataforma, objetivo, tema_o_angulo, subreddit) y el ledger social-state.json, encadena en orden los 6 agentes (phase-gate, platform-rules, draft-writer, brand-legal-review, translate-en, packager) pasando la salida de cada uno al siguiente, y devuelve el plan final + checklist humano + ledger actualizado. Siempre genera ES + EN sin opt-out. Espejo de cms-orchestrator. Úsalo como punto de entrada de una sesión de social-ops.
---

# social-orchestrator

## Propósito
Director del pipeline de social-ops. Recibe el contrato de entrada y el ledger, encadena los 6 agentes pasando la salida de cada uno al siguiente, y devuelve el plan final, el checklist humano y el ledger actualizado. Es el equivalente social de `cms-orchestrator`.

## Cuándo se usa
Punto de entrada del pipeline. Lo lanza el operador (o el script prompt-builder de la app) al inicio de una sesión de Cowork de social-ops.

## Entradas
1. Contrato de entrada. Campos comunes a los dos modos:
   - `modo`: `"post_propio"` (default si ausente) o `"thread_comment"` (ADR-039).
   - `plataforma`: `"x"` o `"reddit"`.
   - `objetivo`: `calentamiento` / `aporte` / `recruit-modelos` / `promo`.
   - `tema_o_angulo`: texto libre.
   - `subreddit`: opcional, solo Reddit modo `post_propio`.
   - `skip_translation`: opcional, boolean. **Forzado a `true`** cuando `modo: "thread_comment"`; no se requiere que el operador lo pase.

   Campos específicos del modo `thread_comment`:
   - `subs_candidatos`: opcional, lista de subs para el finder; si ausente usa defaults del script.
   - `threads_elegidos`: lista de objetos `{thread_url, titulo, subreddit, op_brief}`. Vacía o ausente en la **primera invocación** (descubrimiento); poblada en la **segunda invocación** (redacción).
2. El `social-state.json`:
   - **Modo `post_propio`**: inyectado en el prompt (compatibilidad histórica de ADR-034).
   - **Modo `thread_comment`** (ADR-041): leído del filesystem en `docs/social/social-state.json`. Cowork necesita la carpeta del repo conectada (pre-requisito operativo). El orchestrator hace `read_file` sobre esa ruta al inicio del flujo y trata el contenido como el ledger inyectado. Si el archivo no está accesible, abortar con instrucción de conectar la carpeta o caer al modo legacy inyectando el ledger en el prompt.

## Secuencia

El orquestador despacha a dos sub-flujos según el `modo` del contrato. El flujo `post_propio` se preserva intacto desde ADR-034; el flujo `thread_comment` se añade en ADR-039 como sub-flujo nuevo con pausa humana en el medio.

### Sub-flujo `post_propio` (default, ADR-034)

Invoca en este orden, encadenando los contratos JSON:
1. `social-phase-gate` -> `gate_decision`.
2. `social-platform-rules` -> `platform_constraints`. Si falta la info del sub en el ledger, es bloqueante: detente y pide al operador que cure las reglas de ese sub antes de seguir.
3. `social-draft-writer` -> `drafts` (ES), para el `objetivo_permitido` del gate. Usa `sharemechat-voice` como voz.
4. `social-brand-legal-review` -> `review`.
5. `social-translate-en` -> `drafts_en`. Siempre ES + EN, sin opt-out (como en el pipeline editorial), salvo que `skip_translation: true` venga en el contrato (uso operativo: rara vez en `post_propio`).
6. `social-packager` -> `plan` + `checklist_humano` + `social_state_next`.

### Sub-flujo `thread_comment` (ADR-041, una sola invocación sin pausa humana)

**Vigente desde ADR-041 (FASE 2E)**. El flujo histórico de ADR-039 con dos invocaciones y pausa humana queda como **fallback** documentado para casos donde Cowork no puede hacer fetch a `*.reddit.com` (allowlist desactivada, User-Agent bloqueado, dominio cambiado). Cuando el operador llega con `threads_elegidos` ya poblado (porque ejecutó el `.ps1` localmente), el orchestrator detecta el caso y aplica el flujo ADR-039 saltando el `social-thread-finder` (que ya no haría falta).

**Pre-requisitos operativos** del flujo vigente (validados en FASE 2C):
- `*.reddit.com` en allowlist de Cowork.
- Carpeta del repo conectada a Cowork (para leer `social-state.json` del filesystem).

**Flujo lineal en una invocación**:

1. **Leer ledger**: el orchestrator lee `docs/social/social-state.json` del filesystem del repo conectado a Cowork. NO se inyecta vía prompt como en ADR-039.
2. `social-phase-gate` -> `gate_decision`. Para `modo: "thread_comment"` el `objetivo` siempre se trata como aporte. Verifica que la fase actual lo permita.
3. `social-platform-rules` -> `platform_constraints` con `tipo: "comment"`, sub-tipo `comment.advice_substantive` por defecto en subs target de ADR-040 (o `comment.warmup_casual` si el contrato pasa subs legacy).
4. `social-thread-finder` -> fetch RSS nativo desde Cowork + filtros + marca boost + **auto-selección** según heurística documentada en su skill. Devuelve array de threads_auto_elegidos (max 2/sub, max 6 total). NO presenta candidatos al operador, NO pausa.
   - Si `status != "ok"` (fetch failed, no candidates), el orchestrator interrumpe el pipeline y devuelve el JSON estructurado al operador con instrucción de fallback al `.ps1` legacy o ajuste de subs.
5. `social-comment-helper` (batch) -> 2 variantes por thread (A recomendada, B alternativa) sobre los N threads auto-elegidos en una sola pasada. Títulos ambiguos se redactan con **ángulo prudente** automático (vivencia genérica del oficio sin referencia específica al thread); NO se pausa para pedir OP brief.
6. `social-brand-legal-review` (batch) -> review sobre todos los borradores. Mismas reglas del modo comentario (`disclosure.light` / `disclosure.explicit` según `target_audience` + boost). Bloqueos por variante.
7. `social-translate-en` se **SALTA** por construcción (`skip_translation: true` automático).
8. `social-packager` -> paquete final con N bloques (uno por thread), checklist humano combinado, `social_state_next` propuesto. Output con el formato fijo de ADR-041 (encabezado de resumen + bloque por thread + checklist + instrucción de confirmación).

**Output del orchestrator**: el paquete del packager + un resumen breve para el operador. El operador copia-pega los comentarios a Reddit, vuelve al chat y confirma con `"publicado A en thread 1, B en thread 2"` (o equivalente). El orchestrator parsea la confirmación y aplica `social_state_next` al ledger (incrementa `ratio.aporte` del sub correcto + entry a `commented_threads`).

### Sub-flujo `thread_comment` (ADR-039, FALLBACK con dos invocaciones y pausa humana)

Activación del fallback: el operador pasa `threads_elegidos` ya poblado en el contrato (porque ejecutó el `.ps1` localmente tras un fallo de fetch desde Cowork, o porque prefiere control granular sobre la elección de threads).

En ese caso el orchestrator salta `social-thread-finder` (no hace falta porque la elección ya está hecha) y aplica el resto del pipeline en una sola invocación:

1. **Leer ledger** del filesystem.
2. `social-phase-gate` -> `gate_decision` (re-evalúa ratio con los threads elegidos).
3. `social-platform-rules` -> `platform_constraints` con `tipo: "comment"`.
4. `social-comment-helper` (batch) sobre los `threads_elegidos`.
5. `social-brand-legal-review` (batch).
6. `social-packager` -> paquete final.

Misma salida que el flujo vigente. Se usa cuando hay que evitar el fetch nativo de Cowork.

## Manejo de casos
- Degradación: si el gate degradó el objetivo (por ejemplo promo a aporte), continúa con el permitido y dilo claramente en el resumen al humano.
- Bloqueo de seguridad: si el review bloquea variantes, no las empaquetes; si bloquea todo, el plan sale con `publicable: false` y sus motivos.
- Sub sin reglas: si `platform-rules` no encuentra la política del sub en el ledger, para y pide curarla antes de continuar.
- own_subreddit: si `subreddit` es `own`, el flujo es el mismo, pero el gate ya habrá relajado las comprobaciones externas.
- Modo `thread_comment` con `social-thread-finder` que devuelve `status: "fetch_failed"`: interrumpir el pipeline. Mostrar al operador el JSON estructurado con la instrucción de fallback al `.ps1` legacy. NO intentar redactar sin candidatos.
- Modo `thread_comment` con `social-thread-finder` que devuelve `status: "no_candidates"`: interrumpir el pipeline. Mostrar el motivo (ej: "all threads filtered out by sensitive title check") y sugerir esperar 30-60 min o pasar `subs_candidatos` distintos. NO redactar.
- Modo `thread_comment` con título ambiguo en algún thread auto-elegido: el `social-comment-helper` **no pausa** en ADR-041; aplica ángulo prudente automático (vivencia genérica del oficio sin referencia al thread). El orchestrator no tiene nada especial que manejar aquí; el helper lo absorbe en su redacción.

## Salida
Devuelve lo que emite `social-packager` (plan, variantes_es, checklist_humano, social_state_next, bloqueos, publicable), precedido de un resumen breve en lenguaje natural para el humano: qué pidió, qué se generó, si hubo degradación o bloqueos, y el recordatorio de guardar `social_state_next` solo tras publicar.

## Reglas de oro
- Siempre ES + EN, sin opt-out.
- No publica ni guarda el ledger: emite; el humano ejecuta y persiste.
- Respeta las decisiones de cada agente. El orquestador coordina, no las anula.

## Lo que NO hace
- No toma decisiones de permiso (eso es el gate) ni de seguridad (eso es el review).
- No accede a las plataformas ni publica.
- No persiste estado: propone social_state_next para que lo guarde el humano.
