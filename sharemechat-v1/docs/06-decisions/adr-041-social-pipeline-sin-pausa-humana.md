# ADR-041 — Pipeline social modo `thread_comment` sin pausa humana (fetch RSS nativo + auto-selección)

## Estado

Aceptada — 2026-06-18. Supersede parcial de [ADR-039](adr-039-pipeline-social-modo-thread-comment.md).

## Contexto

El modo `thread_comment` definido en ADR-039 separaba el flujo en **dos invocaciones del orchestrator** con una **pausa humana** intermedia:

1. **Primera invocación**: `phase-gate` → `platform-rules` → `social-thread-finder` (ejecutaba el script local `social-thread-finder.ps1` cuyo stdout markdown se mostraba al operador) → **pausa**.
2. **Pausa**: el operador leía los candidatos, elegía 1-3 con la sintaxis `"r/X #N"`, y respondía al chat.
3. **Segunda invocación**: el operador relanzaba el orchestrator con `threads_elegidos` poblado → `phase-gate` (re-evalúa ratio) → `platform-rules` (tipo `comment`) → `social-comment-helper` → `social-brand-legal-review` → `social-packager`.

Este diseño tenía justificación coherente con el principio rector de ADR-034 ("automatizar el pensar, no el publicar") y resolvía dos restricciones percibidas como duras en su momento:

- Cowork no puede ejecutar scripts `.ps1` (sandbox sin PowerShell).
- La elección del thread se consideraba decisión humana ineludible.

Durante la validación FASE 2C (preparación para uso sostenido), el operador identificó **tres fricciones operativas reales** que el cms-orchestrator no tiene:

1. **El script `.ps1` se ejecuta fuera de Cowork**. El operador lo lanza en local, copia stdout, lo pega en Cowork. Cada ciclo cuesta ~1 minuto de copy-paste manual.
2. **Cowork no tiene memoria entre invocaciones**. Tras la pausa humana, el operador tiene que re-inyectar el ledger completo + el contrato actualizado en una sesión nueva. Olvidar el ledger = el orchestrator no puede aplicar `gate_decision` ni preparar `social_state_next` correctamente. Re-inyectar = más copy-paste manual y riesgo de error.
3. **La elección humana de threads es un paso de fricción que cms-orchestrator no tiene**. El pipeline editorial (`cms-orchestrator`) decide el ángulo y los aspectos del artículo internamente sin pausar al operador; el operador da un prompt y recibe un artículo. La asimetría entre los dos pipelines genera carga cognitiva.

Hallazgos validados por el operador en sesiones recientes:

- **`*.reddit.com` está en allowlist de Cowork** (Settings → Capacidades → Dominios permitidos adicionales). El operador lo añadió durante FASE 2C. Esto significa que Cowork puede hacer fetch nativo de `https://www.reddit.com/r/SUB/hot.rss` sin pasar por el script local.
- **La carpeta del repo es conectable a Cowork**. El operador ya la conectó para que el thread-finder pudiera leer la salida del `.ps1` local. Esto significa que Cowork puede leer `docs/social/social-state.json` directamente del filesystem.

Con estas dos capacidades disponibles, las restricciones que motivaron el diseño de ADR-039 dejan de aplicar.

## Decisión

**Rediseñar el modo `thread_comment` como un flujo lineal sin pausa humana, equivalente operativo de `cms-orchestrator`**: el operador da un prompt, Cowork ejecuta todas las fases en cadena en una sola invocación, y devuelve un paquete final con N comentarios listos para copy-paste a Reddit.

### Cambios concretos

#### 1. `social-thread-finder` hace fetch RSS nativo desde Cowork

La skill deja de instruir al operador a ejecutar el script local. En su lugar:

- Itera la lista `subs_candidatos` del contrato (o defaults del ledger si no se pasa).
- Por cada sub, hace fetch nativo de `https://www.reddit.com/r/<sub>/hot.rss` con User-Agent `SharemeChat:warmup-finder:v2 (by /u/sharemechat)`.
- Aplica los mismos filtros que el script `.ps1` (TabuKeywords, AdminMarkers, BotAuthors, MaxAgeHours por sub, BoostKeywords).
- **Auto-selecciona** top 2-3 candidatos por sub con la heurística del § "Heurística de auto-selección" más abajo.
- Devuelve un array JSON de threads auto-elegidos compatible con el formato `threads_elegidos` que `social-comment-helper` consume.

#### 2. `social-orchestrator` ejecuta el flujo `thread_comment` en una sola invocación

Sin pausa humana. Sin segunda invocación. El orchestrator:

1. Lee `social-state.json` desde el filesystem del repo (Cowork tiene la carpeta conectada).
2. Encadena: `phase-gate` → `platform-rules` (uno por sub) → `social-thread-finder` (fetch + filtros + auto-selección) → `social-comment-helper` (batch sobre los N threads auto-elegidos) → `social-brand-legal-review` (sobre todos los borradores) → `social-packager`.
3. Devuelve un único paquete final con N bloques (uno por thread elegido), checklist humano combinado y `social_state_next` propuesto.

#### 3. `social-comment-helper` acepta input batch

En lugar de un thread por invocación, recibe la lista completa de threads auto-elegidos y genera 2 variantes por thread en una sola pasada. Para títulos ambiguos (`len < 30` y sin keywords del oficio) **ya no pausa para pedir OP brief**; en lugar de eso aplica **ángulo prudente**: vivencia genérica del oficio sin referencia específica al thread.

#### 4. `social-packager` ensambla un paquete final con N bloques

Output adaptado al nuevo flujo:

- Encabezado con resumen (`N comentarios generados, M con boost`).
- Un bloque por thread: URL del thread, título, variante A, variante B, metadata de cada variante.
- Checklist humano combinado al final con `[ ]` por cada acción de publicación.
- `social_state_next` propuesto.
- Instrucción al final: "tras publicar, confirma a Cowork con `publicado A en thread 1, B en thread 2` y aplico `social_state_next` al ledger".

### Heurística de auto-selección (en `social-thread-finder`)

La skill auto-elige los threads candidatos aplicando este orden de prioridad:

1. **Boost > sin boost**: los threads cuyo título matchea `BoostKeywords` (plataformas competencia: `coomeet`, `luckycrush`, `chaturbate`, `stripchat`, `bongacams`, `myfreecams`, `jerkmate`, `camsoda`, `flirt4free`) tienen prioridad absoluta sobre los demás.
2. **Edad fresca > antigua**: dentro de cada grupo (boost / no boost), los threads más recientes primero.
3. **Excluir títulos sensibles**: aunque pasen los filtros base (`TabuKeywords` del script), descartar también títulos que matcheen `blackmail`, `rape`, `scam`, `extortion`, `underage`, `minor`, `abuse`, `suicide`, `self-harm`. Esta lista es **independiente** de `TabuKeywords` y se aplica como segunda barrera en la auto-selección (el `.ps1` tenía estas semánticas más laxas porque dependía del operador para el filtrado fino).
4. **Excluir títulos ambiguos por defecto**: si `len(titulo) < 30` Y sin keywords del oficio (`cam`, `model`, `OF`, `Fansly`, `platform`, `payout`, `verification`, `shift`), descartar — sin operador para clarificar, no merece la pena gastar variante.
5. **Limite por sub**: máximo 2 threads auto-elegidos por sub.
6. **Limite total**: máximo 6 threads en total (3 subs × 2 max).

### Pre-requisitos operativos

- `*.reddit.com` en allowlist de Cowork (Settings → Capacidades → Dominios permitidos adicionales). Validado por el operador en FASE 2C.
- Carpeta del repo conectada a Cowork. Validado por el operador en FASE 2C.

### Fallback documentado

Si el fetch RSS desde Cowork falla (allowlist no propagada en una sesión, User-Agent bloqueado por Reddit, cambio en el dominio del feed), el orchestrator devuelve un **error JSON estructurado** indicando el fallo y la instrucción para fallback:

> "El fetch RSS desde Cowork falló: <razón>. Ejecuta el script local `./sharemechat-v1/ops/scripts/social-thread-finder.ps1`, pega el stdout markdown en una nueva sesión Cowork con `modo: thread_comment` y `threads_elegidos: <lista parseada de tu elección>` para forzar el flujo legacy de ADR-039."

El script `.ps1` se mantiene en `ops/scripts/` como fallback funcional **sin cambios**. No se borra ni se desaprueba; sigue resolviendo el caso de Cowork sin acceso a Reddit.

## Opciones consideradas

### Opción 1 — Mantener el flujo ADR-039 con dos invocaciones y pausa humana

Aceptar la fricción a cambio de preservar el control humano sobre la elección de threads.

Descartada porque:

- Las tres fricciones identificadas son acumulativas: ejecución externa del `.ps1`, re-inyección del ledger, copy-paste de candidatos. Cada ciclo cuesta 2-3 minutos vs ~30 segundos del flujo lineal.
- El cms-orchestrator demuestra que un pipeline complejo sin pausa humana es operable y aceptable; la asimetría con el modo `thread_comment` no aporta valor.
- El "control humano" sobre threads en ADR-039 era limitado: el operador elegía entre los candidatos que el script ya había filtrado por TabuKeywords + AdminMarkers + bots. La auto-selección documentada formaliza esa misma lógica de filtrado, solo que sin intervención manual en cada ciclo.

### Opción 2 — Mantener pausa humana pero unificar en una sesión Cowork

Tener el `social-thread-finder` capaz de fetch nativo pero seguir mostrando candidatos al operador y esperar su elección dentro de la misma sesión Cowork (sin la fricción de re-inyectar ledger en sesión nueva).

Descartada porque:

- Resuelve solo una de las tres fricciones (la re-inyección de ledger). Sigue requiriendo copy-paste de candidatos del operador.
- La pausa intermedia rompe el patrón "1 prompt → 1 output" del cms-orchestrator, que es el patrón que el operador percibe como cómodo y sostenible.
- Si más adelante se quiere reincorporar control humano para casos especiales (por ejemplo "elige tú entre los candidatos hoy"), el operador puede invocar el script `.ps1` manualmente y pasar `threads_elegidos` explícito en el contrato, recuperando el flujo ADR-039 como caso especial.

### Opción 3 (la elegida) — Flujo lineal sin pausa humana, fetch nativo + auto-selección

Descrita en "Decisión" arriba. Se elige porque:

- Resuelve las tres fricciones operativas identificadas.
- Espejo del cms-orchestrator, coherente con el patrón ya validado.
- Preserva el fallback al `.ps1` legacy para los casos donde Cowork no puede.
- La heurística de auto-selección es **transparente y configurable** (documentada en el cuerpo de la skill `social-thread-finder`); si el operador quiere ajustar criterios, edita la skill, no el script.

## Consecuencias

### Positivas

- 1 prompt al operador → 1 paquete final con N comentarios. Patrón consistente con el cms-orchestrator.
- Eliminada la dependencia de ejecución del `.ps1` en el flujo principal. PowerShell deja de ser pre-requisito operativo (sigue siéndolo solo para el fallback).
- Eliminada la re-inyección del ledger entre invocaciones. Cowork lee el filesystem directamente.
- La auto-selección formaliza la heurística operativa en código revisable, no en juicio humano caso a caso.
- Mantenido íntegro el modo `post_propio` del orchestrator. Sin riesgo de regresión en el flujo histórico.
- Mantenido el script `.ps1` como fallback. Sin pérdida de capacidad operativa.

### Negativas

- El operador pierde control granular sobre qué threads se eligen en cada ciclo. La heurística debe ser fiable; si selecciona mal repetidamente, el operador desperdicia variantes generadas. Mitigación: la heurística está documentada y se puede iterar.
- Cowork debe poder fetch `*.reddit.com`. Si la allowlist se desactiva accidentalmente, el flujo deja de funcionar hasta que se reactive. Mitigación: el fallback al `.ps1` cubre este caso con mensaje claro.
- Si Reddit cambia el dominio del feed o el User-Agent es bloqueado por nueva política, el flujo cae. Mitigación: el `.ps1` también caería en ese caso, así que el riesgo es sistémico (no introducido por ADR-041); cuando ocurra, hay que actualizar ambos.
- La asimetría operativa con el flujo `post_propio` se reduce pero no desaparece: `post_propio` sigue siendo "una variante por invocación" (la cuenta de drafts y la elección final son por sub específico), mientras `thread_comment` ahora es "N comentarios por invocación". La asimetría es intencional porque las semánticas de negocio son distintas (un post propio es un evento; N comentarios son una sesión de warmup).

## Relación con otras ADRs

- [ADR-034](adr-034-social-ops-methodology.md) — metodología social-ops base. Principios preservados: "automatizar el pensar, no el publicar" (Cowork sigue sin publicar; lo hace el operador), sistema con estado en el ledger, fuera del producto. La definición del "pensar" se amplía: la elección de threads pasa de decisión humana a decisión automatizada con heurística transparente.
- [ADR-038](adr-038-social-reddit-warmup-rss-not-oauth.md) — RSS público sin auth para descubrimiento. Sigue vigente; el fetch nativo de Cowork usa el mismo endpoint (`hot.rss`) y el mismo User-Agent (versión `v2` para distinguir del `.ps1`).
- [ADR-039](adr-039-pipeline-social-modo-thread-comment.md) — diseño original del modo `thread_comment` con dos invocaciones y pausa humana. **Supersede parcial**: ADR-039 queda como historia del diseño previo y como referencia del flujo `fallback` cuando se invoca el `.ps1` legacy. ADR-041 es el comportamiento vigente por defecto.
- [ADR-040](adr-040-pivote-target-subs-social-ops.md) — pivote target subs adult-ecosystem. Sigue vigente; ADR-041 no toca la elección de subs ni los sub-tipos (`comment.warmup_casual` / `comment.advice_substantive`) ni las políticas de disclosure (`light` / `explicit`). Cambia solo la orquestación.

## Fases del frente

- **FASE 2A** (commit `dbb5274` + hot-fix `da6542b`): script `social-thread-finder.ps1` + ADR-038.
- **FASE 2B-2** (commit `9042712`): modo `thread_comment` original con pausa humana + ADR-039.
- **FASE 2D-2** (commits `61d78c3..ae11eae`): pivote target subs + ADR-040.
- **FASE 2D-2 hot-fix** (commit `45c26fa`): frontmatter YAML obligatorio + límite 1024 chars en `description`.
- **FASE 2E** (esta sesión): rediseño del flujo `thread_comment` sin pausa humana + ADR-041. 4 skills modificadas (`social-thread-finder`, `social-orchestrator` modo thread_comment, `social-comment-helper` batch, `social-packager` paquete final). README + project-log actualizados. Script `.ps1` preservado como fallback.
- **FASE 2C** (diferida): validación end-to-end real con Cowork ejecutando el flujo nuevo contra los 4 subs target de ADR-040.
- **FASE 2D-3** (futura): incorporar `r/OnlyFansAdvice` cuando la cuenta cumpla `karma_total >= 50` + `edad_dias >= 30`.
