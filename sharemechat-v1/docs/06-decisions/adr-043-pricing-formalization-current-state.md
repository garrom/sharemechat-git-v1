# ADR-043: Formalización del estado actual del pricing (cliente / modelo / gifts)

## Estado

Aceptada.

Decisión **declarativa**: no introduce cambios de código, schema ni configuración. Cierra formalmente el estado real vigente del pricing en SharemeChat tras un ciclo previo de auditoría que confirmó, mediante cuatro verificaciones independientes (grep del repo, `git log --all -S`, `INFORMATION_SCHEMA.TABLES` en BD TEST, listado del árbol de ficheros), que artefactos referenciados en sesiones anteriores como `platform_pricing`, `PricingBrackets`, `PricingHistory`, `AdminPricingController`, `AdminPricingService`, `AdminPricingPanel.jsx` y `AdminBillingPanel.jsx` **nunca existieron en el repo**. Ver entrada de bitácora del 2026-07-02 en `docs/project-log.md` para la trazabilidad del hilo de esa alucinación y su cierre.

Esta ADR complementa (no sustituye) las decisiones previas de la línea económica: ADR-011 (catálogo `10 / 20 / 40` y umbral mínimo de recarga) y ADR-012 (BFPM / Bonus Financiado por la Plataforma en Minutos).

## Contexto

La operación económica del producto pre-launch se apoya en cuatro piezas independientes:

1. La tarifa que paga el cliente por minuto de videochat.
2. El umbral de corte que evita saldo negativo.
3. El catálogo de packs de recarga.
4. La retribución de la modelo por minuto (sistema de tiers) y el reparto de gifts.

Cada pieza tiene una fuente de verdad concreta en el repo. Durante el último ciclo de auditoría se acumuló evidencia de que había interpretaciones divergentes sobre dónde vivía cada valor (properties vs BD vs frontend), agravadas por la aparición de referencias fabricadas a tablas y clases inexistentes. El propósito de esta ADR es dejar una única página de referencia con la ruta exacta de cada valor y confirmar que **no existe** un sistema de brackets, franjas horarias, precios por país, precios por tier de modelo del cliente, ni pricing dinámico de ningún tipo.

## Problema

Antes de abrir integraciones reales de PSP (Segpay como frente inmediato) y de firmar checklist con proveedores externos, es necesario que cualquier operador o agente futuro pueda contestar sin ambigüedad:

- ¿Cuánto paga el cliente por minuto de videochat?
- ¿Cuál es el importe de cada pack de recarga?
- ¿Cuánto cobra la modelo por minuto y bajo qué unidad?
- ¿Cómo se reparte un gift entre modelo y plataforma?
- ¿Dónde vive cada uno de esos valores en el código?
- ¿Existe algún sistema de brackets / franjas / pricing dinámico?

Sin esta ADR, cada respuesta implicaba re-derivar el estado desde código, con riesgo de regresiones inducidas por documentación externa desalineada o por alucinaciones de agente sobre tablas o clases inexistentes.

## Decisión

Se formaliza el estado actual del pricing de SharemeChat con las siguientes fuentes de verdad:

### 1. Tarifa cliente por minuto de videochat

- **Valor**: `€1,00 por minuto`.
- **Fuente de verdad**: `sharemechat-v1/src/main/resources/application.properties`, propiedad `billing.rate-per-minute=1.00`.
- **Alcance**: valor plano, independiente de la modelo, del tier de la modelo, del país del cliente, de la hora del día, de la duración de sesión o de cualquier otra variable. **No existe** una tabla `platform_pricing`, ni brackets, ni pricing dinámico.

### 2. Umbral de corte del cliente

- **Valor**: `€1,00 acumulado`.
- **Fuente de verdad**: `application.properties`, propiedad `billing.cutoff-threshold-eur=1.00`.
- **Semántica**: cuando el saldo del cliente cae por debajo del umbral durante una sesión activa, la sesión se cierra automáticamente para evitar saldo negativo.

### 3. Catálogo de packs de recarga

- **Valor**: tres packs cerrados en EUR con bonus BFPM:
  - **P10**: 10 EUR → 10 minutos servidos (sin bonus).
  - **P20**: 20 EUR → 22 minutos servidos (2 minutos de bonus, marcado `recommended`).
  - **P40**: 40 EUR → 44 minutos servidos (4 minutos de bonus).
- **Fuente de verdad**: `sharemechat-v1/frontend/src/components/useAppModals.js`, constante `DEFAULT_PACKS`.
- **Alcance**: catálogo cerrado. No se acepta importe libre ni compra de minutos sueltos. La centralización a backend (BD o endpoint dinámico) queda como deuda declarada en ADR-011 y ADR-012, no bloqueante para pre-launch.

### 4. Retribución de la modelo por minuto

- **Valor**: tres tiers activos en la tabla `model_earning_tiers` (BD relacional), unidad **euros por minuto**:

| Tier   | first_minute_earning_per_min | next_minutes_earning_per_min | min_billed_minutes (ventana 30d) |
|--------|-----------------------------:|-----------------------------:|---------------------------------:|
| 5-15   | €0,05                        | €0,15                        | 0 (tier inicial)                 |
| 7-20   | €0,07                        | €0,20                        | 600                              |
| 9-40   | €0,09                        | €0,40                        | 1200                             |

- **Fuente de verdad**: tabla `model_earning_tiers`, definida en `sharemechat-v1/src/main/resources/db/migration/V1__baseline.sql` (líneas 369-378). Los nombres de columna `first_minute_earning_per_min` y `next_minutes_earning_per_min` fijan la unidad: **por minuto**, no por segundo.
- **Semántica**: el primer minuto de cada sesión se factura al ratio reducido de la columna `first_minute_earning_per_min`. Los minutos restantes al ratio de `next_minutes_earning_per_min`. El tier se recalcula automáticamente cada día en función de la ventana móvil de minutos facturados en los últimos 30 días.

### 5. Reparto de gifts entre modelo y plataforma

- **Valor**: 90 % modelo / 10 % plataforma.
- **Fuente de verdad**: `application.properties`, propiedad `gift.model-share=0.90`.
- **Alcance**: aplica a todos los gifts del catálogo, sin excepción por tipo, tier o país.

### 6. No existencia de sistemas alternativos

Queda declarado formalmente que **no existen y nunca han existido** en el repo:

- Una tabla `platform_pricing`, ni migration Flyway que la haya introducido y eliminado.
- Clases Java `PricingBrackets`, `PlatformPricing`, `PricingHistory`, `TranslateToBigDecimal`, `AdminPricingController`, `AdminPricingService`.
- Un componente frontend `AdminPricingPanel.jsx` ni `AdminBillingPanel.jsx`. El panel admin financiero real es `AdminFinancePanel.jsx`.
- Un sistema de brackets, franjas horarias, precios por país o pricing dinámico de ningún tipo.

Las cuatro verificaciones independientes que confirman la no existencia están registradas en la nota de bitácora del 2026-07-02.

## Consecuencias

- Cualquier operador o agente futuro que necesite responder "¿cuánto cuesta X?" tiene una sola ruta de lectura: esta ADR + los ficheros citados como fuente de verdad.
- No se introduce ningún artefacto nuevo, ningún schema, ninguna propiedad y ningún cambio de código como consecuencia directa de esta ADR.
- Cambiar cualquiera de los cinco valores exige tocar el fichero declarado como fuente de verdad para ese valor, no otro sitio. Una modificación en documentación sin cambio en la fuente de verdad **no cambia el pricing**; solo introduce drift.
- La centralización del catálogo de packs a backend sigue siendo una deuda declarada (ADR-011 §"Pendiente"), no reabierta aquí.
- Un futuro cambio de tarifa cliente, umbral o reparto de gifts se materializa como cambio en `application.properties` y, si aplica, redespliegue con validación en TEST → AUDIT → PROD. Un futuro cambio del catálogo de packs se materializa en `useAppModals.js` (+ backend cuando se centralice). Un futuro cambio de tiers de modelo se materializa como cambio de filas en `model_earning_tiers` (Flyway o edición controlada), documentado en nueva ADR si el diseño de tiers se modifica.
- Cualquier ADR futura que modifique alguno de estos valores debe referenciar explícitamente esta ADR-043 y marcar qué punto (§1..§5) reemplaza.

## Alternativas consideradas

### Extender ADR-011 con anexo del estado actual

Rechazada.

ADR-011 cerró en su momento la decisión de catálogo `10 / 20 / 40` y el estado de implementación asociado. Extenderla ahora mezclaría la decisión histórica de catálogo con la formalización global (tarifa cliente + umbral + tiers modelo + gifts). Preferimos aislar la formalización global en una ADR nueva declarativa que cite ADR-011 y ADR-012 como decisiones vigentes.

### Solo nota de bitácora, sin ADR

Rechazada.

La nota de bitácora cierra el hilo de la alucinación, pero no sirve como página estable de referencia para responder "¿cuánto cuesta X?" en el futuro. Las ADRs son el sitio donde vive la decisión declarada.

### Introducir tabla `platform_pricing` real

Rechazada en esta fase.

La centralización del catálogo de packs a BD ya está declarada como deuda en ADR-011 y ADR-012. La tarifa cliente plana (`€1/min`) y el umbral de corte no requieren una tabla dedicada mientras sigan siendo valores planos gobernados por `application.properties`. Introducir la tabla ahora sería solución en busca de problema. Si en el futuro se necesita pricing dinámico (por país, por tramo horario, por promoción) se abrirá ADR nueva que reemplace el §1 de esta ADR.

## Relación con roadmap

Esta ADR es **prerrequisito documental** para:

- Firmar checklist Segpay sin dudas internas sobre qué valores comunicar como parámetros del negocio.
- Construir la base de conocimiento del Agente IA de Soporte (`resources/knowledge-base/*.md`) sin desalinear los ficheros de cliente (§01, §02) y modelo (§03) del código real.
- Cerrar el hilo de la "regresión €0.06/segundo" que activó la sesión previa, dejando claro que **no había regresión**: la tarifa nunca cambió respecto al commit `c93201a` del 2025-08-20.

## Fuentes de verdad citadas

- `sharemechat-v1/src/main/resources/application.properties:180-182` — `billing.rate-per-minute`, `billing.cutoff-threshold-eur`, `gift.model-share`.
- `sharemechat-v1/frontend/src/components/useAppModals.js:21-25` — `DEFAULT_PACKS`.
- `sharemechat-v1/src/main/resources/db/migration/V1__baseline.sql:369-378` — schema de `model_earning_tiers`.
- Filas activas de `model_earning_tiers` en BD TEST (verificadas al cierre del hilo alucinación).

## ADRs relacionadas

- ADR-011: catálogo `10 / 20 / 40` y umbral mínimo de recarga.
- ADR-012: BFPM / Bonus Financiado por la Plataforma en Minutos (razón de los 22 y 44 minutos servidos en P20 y P40).
