# ADR-028 - Clasificación del negocio como adult/streaming, no dating

## Estado

Aceptado

## Contexto

SharemeChat opera videochat 1-a-1 de pago entre clientes y modelos remuneradas. A efectos de pagos y compliance, hay que declarar una clasificación al PSP, a las redes de tarjeta y a los reguladores que ya operan sobre adult: si nos presentamos como "dating" buscamos un MCC con apariencia menos restrictiva, si nos presentamos como "adult/streaming" entramos en el régimen completo de verificación y trazabilidad de contenido adulto.

Durante onboarding con dos procesadores adult-specialist (CCBill, que dejó de responder, y Segpay, vía activa pero no cerrada contractualmente) se evidenció que las redes de tarjeta tratan el videochat 1-a-1 de pago con modelos remuneradas como contenido adulto con independencia de si el contenido es público o privado, y con independencia del MCC declarado. Pretender una clasificación distinta a adult expone a recategorización forzada, congelación de fondos o cierre de cuenta por parte del PSP.

## Opciones consideradas

### Opción 1 — Clasificarse como dating (MCC 7273)

Buscar un PSP que acepte la categoría 7273 (dating services), apoyándose en que el producto es "encuentro online entre adultos" más que "consumo de contenido adulto".

Pros:
- Vocabulario menos cargado en marketing y onboarding.
- MCCs menos vigilados que `5967` o `7841`.

Contras:
- MCC 7273 ya es Tier-1 de alto riesgo en VIRP (Visa Integrity Risk Program). Arrastra verificación de edad, controles antifraude y monitorización de chargebacks equivalentes a adult.
- Mastercard AN 5196 sobre adult content abarca explícitamente el streaming en vivo y la interacción person-to-person remunerada. Una recategorización a adult por la red es probable en cuanto el PSP audite el catálogo real de uso.
- Riesgo operativo: el día que un PSP recategoriza, todo el cuerpo de compliance ya construido bajo "dating" queda insuficiente y hay que rehacer en condiciones de tiempo limitado (típicamente con fondos congelados).

### Opción 2 — Clasificarse como adult/streaming desde el origen

Asumir que el negocio es adult/streaming y construir todo el cuerpo de compliance bajo ese régimen: verificación de edad y de identidad de modelos y clientes, moderación de contenido robusta, declaración 2257, custodian nombrado, políticas formales de takedown y chargeback, reporting periódico al PSP.

Pros:
- Coherente con la realidad del catálogo (videochat 1-a-1 con modelos remuneradas).
- Alineado con las reglas vigentes de las dos redes de tarjeta dominantes (Mastercard AN 5196, Visa VIRP Tier-1).
- Permite seleccionar PSPs adult-specialist (Segpay, CCBill y similares) que ya tienen procesos diseñados para este vertical, en lugar de pelear con PSPs generalistas que pueden recategorizar a posteriori.
- El coste de compliance es casi fijo una vez construido: aplica a todos los mercados servidos sin reescritura.

Contras:
- Régimen regulatorio más estricto: verificación de edad obligatoria, declaración 2257 y custodian, reporting al PSP, políticas de takedown formales, posible DPIA por procesamiento biométrico (estimación facial de edad) bajo GDPR.
- Carga operativa mensual sostenida (reporting, gestión de quejas, monitorización).

## Decisión

Se clasifica SharemeChat como merchant **adult/streaming**. La ruta "dating" queda descartada como dirección de negocio.

Esta clasificación condiciona, hacia abajo en la cadena documental, las decisiones de:

- arquitectura de verificación de edad e identidad (ver ADR-029)
- arquitectura de moderación y monitorización (ver ADR-030)
- estrategia de PSP (ver `docs/01-business/psp-strategy.md`)
- alcance de compliance accionable (ver `docs/01-business/compliance-deliverables.md`)

## Justificación

Las dos redes de tarjeta dominantes ya tratan el videochat 1-a-1 de pago con modelos remuneradas como contenido adulto: Mastercard lo recoge bajo AN 5196 (que cubre streaming en vivo y person-to-person), Visa lo coloca como Tier-1 en VIRP incluso bajo MCC 7273. El intento de clasificación alternativa no aporta ventaja real y sí abre exposición a recategorización forzada durante operación.

Asumir adult/streaming desde el origen permite además seleccionar el PSP en función del vertical (procesadores adult-specialist con procesos de due diligence adaptados, como Segpay) en lugar de depender de la tolerancia de un PSP generalista que puede revisar la cuenta más tarde. La regulación que aplica (Ofcom guidance enero 2025 sobre Online Safety Act, UE DSA art. 28, Free Speech Coalition v. Paxton en EE.UU., Online Safety Act australiano) refuerza esta dirección: el régimen adult se ha endurecido en los mercados objetivos potenciales, y los productos que se presentan como "social" o "dating" pero operan adult son cada vez más visibles para los reguladores.

## Impacto

### Arquitectura

- Habilita formalmente la línea de trabajo de verificación de edad y de identidad descrita en ADR-029.
- Habilita formalmente la línea de trabajo de moderación con clasificadores externos descrita en ADR-030.
- No cambia código existente por sí misma: la clasificación es un marco de decisión bajo el que se desarrollan los frentes técnicos.

### Operaciones

- Activa la obligación de mantener declaración 2257 visible en el footer y de nombrar un Records Custodian antes del go-live público.
- Activa la obligación de producir las políticas formales que el PSP exigirá (Content Management, Consumer Age Verification, Complaint & Removal, Model Agreement, Chargeback-Fraud Mitigation) — detalle en `docs/01-business/compliance-deliverables.md`.
- Activa el ciclo de reporting periódico al PSP (mensual + nil report cuando no hay actividad relevante).

### Riesgos

- El régimen adult exige sostener procesos de moderación, verificación y reporting de forma continuada; un fallo en cualquiera puede disparar congelación de fondos o cierre de cuenta del PSP. Riesgos concretos en `docs/04-operations/known-risks.md`.
- Procesamiento de datos biométricos (estimación facial) bajo GDPR: probable DPIA y base jurídica explícita; tratamos esto como entregable accionable en `docs/01-business/compliance-deliverables.md`.

## Consecuencias

Positivas:

- Coherencia entre el catálogo real del producto y la postura regulatoria.
- Selección de PSPs alineados con el vertical (Segpay como vía activa actual; ver `psp-strategy.md`), evitando recategorización a posteriori por PSP generalista.
- Compliance construido una sola vez sirve para todos los mercados servidos.

Negativas:

- Carga operativa mensual sostenida (reporting, gestión de quejas, monitorización).
- Régimen regulatorio más estricto en los mercados objetivo: cualquier expansión geográfica futura tendrá que reverificarse contra el régimen local (ver `docs/01-business/geographic-strategy.md`).

Trade-off asumido:

- Se prefiere construir compliance completo desde el origen frente al riesgo operativo de tener que rehacerlo en condiciones de urgencia tras una recategorización.

## Notas

La clasificación adult/streaming es decisión direccional cerrada. Los frentes derivados (PSP, verificación, moderación, geografía) están en distintos estados de avance: la dirección está fijada por este ADR y por los ADRs siguientes, pero la implementación concreta y los contratos con vendors no están finalizados al cierre de este ADR.
