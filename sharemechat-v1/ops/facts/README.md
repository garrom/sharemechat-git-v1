# Motor 1 — hechos generados desde la fuente única (ADR-061)

Los **hechos** del producto (precios, tramos, modos, flags…) tienen UNA fuente de
verdad. Todo lo que los menciona en docs/KB se **genera** de ahí, no se teclea.
Este es el segundo motor de "Facts as Code"; el Motor 1 genera, el Motor 2
(`../repo-consistency`) vigila la prosa contra podredumbre.

## Cómo funciona

1. La fuente vive en `docs/_data/*.yaml` (p. ej. `pricing-tiers.yaml`). El registro
   de qué depende de qué está en `docs/_data/sources-of-truth.yaml`.
2. Los docs/KB que consumen un hecho llevan bloques marcados que el generador
   reescribe:

   ```
   <!-- BEGIN generated:pricing-tiers renderer=md-table (no editar a mano; fuente docs/_data/pricing-tiers.yaml) -->
   ...contenido generado...
   <!-- END generated:pricing-tiers -->
   ```

   No edites lo de dentro de las marcas: edita el YAML y regenera.
3. El bucle se cierra con un **test de integración** que verifica que el YAML ==
   lo que corre el sistema (para pricing: las filas vigentes de `model_pricing_tiers`).
   Así docs y sistema no pueden divergir sin que el CI lo pare.

## Uso

```bash
python3 sharemechat-v1/ops/facts/build_facts.py           # reescribe los bloques
python3 sharemechat-v1/ops/facts/build_facts.py --check   # exit 1 si algún bloque está desincronizado
```

Dependencia: PyYAML. En CI el job `facts-generation` la instala y corre `--check`.

## Cambiar un hecho (ej. pricing)

1. Edita `docs/_data/pricing-tiers.yaml`.
2. `python3 sharemechat-v1/ops/facts/build_facts.py` (regenera los bloques).
3. Si el cambio también toca el sistema, actualiza la migración correspondiente
   (y regenera el baseline IT). El test `PricingTiersSsotIntegrationTest` exige que
   coincidan.
4. Commitea YAML + docs regenerados juntos.

## Renderers disponibles

- `md-table`: tabla markdown (tramo, facturación, % modelo, % empresa, rango €/min).
- `kb-list`: lista de hechos en texto, estilo KB del bot.

Añadir un renderer = una función en `build_facts.py` y su alta en el dict `RENDERERS`.
