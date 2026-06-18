---
name: social-comment-helper
description: Skill nueva del pipeline social-ops de SharemeChat (modo thread_comment). Para una lista de threads elegidos por el operador, genera 2 variantes de comentario por thread (A recomendada, B alternativa), respetando voz casual sin marca sin links max 250 chars max 3 frases, anclada en experiencia personal u observación lateral según el sub target. Pasa por social-brand-legal-review antes de presentar. Output con formato fijo del § 3.B (POSTEAR EN URL, code fences, metadata inline, checklist con checkbox, justificación en <details>). Solo se usa cuando el contrato viene con modo=thread_comment y threads_elegidos poblados. ADR-039.
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

## Heurística de título ambiguo

Antes de redactar para un thread, evaluar:

- `len(titulo) < 40` caracteres, **y**
- el título **no contiene `?`** (no es una pregunta clara).

Si ambas condiciones se cumplen, el título es ambiguo. PAUSAR la redacción de ese thread y emitir al operador:

```
El thread "[titulo]" parece ambiguo. Pégame 1-2 líneas del OP para afinar el ángulo antes de redactar. Para el resto de threads sigo adelante.
```

Continuar redactando los otros threads en paralelo. Cuando el operador pegue el contexto OP del thread ambiguo, rellenar `op_brief` y reanudar. NO hacer fetch al thread ni a Reddit: el operador es la fuente de la información.

Si `op_brief` viene ya poblado en el contrato, **saltarse la heurística** y proceder con la redacción usando ese brief como contexto.

## Reglas de generación

Para cada thread, generar 2 variantes:

1. **Tono y forma** (siempre, todos los subs):
   - Sin marca de SharemeChat.
   - Sin links (ni a sharemechat.com, ni a artículos del blog, ni a nada).
   - Sin CTA.
   - Sin disclosure (no decir "soy el fundador", "monté X", etc.).
   - Sin hashtags (Reddit no los usa).
   - Sin emojis.
   - Max **250 caracteres** por comentario (no por variante: por cada variante de comentario).
   - Max **3 frases** por comentario.
   - Tono casual, conversacional, escrito en EN nativo (los subs target son anglo).

2. **Ángulos por sub**:
   - `r/AskReddit`: opinión personal con tinte de vivencia corta o postura razonada. Engancha en lo concreto, no en abstracciones.
   - `r/CasualConversation`: anécdota cálida, reflexión sosegada, micro-historia con sentimiento.
   - `r/Showerthoughts`: nostalgia, observación lateral, ángulo inesperado que reformula la premisa del OP.
   - Cualquier otro sub que pase por `-SubsOverride`: aplicar el ángulo del sub que más se parezca, o si no encaja ninguno, casual neutro.

3. **Variantes A vs B**:
   - **A** es la "recomendada": el ángulo que la skill considera que pega más con el sub y la voz. Marcada en el output como `Opción A — recomendada`.
   - **B** es alternativa: ángulo disjunto de A (no la misma idea reescrita). Si A es anécdota personal, B es observación lateral; si A es opinión razonada, B es vivencia concreta. Marcada como `Opción B — alternativa`.
   - Si la skill no tiene opinión clara (ambos ángulos son igual de fuertes), marcar A y B sin recomendación: `Opción A` y `Opción B` sin sufijo. **Mejor no recomendar que recomendar al azar.**

4. **Voz `sharemechat-voice` variante "comentarios en threads ajenos"**:
   - Coloquial, no editorial. Lo opuesto al tono del blog.
   - Anclada en lo concreto: un objeto, un momento, una imagen. No abstracciones genéricas.
   - First-person ("I"), no "we". No corporate.
   - Sin filler transitions ("furthermore", "in addition", "moreover"). Reddit los detecta como tono LinkedIn.
   - Sin promesa de respuesta universal ("we all do this"). Habla por ti.

## Pasada por `social-brand-legal-review`

Antes de presentar al operador, cada variante pasa por `social-brand-legal-review` en su modo **"comentario en thread ajeno"** (reglas relajadas: sin disclosure required, sin claims sobre el producto, sin mención de marca; mantener las reglas duras de 18+, menores, ToS de Reddit).

- Si la review bloquea una variante, **regenerar UNA vez** esa variante con un ángulo distinto.
- Si la regeneración también se bloquea (= 2 bloqueos seguidos en la misma posición A o B del mismo thread), **NO regenerar más**: presentar lo que pasó la review y avisar al operador en la justificación de `<details>` que esa posición se quedó vacía con el motivo del bloqueo.

## Output al operador (formato fijo del § 3.B aprobado)

Markdown estricto. El operador pega esto en la sesión Cowork y debe poder copiar el texto exacto de cada variante con un Cmd+A dentro del code fence sin pillarse nada de alrededor.

Estructura literal:

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

`chars: X / 250 · N frases · tono: [descripción corta] · sin marca · sin links`

---

### Opción B — alternativa

​```
[texto literal del comentario]
​```

`chars: X / 250 · N frases · tono: [descripción corta] · sin marca · sin links`

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
- Voz: variante "comentarios en threads ajenos" de sharemechat-voice (casual, sin marca, anclada en lo concreto, primera persona, sin filler).
- Bloqueos del review (si los hubo): [descripción literal del motivo de bloqueo de variantes que quedaron sin redactar].

</details>
```

(Los caracteres `​` antes y después de las triple-backticks de las variantes son **caracteres invisibles de escape para que este markdown se vea en este documento**; en el output real son triple-backticks limpios sin nada delante.)

## Reglas de oro
- El **texto a postear vive SOLO dentro del code fence triple-backtick**. Nada más. Sin comentarios inline.
- Una variante por bloque code fence. NUNCA poner A y B en el mismo bloque.
- Metadata bajo cada code fence en `inline code` (con backticks simples), tipográficamente menor.
- Checklist humano solo con acciones del operador en la plataforma externa. La parte de ledger es responsabilidad del orchestrator + packager, no entra aquí.
- Justificación dentro de `<details>` colapsable al final. Si no hay nada que justificar (A y B son equivalentes y la review no bloqueó nada), el `<details>` puede tener una nota breve: "Sin observaciones específicas".

## Salida al packager

Además del markdown que se presenta al operador, devolver al `social-packager` la lista estructurada de variantes:

```json
{
  "platform": "reddit",
  "modo": "thread_comment",
  "threads": [
    {
      "thread_url": "...",
      "subreddit": "r/AskReddit",
      "variantes": [
        { "label": "A", "recomendada": true,  "texto": "...", "chars": 196, "frases": 3, "tono": "directo, opinión personal", "bloqueada": false },
        { "label": "B", "recomendada": false, "texto": "...", "chars": 195, "frases": 3, "tono": "cotidiano con sorna", "bloqueada": false }
      ]
    }
  ]
}
```

Esto le permite al packager construir `social_state_next` correctamente cuando el operador confirme qué variante publicó en qué thread.

## Lo que NO hace
- No publica.
- No persiste el ledger.
- No traduce (modo `skip_translation: true` siempre en `thread_comment`; los subs target son anglo y redactamos directamente en EN).
- No fetchea Reddit ni el thread.
- No filtra threads (eso ya lo hizo el finder).
- No re-elige threads (eso es decisión del operador en la pausa humana).
