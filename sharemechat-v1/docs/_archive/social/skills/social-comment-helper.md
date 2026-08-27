---
name: social-comment-helper
description: Skill del pipeline social-ops de SharemeChat (modo thread_comment, ADR-039 + ADR-040). Recibe lista de threads elegidos y emite 2 variantes de comentario por thread (A recomendada, B alternativa). Dos sub-tipos: comment.warmup_casual (250 chars, 3 frases) para subs casuales legacy y comment.advice_substantive (1200 chars, 8-15 frases) para subs target adult-ecosystem. Consume target_audience del sub para enrutar angulo y disclosure: clients usa light, models permite explicit, both decide segun el thread. Aplica override por boost cuando el thread menciona plataforma competencia en sub con models (variante A force disclosure explicit con angulo alternativa concreta). Hot-fix code fence: cada texto de comentario envuelto en triple-backtick aislado obligatorio, auto-verify previo a emitir. Pasa por social-brand-legal-review antes de presentar. Solo se usa con threads_elegidos poblados.
---

# social-comment-helper

## Propósito
Segundo paso del sub-flujo de redacción del modo `thread_comment`. Para una lista de threads previamente elegidos por el operador, genera **2 variantes de comentario por thread** (Opción A recomendada y Opción B alternativa) en formato listo para pegar en Reddit. Output con estructura fija pensada para que el operador pueda copiar el texto exacto sin extraer nada de prosa explicativa.

## Cuándo se usa
Solo cuando el contrato del `social-orchestrator` viene con:

- `modo: "thread_comment"`, y
- `threads_elegidos` poblado (lista no vacía con `thread_url`, `titulo`, `subreddit`, `op_brief` opcional por thread).

Esto ocurre en la segunda invocación del orchestrator (la primera invoca `social-thread-finder` y termina con la pausa humana). En la práctica el operador relanza el orchestrator con los threads elegidos ya en el contrato.

## Entradas
1. Lista `threads_elegidos`:

```json
[
  {
    "thread_url": "https://www.reddit.com/r/AskReddit/comments/.../...",
    "titulo": "What's something that's socially acceptable but you personally find deeply uncomfortable?",
    "subreddit": "r/AskReddit",
    "op_brief": null
  }
]
```

2. `platform_constraints` (de `social-platform-rules`): para el tipo `"comment"` la skill espera `max_chars: 250`, `max_frases: 3`, `enlace: { permitido: false }`, `flair: null`, `disclosure_required: false`, `tono: "casual"`.

3. `sharemechat-voice` (variante "comentarios en threads ajenos", vive en `docs/cms/skills/sharemechat-voice.md` sección final).

## Input batch (ADR-041)

Desde ADR-041 la skill acepta input batch: recibe **la lista completa de threads auto-elegidos** por `social-thread-finder` (hasta 6 threads) y genera 2 variantes por thread **en una sola pasada**, sin pausar para pedir brief al operador. Esto es coherente con el flujo lineal del orchestrator (1 invocación → 1 paquete final).

El input ya viene con metadata por thread (`is_boost`, `boost_keyword`, `age_hours`, `subreddit`); la skill consume esos campos para decidir sub-tipo, ángulo y disclosure.

## Heurística de título ambiguo — ángulo prudente automático (ADR-041)

En ADR-040 la heurística pausaba para pedir `op_brief` al operador cuando el título era ambiguo. En ADR-041, con flujo sin pausa humana, la heurística cambia de comportamiento: **se mantiene la detección pero la acción es generar borrador con ángulo prudente automático**, no pausar.

Un título es ambiguo cuando cumple las tres condiciones:

- `len(titulo) < 30` caracteres, **y**
- el título **no contiene `?`** (no es una pregunta clara), **y**
- el título **no contiene ninguna keyword del oficio**: `cam`, `model`, `OF`, `OnlyFans`, `Fansly`, `platform`, `payout`, `verification`, `KYC`, `shift`, `creator`, `chargeback`, `cut`, `revenue`, `tax` (comparación case-insensitive como substring).

Si las tres condiciones se cumplen, **NO pausar**. En su lugar, aplicar ángulo prudente:

- **Vivencia genérica del oficio** sin referencia específica al thread. Ejemplos para audiencia talento: una reflexión sobre el primer mes en cualquier plataforma cam, una observación sobre comodidad sostenida en jornadas largas, una nota sobre la diferencia entre KYC up front y deferido.
- **Sin afirmaciones específicas** que requieran conocer el OP. No decir "Yo tuve exactamente ese problema" si no se sabe cuál era el problema.
- **Sin pretender entender el contexto**. Si el comentario se publicara igual con cualquier título de ese sub, está bien; si requiere contexto específico, está mal.
- **Documentar en la metadata** del output del helper que se usó ángulo prudente (`tono: "vivencia generica del oficio (titulo ambiguo)"`).

Si `op_brief` viene ya poblado en el contrato (caso fallback con `.ps1` legacy donde el operador puede pasar `op_brief` explícito), **saltarse la heurística** y proceder con la redacción usando ese brief como contexto. El flujo vigente de ADR-041 nunca pasa `op_brief` (siempre `null`), así que en uso normal este caso es solo el fallback.

Nota: la auto-selección de `social-thread-finder` ya **descarta títulos ambiguos sin keywords del oficio** como parte de su heurística. En la práctica, los threads que llegan al helper ya pasaron ese filtro; la heurística del helper es **segunda barrera** para casos límite (títulos justo en la frontera) o para el flujo fallback donde el operador pasa threads manualmente.

## Reglas de generación

Para cada thread, generar 2 variantes según el sub-tipo y el `target_audience` que entrega `social-platform-rules`.

### Sub-tipos (ADR-040)

**`comment.warmup_casual`** (subs legacy via `-SubsOverride`):
- Max **250 caracteres** por comentario, max **3 frases**.
- Tono casual, conversacional.
- Voz: `sharemechat-voice` variante "comentarios en threads ajenos (legacy)".

**`comment.advice_substantive`** (subs target de ADR-040, default):
- Max **1200 caracteres** por comentario, **8-15 frases**.
- Tono experimentado, peer-to-peer, anclado en experiencia operativa.
- Voz: `sharemechat-voice` variante "comentarios para audiencia clients" o "comentarios para audiencia talento" según `target_audience`.

### Tono y forma transversales (ambos sub-tipos)
- Sin links en el cuerpo (regla dura, ver `social-brand-legal-review`).
- Sin CTA.
- Sin hashtags (Reddit no los usa).
- Sin emojis.
- Sin signos de exclamación (salvo en cita textual de un tercero).
- Primera persona singular (`I`, `my`), no `we`, no `our`.
- Sin filler transitions (`furthermore`, `in addition`, `moreover`). Reddit los detecta como tono LinkedIn.
- Sin promesas de respuesta universal (`we all do this`, `everyone does X`).

### Selección de ángulo y disclosure según `target_audience`

| `target_audience` | Ángulo | Disclosure defecto |
|---|---|---|
| `["clients"]` | Experiencia de servicio (privacidad, pay-per-minute, sin suscripción, modelos verificadas) | `light` siempre |
| `["models"]` | Plataforma como sitio para trabajar (KYC up front, control horario, base EU, payments) | `light` por defecto; `explicit` si el thread pregunta plataformas o tiene boost |
| `["clients", "models"]` o `["both"]` | Ángulo del thread (helper decide por thread) | Ángulo manda; defecto `light` |

### Override por boost (thread con BoostKeyword)

Si el thread tiene `is_boost: true` (el script `social-thread-finder.ps1` lo marca cuando el título menciona `coomeet`, `luckycrush`, `chaturbate`, `stripchat`, `bongacams`, `myfreecams`, `jerkmate`, `camsoda`, `flirt4free`) Y el sub incluye `models` en `target_audience`:

- **Variante A**: ángulo "alternativa concreta a {plataforma}", disclosure **explicit** (declarar fundador permitido en apertura). Honesto sobre lo que SharemeChat ofrece distinto, sin denigrar competencia.
- **Variante B**: ángulo "experiencia operativa lateral" (no centrada en la comparación), disclosure **light**. Contrapunto que no obliga al lector a comparar.

### Ángulos por sub target (subs de ADR-040)

- `r/CreatorsAdvice` (`both`): valor sobre el oficio (setup, iluminación, comodidad sostenida, on-camera presence). Disclosure light defecto; explicit solo si el thread invita.
- `r/SexWorkerSupport` (`models`): bienestar profesional (jornada larga, mental health). Disclosure light primer mes operativo.
- `r/CamGirlProblems` (`models`): operativa + alternativas a plataformas competencia. Disclosure explicit cuando boost; light en threads no-boost.
- `r/Fansly_Advice` (`models`): operativa creator (taxes, content, mental health). Disclosure light primeros 30 días.

### Ángulos por sub legacy (sub-tipo `comment.warmup_casual`)

Cuando el operador pasa subs legacy via `-SubsOverride`:
- `r/AskReddit`: opinión personal con vivencia corta o postura razonada.
- `r/CasualConversation`: anécdota cálida, reflexión sosegada, microhistoria con sentimiento.
- `r/Showerthoughts`: nostalgia, observación lateral, ángulo inesperado.
- Otros casuales ad-hoc: ángulo del sub más parecido, o casual neutro.

### Variantes A vs B
- **A** es la "recomendada": el ángulo que la skill considera que pega más con el sub, la voz y el contexto. Marcada en el output como `Opción A — recomendada`.
- **B** es alternativa: ángulo disjunto de A. No la misma idea reescrita: si A es anécdota personal, B es observación lateral; si A es opinión razonada, B es vivencia concreta; si A es boost explicit, B es light sin comparación directa. Marcada como `Opción B — alternativa`.
- Si la skill no tiene opinión clara (ambos ángulos son igual de fuertes), marcar A y B sin recomendación: `Opción A` y `Opción B` sin sufijo. Mejor no recomendar que recomendar al azar.

## Pasada por `social-brand-legal-review`

Antes de presentar al operador, cada variante pasa por `social-brand-legal-review` en su modo **"comentario en thread ajeno"** con el sub-modo de disclosure seleccionado (`disclosure.light` o `disclosure.explicit`):

- Reglas duras preservadas: 18+, menores, sin links en cuerpo, sin CTA, sin claims falsos, sin denigrar competencia, ToS de Reddit.
- Reglas relajadas según sub-modo: ver `social-brand-legal-review.md` sección "Sub-modos de disclosure".

Regeneración:
- Si la review bloquea una variante, **regenerar UNA vez** esa variante con un ángulo distinto.
- Si la regeneración también se bloquea (= 2 bloqueos seguidos en la misma posición A o B del mismo thread), **NO regenerar más**: presentar lo que pasó la review y avisar al operador en la justificación del bloque colapsable que esa posición se quedó vacía con el motivo del bloqueo.

## Output al operador (formato fijo del párrafo 3.B aprobado)

Markdown estricto. El operador pega esto en la sesión Cowork y debe poder copiar el texto exacto de cada variante con un Cmd+A dentro del code fence sin pillarse nada de alrededor.

### REGLA DURA del code fence (HOT-FIX 2026-06-18, ADR-040)

Cada texto de comentario generado por la skill DEBE estar envuelto en un code fence triple-backtick **aislado**. Es la única forma de que el operador seleccione todo el comentario de golpe sin atrapar metadata ni etiquetas circundantes. La regla literal de implementación es:

Por cada variante, emitir exactamente esta secuencia:

1. Línea "Opción A — recomendada" o "Opción B — alternativa" (o sin sufijo si no hay recomendación clara).
2. Línea en blanco.
3. Triple-backtick aislado en su propia línea.
4. Línea(s) con el texto generado de la IA (el comentario completo). Puede ser una sola línea o multilínea; el contenido va literal, sin marcas internas.
5. Triple-backtick aislado en su propia línea.
6. Línea en blanco.
7. Línea con metadata en INLINE CODE de un solo backtick: `` `chars: X / Y · N frases · tono: ... · sin marca · sin links` ``. El valor de Y depende del sub-tipo (250 para `comment.warmup_casual`, 1200 para `comment.advice_substantive`).

### Auto-verificación obligatoria antes de emitir

Antes de devolver el output, la skill DEBE auto-verificar:

- Cada variante tiene **exactamente 2 ocurrencias de triple-backtick** en líneas propias (apertura y cierre del code fence).
- Ninguna línea del texto del comentario contiene triple-backtick (rompe el fence).
- La metadata va en inline code (un solo backtick a cada lado), NO en triple-backtick.

Si el auto-check falla, regenerar el output con la estructura correcta antes de devolver. Output con code fence mal formado es **inválido** y rompe la usabilidad del operador.

### Estructura literal completa

Los caracteres invisibles `​` (zero-width space, U+200B) antes y después de las triple-backticks de las variantes en este documento son **caracteres de escape para que el markdown del documento no se rompa**; en el output real son triple-backticks limpios sin nada delante.

```
**Borradores listos. Comentarios en N threads.**
Para cada uno tienes la URL, el bloque a copiar y un check-mark al final.
Si una variante no convence, dime cuál y la rehacemos sin tocar el resto.

---

## Thread 1 — [subreddit]

**POSTEAR EN →** [thread_url]

**Thread original**: "[titulo]"

---

### Opción A — recomendada

​```
[texto literal del comentario, una sola línea o multilínea según necesidad]
​```

`chars: X / Y · N frases · tono: [descripción corta] · sin marca · sin links`

---

### Opción B — alternativa

​```
[texto literal del comentario]
​```

`chars: X / Y · N frases · tono: [descripción corta] · sin marca · sin links`

---

## Thread 2 — [subreddit]

...

---

## Checklist humano (sólo lo que haces TÚ)

- [ ] Abrir el thread de [subreddit thread 1] → pegar Opción A (o B) → publicar.
- [ ] Abrir el thread de [subreddit thread 2] → pegar Opción A (o B) → publicar.
- [ ] Cuando termines, decirme aquí: "publicado A en thread 1, B en thread 2" (o lo que sea) — me encargo de actualizar `social-state.json` en el repo.

---

<details>
<summary>Notas Cowork (justificación de variantes, no necesitas leerlo para publicar)</summary>

- Thread 1: [por qué A vs B, qué tono pega en este sub, cualquier consideración].
- Thread 2: [idem].
- Voz: variante de sharemechat-voice aplicada según `target_audience` del sub.
- Disclosure: light o explicit por variante, según `target_audience` + boost del thread.
- Bloqueos del review (si los hubo): [descripción literal del motivo de bloqueo de variantes que quedaron sin redactar].

</details>
```

### Ejemplo completo literal (sin placeholders)

Así debe verse el output real de una variante (sub-tipo `comment.warmup_casual`, subs casuales legacy). Los caracteres invisibles `​` se reemplazan por nada en el output real:

```
### Opción A — recomendada

​```
My parents made me sit at the table until I cleaned my plate, every meal. It was framed as discipline, but it just taught me to override the signals telling me I was full.
​```

`chars: 196 / 250 · 3 frases · tono: vivencia concreta · sin marca · sin links`
```

Para sub-tipo `comment.advice_substantive` (subs target de ADR-040), la metadata reporta `Y = 1200` y la `N frases` está en rango 8-15:

```
### Opción A — recomendada

​```
On the platform side at SharemeChat I run, what we see consistently is that creators new to 1-a-1 underestimate how much the camera placement affects perceived presence. [... texto extenso ...]
​```

`chars: 847 / 1200 · 11 frases · tono: experimentado peer-to-peer · disclosure: light · sin links`
```

En modo boost (variante A con disclosure.explicit y ángulo "alternativa concreta"), la metadata incluye el marcador `disclosure: explicit · boost: [plataforma]`:

```
### Opción A — recomendada

​```
I run SharemeChat, a 1-a-1 cam platform based in EU. After watching the Coomeet model verification flow break payouts for friends last year, what we did differently is [... texto ...]
​```

`chars: 612 / 1200 · 9 frases · tono: alternativa concreta · disclosure: explicit · boost: coomeet · sin links`
```

## Reglas de oro
- El **texto a postear vive SOLO dentro del code fence triple-backtick**. Nada más. Sin comentarios inline.
- Una variante por bloque code fence. NUNCA poner A y B en el mismo bloque.
- **Auto-verify obligatorio antes de emitir**: cada variante debe tener exactamente 2 triple-backticks en líneas propias. Si el auto-check falla, regenerar antes de devolver. Output mal formado es inválido (regla introducida en ADR-040 hot-fix).
- Metadata bajo cada code fence en `inline code` (con backticks simples), tipográficamente menor.
- Checklist humano solo con acciones del operador en la plataforma externa. La parte de ledger es responsabilidad del orchestrator + packager, no entra aquí.
- Justificación dentro de bloque colapsable al final (`<details>` markdown en el cuerpo de la salida; la restricción de no usar tags XML aplica al frontmatter, no al cuerpo). Si no hay nada que justificar (A y B son equivalentes y la review no bloqueó nada), el bloque colapsable puede tener una nota breve: "Sin observaciones específicas".

## Salida al packager

Además del markdown que se presenta al operador, devolver al `social-packager` la lista estructurada de variantes con metadatos de ADR-040 (sub-tipo, target_audience, is_boost, disclosure_used):

```json
{
  "platform": "reddit",
  "modo": "thread_comment",
  "threads": [
    {
      "thread_url": "...",
      "subreddit": "r/CamGirlProblems",
      "sub_tipo": "comment.advice_substantive",
      "target_audience": ["models"],
      "is_boost": true,
      "boost_keyword": "coomeet",
      "variantes": [
        { "label": "A", "recomendada": true,  "texto": "...", "chars": 612, "frases": 9,  "tono": "alternativa concreta",       "disclosure_used": "explicit", "bloqueada": false },
        { "label": "B", "recomendada": false, "texto": "...", "chars": 540, "frases": 8,  "tono": "experiencia operativa lateral", "disclosure_used": "light",    "bloqueada": false }
      ]
    }
  ]
}
```

Para threads no-boost en sub `target_audience: ["clients"]` o legacy, los campos `is_boost` y `boost_keyword` van a `false` / `null` respectivamente, y `disclosure_used` toma `light` por defecto.

Esto le permite al packager construir `social_state_next` correctamente cuando el operador confirme qué variante publicó en qué thread y registrar el contexto (boost, disclosure usado) en `commented_threads`.

## Lo que NO hace
- No publica.
- No persiste el ledger.
- No traduce (modo `skip_translation: true` siempre en `thread_comment`; los subs target son anglo y redactamos directamente en EN).
- No fetchea Reddit ni el thread.
- No filtra threads (eso ya lo hizo el finder).
- No re-elige threads (eso es decisión del operador en la pausa humana).
