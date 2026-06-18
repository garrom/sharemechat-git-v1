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

### Sub-flujo `thread_comment` (ADR-039)
**Primera invocación** (sin `threads_elegidos`):
| Paso | Skill | Entrada | Salida |
|---|---|---|---|
| 1 | `social-phase-gate` | contrato + ledger | `gate_decision` |
| 2 | `social-platform-rules` | `gate_decision` (tipo `comment`) | `platform_constraints` |
| 3 | `social-thread-finder` | contrato | lista de candidatos para el operador → **pausa humana** |

**Segunda invocación** (con `threads_elegidos`):
| Paso | Skill | Entrada | Salida |
|---|---|---|---|
| 1 | `social-phase-gate` | contrato + ledger | `gate_decision` (re-evalúa ratio) |
| 2 | `social-platform-rules` | `gate_decision` (tipo `comment`) | `platform_constraints` |
| 3 | `social-comment-helper` | threads_elegidos + constraints + `sharemechat-voice` (variante "comentarios en threads ajenos") | 2 variantes por thread |
| 4 | `social-brand-legal-review` | variantes (modo comentario, reglas relajadas) | `review` |
| — | ~~`social-translate-en`~~ | **SALTADO** (`skip_translation: true` automático en este modo) | — |
| 5 | `social-packager` | todo + ledger | `plan` + `checklist_humano` (solo acciones del operador) + `social_state_next` (incrementa `aporte` del sub + entry a `commented_threads`) |

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

## Flujo: warmup Reddit con descubrimiento + comentario (modo `thread_comment`, ADR-039 + ADR-040)

Se usa para acumular `comment_karma` en `u/sharemechat` comentando en threads ajenos de subs target adult-ecosystem (definidos en [ADR-040](../06-decisions/adr-040-pivote-target-subs-social-ops.md)). NO sirve para post propio (ese es el flujo anterior) ni para publicar en `r/SharemeChat` (eso es post propio en el sub `own`).

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

### Pre-requisitos
- Repo clonado en el equipo del operador (path por defecto del script: `./sharemechat-v1/`).
- PowerShell 5.1+ disponible en el equipo.
- Cowork con permiso para ejecutar comandos PowerShell desde la sesión.

### Paso 1 — Invocar `social-thread-finder`
Cowork ejecuta:

```
powershell -NoProfile -File ./sharemechat-v1/ops/scripts/social-thread-finder.ps1
```

Captura `stdout` (markdown agrupado por sub) y `stderr` (warnings de 429, retries, etc.). Pega al operador el bloque markdown precedido del envoltorio instructivo literal:

> *"Threads candidatos descubiertos (run YYYY-MM-DDTHH:MM UTC). Para elegir, responde con sub y número: 'voy con r/AskReddit #4, r/Showerthoughts #1'. Si ninguno encaja, di 'ninguno me convence' y relanzo el descubrimiento."*

Si el script sale con exit code 1 (cero candidatos) o stderr con errores, ver "Plan B" en `social-thread-finder.md`. NO inventar candidatos.

### Paso 2 — Esperar input del operador
Cowork interpreta la respuesta en lenguaje natural con regex `r/(\w+)\s*#\s*(\d+)`:
- `"voy con r/AskReddit #4, r/Showerthoughts #1"` → 2 threads elegidos. Construir lista de objetos `{thread_url, titulo, subreddit, op_brief}` (con `op_brief: null`) y pasar al Paso 3.
- `"ninguno me convence"` → relanzar Paso 1 (recomendar esperar 10 min si es el segundo "ninguno" seguido).
- `"prueba con r/Cooking, r/Coffee"` → relanzar Paso 1 con `-SubsOverride "r/Cooking,r/Coffee"`.
- Respuesta ambigua → repreguntar con ejemplo concreto. NO inventar interpretación.

### Paso 3 — Invocar `social-comment-helper`
Cowork relanza `social-orchestrator` con el contrato actualizado (`threads_elegidos` poblado). El sub-flujo de la segunda invocación encadena: `phase-gate` → `platform-rules` (tipo `comment`) → `social-comment-helper` → `social-brand-legal-review` (reglas relajadas modo comentario) → `social-packager`. `social-translate-en` se SALTA por construcción (`skip_translation: true` automático).

`social-comment-helper` aplica la heurística de **título ambiguo**: si `len(titulo) < 40` Y el título no contiene `?`, pausa para pedir al operador 1-2 líneas del OP de ese thread antes de redactar. NO hace fetch a Reddit.

### Paso 4 — Presentar al operador
Pegar al operador el output del helper **tal cual**: estructura fija del § 3.B (URL con flecha, code fences aislados para cada variante, metadata en inline code, checklist con checkbox `[ ]`, justificación en `<details>` colapsable). NO añadir contexto inline, NO resumir las variantes en prosa antes del bloque, NO mezclar el JSON técnico del packager en el chat.

### Paso 5 — Confirmación post-publicación
El operador publica los comentarios en su navegador y vuelve al chat con una confirmación tipo `"publicado A en thread 1, B en thread 2"`. Cowork parsea la confirmación y aplica el ledger:
- Incrementa `platforms.reddit.subreddits[r/X].ratio.aporte` para cada sub donde se posteó.
- Añade entry a `platforms.reddit.subreddits[r/X].commented_threads: [{url, at}]` (campo nuevo del schema v0.2 del ledger).
- Actualiza `updated_at` global del ledger.
- Persiste el ledger en `docs/social/social-state.json` (operación del orchestrator + packager, no del operador).

## El ledger (`social-state.json`) — schema v0.3

A partir del schema v0.2 (ADR-039), cada entrada en `platforms.reddit.subreddits[]` puede tener un campo opcional `commented_threads: [{url, at}]` que registra los threads en los que se ha comentado desde el pipeline. Compatibilidad retroactiva: si el campo no existe en un sub, se trata como array vacío.

A partir del schema v0.3 (ADR-040), cada entrada añade además dos campos:

- **`rol`** (string): `"karma"` (subs casuales legacy) o `"target_brand_fit"` (subs nuevos donde la marca encaja por contexto). Sustituye el `rol: "karma"` único anterior.
- **`target_audience`** (array de strings): `["clients"]` | `["models"]` | `["clients", "models"]` o `["both"]`. Determina el ángulo de comentario y la política de disclosure que aplica el `social-comment-helper`.

Compatibilidad retroactiva: si una entrada no tiene `rol` o `target_audience`, defaults aplicables (`"karma"` y `["both"]` respectivamente). Sin migración masiva.

## Relación con el blog
Mismo patrón que el pipeline editorial (`cms-orchestrator` + agentes), reutiliza `sharemechat-voice` (con secciones específicas para cada modo, incluyendo la "comentarios en threads ajenos" añadida en ADR-039). Diferencia clave: el blog produce un artefacto que se persiste y se renderiza en el producto; social produce un plan que ejecuta un humano fuera del producto.

## Convenciones del frontmatter de las skills sociales

Las skills bajo `docs/social/skills/` usan **formato A** (frontmatter YAML) según el contrato que el script `ops/scripts/sync-skills-to-cowork.ps1` reproduce hacia Cowork:

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
head -5 docs/social/skills/<skill>.md | Select-String -Pattern '<[^>]*>|&lt;|&gt;|&amp;'
```

Si la regex devuelve algún match, la skill será rechazada por Cowork al sincronizar.

Esta regla aplica también a las skills CMS bajo `docs/cms/skills/` cuando usen formato A (frontmatter YAML). Las que usan formato B (`# Descripcion` + `# Instrucciones`) NO tienen frontmatter YAML y por tanto la restricción no aplica al campo description, pero conviene evitar tags angulares en la línea inmediatamente posterior a `# Descripcion` por consistencia.
