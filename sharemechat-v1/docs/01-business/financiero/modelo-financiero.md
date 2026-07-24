# Modelo financiero — SharemeChat

> **Documento estratégico.** Conecta la proyección de tráfico orgánico (ver `seo/estrategia.md`) con la estructura real de costes para calcular margen neto mes a mes y horizonte de break-even.
>
> Versión 1.0 — 17 jun 2026
>
> **Decisión tomada**: Alain asume el escenario pesimista como referencia operativa y financiera. El plan sigue adelante con esta visibilidad.

## ⚠️ Aviso 2026-07-24 — Modelo DESACTUALIZADO por ADR-052; recalibración pendiente

Este modelo financiero y su xlsx companion (`modelo-financiero.xlsx`) están **desalineados con la línea económica vigente** tras la aprobación de [ADR-052](../../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) el 2026-07-24. Los supuestos que este documento usa (reparto 15-40% modelo según tier `5-15/7-20/9-40`, tarifa plana €1/min al cliente, CardBilling / Verotel al 10% + €0,30/TX) quedaron superseded en tres dimensiones simultáneamente:

- **Reparto ahora 75-79% modelo escalonado por facturación bruta rolling 30d** (T0: 75/25; T1: 77/23; T2: 78/22; T3: 79/21). Ver [ADR-052 §D1](../../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md).
- **Precio por minuto ya no es plano**: rango autoservicio 1-9 €/min según tramo. La modelo T3 puede facturar €45 en 5 min donde el modelo previo calculaba €5. El pack medio efectivo se dispara para modelos de tramos altos.
- **Fees PSP**: NOWPayments ~1% cripto (contrato cerrado, ADR-051), tarjeta ~10-15% aproximación conservadora hasta que el PSP tarjeta cierre contrato con nuevos candidatos post-Segpay.

**Impacto previsible en la proyección**:

- El **pago a modelo por transacción sube significativamente**: en el modelo previo con tier 5-15 la modelo cobraba €1,40 sobre un pack de €10 (14% del pack). Con el nuevo régimen y modelo T0 a €1/min plano, la modelo cobra 75% × €10 = €7,50 (75% del pack). El margen bruto empresa por transacción baja de ~86% a ~25%.
- El **horizonte de break-even se aleja significativamente** respecto al modelo previo (margen unitario delgado); [ADR-052](../../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) asume esta consecuencia como coste del reclutamiento agresivo.
- La **sensibilidad principal del negocio se traslada** del %reparto (que queda fijo estructuralmente) al **mix cripto/tarjeta** y al **volumen** (para renegociar fees PSP a la baja).

**Recalibración pendiente** (registrada como deuda #D-25 en [`../../04-operations/known-debt.md`](../../04-operations/known-debt.md)):

- Este `.md` puede pre-cablearse con las nuevas fórmulas (reparto por tramo × precio por modelo × fees cripto/tarjeta) manteniendo los escenarios pesimista/normal con la nueva estructura.
- El `.xlsx` es binario y requiere manipulación manual del operador con los datos actualizados; queda diferido a una pasada del operador cuando quiera cerrar la proyección revisada.

**Uso del documento mientras la recalibración esté pendiente**: NO usar como base para decisiones estratégicas (fase de lanzamiento, activación de paid traffic, revisión mensual del tracking) hasta que el modelo se recalibre. Las cifras de horizonte break-even, coste personal y pack medio siguen siendo válidas como estimación conservadora del caso previo, no del caso actual. El caso actual es probablemente **peor en margen unitario** y **más dependiente del volumen** de lo que este documento describe.

Referencia comercial vigente para decisiones intermedias: [`../unit-economics.md`](../unit-economics.md) (recalibrado por ADR-052 con márgenes netos por método de pago).

---

## 1. Resumen ejecutivo

El modelo cruza los volúmenes proyectados de tráfico (sesiones GA4 → signups → verificaciones → primeras compras → repeats) con la estructura de costes real:

- **Costes fijos**: AWS (~€120/mes) + Companio (~€110/mes) + Sightengine live moderation plan Starter (~€27/mes) = **€257/mes**.
- **Costes variables**: pagos a modelos (tier 5-15 base), CardBilling / Verotel (10% + €0.30), Didit verificación, demo gratis absorbida.
- **Sin capital inicial**: cada mes en pérdida se cubre con nómina externa de Alain (no hay runway tradicional).

### Resultados a 19 meses (jun 2026 → dic 2027)

| Métrica | Pesimista (referencia) | Normal |
|---|---|---|
| Revenue acumulado | ~€500 | ~€7.000 |
| Margen neto acumulado | **−€4.698** | **+€25** (equilibrio) |
| Gasto personal medio | **€247/mes** | **€1/mes** promedio |
| Break-even mensual | No alcanzado en 19m | Mes 15-16 |

### Decisión

Alain asume el escenario pesimista como realista y se compromete a sostener ~€247/mes de gasto personal durante el horizonte de 18-24 meses si el SEO no acelera más de lo proyectado.

---

## 2. Estructura del modelo

El cálculo mensual sigue esta cadena:

```
Sesiones GA4
  → Signups (×1% pesimista / ×3% normal)
    → Verificados KYC (×30% / ×50%)
      → Primeras compras (×10% / ×18%)
        → Repeats acumulados (LTV factor)
          → Transacciones totales del mes (primeras + repeats)
            → Revenue bruto = TX × pack medio
            → Costes variables:
               - Pago a modelo: TX × €1.40 (tier 5-15)
               - CardBilling / Verotel: TX × (precio × 10% + €0.30)
               - Chargebacks: TX × 1% × €25
               - Didit clientes: verificados × €0.13
               - Demo gratis absorbida: signups × €0.30
            → Margen bruto = Revenue − Variables
            → Margen neto = Margen bruto − €257 fijos
```

El Excel companion (`modelo-financiero.xlsx`) contiene el desglose completo mes a mes en dos pestañas (Pesimista, Normal) más una pestaña de supuestos transparentes.

---

## 3. Supuestos clave (resumen — detalle completo en el Excel)

### Costes fijos
- AWS: €120/mes (aproximado, varía por uso de entornos TEST/AUDIT/PROD).
- Companio: €110/mes (confirmado).
- Sightengine live moderation: €27/mes (plan Starter $29, en horizonte 19m las ops incluidas (10.000/mes) cubren toda la moderación sin overage).
- Otros gastos (dominio, SaaS, herramientas): excluidos por decisión operativa.
- **TOTAL FIJOS: €257/mes**.

### Costes variables
- Pack medio asumido: €10 pesimista / €12 normal.
- Modelo en tier 5-15 (€0.05 primer min + €0.15 siguientes = €1.40/pack a la modelo).
- CardBilling / Verotel: 10% + €0.30/TX + 1% chargebacks × €25. Valores estándar del sector adulto (a confirmar con contrato CardBilling / Verotel).
- Didit cliente: €0.13 ponderado (95% Age Estimation directa + 5% fallback documental).
- Didit modelo: €0 efectivo (500 gratis/mes cubren el horizonte de 18m con flujo de ~5 modelos nuevas/mes).
- Demo gratis: €0.30/signup absorbido (~9 min máx primer día × tarifa modelo ponderada).

### Funnel SEO (del documento de estrategia)
- Conversion sesión→signup: 1% pesimista / 3% normal.
- Conversion signup→verificado: 30% / 50%.
- Conversion verificado→1ª compra: 10% / 18%.
- LTV en 12m: 1.2 compras pesimista / 2.5 compras normal.

### Lo que NO está modelado
- Paid traffic (TrafficJunky, ExoClick) — si se incorpora, suma €200-500/mes pero acelera curva.
- PR sector (XBIZ, YNOT, AVN) — coste tiempo principalmente, sin impacto monetario directo.
- Programa affiliates / partnerships con modelos.
- Crecimiento exponencial de modelos (se asume flujo constante de 5/mes).

---

## 4. Hallazgos y conclusiones

### Por qué el pesimista cuesta exactamente los costes fijos

Los **costes fijos (€257/mes) dominan** el modelo durante toda la fase Coming Soon y Soft Launch (mes 0-9), porque el revenue es minúsculo (€0-15/mes). Los costes variables son proporcionales al volumen y, con volumen casi cero, son despreciables. Por eso el coste personal de Alain en pesimista es prácticamente igual a los costes fijos: **AWS, Companio y Sightengine mandan**.

**Implicación**: cualquier negociación a la baja en AWS (consolidar entornos, reducir instancias en idle), Companio (cambiar a una alternativa más barata) o Sightengine (mantenerse en Starter el máximo tiempo posible, no saltar a Pro hasta que compense) impacta directo en el horizonte de break-even. **€20/mes ahorrados = €380 menos en 19 meses de bolsillo**.

### El gap entre escenarios es enorme

Pesimista −€4.698 vs Normal +€25 = diferencia de **~€4.700 acumulados a 19 meses**. La diferencia se debe principalmente a:

1. **3x más sesiones** en normal (mejor SEO).
2. **Ticket medio €12 vs €10** en normal (clientes eligen packs más altos cuando confían en el producto).
3. **Conversion rates mejores** en cada paso del funnel (3% vs 1% sesión→signup; 50% vs 30% signup→verificado; 18% vs 10% verificado→compra).

Eso significa que **mover la curva del pesimista al normal vale €4.700 acumulados**. Cualquier inversión que mueva consistentemente la curva (paid traffic dirigido, mejoras de conversión en el funnel KYC, ticket medio más alto) puede tener ROI alto si cuesta menos que eso en el mismo horizonte.

**Nota importante**: el normal queda en equilibrio (+€25) a 19 meses. Eso es muy ajustado, no es un colchón. Cualquier desviación negativa lo lleva a pérdida. Por tanto el escenario normal no es "rentable" en 19 meses — es "no costoso".

### El break-even ESTABLE llega tarde

En el escenario normal, el break-even mensual (un mes con margen positivo sostenido) llega hacia el mes 15-16. Eso requiere:

- (a) Que el SEO funcione **bien** (escenario normal, no pesimista).
- (b) Que Alain pueda cubrir 12-15 meses de pérdida personal antes de equilibrio.

Si solo se cumple (a) pero no (b), el negocio se queda sin runway antes de llegar al break-even. Si se cumple (b) pero no (a), el negocio sigue costando dinero indefinidamente.

### El coste de NO lanzar

Cada mes que el soft launch se retrasa, los **€257 fijos siguen corriendo**. Sin revenue compensador. Lanzar antes (aunque sea con producto imperfecto, con pocas modelos, con feedback limitado) es financieramente mejor que esperar perfección. Calibrar este trade-off entre "no lanzar imperfecto" y "no quemar dinero esperando" será una decisión clave entre mes 4-6.

---

## 5. Triggers para revisar el modelo

Este modelo debe revisarse cuando se cumpla cualquiera de:

1. **Mes 3 (sep 2026)**: revisión obligatoria. Comparar impresiones GSC reales vs proyección pesimista. Si están más cerca del normal, mantener plan. Si están en pesimista o por debajo, evaluar palancas.
2. **Mes 6 (dic 2026)**: si las primeras compras reales están por debajo del pesimista en 3 meses consecutivos, **incorporar paid traffic** o pivotar.
3. **Cuando se confirmen fees CardBilling / Verotel**: actualizar el 10% asumido con el contractual real.
4. **Cuando se decida soft launch**: actualizar fechas y rehacer proyecciones desde ese mes.
5. **Si los costes fijos cambian**: AWS reorganización, cambio de Companio, salto de Sightengine Starter → Pro (~€90/mes adicionales), etc.
6. **Cuando Sightengine cruce el umbral económico o técnico**: si las sesiones pagadas/mes superan ~250 con cadencia 15s, o si hay >10 sesiones concurrentes pico, revisar el salto a plan Pro $99/mes.
7. **Cuando se incorpore una palanca nueva**: paid traffic, PR, affiliates, partnerships. Cada palanca requiere re-modelar.

---

## 6. Próximos pasos operativos

1. **Mantener cadencia operativa actual** (blog 1/semana, social pipeline, Reddit warmup) sin alterar nada — el plan SEO se ejecuta tal como está documentado.
2. **Monitorizar el tracking mensual** (`seo/tracking-mensual.md`) cada domingo en la revisión semanal P7.
3. **Decidir fecha tentativa de soft launch** en mes 3 (sep 2026), una vez tengamos 3 meses de datos reales para calibrar tráfico real vs proyectado.
4. **Confirmar fees CardBilling / Verotel** cuando se cierre el contrato y actualizar este documento.
5. **Evaluar palanca de paid traffic adulto** en mes 6 si los KPIs siguen en pesimista o por debajo.
6. **No tocar el plan SEO** mientras los KPIs estén alineados con el escenario pesimista o mejor — es el escenario que ya hemos aceptado financieramente.

---

## 7. Referencias

- Estrategia de tráfico orgánico y proyecciones de funnel: `docs/01-business/seo/estrategia.md`
- Tracking mensual de KPIs reales vs plan: `docs/01-business/seo/tracking-mensual.md`
- Sistema de tiers y economía de modelos: `docs/01-business/sistema-tiers-modelos.md`
- Pricing del producto al cliente: `docs/01-business/pricing.md`
- Unit economics marco general: `docs/01-business/unit-economics.md`
- Estado contable y costes operativos detallados: `docs/01-business/accounting-status.md`
- Excel companion con cálculo mes a mes: `modelo-financiero.xlsx` (junto a este documento)

---

*Documento creado 17 jun 2026. Próxima revisión obligatoria: 16 sep 2026 (mes 3).*
