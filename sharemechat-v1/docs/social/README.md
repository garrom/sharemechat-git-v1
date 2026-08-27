# Social-ops — pipeline de redes sociales (X / Reddit)

Sistema de Cowork para generar contenido y planes de publicación para X y Reddit respetando las reglas anti-baneo de cada plataforma. Es el gemelo social del pipeline editorial (`cms/`): mismo patrón de orquestador + agentes encadenados con contratos JSON, y reutiliza `sharemechat-voice`.

## Principio rector
Automatiza el pensar, no el publicar.
- **Cowork** = fábrica de contenido + compliance + plan.
- **Humano** = ejecución (publicar), conversación genuina, y persistir el ledger.
- **Motivo**: Reddit y X prohíben o limitan la automatización de acciones (votos, posteo scriptado, multicuenta); la cuenta es el activo que cuesta calentar. Por eso el sistema genera y comprueba, pero el humano postea.

## Contrato de entrada (4 campos)
| Campo | Valores |
|---|---|
| `plataforma` | `x` / `reddit` |
| `objetivo` | `calentamiento` / `aporte` / `recruit-modelos` / `promo` |
| `tema_o_angulo` | texto libre (o "reaprovecha el artículo X del blog") |
| `subreddit` | opcional, solo Reddit: el sub objetivo u `own` |

La `fase` no se introduce: la deriva el gate desde el ledger.

## Pipeline

El orchestrator despacha a dos sub-flujos según el campo `modo` del contrato. El modo `post_propio` es el flujo histórico (ADR-034); el modo `thread_comment` se añade en ADR-039 con dos invocaciones de Cowork separadas por una pausa humana.

### Sub-flujo `post_propio` (default)
| Paso | Skill | Entrada | Salida |
|---|---|---|---|
| — | `social-orchestrator` | contrato + ledger | resumen + salida del packager |
| 1 | `social-phase-gate` | contrato + ledger | `gate_decision` |
| 2 | `social-platform-rules` | `gate_decision` + sub | `platform_constraints` |
| 3 | `social-draft-writer` | gate + constraints + `sharemechat-voice` | `drafts` (ES) |
| 4 | `social-brand-legal-review` | `drafts` | `review` |
| 5 | `social-translate-en` | `review` | `drafts_en` |
| 6 | `social-packager` | todo + ledger | `plan` + `checklist_humano` + `social_state_next` |

### Sub-flujo `thread_comment` (ADR-041, vigente desde 2026-06-18)

Una sola invocación, sin pausa humana. Cowork ejecuta todas las fases en cadena y devuelve un paquete final con N comentarios (hasta 6).

| Paso | Skill | Entrada | Salida |
|---|---|---|---|
| — | (orchestrator) | lee `social-state.json` del filesystem | ledger inyectado |
| 1 | `social-phase-gate` | contrato + ledger | `gate_decision` |
| 2 | `social-platform-rules` | `gate_decision` (tipo `comment`, sub-tipo `advice_substantive` o `warmup_casual`) | `platform_constraints` |
| 3 | `social-thread-finder` | contrato + ledger | fetch RSS nativo + filtros + boost + **auto-selección** → `threads_auto_elegidos` |
| 4 | `social-comment-helper` | batch de threads + constraints + `sharemechat-voice` | 2 variantes por thread (ángulo prudente automático en títulos ambiguos) |
| 5 | `social-brand-legal-review` | variantes batch | `review` con disclosure light/explicit por variante |
| — | ~~`social-translate-en`~~ | **SALTADO** (`skip_translation: true` automático) | — |
| 6 | `social-packager` | todo + ledger | paquete final (encabezado de resumen + N bloques + checklist combinado + `social_state_next`) |

Si `social-thread-finder` devuelve `status != "ok"` (fetch falló o 0 candidatos tras filtros), el orchestrator interrumpe el pipeline y emite el JSON estructurado al operador con instrucción de fallback al `.ps1`. NO redacta sin candidatos.

### Sub-flujo `thread_comment` (ADR-039, FALLBACK)

Activación: el operador pasa `threads_elegidos` ya poblado en el contrato (porque ejecutó el `.ps1` local tras un fallo de fetch desde Cowork).

Mismo pipeline que ADR-041 pero saltándose `social-thread-finder`. El orchestrator detecta la presencia de `threads_elegidos` y va directo al `social-comment-helper`.

## El ledger (`social-state.json`)
- Vive en `docs/social/social-state.json`.
- Cowork no tiene memoria entre sesiones: el ledger se inyecta al inicio y el `social-packager` devuelve `social_state_next`.
- El humano lo guarda DESPUÉS de publicar (es la fuente de verdad de lo que se posteó) y mantiene a mano las métricas (karma, followers) y las reglas curadas de cada sub.
- Rastrea por plataforma: fase, métricas, ratio (X global, Reddit por sub) y las entradas de subreddits con su `promo_policy` y mínimos.

## Fases y umbrales
- **Reddit**: `warmup` → `building` (edad >=7d y comment_karma >=20) → `promo-allowed` (edad >=21d y karma total >=50). Ratio 10% por sub.
- **X**: `warmup` → `promo-allowed` (edad >=7d y >=5 aportes). Ratio 25% global.
- Manda siempre el criterio más estricto entre la fase global y los mínimos del sub.

## Flujo: post propio en X / Reddit (modo `post_propio`, ADR-034)

Es el flujo histórico del pipeline social. Se usa para publicar un post propio en X (`@shareme_chat`) o en Reddit (en `r/SharemeChat` u otro sub con `promo_policy: allowed`).

1. Rellena los 4 campos del contrato (el script prompt-builder arma el prompt) con `modo: "post_propio"` (default si omites el campo).
2. Abre una sesión nueva de Cowork e invoca `social-orchestrator` con el contrato + el ledger inyectado.
3. Recibes: resumen + plan + checklist humano + `social_state_next`.
4. Publicas a mano siguiendo el checklist.
5. Tras publicar, guardas `social_state_next` (ajustando si publicaste otra variante o nada) y actualizas las métricas de la cuenta.

## Flujo: warmup Reddit con descubrimiento + comentario (modo `thread_comment`, ADR-039 + ADR-040 + ADR-041)

Se usa para acumular `comment_karma` en `u/sharemechat` comentando en threads ajenos de subs target adult-ecosystem (definidos en [ADR-040](../06-decisions/adr-040-pivote-target-subs-social-ops.md)). NO sirve para post propio (ese es el flujo anterior) ni para publicar en `r/SharemeChat` (eso es post propio en el sub `own`).

### Workflow operativo vigente (ADR-041, sin pausa humana)

Cuatro pasos:

1. **Abre Cowork** en una sesión nueva.
2. **Lanza el orchestrator** con: `ejecuta social pipeline modo thread_comment en r/CamGirlProblems, r/Fansly_Advice` (o los subs que quieras del ledger).
3. **Cowork devuelve un paquete final** con hasta 6 comentarios (2 variantes por thread, max 2 threads por sub) en formato §3.B con code fences aislados.
4. **Copy-paste a Reddit** thread por thread → vuelve al chat y confirma con `publicado A en thread 1, B en thread 2, ...` → Cowork aplica `social_state_next` al ledger automáticamente.

Pre-requisitos operativos (validados en FASE 2C):

- `*.reddit.com` en allowlist de Cowork (Settings → Capacidades → Dominios permitidos adicionales).
- Carpeta del repo conectada a Cowork (para leer `docs/social/social-state.json` del filesystem).

### Fallback: script local si Cowork no puede fetch Reddit

Si Cowork devuelve `status: "fetch_failed"` (allowlist desactivada accidentalmente, User-Agent bloqueado por Reddit, dominio cambiado), el operador puede recuperar el flujo legacy ejecutando manualmente el script local:

1. Ejecutar en PowerShell local desde el root del repo:
   ```
   powershell -NoProfile -File ./sharemechat-v1/ops/scripts/social-thread-finder.ps1
   ```
2. El script aplica los mismos filtros + boost que la skill, devuelve markdown con candidatos numerados por sub y etiqueta `[BOOST]`.
3. Elegir 1-3 threads con la sintaxis `r/X #N` y pasarlos al orchestrator en `threads_elegidos` (formato JSON con `thread_url`, `titulo`, `subreddit`, `op_brief: null`).
4. El orchestrator detecta `threads_elegidos` ya poblado y aplica el sub-flujo ADR-039 saltándose `social-thread-finder` (mismo pipeline desde el comment-helper en adelante).

El script `.ps1` se mantiene en `ops/scripts/` sin cambios desde ADR-040. Sigue funcional como fallback.

### Subs target activos (ADR-040)

| Sub | `target_audience` | Sub-tipo | Disclosure defecto | Volumen aprox |
|---|---|---|---|---|
| `r/CreatorsAdvice` | `both` | `comment.advice_substantive` | `light` | medio |
| `r/SexWorkerSupport` | `models` | `comment.advice_substantive` | `light` (primer mes) | ~633 vis/sem |
| `r/CamGirlProblems` | `models` | `comment.advice_substantive` | `light` (no-boost) / `explicit` (boost) | ~226k vis/sem (PRIORITARIO) |
| `r/Fansly_Advice` | `models` | `comment.advice_substantive` | `light` (primeros 30 días) | ~22k vis/sem |

Las dos entradas legacy del ledger (`r/AskReddit`, `r/CasualConversation`) tienen `rol: "karma"` y `target_audience: ["both"]` y **solo son accesibles via `-SubsOverride` en el script** (`powershell -NoProfile -File ./sharemechat-v1/ops/scripts/social-thread-finder.ps1 -SubsOverride "r/AskReddit,r/CasualConversation"`). No se usan en flujo principal desde ADR-040; se conservan para experimentación o reactivación futura.

### Boost: oportunidades de captación de modelos (ADR-040)

El script `social-thread-finder.ps1` define `$BoostKeywords` con plataformas competencia (`coomeet`, `luckycrush`, `chaturbate`, `stripchat`, `bongacams`, `myfreecams`, `jerkmate`, `camsoda`, `flirt4free`).

Comportamiento:

1. **En el descubrimiento**: threads cuyo título matchea cualquier BoostKeyword suben al **top** de su sub en la salida markdown del script, con etiqueta visual `[BOOST]` tras el título. Esto requiere que el sub esté entre los target activos; subs legacy via override también aplican el boost.
2. **En el helper**: cuando `social-comment-helper` recibe un thread con `is_boost: true` Y el sub incluye `models` en `target_audience`, el helper FUERZA en variante A:
   - Ángulo "alternativa concreta a {plataforma}".
   - Disclosure `explicit` (declarar fundador permitido en apertura).
   - Sin denigrar la plataforma competencia. "X is a fine option for [caso]; what we did differently is..." es OK; "X sucks" no.
3. **Variante B** mantiene `disclosure.light` como contrapunto, sin centrarse en la comparación directa.

### Sub-tipos del tipo `comment` (ADR-040)

Dos sub-tipos enrutados por el sub target (no por decisión del operador):

- **`comment.warmup_casual`** (legacy): max 250 chars, max 3 frases. Voz casual. Aplicado en subs legacy via `-SubsOverride`.
- **`comment.advice_substantive`** (nuevo, default para los 4 subs target): max 1200 chars, 8-15 frases. Voz experimentado peer-to-peer con vocabulario operativo del oficio (`shift`, `payout`, `verification flow`, `KYC up front`, `platform side`).

### Política de disclosure diferenciada (ADR-040)

Dos sub-modos en `social-brand-legal-review`. Reglas duras preservadas idénticas en ambos: **18+, menores, sin links en cuerpo, sin CTA, sin claims falsos**.

- **`disclosure.light`**: una línea de contexto sobre la plataforma DENTRO del aporte, no en apertura, solo si el thread la pide. Sin URL.
- **`disclosure.explicit`**: declarar fundador permitido en apertura ("I run SharemeChat, a 1-a-1 cam platform based in EU..."). Sin URL. Sin CTA. Sin claims sobre precio o resultados.

Selección automática del sub-modo según `target_audience` del sub + `is_boost` del thread:

- `target_audience: ["clients"]` → `disclosure.light` siempre.
- `target_audience: ["models"]` + `is_boost: true` → `disclosure.explicit` (variante A) + `disclosure.light` (variante B).
- `target_audience: ["models"]` + no boost → `disclosure.light` por defecto.
- `target_audience: ["both"]` → ángulo del thread manda.

### Detalle del flujo legacy ADR-039 (sólo cuando se cae al fallback)

Si el operador acaba ejecutando el `.ps1` manualmente porque Cowork no puede fetch Reddit, el pipeline se completa así:

1. Operador ejecuta el script local y elige threads con la sintaxis `r/X #N`.
2. Construye `threads_elegidos` (lista JSON con `thread_url`, `titulo`, `subreddit`, `op_brief: null`).
3. Lanza `social-orchestrator` con el contrato + `threads_elegidos` poblado. El orchestrator detecta el escenario y aplica el sub-flujo de fallback: `phase-gate` → `platform-rules` → `comment-helper` (batch) → `brand-legal-review` → `packager`. Salta `social-thread-finder` (ya no hace falta).
4. Cowork devuelve el paquete final con el mismo formato §3.B del flujo vigente.
5. Operador copy-paste a Reddit y confirma. Cowork aplica `social_state_next` al ledger.

Pre-requisitos para el fallback:
- Repo clonado en el equipo del operador (path por defecto del script: `./sharemechat-v1/`).
- PowerShell 5.1+ disponible.

La heurística de **título ambiguo** en el helper se mantiene pero ya no pausa (ADR-041): aplica ángulo prudente automático (vivencia genérica del oficio sin referencia específica). El operador no tiene que rellenar `op_brief` manualmente salvo que quiera control granular sobre algún thread, en cuyo caso lo pasa en el `threads_elegidos`.

## El ledger (`social-state.json`) — schema v0.3

A partir del schema v0.2 (ADR-039), cada entrada en `platforms.reddit.subreddits[]` puede tener un campo opcional `commented_threads: [{url, at}]` que registra los threads en los que se ha comentado desde el pipeline. Compatibilidad retroactiva: si el campo no existe en un sub, se trata como array vacío.

A partir del schema v0.3 (ADR-040), cada entrada añade además dos campos:

- **`rol`** (string): `"karma"` (subs casuales legacy) o `"target_brand_fit"` (subs nuevos donde la marca encaja por contexto). Sustituye el `rol: "karma"` único anterior.
- **`target_audience`** (array de strings): `["clients"]` | `["models"]` | `["clients", "models"]` o `["both"]`. Determina el ángulo de comentario y la política de disclosure que aplica el `social-comment-helper`.

Compatibilidad retroactiva: si una entrada no tiene `rol` o `target_audience`, defaults aplicables (`"karma"` y `["both"]` respectivamente). Sin migración masiva.

## Relación con el blog
Mismo patrón que el pipeline editorial (`cms-orchestrator` + agentes), reutiliza `sharemechat-voice` (con secciones específicas para cada modo, incluyendo la "comentarios en threads ajenos" añadida en ADR-039). Diferencia clave: el blog produce un artefacto que se persiste y se renderiza en el producto; social produce un plan que ejecuta un humano fuera del producto.

## Convenciones del frontmatter de las skills sociales

Las skills bajo `docs/_archive/social/skills/` usan **formato A** (frontmatter YAML) según el contrato que el script `ops/scripts/sync-skills-to-cowork.ps1` reproduce hacia Cowork:

```yaml
---
name: <slug-de-la-skill>
description: <una sola línea larga, prosa pura>
---

# <Cuerpo libre con cabeceras markdown>
```

### Regla operativa de Cowork: cero tags XML/HTML en `description`

Cowork **rechaza el upload de una skill** si el campo `description` del frontmatter YAML contiene tags del tipo `<algo>`, `</algo>`, `<algo/>`. El error operativo que devuelve es:

```
SKILL.md description cannot contain XML tags
```

Esto se detectó la primera vez al subir `social-comment-helper` con la descripción "justificación en <details>" (commit `9042712`, FASE 2B-2). Se corrigió en hot-fix posterior reemplazando `<details>` por "bloque colapsable" (prosa equivalente).

Reglas concretas a aplicar al escribir el `description` del frontmatter de cualquier skill social nueva:

- NO usar tags HTML/XML del tipo `<details>`, `<summary>`, `<br>`, `<a>`, etc.
- NO usar entidades HTML del tipo `&lt;`, `&gt;`, `&amp;`.
- NO usar brackets angulares sueltos `<` o `>` (aunque no formen un tag).
- Sustituir por **prosa equivalente**: en lugar de `<details>` decir "bloque colapsable"; en lugar de `<código>` decir "code fence"; etc.
- El cuerpo de la skill (después del `---` de cierre del frontmatter) **SÍ admite tags HTML/markdown libremente**. La restricción aplica solo al frontmatter.

Antes de hacer commit de una skill nueva o modificada, ejecutar localmente:

```powershell
head -5 docs/_archive/social/skills/<skill>.md | Select-String -Pattern '<[^>]*>|&lt;|&gt;|&amp;'
```

Si la regex devuelve algún match, la skill será rechazada por Cowork al sincronizar.

Esta regla aplica también a las skills CMS bajo `docs/_archive/cms/skills/` cuando usen formato A (frontmatter YAML). Las que usan formato B (`# Descripcion` + `# Instrucciones`) NO tienen frontmatter YAML y por tanto la restricción no aplica al campo description, pero conviene evitar tags angulares en la línea inmediatamente posterior a `# Descripcion` por consistencia.

### Regla operativa de Cowork: límite duro de 1024 chars en el `description`

Cowork **rechaza el upload de una skill** si el campo `description` del frontmatter YAML supera **1024 caracteres**. El error operativo que devuelve es:

```
field 'description' in SKILL.md must be at most 1024 characters
```

Esto se detectó al subir `social-comment-helper` tras la expansión de FASE 2D-2 (descripción había crecido a 1109 chars al añadir los sub-tipos, target_audience, boost y hot-fix code fence). Se corrigió en hot-fix posterior condensando a prosa más telegráfica (895 chars).

Reglas concretas a aplicar:

- Objetivo de longitud al escribir el `description`: **<= 900 chars** para tener ~100 de margen ante futuras adiciones.
- Si la description necesita explicar muchos detalles, **condensar a lo esencial** (rol de la skill, input/output básico, ADR de referencia, prerequisitos) y mover el resto al cuerpo de la skill (sección "Propósito" o equivalente).
- Antes de commit, validar con:

```powershell
$line = (Get-Content docs/_archive/social/skills/<skill>.md -TotalCount 3)[2]
if ($line -match '^description:\s*(.*)$') { "$($matches[1].Length) chars" }
```

Si reporta >1024, la skill será rechazada por Cowork al sincronizar.

### Regla operativa de Cowork: frontmatter YAML obligatorio (formato A)

Cowork actual **exige frontmatter YAML al inicio de cada SKILL.md**. El error operativo que devuelve si falta es:

```
SKILL.md must start with YAML frontmatter (---)
```

Las skills del CMS legacy en **formato B** (sin frontmatter YAML, con secciones `# Descripcion` + `# Instrucciones`) deben **migrarse a formato A** si se van a re-subir a Cowork. La migración consiste en añadir al inicio del fichero un bloque:

```yaml
---
name: <slug-de-la-skill>
description: <prosa <= 1024 chars, sin tags HTML/XML, sin entidades>
---
```

El cuerpo de la skill (incluido el `# Descripcion` y `# Instrucciones` legacy) **se conserva íntegro** debajo del segundo `---`. El script `sync-skills-to-cowork.ps1` ya entendía ambos formatos para entrada; lo que cambió es que Cowork mismo rechaza el upload sin frontmatter, por lo que el fichero del repo también debe llevarlo.

Esto se detectó al sincronizar `sharemechat-voice` tras los commits de FASE 2D-2 (la skill estaba en formato B desde antes de la introducción del corpus social). Se corrigió añadiendo el frontmatter con `description` de 1002 chars (margen ajustado pero dentro del límite).
