# ADR-061: Facts as Code — fuente única por hecho, generación en vez de copia, y puerta de drift en CI

## Estado

Propuesta (2026-08-23). Generaliza el patrón anti-drift que ya existe en dos sitios del repo y funciona: el **drift-check de despliegue** (`check-deploy-drift.ps1` + manifests `deploy-state/*.yaml` + `/api/health/version`, donde la verdad es el backend vivo y el manifest es un derivado verificado) y la **KB en git** de [ADR-060](adr-060-fuente-git-base-conocimiento-agente-ia.md). No sustituye a ninguno: los reutiliza como precedente y extiende su principio a los **hechos** del producto (precios, tiers, modos operativos, feature flags, umbrales).

## Contexto

El 2026-08-23, arreglando un fallo del Agente IA, se detectó que la KB `support-kb/payout-y-tiers.md` describe un esquema de tiers **completamente desalineado del sistema real**:

| | KB (lo que el bot cuenta) | Realidad (`model_pricing_tiers`) |
|---|---|---|
| Nº de tiers | 3 | 4 |
| Nombres | 5-15 / 7-20 / 9-40 | T1 / T2 / T3 / T4 |
| Tarifa | €0.05–0.40/min | €1–9/min |
| Umbrales | por minutos (600/1200) | por euros facturados |
| Reparto | sin claridad | 50–70% según tier |

El rastreo del origen (git log + blame) es la parte importante: el fichero KB **se escribió a mano el 2026-08-19** (commit del baseline de ADR-060) copiando de [ADR-043](adr-043-pricing-formalization-current-state.md), **un documento que en su propia cabecera se declara superseded desde el 2026-07-24** ([ADR-052](adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)). Es decir: se copió de una fuente muerta casi un mes después de morir, teniendo la fuente viva (la tabla `model_pricing_tiers`, poblada desde el 25-jul) a mano.

Ese mismo esquema caducado sigue vivo, tal cual, en varios sitios del árbol: `adr-043` (con su tabla), `docs/01-business/financiero/modelo-financiero-tablas.md` (supuesto "modelo en tier 5-15"), y está incluso fichado como deuda en `known-debt.md #19`. El repo guarda **varias copias del mismo hecho caducado**, y cuando se fabrica un artefacto nuevo copiando de la documentación en vez del código, la caducidad se propaga.

El problema no es un fichero malo. Es estructural: el repo trata el **código** como código (CI, tests, drift-check de deploy) pero trata los **hechos** como **prosa escrita a mano y duplicada en N sitios**. No hay ningún vínculo entre lo que un doc afirma y la fuente que lo define, así que nada detecta el desfase y la política de "no borro, marco como superseded y lo dejo por historia" garantiza que las copias caducadas sigan disponibles para ser copiadas.

## Problema

Que ningún artefacto derivado (docs de negocio, KB del bot, tablas financieras, ADRs) pueda **contradecir al sistema real**, y que esa garantía sea **por construcción y verificada en CI**, no por disciplina humana. En concreto: (a) una única fuente por hecho; (b) los consumidores del hecho se **generan** de esa fuente, no se teclean; (c) el CI **bloquea el merge** si un derivado y su fuente discrepan; (d) el contenido superseded no queda disponible para ser copiado por error.

## Decisión

Tratar los hechos del producto como **código generado**: **una fuente de verdad por hecho, todo lo demás se genera o se verifica contra ella, nunca se copia a mano.** Es el mismo principio que ya aceptamos para código generado (protobuf/OpenAPI), para `terraform fmt -check`, y para el drift-check de despliegue. Tres componentes.

### 1. Registro de fuentes de verdad (SSOT registry)

Un único fichero versionado `docs/_data/sources-of-truth.yaml` declara, por dominio de hecho, dónde vive la verdad y qué artefactos derivan de ella:

```yaml
pricing_tiers:
  source: db/migration → tabla model_pricing_tiers   # verdad viva
  derived:
    - support-kb/payout-y-tiers.md#tiers-block
    - docs/01-business/sistema-tiers-modelos.md#tabla
    - docs/01-business/financiero/modelo-financiero-tablas.md   # compilado entero
product_modes:
  source: config/ProductOperationalProperties.java
  derived: [ support-kb/comportamiento-agente-ia.md#modos ]
feature_flags:
  source: application.properties + config.env.example
  derived: [ support-kb/... ]
```

Convierte "qué depende de qué" en dato, no en conocimiento tribal. El job de CI itera este registro.

### 2. Generación en vez de duplicación

Los artefactos derivados se parten en dos: **prosa** (explicación, tono, ejemplos — a mano, libre) y **bloques de hechos** (generados desde la SSOT, dentro de marcas). Editar dentro de las marcas a mano queda prohibido y lo verifica el CI.

```markdown
Tu tarifa depende de tu tier. [prosa a mano...]

<!-- BEGIN generated:pricing_tiers (no editar a mano) -->
| Tier | Umbral (€/30d) | €/min | Reparto |
| T1   | 0              | 1     | 50%     |
...
<!-- END generated:pricing_tiers -->
```

Para artefactos que **son un cálculo** (el caso de `modelo-financiero-tablas.md`), el fichero entero pasa a ser un **binario compilado**: un compilador (`build-financial-model`) lo genera desde `financial-assumptions.yaml` (supuestos de negocio: sesiones, conversiones, pack medio, líneas de coste fijo, tasas de coste variable) + el pricing leído de `model_pricing_tiers`. Ninguna celda se teclea; el pago a la modelo se saca de la tabla, así que "tier 5-15 / €1.40" no puede sobrevivir. Cambiar un supuesto = 1 línea en el YAML → recompila → las 80 celdas quedan coherentes de golpe.

Analogía exacta: `financial-assumptions.yaml` + `model_pricing_tiers` son el `.java`; el compilador es `javac`; el `.md` es el `.class`; "no compila" es un error de CI.

### 3. Puerta de drift en CI (lo que lo sostiene)

Un job `content-drift` en `.github/workflows/ci.yml` que, en cada PR, **regenera** todos los bloques y compilados desde sus SSOT y **falla si difieren de lo commiteado** — igual que `gofmt -l` o el drift-check de deploy. No es un aviso: es bloqueo de merge. Dos modos de fallo:

1. **Drift**: el `.md` commiteado ≠ el regenerado (alguien tecleó una celda o cambió la fuente sin recompilar).
2. **Validación**: el compilador falla antes de generar (input ausente, tasa negativa, % que no suman, tier referenciado inexistente en la SSOT).

Complementos del mismo job:
- **Lint "no copias caducadas"**: prohíbe patrones de esquemas retirados (p. ej. `5-15/7-20/9-40`) fuera de `_archive/`.
- **Sello de frescura**: cada bloque generado lleva el hash de su fuente; el CI comprueba que coincide.

### Cambios de gobierno (aditivos a `documentation-governance.md`)

La regla del 2026-08-12 ("estado derivado, no escrito a mano") ya apuntaba aquí; le faltan tres reglas duras:

1. **Borrar, no marcar.** Lo superseded se **mueve a `_archive/`** (fuera del árbol vivo y derivable), no se deja con un cartel "superseded" y su tabla intacta. El cartel no impide el copy-paste; sacarlo del árbol, sí.
2. **Definition of Done.** Tocar una fuente de verdad (migración, properties, pricing) **obliga a regenerar los derivados en el mismo PR**; el CI lo exige.
3. **La KB del bot es un artefacto de build.** `sync-support-kb.ps1` gana un paso previo `build-support-kb` que ensambla prosa + bloques generados. El bot nunca vuelve a "saber" un número tecleado.

### Alternativas descartadas

- **Seguir marcando superseded sin borrar.** Es lo que hay hoy y es justo lo que falló: el cartel no impide que se copie.
- **Confiar en revisión humana / checklist.** No escala; el incidente ocurrió teniendo ya `known-debt #19` fichado. La garantía tiene que ser mecánica.
- **Wiki/Notion externa como fuente.** Saca la verdad de git, empeora el problema (ni PR, ni diff, ni CI).

### Fuera de alcance

- Reescribir todos los docs derivados de golpe (se hace por fases, empezando por pricing).
- Un motor de plantillas sofisticado: basta un generador pequeño por dominio (script Python/JS) que lea la SSOT y reescriba entre marcas.

## Rollout (por fases, reversible)

| Fase | Qué | Esfuerzo |
|---|---|---|
| 0 | Inventario de hechos que derivan + escribir `sources-of-truth.yaml` | ~1 día |
| 1 | Piloto **pricing/tiers**: generador desde `model_pricing_tiers` → inyecta en KB + ADR + `modelo-financiero-tablas.md`; job `content-drift` para ese dominio; mover copias viejas a `_archive/` | 2–3 días |
| 2 | Extender generador + job a modos, flags, umbrales | 2–3 días |
| 3 | Hacer el job **bloqueante** + PR template + regla "borrar-no-marcar" en governance | 1 día |

Reversible en cualquier punto: mientras el job no sea bloqueante (fase 3), es solo informativo.

## Consecuencias

Positivas:
- El desfase doc/sistema se vuelve **imposible de mergear**, no "improbable si alguien se acuerda".
- Cambiar un hecho = editar un sitio → todos los derivados coherentes al instante.
- Revisar un PR = mirar el diff de la fuente (pocas líneas), no auditar tablas recomputadas.

Coste / negativas:
- ~1 semana de trabajo repartida.
- Ciertos `.md` dejan de editarse a mano en su parte de datos (hay que aceptar el modelo "generado").
- Requiere disciplina inicial para declarar las SSOT y mover lo caducado a `_archive/`.

## Trazabilidad

- Incidente que lo motiva: KB de tiers copiada de ADR-043 (superseded) — sesión 2026-08-23.
- Precedentes que se generalizan: [ADR-060](adr-060-fuente-git-base-conocimiento-agente-ia.md) (KB en git), drift-check de deploy (`ops/scripts/check-deploy-drift.ps1`, `update-manifest-backend.ps1`, `/api/health/version`).
- Fuentes de verdad de pricing implicadas: [ADR-052](adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md), [ADR-056](adr-056-sistema-master-studio.md), tabla `model_pricing_tiers` (migraciones V39/V40).
- Deuda relacionada que este ADR resuelve de raíz: `known-debt.md #19` (nombres de tier obsoletos).
- Gobierno afectado: `docs/documentation-governance.md` (regla del 2026-08-12 sobre estado derivado).
