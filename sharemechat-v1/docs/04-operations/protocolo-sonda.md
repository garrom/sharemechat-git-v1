# Protocolo SONDA — búsqueda / investigación profunda escalada

> **Qué es.** Un estándar reutilizable para las **búsquedas profundas** del proyecto:
> investigaciones con fan-out de agentes en paralelo, escaladas por un presupuesto
> de tiempo que el operador elige. Fija de antemano cuántos agentes, cuánta
> amplitud, cuánto rigor y qué salida, para que cada investigación sea comparable
> y no dependa de la improvisación.
>
> **Cuándo se aplica.** Cuando el operador pide "búsqueda profunda", "investigación
> profunda", "estudio a fondo" o equivalente. La regla de disparo vive en `CLAUDE.md`.
>
> Referencia de facto: la investigación [`../07-roadmap/captacion-modelos/`](../07-roadmap/captacion-modelos/) fue un SONDA N2/N3 (7 agentes A1-A7, carpeta+índice, evidencia etiquetada, "lo no verificado"). Es el patrón.

## Las 3 preguntas (verbatim)

Al pedir una búsqueda profunda, Claude hace **estas tres preguntas, en un solo mensaje, en prosa** (nunca desplegable):

> Antes de lanzar la búsqueda profunda, dime tres cosas rápidas:
>
> **1. ¿Cuánto tiempo, aproximadamente?** — vistazo (~20 min), estándar (~1 h), a fondo (~3 h) o exhaustiva (medio día+).
>
> **2. ¿Algún foco o límite?** — algún país / canal / ángulo concreto en el que centrarme, o algo que excluir. Si no, barro amplio.
>
> **3. ¿Qué quieres al final?** — solo el mapa de datos con evidencias, o además una recomendación accionable.
>
> Con eso fijo el alcance y te lo confirmo en 2 líneas antes de arrancar.

**Qué define cada respuesta:**

| Pregunta | Fija |
|---|---|
| 1 · Tiempo | El **nivel** (N1-N4) → nº de agentes, dimensiones, fuentes/dato, verificación, formato de salida. |
| 2 · Foco/límite | Qué dimensiones se priorizan o descartan (afina la amplitud). |
| 3 · Resultado | Si la salida incluye **recomendación accionable** o se queda en datos+evidencias. |

*(El **tema** exacto ya viene en el encargo del operador; no se pregunta.)*

## La tabla escalada (los parámetros por nivel)

| Parámetro | **N1 · Vistazo** ~15-20 min | **N2 · Estándar** ~1 h | **N3 · A fondo** ~3 h | **N4 · Exhaustiva** medio día+ |
|---|---|---|---|---|
| Agentes paralelos | 1-2 | 4-6 | 8-12 | 12+ en oleadas |
| Dimensiones (sub-preguntas) | 3-4 | 6-8 | 10-15 | 15+ |
| Fuentes mín. por dato clave | ≥2 | ≥2-3 | ≥3 | ≥3 |
| Fuente primaria (abrir el original) | opcional | si existe | obligatoria | obligatoria |
| Verificación | síntesis | síntesis + sanity-check | + pasada adversarial (contra-evidencia) | + revisión cruzada entre agentes |
| Salida | 1 nota | carpeta + índice | carpeta + índice + recomendación | ídem, por oleadas |

## Reglas SIEMPRE activas (todos los niveles)

- **Etiquetado de evidencia** por dato: **dato duro** (fuente verificable) / **impresión** (sin fuente sólida, no citar como hecho) / **no verificado**.
- **Sección "Lo que NO se verificó"** al cierre, explícita.
- **Fuente primaria cuando exista** (ley, informe, dato oficial, código), no solo agregadores.
- El veredicto sale de **fuentes reales**, no del reporte de un subagente tomado al pie de la letra: la síntesis contrasta.

## El flujo

1. **Preguntar** las 3 preguntas (arriba).
2. **Confirmar el alcance en 2 líneas** antes de lanzar: nivel elegido, nº de agentes, dimensiones y formato de salida. Esperar OK si el operador lo pide; si dio vía libre, arrancar.
3. **Fan-out:** lanzar los agentes en paralelo (uno por dimensión o grupo de dimensiones), **en background**. Cada agente persiste su parte incrementalmente para no perder trabajo si se interrumpe.
4. **Cierre:** un paso de **síntesis** (lee todos, cruza, resuelve contradicciones) + **sanity-check** + **"lo no verificado"**. En N3/N4, además una pasada **adversarial** que busca activamente contra-evidencia de las conclusiones.
5. **Salida** en el formato del nivel (nota o carpeta+índice), bajo `docs/` en el sitio que corresponda al tema.

## Mecanismo y autorización

- El fan-out usa el **Agent tool** (subagentes), no el Workflow tool, salvo que el operador pida explícitamente orquestación multi-agente a gran escala.
- La **petición de búsqueda profunda + la elección de nivel ES la autorización** para lanzar esos N agentes en paralelo (no hay que volver a preguntar por el fan-out).
- Más agentes en paralelo **no alargan el reloj** (corren a la vez); suben **cobertura y coste de tokens**. El "tiempo" del nivel gobierna sobre todo **cuánto cava cada agente** y la **amplitud**.

## Notas

- Los niveles son guía, no dogma: si el tema pide 5 agentes en un N2, se ajusta; la tabla fija el orden de magnitud.
- SONDA **planifica y ejecuta la investigación**; cualquier acción externa que se derive (publicar, contactar, gastar) sigue siendo una decisión aparte del operador, no parte del SONDA.
