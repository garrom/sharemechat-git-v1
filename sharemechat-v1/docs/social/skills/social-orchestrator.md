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
2. El `social-state.json` completo. Inyectado en el prompt, porque Cowork no tiene memoria entre sesiones.

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

### Sub-flujo `thread_comment` (ADR-039, dos invocaciones)

**Primera invocación** (contrato con `threads_elegidos: []` o ausente):

1. `social-phase-gate` -> `gate_decision`. Para `modo: "thread_comment"` el `objetivo` solicitado siempre es tratado como aporte (un comentario en thread ajeno con tono casual no es promocional). El gate verifica que la fase actual lo permita (en `warmup` siempre permitido).
2. `social-platform-rules` -> `platform_constraints` con `tipo: "comment"` (max 250 chars, sin enlace, sin flair, sin disclosure, tono casual).
3. `social-thread-finder` -> lista de candidatos presentada al operador + parser de respuesta. Devuelve `threads_elegidos` (lista) o aborta si el operador dice "ninguno me convence" después de reintentar.
4. **Pausa humana**: el orquestador devuelve `threads_elegidos` al chat. El operador relanza el orchestrator con el nuevo contrato (`threads_elegidos` poblado).

**Segunda invocación** (contrato con `threads_elegidos` poblado):

1. `social-phase-gate` -> `gate_decision`. Re-evalúa ratio porque cada comentario incrementa `subreddits[r/X].ratio.aporte` del sub correspondiente y la decisión final podría cambiar si entre la primera y la segunda invocación el ledger cambió.
2. `social-platform-rules` -> `platform_constraints` con `tipo: "comment"`.
3. `social-comment-helper` -> 2 variantes por thread (A recomendada, B alternativa). Si algún thread tiene título ambiguo y `op_brief` ausente, la skill pausa para pedir al operador 1-2 líneas del OP. Sin fetch a Reddit.
4. `social-brand-legal-review` -> `review` en modo "comentario en thread ajeno" (reglas relajadas: sin disclosure, sin claims sobre el producto; mantiene 18+, marca, links).
5. `social-translate-en` se **SALTA** por construcción (`skip_translation: true` forzado en este modo; los subs target son anglo y el helper redacta directamente en EN).
6. `social-packager` -> `plan` + `checklist_humano` + `social_state_next`. El packager incrementa `subreddits[r/X].ratio.aporte` del sub correcto y añade entry a `subreddits[r/X].commented_threads: [{url, at}]` cuando el operador confirme la publicación.

## Manejo de casos
- Degradación: si el gate degradó el objetivo (por ejemplo promo a aporte), continúa con el permitido y dilo claramente en el resumen al humano.
- Bloqueo de seguridad: si el review bloquea variantes, no las empaquetes; si bloquea todo, el plan sale con `publicable: false` y sus motivos.
- Sub sin reglas: si `platform-rules` no encuentra la política del sub en el ledger, para y pide curarla antes de continuar.
- own_subreddit: si `subreddit` es `own`, el flujo es el mismo, pero el gate ya habrá relajado las comprobaciones externas.
- Modo `thread_comment` con script de descubrimiento fallido: si `social-thread-finder` sale con exit 1 o todos los subs en 429, no continuar al `social-comment-helper`. Mostrar el stderr al operador y dejar la decisión de reintentar / cambiar subs / abortar al humano. NO inventar candidatos.
- Modo `thread_comment` con título ambiguo: si `social-comment-helper` pausa para pedir `op_brief` de un thread, el orquestador deja que la pausa ocurra y reanuda cuando el operador pegue el contexto. NO redactar sin contexto si la heurística marcó ambigüedad.
- Modo `thread_comment` sin threads elegidos por el operador ("ninguno me convence" final): emitir un plan vacío con `publicable: false` y motivo "operador no eligió thread tras descubrimiento". NO incrementar ningún contador del ledger.

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
