# Motor 2 — consistencia del repo (ADR-061 "Facts as Code")

Detector de **podredumbre repo-wide**. Vigila lo que NO se puede generar (prosa:
docs, ADRs, KB, READMEs) y hace **fallar el CI** ante incoherencias nuevas, para
que la deriva no se acumule en silencio. No reescribe nada: solo detecta.

Es el primero de los dos motores del ADR-061. El Motor 1 (hechos generados desde
una fuente única) es complementario; este da **cobertura de todo el repo desde el
día 1** sin trabajo por dominio.

## Qué comprueba

| Check | Qué caza |
|---|---|
| A | Enlaces markdown internos rotos (`[texto](ruta)` cuyo destino no existe). |
| B | Referencias a rutas del repo inexistentes (`` `ruta/con/extension` `` en backticks). |
| C | Patrones caducados fuera de `_archive/` (lista curada en `stale-patterns.txt`). |
| D | Integridad de ADRs (referencia `ADR-NNN` sin fichero; números duplicados). |

Se excluyen del escaneo `_archive/`, `_audit/` y `_deprecated/` (historia congelada
por diseño), además de `node_modules`, `target`, `build`, etc.

## El ratchet de baseline (clave)

`baseline.txt` congela los hallazgos **preexistentes** el día que se introdujo el
motor. El CI **solo falla ante hallazgos NUEVOS**: la deuda vieja no bloquea a
nadie, pero **no se puede crear más**. El baseline solo debe **menguar** (cuando
se arregla deuda vieja, desaparece de él); nunca se añaden entradas a mano.

## Uso

```bash
python3 sharemechat-v1/ops/repo-consistency/check.py        # verifica; exit 1 si hay algo nuevo
python3 sharemechat-v1/ops/repo-consistency/check.py --all  # lista TODO (incl. baselined)
python3 sharemechat-v1/ops/repo-consistency/check.py --write-baseline  # recongela (solo al reducir deuda)
```

Corre en CI como job `docs-consistency` (`.github/workflows/ci.yml`), en cada
push/PR. Sin dependencias externas (stdlib de Python).

## Añadir un patrón caducado

Cuando se retira un esquema de negocio (p. ej. una tarifa antigua), añade su firma
**inequívoca** a `stale-patterns.txt` (regex, alta especificidad — nada de tokens
que salgan legítimamente en otros contextos). A partir de ahí, cualquier copia
nueva fuera de `_archive/` bloquea el merge.

## Cuando arregles deuda vieja

Corrige el enlace/ruta/patrón, y luego `--write-baseline` para que el baseline
mengüe. Revisa el diff del baseline en el PR: solo deberían **desaparecer** líneas.
