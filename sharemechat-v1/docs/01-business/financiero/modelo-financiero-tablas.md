# Modelo financiero — tablas mes a mes

> Estado: HISTÓRICO
> Fecha: 2026-07-09
> Vigencia esperada: hasta reescritura del modelo financiero tras el pivote de soft launch (Fase B)
> Reemplaza: `modelo-financiero-sharemechat.xlsx` (retirado del repo por política de formatos)
> Ver también: `modelo-financiero.md`, `../seo/estrategia.md`, `../sistema-tiers-modelos.md`

## Nota preliminar

Este fichero es la migración a Markdown del antiguo Excel companion `modelo-financiero-sharemechat.xlsx` (v1.0, 17 jun 2026), retirado del repo tras la introducción de la política de formatos aceptados (2026-07-09).

Complementa a [`modelo-financiero.md`](modelo-financiero.md) con las tablas mes a mes (Pesimista y Normal) y la tabla completa de supuestos que solo vivían en el Excel. La prosa (resumen, hallazgos, triggers de revisión) sigue en [`modelo-financiero.md`](modelo-financiero.md).

**Contenido pendiente de revisión (Fase B):** las tablas y supuestos siguen asumiendo Segpay como PSP activo y F1 Coming Soon mes 0-3 sin revenue. Estas premisas quedan invalidadas por [ADR-047](../../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md) (soft launch cripto + Paxum desde mes 1). La actualización numérica de estas tablas corresponde a la Fase B de la reescritura del modelo financiero. Se conserva el contenido tal como estaba en el Excel para no perder la traza histórica.

## 1. Resumen ejecutivo

Números que salen del modelo cuando se cruza con el plan SEO. Sin capital inicial, cada mes negativo lo cubre el operador personalmente.

| Concepto | Pesimista | Normal |
|---|---:|---:|
| Revenue acumulado 18 meses | 490 € | 7.823 € |
| Coste variable acumulado (Segpay + modelos + Didit + demo) | 305 € | 2.914 € |
| Coste fijo acumulado (AWS + Companio + Sightengine, 19 meses) | 4.883 € | 4.883 € |
| **Margen neto acumulado 18 meses** | **−4.698 €** | **+25 €** |
| Gasto personal medio (€/mes) que tiene que cubrir el operador | 247 € / mes | Positivo |

### Conclusiones clave

1. En el escenario **pesimista**, el negocio cuesta ~257 €/mes de bolsillo durante los 18 meses (básicamente los costes fijos, porque el ingreso no llega ni a cubrirlos).
2. En el escenario **normal**, los últimos meses (16-18) empiezan a tener margen positivo, pero el acumulado de 18 meses queda casi en equilibrio. El break-even mensual del escenario normal ocurre alrededor del mes 15-16.
3. La conclusión NO es que el negocio sea malo. Es que **el SEO orgánico solo es demasiado lento** para sostener el negocio si se quieren cubrir costes en menos de 18 meses. Se necesitan palancas adicionales entre mes 6-12 (paid adulto especializado, partnerships, PR sector) para acelerar la curva.
4. Sin capital inicial, la métrica a monitorizar es: ¿se está dispuesto a poner 257 €/mes de bolsillo durante 12-18 meses? Si la respuesta es sí, el plan es viable. Si no, hay que acelerar o pivotar antes.
5. Punto clave: los **costes fijos (257 €/mes) son dominantes** en pre-launch y soft launch. Solo a partir del mes 9-12 el revenue empieza a tener tamaño suficiente para que los costes variables importen. Hasta entonces, cada mes cuesta exactamente lo que se paga en AWS + Companio + Sightengine (~257 €), independientemente de lo que pase con el blog.
6. Sightengine plan Starter ($29/mes) incluye 10.000 ops/mes, suficiente para cubrir hasta 250 sesiones pagadas/mes con cadencia 15s. En todo el horizonte 19m no se cruza ese umbral, por lo que el coste variable de moderación es 0 € (todo incluido en la cuota fija). Solo conviene saltar a Pro $99/mes cuando se superen ~45.000 ops/mes o se necesite más throughput (>10 sesiones concurrentes).

## 2. Escenario Pesimista — mes a mes

**Supuestos de tabla**: pack medio €10 (todos al pack mínimo). Modelo asumida en tier 5-15 (€1.40/pack pagado a modelo). Segpay 10% + €0.30/TX. Didit cliente €0.13/verificado. Costes fijos €257/mes (AWS €120 + Companio €110 + Sightengine €27 plan Starter).

| Mes | Fase | Sesiones | Signups | Verif. | 1ª compras | Repeats (€) | TX total | Revenue (€) | Coste var (€) | Coste fijo (€) | Margen neto (€) | Acumulado neto (€) | Gasto personal mes (€) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 - Jun 26 | F1 Coming Soon | 100 | 0 | 0 | 0 | 0 | 0.0 | 0.0 | 0.0 | 257 | −257.0 | −257 | 257.0 |
| 1 - Jul 26 | F1 Coming Soon | 150 | 0 | 0 | 0 | 0 | 0.0 | 0.0 | 0.0 | 257 | −257.0 | −514 | 257.0 |
| 2 - Ago 26 | F1 Coming Soon | 200 | 0 | 0 | 0 | 0 | 0.0 | 0.0 | 0.0 | 257 | −257.0 | −771 | 257.0 |
| 3 - Sep 26 | F1 Coming Soon | 300 | 0 | 0 | 0 | 0 | 0.0 | 0.0 | 0.0 | 257 | −257.0 | −1.028 | 257.0 |
| 4 - Oct 26 | F2 Soft Launch | 500 | 5 | 2 | 0.3 | 0 | 0.3 | 3.0 | 2.6 | 257 | −256.6 | −1.285 | 256.6 |
| 5 - Nov 26 | F2 Soft Launch | 700 | 7 | 3 | 0.4 | 1 | 0.5 | 5.0 | 4.0 | 257 | −256.0 | −1.541 | 256.0 |
| 6 - Dic 26 | F2 Soft Launch | 900 | 9 | 4 | 0.6 | 2 | 0.8 | 8.0 | 5.6 | 257 | −254.6 | −1.795 | 254.6 |
| 7 - Ene 27 | F3 Live | 1.200 | 14 | 6 | 0.9 | 3 | 1.2 | 12.0 | 8.5 | 257 | −253.5 | −2.049 | 253.5 |
| 8 - Feb 27 | F3 Live | 1.400 | 17 | 7 | 1.1 | 4 | 1.5 | 15.0 | 10.4 | 257 | −252.4 | −2.301 | 252.4 |
| 9 - Mar 27 | F3 Live | 1.600 | 19 | 8 | 1.2 | 5 | 1.7 | 17.0 | 11.8 | 257 | −251.8 | −2.553 | 251.8 |
| 10 - Abr 27 | F3 Live | 1.800 | 22 | 9 | 1.4 | 7 | 2.1 | 21.0 | 14.0 | 257 | −250.0 | −2.803 | 250.0 |
| 11 - May 27 | F3 Live | 2.100 | 25 | 10 | 1.6 | 9 | 2.5 | 25.0 | 16.2 | 257 | −248.2 | −3.051 | 248.2 |
| 12 - Jun 27 | F3 Live | 2.500 | 30 | 12 | 1.9 | 12 | 3.1 | 31.0 | 19.7 | 257 | −245.7 | −3.297 | 245.7 |
| 13 - Jul 27 | F4 Crecimiento | 3.000 | 36 | 14 | 2.3 | 15 | 3.8 | 38.0 | 23.8 | 257 | −242.8 | −3.540 | 242.8 |
| 14 - Ago 27 | F4 Crecimiento | 3.500 | 42 | 17 | 2.7 | 19 | 4.6 | 46.0 | 28.4 | 257 | −239.4 | −3.779 | 239.4 |
| 15 - Sep 27 | F4 Crecimiento | 4.000 | 48 | 19 | 3 | 23 | 5.3 | 53.0 | 32.5 | 257 | −236.5 | −4.015 | 236.5 |
| 16 - Oct 27 | F4 Crecimiento | 4.500 | 54 | 22 | 3.4 | 28 | 6.2 | 62.0 | 37.3 | 257 | −232.3 | −4.248 | 232.3 |
| 17 - Nov 27 | F4 Crecimiento | 5.000 | 60 | 24 | 3.8 | 34 | 7.2 | 72.0 | 42.4 | 257 | −227.4 | −4.475 | 227.4 |
| 18 - Dic 27 | F4 Crecimiento | 5.500 | 66 | 26 | 4.2 | 40 | 8.2 | 82.0 | 47.4 | 257 | −222.4 | −4.698 | 222.4 |
| **TOTAL 19 meses** |  |  |  |  |  |  |  |  |  |  | **−4.698** |  |  |

## 3. Escenario Normal — mes a mes

**Supuestos de tabla**: pack medio €12 (mix entre €10 y €20). Modelo asumida en tier 5-15 (€1.40/pack pagado a modelo). Segpay 10% + €0.30/TX. Didit cliente €0.13/verificado. Costes fijos €257/mes (AWS €120 + Companio €110 + Sightengine €27 plan Starter).

| Mes | Fase | Sesiones | Signups | Verif. | 1ª compras | Repeats (€) | TX total | Revenue (€) | Coste var (€) | Coste fijo (€) | Margen neto (€) | Acumulado neto (€) | Gasto personal mes (€) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 - Jun 26 | F1 Coming Soon | 150 | 0 | 0 | 0 | 0 | 0.0 | 0.0 | 0.0 | 257 | −257.0 | −257 | 257.0 |
| 1 - Jul 26 | F1 Coming Soon | 250 | 0 | 0 | 0 | 0 | 0.0 | 0.0 | 0.0 | 257 | −257.0 | −514 | 257.0 |
| 2 - Ago 26 | F1 Coming Soon | 400 | 0 | 0 | 0 | 0 | 0.0 | 0.0 | 0.0 | 257 | −257.0 | −771 | 257.0 |
| 3 - Sep 26 | F1 Coming Soon | 600 | 0 | 0 | 0 | 0 | 0.0 | 0.0 | 0.0 | 257 | −257.0 | −1.028 | 257.0 |
| 4 - Oct 26 | F2 Soft Launch | 800 | 24 | 12 | 2.2 | 0 | 2.2 | 26.4 | 15.7 | 257 | −246.3 | −1.274 | 246.3 |
| 5 - Nov 26 | F2 Soft Launch | 1.100 | 33 | 17 | 3 | 15 | 4.2 | 51.0 | 25.5 | 257 | −231.5 | −1.506 | 231.5 |
| 6 - Dic 26 | F2 Soft Launch | 1.500 | 45 | 23 | 4.1 | 35 | 7.0 | 84.2 | 38.6 | 257 | −211.4 | −1.717 | 211.4 |
| 7 - Ene 27 | F3 Live | 1.800 | 54 | 27 | 4.9 | 60 | 9.9 | 118.8 | 50.9 | 257 | −189.1 | −1.906 | 189.1 |
| 8 - Feb 27 | F3 Live | 2.200 | 66 | 33 | 5.9 | 90 | 13.4 | 160.8 | 66.3 | 257 | −162.5 | −2.069 | 162.5 |
| 9 - Mar 27 | F3 Live | 3.000 | 90 | 45 | 8.1 | 130 | 18.9 | 227.2 | 92.5 | 257 | −122.3 | −2.191 | 122.3 |
| 10 - Abr 27 | F3 Live | 3.500 | 105 | 53 | 9.5 | 180 | 24.5 | 294.0 | 115.6 | 257 | −78.6 | −2.270 | 78.6 |
| 11 - May 27 | F3 Live | 4.200 | 126 | 63 | 11.3 | 240 | 31.3 | 375.6 | 144.6 | 257 | −26.0 | −2.296 | 26.0 |
| 12 - Jun 27 | F3 Live | 5.000 | 150 | 75 | 13.5 | 310 | 39.3 | 472.0 | 178.6 | 257 | +36.3 | −2.259 | 0.0 |
| 13 - Jul 27 | F4 Crecimiento | 6.000 | 180 | 90 | 16.2 | 395 | 49.1 | 589.4 | 220.4 | 257 | +112.0 | −2.147 | 0.0 |
| 14 - Ago 27 | F4 Crecimiento | 7.500 | 225 | 112 | 20.2 | 495 | 61.5 | 737.4 | 275.6 | 257 | +204.8 | −1.943 | 0.0 |
| 15 - Sep 27 | F4 Crecimiento | 9.000 | 270 | 135 | 24.3 | 615 | 75.5 | 906.6 | 336.5 | 257 | +313.1 | −1.629 | 0.0 |
| 16 - Oct 27 | F4 Crecimiento | 10.000 | 300 | 150 | 27 | 750 | 89.5 | 1.074.0 | 391.4 | 257 | +425.6 | −1.204 | 0.0 |
| 17 - Nov 27 | F4 Crecimiento | 11.000 | 330 | 165 | 29.7 | 900 | 104.7 | 1.256.4 | 450.3 | 257 | +549.1 | −655 | 0.0 |
| 18 - Dic 27 | F4 Crecimiento | 12.000 | 360 | 180 | 32.4 | 1.060 | 120.7 | 1.448.8 | 511.7 | 257 | +680.1 | +25 | 0.0 |
| **TOTAL 19 meses** |  |  |  |  |  |  |  |  |  |  | **+25** |  |  |

## 4. Supuestos del modelo (tabla completa)

### Costes fijos mensuales

| Categoría | Valor | Fuente / nota |
|---|---:|---|
| AWS (TEST + AUDIT + PROD) | €120/mes | Aproximado. Variable según uso de entornos. |
| Companio (accounting + virtual office) | €110/mes | Confirmado. |
| Sightengine live moderation (plan Starter $29) | €27/mes | Cubre 10.000 ops/mes incluidas. Cadencia 15s = 40 ops/sesión de 10 min. En horizonte 19 meses NO se cruza el umbral (250 sesiones/mes), por lo que el coste variable adicional es 0 €. |
| Otros gastos fijos (dominio, SaaS, herramientas) | Excluidos | Decisión operativa: no contabilizados. |
| **TOTAL FIJOS** | **€257/mes** | (€3.083/año aprox) |

### Costes variables por transacción

| Categoría | Valor | Fuente / nota |
|---|---:|---|
| Pack medio pesimista | €10 | Asume todos eligen el pack más barato. |
| Pack medio normal | €12 | Mix entre €10/22min y €20/22min. |
| Pago a la modelo (tier 5-15) | €1.40/pack | €0.05 primer min + 9 × €0.15 minutos siguientes. |
| Segpay comisión % | 10% | Estándar sector adulto (riesgo alto). Confirmar con Segpay en contrato. |
| Segpay fijo por TX | €0.30 | Estándar sector adulto. |
| Tasa de chargebacks | 1% | Asumido conservador. Sector adulto puede ser 0.5-3%. |
| Coste por chargeback | €25 | Estándar. |

### Costes variables por verificación / demo

| Categoría | Valor | Fuente / nota |
|---|---:|---|
| Didit cliente verificado | €0.13 | Ponderado: 95% Age Estimation directa ($0.13) + 5% fallback documental ($0.28). Una vez por cliente, no recurrente. |
| Didit modelo verificada | €0 (free tier) | 500 gratis/mes. En horizonte 18m con 5 modelos/mes nuevas (~90 total) no se supera el free tier. |
| Demo gratis absorbida (por signup) | €0.30 | 9 min máx primer día × €0.05-0.09 ponderado. Es lo que cuesta a la plataforma cada usuario que se registra y prueba sin convertir. |

### Funnel de conversión

| Categoría | Valor | Fuente / nota |
|---|---:|---|
| Conversion sesión → signup pesimista | 1% | Conservador adulto. |
| Conversion sesión → signup normal | 3% | Realista adulto bien hecho. |
| Conversion signup → verificado | 30% / 50% | KYC adulto es barrera. Pesimista / Normal. |
| Conversion verificado → 1ª compra | 10% / 18% | Pesimista / Normal. |
| LTV (compras totales por cliente en 12m) | 1.2 / 2.5 | Pesimista / Normal. Repeat rate aplicado. |

### Fases temporales asumidas

| Fase | Meses | Nota |
|---|---|---|
| F1 Coming Soon | Mes 0-3 (jun-sep 2026) | Producto NO operacional. Tráfico no convierte. |
| F2 Soft Launch | Mes 4-6 (oct-dic 2026) | Producto operacional + Segpay activo. Primeras compras posibles. |
| F3 Live público | Mes 7-12 (ene-jun 2027) | Producto open, efectos compuestos del SEO empiezan. |
| F4 Crecimiento | Mes 13-18 (jul-dic 2027) | Long-tail SEO funcionando si todo va bien. |

### Runway y break-even

| Categoría | Valor | Fuente / nota |
|---|---:|---|
| Capital inicial disponible | €0 | El operador cubre gastos personalmente con nómina externa. |
| Break-even | No alcanzado en 18m (pesimista) | Mes 15-16 (normal). Necesidad de palancas adicionales identificada. |

### Palancas excluidas del modelo (no modeladas numéricamente)

| Categoría | Estado | Fuente / nota |
|---|---|---|
| Paid traffic (TrafficJunky, ExoClick) | Excluido | Si se incorpora entre mes 6-12, acelera break-even pero suma coste mensual €200-500. |
| PR sector (XBIZ, YNOT, AVN) | Excluido | Coste tiempo principalmente. Sin impacto monetario directo. |
| Programa affiliates / partnerships | Excluido | Si se incorpora, suma % revenue compartido (5-15%). |
| Costes legales adicionales | Excluido | Se confía en Companio + ADRs internos. |
| Stripe / pasarelas backup | Excluido | Solo Segpay como PSP único (asunción del modelo original — invalidada por ADR-047). |
| Crecimiento modelos exponencial | No modelado | Asume 5 modelos nuevas/mes constante. |
