# ADR-011: Simplificación de pricing y umbral mínimo de recarga

## Estado

Aceptada.

Decisión documental sobre la estructura de paquetes de recarga y el mínimo de transacción del modelo prepago.

La implementación operativa queda pendiente:

- centralizar catálogo de packs en backend
- alinear frontend con el nuevo catálogo
- eliminar o aislar el catálogo legacy `P5 / P15 / P30 / P45`
- validar que los importes acreditados coinciden con la oferta visible
- dejar preparado el catálogo para la futura integración real con CCBill

Esta decisión sustituye el catálogo previo basado en `5 / 12 / 27 / 40 EUR`.

## Contexto

SharemeChat monetiza inicialmente mediante un modelo **prepago**: el cliente compra saldo interno en EUR y consume ese saldo en sesiones, gifts u otros servicios de pago.

El catálogo histórico contenía paquetes pequeños y poco redondos:

- `P5` → 5 EUR
- `P15` → 12 EUR
- `P30` → 27 EUR
- `P45` → 40 EUR

Ese catálogo tenía tres problemas:

1. **Ticket mínimo demasiado bajo**  
   Un paquete de 5 EUR queda muy expuesto al componente fijo de coste del PSP. En pagos reales, un importe tan bajo puede erosionar el margen de forma desproporcionada.

2. **Catálogo poco limpio**  
   Los importes 12 y 27 EUR son menos claros comercialmente que importes redondos.

3. **Riesgo de incoherencia minutos / saldo**  
   Si la UI comunica minutos fijos asociados a un paquete, esos minutos pueden dejar de coincidir con la tarifa por minuto vigente. El backend trabaja con saldo y tarifa; no debe prometerse tiempo estático que no derive de esa tarifa.

Además, CCBill será el PSP prioritario, pero la integración real y la firma del webhook están bloqueadas hasta recibir el manual oficial de integración. Por tanto, esta ADR decide el catálogo y la estructura de pricing, pero no implementa todavía el contrato real de PSP.

## Problema

Antes de abrir pagos reales o preparar una integración final de PSP, era necesario decidir:

- qué paquetes de recarga ofrecer;
- cuál es el mínimo de transacción aceptable;
- cómo evitar que el frontend prometa minutos no respaldados por la tarifa real;
- cómo evitar que el catálogo legacy siga disperso entre frontend, backend y placeholder PSP;
- cómo dejar una estructura simple que pueda validarse en TEST/AUDIT antes de producción.

## Decisión

Se adopta un catálogo simplificado de tres paquetes:

- **10 EUR**
- **20 EUR**
- **40 EUR**

El paquete mínimo pasa a ser **10 EUR**.

El catálogo legacy `P5 / P15 / P30 / P45` queda obsoleto para la futura operación real.

La oferta visible al cliente debe comunicar saldo en EUR. Si se muestra una equivalencia en tiempo, esa equivalencia debe calcularse dinámicamente a partir de la tarifa por minuto vigente, no fijarse como literal estático del paquete.

## Reglas de implementación derivadas

La implementación posterior debe cumplir:

1. **Fuente de verdad única para packs**
    - El catálogo `10 / 20 / 40` debe quedar centralizado.
    - No deben existir importes hardcodeados dispersos entre frontend y backend.

2. **Backend alineado**
    - `CcbillService.resolvePackAmount(...)` o el mecanismo equivalente debe dejar de depender del catálogo legacy.
    - Los endpoints económicos directos ya gobernados por `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED` no deben permitir acreditar importes arbitrarios en entornos no autorizados.

3. **Frontend alineado**
    - La UI de compra debe mostrar los nuevos packs.
    - No debe seguir mostrando `P5 / P15 / P30 / P45`.
    - No debe prometer minutos fijos salvo que se deriven de la tarifa vigente.

4. **PSP pendiente**
    - La integración real con CCBill no se implementa por inferencia.
    - La firma del webhook, contrato definitivo y validación final quedan bloqueados hasta recibir el manual oficial.

5. **Validación**
    - TEST debe validar el catálogo nuevo.
    - AUDIT debe quedar preparado para revisión externa sin simulación económica directa abierta por defecto.
    - PRO debe mantener `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false`.

## Por qué 10 / 20 / 40

La escalera `10 / 20 / 40` tiene ventajas claras:

- reduce el impacto relativo del coste fijo del PSP;
- elimina tickets demasiado pequeños;
- usa importes redondos y fáciles de entender;
- mantiene una oferta corta y legible;
- facilita comparar paquetes sin una tabla larga de variantes;
- permite evolucionar hacia descuentos o bonus futuros sin reescribir el modelo completo.

## Por qué eliminar el paquete de 5 EUR

El paquete de 5 EUR se descarta porque:

- tiene peor relación entre coste fijo PSP e importe cobrado;
- genera más operaciones pequeñas;
- complica la rentabilidad inicial;
- no aporta suficiente valor estratégico antes de tener datos reales de conversión.

Si en una fase posterior se demuestra con datos que un ticket inferior mejora conversión sin destruir margen, podrá reabrirse la decisión mediante una nueva ADR o una revisión formal del pricing.

## Por qué no mantener 12 / 27 / 40

Los importes 12 y 27 EUR son menos claros comercialmente. No aportan una ventaja evidente frente a 20 y 40 EUR, y hacen más difícil explicar el catálogo.

La nueva estructura prioriza claridad, margen y simplicidad operativa.

## Por qué no comunicar minutos fijos por pack

El tiempo equivalente depende de la tarifa por minuto vigente.

Si se comunica un número fijo de minutos asociado al pack, cualquier cambio de tarifa rompe la promesa comercial o exige actualizar copy, frontend, tests y documentación.

Por eso, la fuente de verdad debe ser:

- saldo comprado en EUR;
- tarifa por minuto vigente;
- equivalencia calculada cuando sea necesario.

## Alternativas consideradas

### Mantener catálogo previo `5 / 12 / 27 / 40`

Rechazada.

Motivos:

- ticket mínimo demasiado bajo;
- importes poco limpios;
- riesgo de incoherencia minutos/saldo;
- catálogo más difícil de mantener.

### Añadir más paquetes

Rechazada en esta fase.

Motivos:

- más complejidad visual;
- más combinaciones que validar;
- sin datos reales que justifiquen una escalera más larga.

### Permitir importe libre

Rechazada para la primera monetización real.

Motivos:

- dificulta controlar mínimo de transacción;
- complica validaciones;
- reduce claridad para el cliente;
- puede reabrir tickets demasiado pequeños.

### Modelo de suscripción

Rechazado para esta fase.

El roadmap actual mantiene **wallet prepago** como único modelo inicial de monetización.

## Consecuencias

- El catálogo real pasa a ser `10 / 20 / 40`.
- El paquete de 5 EUR desaparece.
- El catálogo legacy queda obsoleto.
- La UI debe alinear textos, botones y equivalencias.
- El backend debe resolver packs desde una fuente clara.
- El placeholder PSP debe alinearse con el catálogo nuevo.
- CCBill real queda pendiente hasta recibir manual oficial.
- La decisión no cambia gifts, tiers, payouts ni reparto modelo/plataforma.
- La decisión no sustituye el trabajo pendiente de BFPM.

## Riesgos

### Menor conversión inicial por subir el mínimo

Un mínimo de 10 EUR puede reducir compras iniciales de clientes muy sensibles al precio.

Mitigación:

- medir conversión real;
- no reabrir el paquete de 5 EUR por intuición;
- revisar solo con datos.

### Desfase frontend/backend

Si el frontend muestra `10 / 20 / 40` pero el backend sigue aceptando `P5 / P15 / P30 / P45`, se genera incoherencia.

Mitigación:

- centralizar packs;
- validar compra simulada en TEST;
- buscar y eliminar referencias legacy.

### Confusión minutos/saldo

Si se mantienen textos antiguos de minutos fijos, puede seguir existiendo una promesa comercial incorrecta.

Mitigación:

- comunicar saldo en EUR;
- calcular equivalencia de tiempo desde la tarifa vigente;
- no hardcodear minutos en el catálogo.

### Integración PSP incompleta

El catálogo puede quedar preparado, pero CCBill real no debe implementarse sin manual.

Mitigación:

- mantener Fase 5 bloqueada;
- no inferir firma webhook;
- no validar contrato PSP sin documentación oficial.

## Relación con roadmap

Esta ADR pertenece al frente operativo:

**Gobierno económico pre-PSP**

Secuencia:

1. Gobierno por entorno de endpoints económicos directos — HECHO.
2. Corrección de `billable_start` — HECHO.
3. Centralización de packs `10 / 20 / 40` — SIGUIENTE.
4. BFPM — PENDIENTE.
5. Integración CCBill real y firma webhook — BLOQUEADO hasta recibir manual oficial.

Esta decisión es prerrequisito práctico para:

- preparar la futura integración CCBill;
- evitar incoherencias en la UI de compra;
- evitar que el catálogo legacy siga condicionando el diseño económico;
- validar la economía interna antes de dinero real.

## Estado de implementación

- Decisión aceptada.
- **Implementación Fase 3A completada y validada en TEST.**
- Backend CCBill provisional actualizado: `CcbillService.resolvePackAmount` acepta `P10 / P20 / P40` y rechaza el catálogo legacy `P5 / P15 / P30 / P45` con `IllegalArgumentException("PackId no soportado: ...")`.
- Frontend actualizado: `useAppModals.js` muestra los tres packs `10 / 20 / 40 EUR` (`P20` marcado como `recommended`).
- Catálogo legacy eliminado del código funcional. Sesiones `payment_sessions` PENDING legacy cierran correctamente vía `session.getAmount()` ya persistido (sin re-resolver).
- Validación operativa en TEST:
  - frontend muestra los nuevos packs;
  - endpoints directos `/api/transactions/first` y `/api/transactions/add-balance` registran ingresos `10.00 / 20.00 / 40.00` con `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=true`;
  - `POST /api/billing/ccbill/session` acepta `P10 / P20 / P40` y crea `payment_sessions` con `amount` correspondiente;
  - `POST /api/billing/ccbill/session` rechaza `P5 / P15 / P30 / P45`.
- Alcance limitado de Fase 3A: `minutesGranted == priceEur`. No hay descuentos por volumen, ni bonus, ni "saldo virtual".
- **Pendiente**:
  - **BFPM**: separación trazable entre minutos otorgados e importe pagado (descuentos / bonus / promociones). Es prerrequisito antes de la integración PSP real.
  - **Centralización fuerte del catálogo** (BD o endpoint dinámico): no abordada; duplicidad transitoria frontend/backend aceptada como deuda.
  - **CCBill real y firma webhook**: bloqueado hasta recibir el manual oficial. No inferir contrato ni firma.
- La decisión histórica de esta ADR no cambia. Los riesgos y alternativas quedan registrados como referencia.