---
name: social-thread-finder
description: Skill nueva del pipeline social-ops de SharemeChat (modo thread_comment). Ejecuta el script local social-thread-finder.ps1, captura su stdout (markdown con candidatos a comentar agrupados por subreddit), lo presenta al operador con un envoltorio explícito de cómo elegir, parsea la respuesta del operador y devuelve la lista estructurada de threads elegidos al orchestrator. NO genera borradores, NO publica, NO toca el ledger. Solo se usa cuando el contrato del social-orchestrator viene con modo=thread_comment y threads_elegidos vacío. ADR-038 + ADR-039.
---

# social-thread-finder

## Propósito
Primer paso del sub-flujo de descubrimiento del modo `thread_comment`. Ejecuta el script local que descarga los feeds Atom de los subreddits target, presenta los candidatos al operador con instrucciones explícitas de cómo elegir, parsea la elección y devuelve al orchestrator la lista de threads que se llevarán al siguiente paso (`social-comment-helper`).

## Cuándo se usa
Solo cuando el contrato del `social-orchestrator` viene con:

- `modo: "thread_comment"`, y
- `threads_elegidos: []` (vacío o ausente, lo que significa que el operador aún no ha elegido).

Si `threads_elegidos` viene ya poblado por el operador en una segunda invocación del orchestrator, este paso se salta y se va directo a `social-comment-helper`.

NO se ejecuta en el modo `post_propio` (el flujo histórico de post propio en X / Reddit no usa descubrimiento de threads ajenos).

## Entradas
1. Contrato del orchestrator: `plataforma: "reddit"`, `modo: "thread_comment"`, `subs_candidatos` (opcional; si ausente usa los defaults del script: r/AskReddit, r/CasualConversation, r/Showerthoughts).
2. Ningún input del ledger en este paso (la decisión de qué subs leer es del operador o de los defaults del script).

## Comando exacto que ejecuta

Una sola línea desde el directorio de trabajo:

```
powershell -NoProfile -File ./sharemechat-v1/ops/scripts/social-thread-finder.ps1
```

Si el operador pasó `subs_candidatos` en el contrato, añadir `-SubsOverride "r/X,r/Y"` con la lista separada por coma. Si pasó `max_per_sub`, añadir `-MaxPerSub N`. Si el operador pidió verbose para debugging, añadir `-Verbose`.

NO añadir `-OutputJson` (no lo necesitamos en este flujo).

NO añadir `-DryRun` salvo que el operador lo pida explícitamente para inspeccionar feeds crudos.

El script aplica internamente el hot-fix de FASE 2B-1: sleep 15s entre fetches + retry on 429 con backoff de 30s. No tocar esos parámetros desde aquí.

## Captura y presentación al operador

1. Capturar el stdout del script (markdown estricto con las cabeceras `# Candidatos para comentario`, `## r/SUB` y `### N. titulo`).
2. Capturar también el stderr (warnings de 429, retries, etc.) para diagnóstico si hay problemas.
3. Si el exit code es 0 (al menos un candidato), emitir al operador en este orden literal:

```
Threads candidatos descubiertos (run YYYY-MM-DDTHH:MM UTC). Para elegir, responde con sub y número: "voy con r/AskReddit #4, r/Showerthoughts #1". Si ninguno encaja, di "ninguno me convence" y relanzo el descubrimiento.

[aquí va el bloque markdown del script, tal cual, sin reformatear]
```

Sustituir `YYYY-MM-DDTHH:MM UTC` por el timestamp UTC actual de la presentación.

4. Esperar la respuesta del operador.

## Parser de la respuesta del operador

Regex de extracción: `r/(\w+)\s*#\s*(\d+)` aplicada sobre la respuesta del operador. Captura tuplas `(subreddit, numero)`.

Mapear cada tupla al thread correspondiente del output del script (el número es el ordinal `### N` bajo la cabecera `## r/SUB`). Construir una lista de objetos:

```json
[
  {
    "thread_url": "https://www.reddit.com/r/AskReddit/comments/.../...",
    "titulo": "What's something that's socially acceptable but you personally find deeply uncomfortable?",
    "subreddit": "r/AskReddit",
    "op_brief": null
  },
  {
    "thread_url": "https://www.reddit.com/r/Showerthoughts/comments/.../...",
    "titulo": "Future generations may never know the thrill of randomly finding cash in the street.",
    "subreddit": "r/Showerthoughts",
    "op_brief": null
  }
]
```

`op_brief` siempre se inicializa a `null` en este paso; lo rellena el operador en el siguiente paso si `social-comment-helper` lo solicita por heurística de título ambiguo.

## Otros casos de respuesta del operador

- **"ninguno me convence"** o frase equivalente: no elegir nada. Volver a invocar el script (con o sin override de subs según contexto). Si es la segunda vez seguida que el operador dice "ninguno me convence", recomendar esperar 10 min antes del siguiente intento (Reddit puede estar throttle o el universo de threads hot está saturado de tema-tabú ese momento).

- **"más threads de r/X"** o **"prueba con r/Cooking, r/Coffee"** o equivalente: parsear los subs nombrados y relanzar el script con `-SubsOverride "r/Cooking,r/Coffee"`. NO mezclar con los subs por defecto salvo que el operador lo pida explícitamente.

- **Ambigüedad o respuesta no parseable**: repreguntar al operador con un ejemplo concreto del formato esperado. NO inventar interpretación.

## Plan B si el script falla

Si el script sale con **exit code 1** (cero candidatos tras filtros) o si stderr contiene errores de red, autenticación, parseo, etc.:

1. Mostrar al operador el `stderr` completo del script (warnings de 429, errores HTTP por sub, mensajes del fail mode). NO ocultar la información técnica: el operador debe entender qué pasó.
2. Sugerir esperar **10 minutos** y reintentar. Esto es típico tras un 429 persistente que el retry on 429 no resolvió en el momento. El reintento posterior con Reddit relajado suele funcionar.
3. Si el operador confirma reintentar, relanzar el script con los mismos parámetros.
4. Si el operador pide cambiar de subs ("prueba con r/Cooking"), relanzar con `-SubsOverride` ajustado.
5. Si el operador abandona la sesión, cerrar limpiamente sin invocar las siguientes skills del pipeline (no hay nada que redactar si no hay threads).

NO intentar arreglar el script desde aquí. Cualquier bug del script se documenta como issue para el operador (FASE 2B-3+).

## Salida al orchestrator

Devuelve la lista de threads elegidos en el formato JSON mostrado arriba. El orchestrator la pasa al siguiente paso (`social-comment-helper`).

Si el operador no eligió ningún thread (`"ninguno me convence"` final), devolver `threads_elegidos: []` y `aborted: true`. El orchestrator NO debe seguir con el resto del pipeline en ese caso.

## Lo que NO hace
- No genera borradores de comentario.
- No publica nada.
- No toca el ledger `social-state.json`.
- No fetchea el cuerpo de cada thread (el `op_brief` lo aporta el operador en el siguiente paso si hace falta).
- No interpreta las reglas del subreddit (eso es responsabilidad de `social-platform-rules` aguas abajo, si aplica).
- No filtra los candidatos por encima de lo que ya filtró el script (las palabras tabú, los markers admin y los autores bot están en el script; cualquier criterio adicional pasa al criterio del operador, no a esta skill).

## Reglas de oro
- Presentar siempre el envoltorio instructivo exacto antes del bloque markdown del script. Sin paráfrasis, sin "como podrás ver, hay 15 candidatos..." inline. El operador necesita el bloque limpio.
- Si la respuesta del operador es ambigua, repreguntar; no inventar.
- Si el script falla, mostrar el stderr; no sustituirlo por una explicación más bonita.
