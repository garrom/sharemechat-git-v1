# Modelo financiero — SharemeChat

> **Documento estratégico.** Conecta la proyección de tráfico orgánico (ver `seo/estrategia.md`) con la estructura real de costes para calcular margen neto mes a mes y horizonte de break-even.
>
> Versión 2.1 — 2026-08-04 (actualización tras [ADR-056 §D3](../../06-decisions/adr-056-sistema-master-studio.md) que sobrescribió los tramos y umbrales de [ADR-052](../../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)). Versión 2.0 del 2026-07-25 con reparto 75-79% queda superseded. Versión 1.0 del 17 jun 2026 con reparto 15-40% modelo archivada en git history.
>
> **Decisión tomada**: Alain asume el escenario pesimista como referencia operativa y financiera. Con el reparto vigente 50-60% (ADR-056), el escenario pesimista es menos exigente que el que planteaba ADR-052 (75-79%) pero sigue más costoso que la v1 (15-40%). El equilibrio elegido: propuesta a la modelo por encima del sector (50% en T1 vs 30% LiveJasmin L1) manteniendo margen empresa suficiente para operar (50% bruto en T1, ≥40% en cualquier tramo).

---

## 1. Resumen ejecutivo

El modelo cruza los volúmenes proyectados de tráfico (sesiones GA4 → signups → verificaciones → primeras compras → repeats) con la estructura de costes real.

**Cambio estructural principal (2026-08-04)**: el reparto modelo evoluciona en dos pasos: v1 (15-40%, tiers previos) → v2 con ADR-052 (75-79%, umbrales 3.500/5.000/6.500) → **v3 vigente con [ADR-056 §D3](../../06-decisions/adr-056-sistema-master-studio.md) (50-60%, umbrales 1.000/4.000/15.000)**. Consecuencia directa: el margen bruto empresa por transacción se recalibra a **40-50%** (v3) frente al 15-18% que habría dejado ADR-052. El horizonte de break-even queda intermedio entre la v1 (~73% margen bruto) y la v2 (~15-18%).

### Estructura de costes vigente

- **Costes fijos**: AWS (~€120/mes) + Companio (~€110/mes) + Sightengine Starter (~€27/mes) = **€257/mes** (sin cambio).
- **Costes variables por transacción** (pack €10 modelo T1 a €1/min, mix 50/50 cripto/tarjeta):
  - Pago a modelo: 50% × €10 = **€5,00**
  - Fees PSP: 50% × 1% (cripto) + 50% × 13% (tarjeta) × €10 = **€0,70**
  - Chargebacks tarjeta: 1% × €25 (prorrateados) = **€0,25**
  - Didit cliente (prorrateado): ~**€0,05**
  - **Margen bruto por TX ≈ €4,00** (40% del pack).
- **Sin capital inicial**: cada mes en pérdida se cubre con nómina externa de Alain.

### Resultados aproximados a 19 meses (jun 2026 → dic 2027)

Estimación revisada con el régimen vigente ADR-056 (reparto 50% T1, umbrales 1.000/4.000/15.000). Cifras exactas dependen del recálculo del xlsx (deuda pendiente #D-25 del operador; ver §7).

| Métrica | Pesimista (referencia) | Normal |
|---|---|---|
| Break-even mensual TX/mes | **~65 TX/mes** (€4,00 margen bruto por TX) | **~65 TX/mes** |
| Margen neto acumulado 19m | **~−€2.800 a −€3.500** (mejor que v2 ADR-052, peor que v1) | **marginalmente equilibrado o levemente positivo** |
| Gasto personal medio | **€150-200/mes** | **€0-50/mes** |
| Break-even mensual (sostenido) | Mes 15-18 aprox | Mes 12-15 |

Números indicativos; recalibración fina en el xlsx cuando el operador lo procese. Vs escenario ADR-052 (75-79%) el modelo mejora sustancialmente: el margen bruto por TX pasa de €1,50 a €4,00.

### Decisión

Alain asume el escenario pesimista con el régimen vigente como realista y se compromete a sostener **~€150-200/mes de gasto personal** durante el horizonte de 19-24 meses. La apuesta: el reclutamiento a **50% modelo T1** (por encima del sector: LiveJasmin L1 30%, BongaCams ~35%) sigue siendo competitivo, y el margen empresa recalibrado por ADR-056 (≥40% bruto) es sostenible con volumen moderado.

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
               - Pago a modelo: TX × pack × %reparto_tramo
                 (T1: 50%, T2: 54%, T3: 57%, T4: 60%) — ADR-056 §D3
               - Fees PSP: TX × pack × (mix_cripto × 1% + mix_tarjeta × 13%)
               - Chargebacks: TX × 1% × €25 (solo aplica al share tarjeta)
               - Didit clientes: verificados × €0.13
               - Trial absorbido: signups × €0.20 (primer minuto @ €0.07/min × ~3 min)
            → Margen bruto = Revenue − Variables
            → Margen neto = Margen bruto − €257 fijos
```

El Excel companion (`modelo-financiero.xlsx`) contiene el desglose completo mes a mes en dos pestañas (Pesimista, Normal) más una pestaña de supuestos transparentes. **Estado del xlsx**: recalibración pendiente por el operador (ver §7).

---

## 3. Supuestos clave

### Costes fijos
- AWS: €120/mes (aproximado, varía por uso de entornos TEST/AUDIT/PROD).
- Companio: €110/mes (confirmado).
- Sightengine live moderation: €27/mes (plan Starter $29, en horizonte 19m las ops incluidas (10.000/mes) cubren toda la moderación sin overage).
- Otros gastos (dominio, SaaS, herramientas): excluidos por decisión operativa.
- **TOTAL FIJOS: €257/mes**.

### Costes variables (nuevos supuestos ADR-052)

- **Pack medio asumido**: €10 pesimista / €12 normal (sin cambio respecto v1).
- **Reparto a modelo**: **50% en T1** (tramo de entrada, donde estarán la mayoría de modelos nuevas al principio). Progresión a 54/57/60% al superar €1.000/€4.000/€15.000 mensuales de facturación bruta ([ADR-056 §D3](../../06-decisions/adr-056-sistema-master-studio.md)). Cálculo pesimista: asumir 100% modelos en T1 durante los primeros 12 meses.
- **Precio por minuto**: **€1/min plano en T1** (todas las modelos nuevas). Modelos T2/T3/T4 con tarifa autoservicio hasta €9/min no se modelan aún; su aparición esperada es post-mes 12 con volumen sostenido.
- **Fees PSP (mix 50/50 cripto/tarjeta como asunción de arranque)**:
  - Cripto (NOWPayments, ADR-051): **~1% del importe**, sin fijo por transacción relevante.
  - Tarjeta (PSP tarjeta en negociación post-Segpay): **~13% aproximación conservadora** (10-15% típico sector adult + reserve + chargeback fees). Sustituir por cifra real cuando cierre contrato.
  - **Coste medio PSP mix 50/50**: 7% del pack.
- **Chargebacks**: 1% × €25 sobre el 50% que va por tarjeta (cripto ~0% chargebacks). Prorrateado ≈ €0,125/TX.
- **Didit cliente**: €0.13 ponderado (95% Age Estimation directa + 5% fallback documental).
- **Didit modelo**: €0 efectivo (500 gratis/mes cubren el horizonte de 18m con flujo de ~5 modelos nuevas/mes).
- **Trial absorbido**: €0.07/min primer minuto (ADR-052 §D8) × ~3 min/día por cliente en régimen estacionario × probabilidad de uso. Aproximación: **€0,20 absorbido por signup** (baja respecto al pack medio, pero suma cuando el volumen de signups es alto y la conversión a compra es baja).

### Funnel SEO (sin cambio respecto v1)
- Conversion sesión→signup: 1% pesimista / 3% normal.
- Conversion signup→verificado: 30% / 50%.
- Conversion verificado→1ª compra: 10% / 18%.
- LTV en 12m: 1.2 compras pesimista / 2.5 compras normal.

### Sensibilidad al mix cripto/tarjeta

Bloque nuevo tras ADR-052. El mix real determina el margen unitario:

| Mix cripto/tarjeta | Fee PSP medio | Margen bruto TX pack €10 T1 | Break-even TX/mes |
|---|---:|---:|---:|
| 90% cripto / 10% tarjeta | 2,2% | €2,03 (20%) | 127 TX/mes |
| 70/30 | 4,6% | €1,79 (18%) | 144 TX/mes |
| 50/50 (asunción base) | 7,0% | €1,55 (15%) | 166 TX/mes |
| 30/70 | 9,4% | €1,31 (13%) | 196 TX/mes |
| 10/90 | 11,8% | €1,07 (11%) | 240 TX/mes |

Lectura: **cada 20pp de shift hacia cripto ahorra ~40 TX/mes de break-even**. La estrategia soft launch cripto de ADR-047 no es solo pragmática (único PSP viable pre-tarjeta): es económicamente óptima.

### Lo que NO está modelado

- Paid traffic (TrafficJunky, ExoClick) — si se incorpora, suma €200-500/mes pero acelera curva.
- PR sector (XBIZ, YNOT, AVN) — coste tiempo principalmente, sin impacto monetario directo.
- ~~Programa affiliates / partnerships con modelos~~ (retirado por [ADR-052 §D11](../../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md); ya no aplica al modelo).
- Modelos T2-T4 con tarifas €2-9/min: se modelará cuando haya evidencia empírica de que alguna modelo cruza los umbrales (post-mes 12).
- Rediseño packs premium para modelos T3/T4 (#D-24 en `known-debt.md`): no scope ADR-052.
- Crecimiento exponencial de modelos (se asume flujo constante de 5/mes).
- Chargebacks del cliente descontados de payout de modelo (ADR-052 §D7): efecto neutral en margen empresa (la modelo absorbe), no cambia el margen bruto por TX.

---

## 4. Hallazgos y conclusiones (recalibradas)

### El margen unitario ya no es el driver principal

Antes del ADR-052 el margen bruto empresa por TX era ~73% del pack. Ahora es 11-20% según mix. **Pequeñas mejoras de mix (empujar más cripto) valen tanto como mejoras de conversion rate del funnel SEO**. Concretamente: pasar del mix 50/50 al 70/30 (cripto/tarjeta) ahorra ~22 TX/mes de break-even, equivalente a un ~15% de mejora de conversion signup→verificado.

**Implicación**: el marketing y la propuesta al cliente deben reforzar cripto (privacidad, sin cargo bancario visible, discreto) sin decir "el diferencial de fee me beneficia a mí". Es honesto: el diferencial es margen operativo empresa, pero el beneficio narrativo va al cliente.

### Los costes fijos siguen dominando en pesimista

Los **costes fijos (€257/mes) dominan** el modelo durante toda la fase Coming Soon y Soft Launch (mes 0-9), porque el revenue es minúsculo (€0-50/mes). Los costes variables son proporcionales al volumen y, con volumen casi cero, son despreciables. El coste personal de Alain en pesimista es prácticamente igual a los costes fijos + la absorción del trial: **AWS, Companio, Sightengine y trial mandan**.

**Implicación**: cualquier negociación a la baja en costes fijos (consolidar entornos AWS, alternativa a Companio, mantenerse en Sightengine Starter) impacta directo. **€20/mes ahorrados = €380 menos en 19 meses de bolsillo**.

Añadido tras ADR-052: **el coste del trial también impacta**. Con 100 signups/mes en pesimista, la absorción del trial suma €20/mes (100 × €0.20). En normal con 300 signups/mes son €60/mes. Es la primera partida variable que dispara con volumen. Si el ratio "min1 trial → min2 pagado" cae por debajo del 30%, el trial se vuelve costoso.

### El break-even se aleja significativamente

**Antes**: break-even mensual en escenario normal al mes 15-16 (35 TX/mes eran suficientes).
**Ahora**: break-even mensual en escenario normal al mes 20-24 (166 TX/mes en mix 50/50). Es un cambio grande: la modelo captura 5x más margen por TX que antes, pero necesita ~5x más volumen para que la empresa cubra costes fijos.

Si el mix real se estabiliza en 70% cripto / 30% tarjeta (mejor de lo asumido), el break-even baja a **~145 TX/mes** y la fecha se acerca a **mes 18-20**. La estrategia de cripto no es solo lanzamiento técnico: es la **variable financiera más sensible del modelo**.

### El coste de NO lanzar sigue vigente

Cada mes que el soft launch se retrasa, los **€257 fijos siguen corriendo**. Sin revenue compensador. Lanzar antes (aunque sea con producto imperfecto, con pocas modelos, con feedback limitado) sigue siendo financieramente mejor que esperar perfección. El cambio del régimen no cambia esta lógica; sí subraya que **cada mes de retraso tiene un coste de oportunidad de reclutamiento** (una modelo con 3 meses en la plataforma acumula más facturación bruta y puede llegar antes a T2, mejorando ambos su percepción y el mix cripto que arrastra su audiencia).

### El punto de fragilidad principal es el volumen, no el margen

Antes el negocio era frágil por dependencia del SEO (funnel top). Ahora es frágil por **dependencia del volumen sostenido**: 170 TX/mes es un umbral realista solo con reclutamiento activo de modelos con audiencia propia, no con SEO orgánico puro. Si el reclutamiento se atasca (P4 del plan de captación Q3), el break-even no llega y el gasto personal se sostiene indefinidamente.

**Mitigación**: el programa de afiliadas fue retirado por ADR-052 §D11 porque el reparto elevado ya sobre-incentiva a la modelo a traer clientes; con el reparto vigente 50-60% (ADR-056) el incentivo sigue por encima del sector aunque menor que en la propuesta ADR-052. Ese incentivo tiene que traducirse en volumen real; si no, el modelo financiero no cierra. **Métrica canónica a vigilar**: modelos con >€1.500 facturación bruta rolling 30d (elegibles para Estatus Pro, umbral mantenido tras ADR-056). Es un indicador anticipado de conversión de reclutamiento en volumen sostenido.

---

## 5. Triggers para revisar el modelo

Este modelo debe revisarse cuando se cumpla cualquiera de:

1. **Mes 3 (sep 2026)**: revisión obligatoria. Comparar impresiones GSC reales vs proyección pesimista. Si están más cerca del normal, mantener plan. Si están en pesimista o por debajo, evaluar palancas.
2. **Mes 6 (dic 2026)**: si las primeras compras reales están por debajo del pesimista en 3 meses consecutivos, **incorporar paid traffic** o pivotar.
3. **Cuando se cierre PSP tarjeta**: actualizar el 13% asumido con las tarifas contractuales reales (fee variable + fijo + reserve + chargeback fees).
4. **Cuando aparezca la primera modelo en T2 (>€1.000 facturación bruta rolling 30d)**: recalibrar el modelo con reparto ponderado por distribución de tramos.
5. **Cuando el mix real cripto/tarjeta se estabilice** (tras primeros 500 pagos reales): recalcular break-even con el mix observado.
6. **Cuando se decida soft launch**: actualizar fechas y rehacer proyecciones desde ese mes.
7. **Si los costes fijos cambian**: AWS reorganización, cambio de Companio, salto de Sightengine Starter → Pro (~€90/mes adicionales), etc.
8. **Cuando Sightengine cruce el umbral económico o técnico**: si las sesiones pagadas/mes superan ~250 con cadencia 15s, o si hay >10 sesiones concurrentes pico, revisar el salto a plan Pro $99/mes.
9. **Cuando se incorpore una palanca nueva**: paid traffic, PR, partnerships. Cada palanca requiere re-modelar.

---

## 6. Próximos pasos operativos

1. **Mantener cadencia operativa actual** (blog 1/semana, social pipeline, Reddit warmup) sin alterar nada — el plan SEO se ejecuta tal como está documentado.
2. **Monitorizar el tracking mensual** (`seo/tracking-mensual.md`) cada domingo en la revisión semanal P7.
3. **Empujar cripto como propuesta al cliente** desde el primer mes: es la variable financiera más sensible del modelo. Ratio objetivo mínimo: 60% de pagos en cripto durante los primeros 6 meses.
4. **Decidir fecha tentativa de soft launch** en mes 3 (sep 2026), una vez tengamos 3 meses de datos reales para calibrar tráfico real vs proyectado.
5. **Confirmar fees PSP tarjeta** cuando se cierre el contrato con el nuevo candidato post-Segpay y actualizar este documento.
6. **Evaluar palanca de paid traffic adulto** en mes 6 si los KPIs siguen en pesimista o por debajo.
7. **No tocar el plan SEO** mientras los KPIs estén alineados con el escenario pesimista o mejor — es el escenario que ya hemos aceptado financieramente.

---

## 7. Estado del xlsx companion (deuda declarada)

El fichero `modelo-financiero.xlsx` sigue con la estructura v1 (reparto 15-40%, tarifa plana €1/min, fees CardBilling / Verotel). El operador lo recalibrará manualmente cuando disponga de tiempo, con los supuestos revisados que este `.md` ya recoge:

- Reparto **50% pesimista** (todas las modelos en T1 durante los primeros 12 meses; ADR-056 §D3).
- Fees mix 50/50 cripto/tarjeta como asunción base (con pestaña de sensibilidad al mix).
- Coste trial €0.20/signup absorbido.
- Break-even TX/mes ~170 en mix 50/50; ver §3 tabla de sensibilidad para otros mix.

Mientras el xlsx no esté actualizado, este `.md` es la fuente de verdad estratégica.

---

## 8. Referencias

- Estrategia de tráfico orgánico y proyecciones de funnel: `docs/01-business/seo/estrategia.md`
- Tracking mensual de KPIs reales vs plan: `docs/01-business/seo/tracking-mensual.md`
- Sistema de tramos y economía de modelos: `docs/01-business/sistema-tiers-modelos.md`
- Pricing del producto al cliente: `docs/01-business/pricing.md`
- Unit economics marco general: `docs/01-business/unit-economics.md`
- Estado contable y costes operativos detallados: `docs/01-business/accounting-status.md`
- [ADR-052](../../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) — rediseño estructural del reparto (fuente del cambio v1 → v2 de este modelo; §D1 y §D5 sobrescritos posteriormente por ADR-056).
- [ADR-056](../../06-decisions/adr-056-sistema-master-studio.md) — sistema Master/Studio: §D3 vigente para tramos y umbrales (fuente del cambio v2 → v2.1 de este modelo).
- Excel companion con cálculo mes a mes: `modelo-financiero.xlsx` (junto a este documento; recalibración manual pendiente).

---

*Documento reescrito 2026-07-25 (v2.0) tras ADR-052. Próxima revisión obligatoria: 16 sep 2026 (mes 3).*
