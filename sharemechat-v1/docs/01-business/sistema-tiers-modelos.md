# Sistema de tiers y economía de modelos — SharemeChat

> **Documento operativo.** Explica el sistema de retribución de modelos verificadas: cómo se calcula la tarifa por minuto, cómo se sube/baja de tier, cómo funciona el primer minuto gratis para el cliente, y las implicaciones económicas para la plataforma.
>
> Versión 1.0 — 17 jun 2026
>
> **Lectura clave**: el primer minuto de cada sesión es **gratis para el cliente** (lo paga la plataforma como demo), con un tope diario de minutos gratis por cliente. La modelo cobra el primer minuto a tarifa reducida; los minutos siguientes los paga el cliente a la tarifa normal del pack.

---

## 1. Resumen del sistema

SharemeChat retribuye a las modelos verificadas mediante un **sistema de tiers escalonado**, donde la tarifa por minuto sube según la actividad reciente de cada modelo. Hay **3 tiers**, cada uno con dos tarifas internas: una para el primer minuto (más baja) y otra para los minutos siguientes (más alta). Los tiers se recalculan **una vez al día** mediante un snapshot que mira los minutos facturados en los **últimos 30 días** (ventana móvil).

A nivel cliente, **el primer minuto de cada sesión es gratis** hasta un tope diario por cliente. La plataforma asume el coste de ese primer minuto pagándoselo a la modelo, para que el cliente pueda probar la conversación antes de comprometerse. A partir del segundo minuto el cliente paga la tarifa normal del pack contratado.

---

## 2. Los 3 tiers — tabla de referencia

| Tier | Min. facturados (ventana 30d) | Tarifa 1er minuto (modelo gana) | Tarifa minutos siguientes (modelo gana) |
|---|---|---|---|
| **5-15** | 0 (tier inicial) | €0.05/min | €0.15/min |
| **7-20** | ≥ 600 | €0.07/min | €0.20/min |
| **9-40** | ≥ 1.200 | €0.09/min | €0.40/min |

**Lectura del nombre del tier**: los dos números del nombre indican las dos tarifas en céntimos. Ejemplo: tier "9-40" significa "9 céntimos el primer minuto, 40 céntimos cada minuto siguiente".

---

## 3. Mecánica de progresión entre tiers

### Cómo se sube de tier

1. **Toda modelo nueva empieza en el tier 5-15**, con 0 minutos facturados.
2. Cuando los **minutos facturados en los últimos 30 días** superan el umbral siguiente, la modelo sube de tier al ejecutarse el siguiente snapshot diario:
   - Al superar **600 min** → sube al tier **7-20**.
   - Al superar **1.200 min** → sube al tier **9-40**.
3. **El paso no es inmediato durante la sesión**: el sistema ejecuta un snapshot diario que recalcula el tier de cada modelo en base a su acumulado de los últimos 30 días.

### Cómo se baja de tier

El sistema es **simétrico**. La ventana de 30 días es **móvil**: cada día que pasa, los minutos facturados hace más de 30 días "salen" de la ventana de cálculo. Si la modelo deja de trabajar y su acumulado en los últimos 30 días cae por debajo del umbral del tier actual, baja de tier en el siguiente snapshot diario.

### Implicación

El tier **se mantiene trabajando**, no se gana de forma permanente. Esto crea un incentivo continuo de actividad para las modelos que quieren conservar tarifas altas.

---

## 4. Estructura de doble tarifa dentro de cada tier

Dentro de cada tier, **el primer minuto de la sesión cobra menos que los siguientes**. Razones:

1. **El primer minuto es gratis para el cliente** (ver §5). La plataforma asume ese coste y paga a la modelo una tarifa reducida.
2. **Incentivo a sesiones largas**: si el cliente entra 30 segundos y se va, la modelo gana muy poco. Si el cliente se queda, la modelo cobra el primer minuto al tarifa baja + el resto a tarifa alta. Cuanto más larga la sesión, mayor el ingreso medio por minuto para la modelo.
3. **Filtro implícito de demanda**: el coste del primer minuto incentiva a la plataforma a no ofrecer demos infinitas, y a la modelo a captar la atención del cliente desde el primer momento.

---

## 5. Primer minuto gratis para el cliente

### Cómo funciona

- El cliente registrado **NO paga el primer minuto** de cada sesión.
- Es la **plataforma quien paga** ese primer minuto a la modelo, a la tarifa correspondiente al tier de la modelo (€0.05 / €0.07 / €0.09 según tier).
- A partir del **segundo minuto**, el cliente paga la tarifa normal según el pack contratado (~€1/min en el pack de 10€/10min).

### Tope diario por cliente

Para evitar abuso, existe un **máximo de minutos gratis al día por cliente**. Una vez superado el tope, los siguientes inicios de sesión del día ya no aplican el primer minuto gratis: el cliente paga desde el minuto 1.

**Valor actual configurado**: el código **no implementa un tope diario hard en minutos**, sino un **sistema de packs con cooldown progresivo entre packs**:

- Cada **pack** son **3 slots** con cap de **60 s/slot** (≈ 3 minutos por pack).
- **Pack 1** (slots 1-3): sin cooldown, disponible inmediatamente.
- **Pack 2** (slots 4-6): cooldown de **1 hora** desde el fin del pack anterior.
- **Pack 3** (slots 7-9): cooldown de **4 horas** desde el fin del pack anterior.
- **Pack 4 y siguientes**: cooldown de **24 horas** entre packs.

**Tope efectivo en régimen estacionario**: **~3 minutos gratis cada 24 h por cliente** (un único pack/día tras el periodo de onboarding).

**Pico durante las primeras horas de uso**: hasta **~9 minutos** acumulados (los 3 primeros packs encadenados en aproximadamente 5 horas: pack 1 + pack 2 tras 1 h + pack 3 tras 4 h adicionales).

Implementado en [`sharemechat-v1/src/main/java/com/sharemechat/service/UserTrialService.java`](../../src/main/java/com/sharemechat/service/UserTrialService.java):

- `TRIAL_MAX_SLOTS_PER_USER = 3` (línea 42)
- `TRIAL_MAX_SECONDS_PER_SESSION = 60L` (línea 26, cap contable del segundo pagado a la modelo)
- `TRIAL_HARD_CUTOFF_SECONDS = 50L` (línea 35, corte duro de comunicación con colchón frente a retrasos de ping)
- Lógica de cooldown entre packs: método `canStartTrial()` (líneas 91-163)

Las tres constantes son **hardcoded** (Java `private static final`); **no son parametrizables** por properties ni por entorno. Para modificarlas hay que tocar el código y redesplegar.

### Implicación económica

El primer minuto gratis es un **coste de adquisición** asumido por la plataforma. Cada vez que un cliente prueba sin terminar comprando, la plataforma ha pagado el primer minuto a la modelo sin ingreso compensatorio. Es el equivalente a un "demo" del producto.

Coste de un primer minuto gratis no convertido:
- Cliente conectado con modelo en tier 5-15: la plataforma paga €0.05.
- Modelo en tier 7-20: paga €0.07.
- Modelo en tier 9-40: paga €0.09.

Este coste hay que multiplicarlo por el ratio de "sesiones probadas que no continúan a minuto 2". Si la conversión del primer minuto al segundo minuto es del X%, el coste medio por demo es:

```
coste_medio_demo = tarifa_primer_minuto × (1 - tasa_conversion_min1_a_min2)
```

Métrica a monitorizar en producto: tasa de conversión "minuto 1 → minuto 2" por modelo y agregada.

---

## 6. Reparto plataforma / modelo — desglose

Asumiendo que el cliente paga aproximadamente €1/min según el pack contratado (10€/10min, 20€/22min ≈ €0.91/min, 40€/44min ≈ €0.91/min):

### Primer minuto de la sesión

| Tier | Cliente paga | Modelo gana | Plataforma absorbe |
|---|---|---|---|
| 5-15 | €0 (gratis) | €0.05 | **−€0.05** |
| 7-20 | €0 (gratis) | €0.07 | **−€0.07** |
| 9-40 | €0 (gratis) | €0.09 | **−€0.09** |

### A partir del segundo minuto

| Tier | Cliente paga | Modelo gana | Plataforma se queda (bruto) |
|---|---|---|---|
| 5-15 | €1.00 | €0.15 | **€0.85** (85%) |
| 7-20 | €1.00 | €0.20 | **€0.80** (80%) |
| 9-40 | €1.00 | €0.40 | **€0.60** (60%) |

El margen bruto de la plataforma por minuto baja del 85% al 60% según el tier de la modelo. **Una modelo en tier alto cuesta más a la plataforma**, pero es señal de que la modelo retiene clientes (los minutos facturados son altos), por lo que el volumen compensa el porcentaje menor.

### Margen NETO

El margen neto por minuto necesita descontar adicionalmente:
- Comisión de CardBilling / Verotel (fees % + fijo + chargebacks).
- Coste técnico variable (AWS por minuto streamed, infraestructura).
- Asignación de costes fijos (Companio, dominios, herramientas).

Esta deducción se hace en el modelo financiero (ver `docs/01-business/seo/estrategia.md` para proyecciones de tráfico y futuro modelo de unit economics ampliado).

---

## 7. Ejemplos de cálculo

### Ejemplo A: sesión de 1 minuto (cliente prueba y se va)

- Cliente sin tope diario alcanzado, modelo en tier 5-15.
- Cliente paga: **€0**
- Modelo gana: **€0.05**
- Plataforma absorbe: **−€0.05**

### Ejemplo B: sesión de 10 minutos en pack de €10

- Cliente paga: **€10** (paga el pack entero por adelantado, aunque solo se le cobran 9 minutos del pack porque el primero es gratis).
- Espera, matiz: el cliente paga €10 por el pack, y consume 10 minutos. El primer minuto es gratis, así que el pack "rinde" 9 minutos cobrables + 1 gratis = 10 minutos totales para el cliente.
- Modelo en tier 5-15:
  - Minuto 1: gana €0.05 (lo paga la plataforma).
  - Minutos 2-10 (9 min): gana 9 × €0.15 = **€1.35**.
  - Total modelo: **€1.40**.
- Plataforma:
  - Ingresa €10 del cliente.
  - Paga €0.05 a la modelo por el minuto gratis.
  - Paga €1.35 a la modelo por los minutos 2-10.
  - **Margen bruto plataforma**: €10 − €1.40 = **€8.60** (86% margen bruto).

### Ejemplo C: misma sesión con modelo en tier 9-40

- Cliente paga: **€10**
- Modelo:
  - Minuto 1: €0.09 (plataforma).
  - Minutos 2-10 (9 min): 9 × €0.40 = **€3.60**.
  - Total modelo: **€3.69**.
- Plataforma:
  - Ingresa €10.
  - Paga €3.69 a la modelo.
  - **Margen bruto plataforma**: €10 − €3.69 = **€6.31** (63% margen bruto).

### Ejemplo D: cliente prueba con 3 modelos distintas del tier 5-15 y no compra

- 3 primeros minutos gratis (3 sesiones distintas, todos minuto 1):
  - 3 × €0.05 = **−€0.15 de coste para la plataforma**.
- Si esto pasa con un máximo diario alto (>3), el cliente puede "tirar" la plataforma probando sin convertir.
- Por eso el tope diario por cliente existe.

---

## 8. Métricas operativas a monitorizar

Para validar que el sistema funciona económicamente, hay que vigilar:

| Métrica | Significa | Por qué importa |
|---|---|---|
| **Tasa min1→min2** | % de sesiones que pasan del minuto 1 al 2 | Si es baja, las demos cuestan mucho y no convierten. |
| **Tiempo medio de sesión** | Duración media de las sesiones que pasan del minuto 1 | A mayor duración, más margen para la plataforma. |
| **Distribución de tier** | Cuántas modelos en cada tier (5-15, 7-20, 9-40) | Indica madurez del marketplace; si todas están en 5-15 hay un problema de retención. |
| **Tope diario consumido** | % de clientes que alcanzan el tope de minutos gratis al día | Si es muy alto, el tope está mal calibrado. |
| **Modelos que suben de tier por mes** | Flujo upward | Salud del sistema de incentivos. |
| **Modelos que bajan de tier por mes** | Flujo downward | Si es alto, churn de modelos activas. |

Estas métricas no están todavía implementadas en GA4/dashboard — se deben definir cuando el producto entre en fase **Soft Launch** (ver `docs/01-business/seo/estrategia.md`).

---

## 9. Decisiones y restricciones del diseño actual

- **Tarifas en céntimos visibles en el nombre del tier**: decisión deliberada de transparencia hacia la modelo. La modelo entiende su tier sin necesitar abrir documentación.
- **3 tiers, no más**: simplifica la comprensión y reduce fricción cognitiva en las modelos. Cada tier representa un salto significativo de tarifa.
- **Umbrales de 600 y 1.200 minutos**: equivalen a aproximadamente 20 min/día durante 30 días para tier 7-20, y 40 min/día para tier 9-40. Niveles razonables para modelos activas.
- **Snapshot diario, no en tiempo real**: simplifica la arquitectura y evita "saltos" durante sesiones. La modelo ve su tier de "hoy" al inicio de su jornada.
- **Ventana móvil de 30 días**: equilibrio entre estabilidad (no se penaliza una semana mala) y dinamismo (modelos inactivas pierden tier en plazo razonable).
- **Primer minuto gratis con tope diario**: balance entre conversión (cliente prueba sin fricción) y abuso (tope evita free-riders).

---

## 10. Referencias

- Pricing del producto: `docs/01-business/pricing.md`
- Modelo de unit economics general: `docs/01-business/unit-economics.md`
- Estrategia SEO y proyecciones de tráfico: `docs/01-business/seo/estrategia.md`
- Modelo financiero (proyección mes a mes con tarifas de tier base 5-15 aplicadas al cálculo de pago a modelos): [`docs/01-business/financiero/modelo-financiero.md`](financiero/modelo-financiero.md) + Excel companion [`docs/01-business/financiero/modelo-financiero-sharemechat.xlsx`](financiero/modelo-financiero-sharemechat.xlsx).
- Implementación técnica del sistema de tiers (backend Spring Boot):
  - Catálogo de tiers: tabla `model_earning_tiers` en [`src/main/resources/db/migration/V1__baseline.sql`](../../src/main/resources/db/migration/V1__baseline.sql) (campos `name`, `min_billed_minutes`, `first_minute_earning_per_min`, `next_minutes_earning_per_min`, `active`).
  - Snapshot diario por modelo: tabla `model_tier_daily_snapshots` en la misma migración (campos `model_id`, `snapshot_date`, `window_start`, `window_end`, `billed_seconds`, `billed_minutes`, `tier_id`, `tier_name`, las dos tarifas, con UNIQUE `(model_id, snapshot_date)`).
  - Servicio de resolución y cálculo de tier: [`src/main/java/com/sharemechat/service/ModelTierService.java`](../../src/main/java/com/sharemechat/service/ModelTierService.java) (constante `WINDOW_DAYS = 30` que define la ventana móvil de 30 días).
  - Job programado del snapshot diario: [`src/main/java/com/sharemechat/jobs/ModelTierSnapshotJob.java`](../../src/main/java/com/sharemechat/jobs/ModelTierSnapshotJob.java).
- Implementación técnica del primer minuto gratis (sistema de packs y cooldown): [`src/main/java/com/sharemechat/service/UserTrialService.java`](../../src/main/java/com/sharemechat/service/UserTrialService.java) y entidad [`src/main/java/com/sharemechat/entity/UserTrialStream.java`](../../src/main/java/com/sharemechat/entity/UserTrialStream.java) (tabla `user_trial_streams`).

---

*Documento creado 17 jun 2026. Próxima revisión: cuando se replanteen los tiers, los umbrales, o el tope diario.*
