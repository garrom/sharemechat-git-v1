# SEED — Motor de captación orgánica de CLIENTES

> Único fichero legible-humano de `docs/brainstorming/`. El resto del estado
> (`state/`, `cycles/`, `sources/`, `experiments/`, `requests/`) está en formato
> máquina (JSON/JSONL compacto) optimizado para escritura y búsqueda, no lectura.

## Objetivo

Descubrir y refinar **en bucle** canales y tácticas **orgánicos** (~0€) para
atraer **CLIENTES** que pagan por videochat 1-a-1 con modelos verificadas a
sharemechat.com. Foco **exclusivo en clientes**, no en reclutar modelos.

Distinción con el plan existente `docs/07-roadmap/plan-captacion-trafico-2026-q3.md`:
ese plan es **model-céntrico** (las modelos traen su audiencia). SEED explora el
espacio complementario: **captación DIRECTA de clientes**, que ese plan apenas toca.

## Verdad de diseño (anti-autoengaño)

Un bucle que solo razona converge en planes que "suenan bien". Por eso la salida
NO es "el plan ganador", es un **portafolio rankeado de hipótesis**, cada una con
un **test falsable** listo para lanzar. La probabilidad real SOLO sube cuando un
experimento devuelve datos. Nunca se escribe "alta probabilidad" desde razonamiento.

## Frontera de ejecución (innegociable)

El motor **solo planifica y prepara**. Cualquier acción externa (publicar,
contactar, gastar, crear cuentas, tocar código) se convierte en una **request**
para Alain en `requests/human-queue.jsonl`. El motor nunca la ejecuta.

## Reglas del bucle (resumen)

- Cada invocación corre hasta 6 ciclos y para (o antes por meseta/bloqueo).
- Cada ciclo: cargar estado → ingerir input → crítica adversaria → grounding web →
  generar/mutar → re-scorear → decidir (promote/kill/park/request) → escribir deltas.
- Mata sin piedad lo wishful, redundante o que viole restricciones (registra motivo `kr`).

## Esquema de scores (por hipótesis)

Todos 0–5 salvo `conf` (0.0–1.0). Direcciones:

| clave | significado | mejor |
|---|---|---|
| reach | alcance potencial | alto |
| conv | probabilidad de conversión a cliente pagador | alto |
| eff | esfuerzo del operador | **bajo** |
| ban | riesgo de ban / compliance | **bajo** (umbral duro ≤2) |
| brand | encaje de marca / posicionamiento | alto |
| conf | confianza en la hipótesis | — |

## Provenance y topes de confianza (duros)

- Cada claim clave lleva provenance: `inf` (inferencia) o `src`+id (dato con S-file).
- Solo `inf` → `conf ≤ 0.40`.
- ≥1 apoyo `src` → `conf ≤ 0.60`.
- `conf > 0.60` SOLO si un experimento con resultado real lo respalda.

## Criterio de promoción a `recommended`

TODO de: (a) ≥1 provenance `src`, (b) tiene test falsable `ft`, (c) sobrevivió la
crítica adversaria del ciclo, (d) `ban ≤ 2`. Al alcanzarlo se crea un E-file
(experimento propuesto) + una request `k:experiment` para que Alain lo apruebe/lance.

## Criterio de parada

- Batch de 6 ciclos completado, o
- meseta (top-5 no cambia en 3 ciclos → señal de EXPERIMENTAR, no seguir pensando), o
- todo lo accionable bloqueado esperando human-queue.

Estado de un vistazo en `state/run-status.json`.
