---
name: social-thread-finder
description: Skill del pipeline social-ops de SharemeChat (modo thread_comment, ADR-038 + ADR-039 + ADR-041). Hace fetch RSS nativo desde Cowork de https://www.reddit.com/r/SUB/hot.rss por cada sub candidato con User-Agent SharemeChat:warmup-finder:v2. Aplica filtros (TabuKeywords, AdminMarkers, BotAuthors, edad max por sub) y marca BoostKeywords para threads que mencionan plataforma competencia. Auto-selecciona top 2-3 candidatos por sub con heuristica boost > sin boost, fresco > antiguo, max 2 por sub, max 6 total. Excluye titulos sensibles y titulos ambiguos sin keywords del oficio. Devuelve array JSON de threads auto-elegidos compatible con social-comment-helper. Si fetch falla, emite error estructurado con instruccion de fallback al script local social-thread-finder.ps1 (flujo ADR-039 con pausa humana). Mantiene compatibilidad con subs_candidatos del contrato. Las listas concretas de BoostKeywords y de palabras sensibles viven en el cuerpo de la skill.
---

# social-thread-finder

## Propósito
Descubre threads candidatos a comentar y **auto-selecciona** los mejores para el siguiente paso del pipeline, en una sola invocación sin pausa humana. Hace fetch RSS nativo desde Cowork, aplica filtros, marca boost y devuelve un array JSON listo para `social-comment-helper`.

Es la primera operación del sub-flujo lineal del modo `thread_comment` definido en [ADR-041](../../06-decisions/adr-041-social-pipeline-sin-pausa-humana.md). Reemplaza la lógica de "ejecuta el `.ps1` local + presenta al operador + parsea elección" del diseño ADR-039 original, que queda como fallback.

## Cuándo se usa
Cuando el contrato del `social-orchestrator` viene con:

- `modo: "thread_comment"`, y
- `threads_elegidos: []` (vacío o ausente).

Si el operador pasa `threads_elegidos` ya poblado (caso fallback con `.ps1` legacy), este paso se salta y se va directo a `social-comment-helper`.

NO se ejecuta en modo `post_propio` (flujo histórico de post propio en X / Reddit).

## Entradas
1. Contrato del orchestrator: `plataforma: "reddit"`, `modo: "thread_comment"`, `subs_candidatos` (opcional; si ausente, usa los subs con `rol: "target_brand_fit"` del ledger).
2. `social-state.json` del filesystem (`docs/social/social-state.json`), inyectado por el orchestrator. La skill lo lee para conocer los `subs_candidatos` por defecto y las edades máximas por sub.

## Pre-requisitos operativos
- `*.reddit.com` en allowlist de Cowork (Settings → Capacidades → Dominios permitidos adicionales).
- Carpeta del repo conectada a Cowork (para leer el ledger del filesystem).

Si alguno falla, ver § "Fallback al script local".

## Fetch RSS nativo

Por cada sub en `subs_candidatos`:

1. Construir URL: `https://www.reddit.com/r/<sub_sin_prefijo>/hot.rss`.
2. Hacer fetch con headers:
   - `User-Agent: SharemeChat:warmup-finder:v2 (by /u/sharemechat)`
   - `Accept: application/atom+xml, application/xml, text/xml`
3. Si la respuesta es 200, parsear como Atom feed. Si la respuesta es 429, esperar 30 segundos y reintentar UNA vez; si el retry vuelve a 429, marcar el sub como "throttled" y continuar con el siguiente sub.
4. Si la respuesta es no-200 no-429 (404, 5xx, timeout), marcar el sub como "failed" y continuar.
5. Entre fetches de subs distintos, esperar **15 segundos** (mitigación de throttling preventiva). En batches pequeños (1-3 subs), aceptable; si Cowork tarda mucho, validar empíricamente y ajustar.

User-Agent **versión `v2`** para distinguir de los fetches del `.ps1` legacy (que sigue usando `v1`). Permite a Reddit (y al operador en logs) saber qué cliente está consultando.

## Filtros aplicados a cada entry del feed

Mismo set de filtros que el script `social-thread-finder.ps1`:

### TabuKeywords (descarta el thread completo)
Coincidencia case-insensitive como substring del título. Cualquier título que contenga alguna se descarta:

- **Líneas rojas absolutas**: `underage`, `teen`, `minor`, `child`, `cp`, `trafficking`, `snuff`, `rape`, `coercion`, `force`.
- **Politizados / derail**: `religion`, `politics`, `trump`, `biden`, `israel`, `palestine`, `abortion`, `AITA`, `rant`, `hate`, `racist`, `gun`, `shooting`, `war`.

### AdminMarkers (descarta posts administrativos)
Substring case-insensitive: `Welcome Thread`, `Megathread`, `Daily Discussion`, `Daily Thread`, `Monthly`, `Weekly`, `Mod Post`, `Moderator`, `looking for new moderators`.

### BotAuthors (descarta autores bot)
Match case-insensitive sobre el autor (limpiando prefijo `/u/`): `AutoModerator`, `Sub_Mentions`, `reddit`.

### Edad máxima por sub
Desde el ledger (`subreddits[].max_age_hours` si existe; si no, usar defaults por sub):

- `r/CreatorsAdvice`: 96h.
- `r/SexWorkerSupport`: 168h.
- `r/CamGirlProblems`: 72h.
- `r/Fansly_Advice`: 168h.
- Subs no listados: 96h por defecto.

Threads más antiguos que el límite se descartan.

### Dedup
Por URL del thread (case-insensitive).

## BoostKeywords (marca, no descarta)

Threads cuyo título contenga alguna de estas plataformas competencia (substring case-insensitive) se marcan con `is_boost: true`:

`coomeet`, `luckycrush`, `chaturbate`, `stripchat`, `bongacams`, `myfreecams`, `jerkmate`, `camsoda`, `flirt4free`.

Se usan en la auto-selección (§ siguiente).

## Heurística de auto-selección (clave de ADR-041)

Tras filtrar y marcar, la skill auto-elige los mejores candidatos con este orden:

1. **Excluir títulos sensibles** (segunda barrera, independiente de TabuKeywords): descartar títulos que matcheen `blackmail`, `rape`, `scam`, `extortion`, `underage`, `minor`, `abuse`, `suicide`, `self-harm` (case-insensitive como substring). Esta lista solapa parcialmente con TabuKeywords pero se aplica también aquí como red de seguridad.

2. **Excluir títulos ambiguos por defecto**: si `len(titulo) < 30` Y el título no contiene ninguna keyword del oficio (`cam`, `model`, `OF`, `OnlyFans`, `Fansly`, `platform`, `payout`, `verification`, `KYC`, `shift`, `creator`), descartar. Sin operador para clarificar el contexto, no merece la pena consumir variante en threads opacos.

3. **Ordenar dentro de cada sub** por dos claves:
   - **Boost desc** (`is_boost: true` antes que `is_boost: false`).
   - **Edad asc** (más reciente primero).

4. **Tomar top 2 por sub** (límite por sub).

5. **Limitar total a 6 threads** (3 subs × 2 max). Si más de 3 subs se han pasado en `subs_candidatos`, priorizar boost cross-sub: primero todos los boost (hasta agotar), después los no-boost en orden de aparición.

6. Si la lista final está vacía (todos los candidatos descartados o todos los fetches fallaron), devolver `aborted: true` con motivo claro. El orchestrator no continuará el pipeline.

## Salida al orchestrator (JSON estructurado)

Caso éxito:

```json
{
  "status": "ok",
  "threads_elegidos": [
    {
      "thread_url": "https://www.reddit.com/r/CamGirlProblems/comments/.../...",
      "titulo": "Leaving Coomeet, looking for alternatives - what's worked for you?",
      "subreddit": "r/CamGirlProblems",
      "is_boost": true,
      "boost_keyword": "coomeet",
      "age_hours": 4.3,
      "op_brief": null
    },
    {
      "thread_url": "https://www.reddit.com/r/CreatorsAdvice/comments/.../...",
      "titulo": "How to get 85% payout on Fansly (for new joiners)",
      "subreddit": "r/CreatorsAdvice",
      "is_boost": false,
      "boost_keyword": null,
      "age_hours": 6.1,
      "op_brief": null
    }
  ],
  "discovery_summary": {
    "subs_consulted": ["r/CamGirlProblems", "r/CreatorsAdvice", "r/SexWorkerSupport"],
    "subs_failed": [],
    "candidates_total_pre_filter": 75,
    "candidates_after_filter": 22,
    "boost_count": 3,
    "auto_selected": 5
  }
}
```

`op_brief` siempre `null` en este flujo: para títulos ambiguos `social-comment-helper` aplica **ángulo prudente** automático (ver su documentación), no pide brief al operador.

Caso fetch falla totalmente:

```json
{
  "status": "fetch_failed",
  "error": "All subs returned non-200 or fetch was blocked. Possible causes: reddit.com allowlist not active in Cowork, User-Agent blocked by Reddit, or domain change in feed URL.",
  "fallback_instruction": "Ejecuta el script local ./sharemechat-v1/ops/scripts/social-thread-finder.ps1 desde PowerShell, pega el stdout markdown en una nueva sesion Cowork con modo: thread_comment y threads_elegidos: <lista parseada de tu eleccion> para forzar el flujo legacy de ADR-039.",
  "subs_failed": ["r/CreatorsAdvice", "r/CamGirlProblems", "r/Fansly_Advice"],
  "fetch_errors": ["403 Forbidden on r/CreatorsAdvice", "timeout on r/CamGirlProblems", "..."]
}
```

Caso todos los candidatos descartados:

```json
{
  "status": "no_candidates",
  "reason": "All threads after fetch were filtered out (sensitive titles, ambiguous, or age beyond limit).",
  "subs_consulted": ["r/CreatorsAdvice", "r/CamGirlProblems"],
  "candidates_total_pre_filter": 50,
  "candidates_after_filter": 0,
  "suggestion": "Wait 30-60 min and retry, or override subs with subs_candidatos in the contract."
}
```

En cualquier caso `status != "ok"`, el orchestrator NO continúa con `social-comment-helper`. Emite el mensaje al operador y termina la sesión.

## Fallback al script local

Si Cowork no puede fetch reddit (allowlist desactivada accidentalmente, User-Agent bloqueado, dominio cambiado), el operador puede recuperar el flujo de ADR-039 manualmente:

1. Ejecutar en PowerShell local:
   ```
   powershell -NoProfile -File ./sharemechat-v1/ops/scripts/social-thread-finder.ps1
   ```
2. El script aplica los mismos filtros + boost que esta skill, devuelve markdown con candidatos numerados por sub.
3. El operador elige threads con la sintaxis `"voy con r/X #N"` y los pasa al orchestrator en `threads_elegidos`.

El script `.ps1` se mantiene en `ops/scripts/` **sin cambios**. Sigue siendo funcional y compatible.

## Lo que NO hace
- No genera borradores de comentario (eso es `social-comment-helper`).
- No publica nada.
- No toca el ledger `social-state.json`.
- No fetchea el cuerpo de cada thread (para títulos ambiguos, el comment-helper aplica ángulo prudente, no pide brief).
- No interpreta las reglas del subreddit (eso es responsabilidad de `social-platform-rules`).
- No pausa al operador. La selección es automática con heurística documentada.

## Reglas de oro
- El User-Agent declarado (`SharemeChat:warmup-finder:v2 (by /u/sharemechat)`) es obligatorio. Reddit penaliza fetches con UA genérico.
- Sleep de 15s entre fetches de subs distintos. No bajar sin validación empírica.
- La heurística de auto-selección es la fuente de verdad de "qué thread vale la pena comentar". Si la heurística necesita ajustarse, editar este documento y testear; no improvisar en runtime.
- Si el status no es `"ok"`, mostrar el JSON estructurado al operador tal cual, sin paráfrasis. El operador necesita ver el motivo técnico para decidir si reintenta, hace override de subs o cae al fallback `.ps1`.
