# Model Contract v5 — Borrador cláusulas ADR-052 §D7

**Estado**: borrador operativo redactado por el asistente (Claude Code) el 2026-07-25 a petición del operador. **No pasa por asesoría legal externa** por decisión explícita del operador. Shareme Technologies OÜ asume la responsabilidad última del texto que se firmará con las modelos.

**Propósito**: bloque de cláusulas listo para integrar en el Model Collaboration Agreement v5 cuando se refactorice desde el v4 vigente (`v4_2026-03-23`) — refactor cubierto por la deuda R5 del 2026-06-27 y la deuda G4 (rescate de la fuente al repo). Estas cláusulas materializan la política de responsabilidad económica introducida por [ADR-052 §D7](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) y son **bloqueantes** para desplegar D9 (descuentos automáticos) sin exposición legal.

**Cómo usar este documento**:
1. Revisar las cláusulas y las **advertencias y decisiones pendientes** al final.
2. Confirmar valores numéricos concretos (umbral chargebacks, ventana notificación, SLA disputa).
3. Cuando toque el refactor v5 completo (R5): copiar estos bloques dentro del Model Contract, ajustar redacción para que fluya con el resto del texto, bump versión.
4. Añadir la traducción EN (bloque paralelo abajo) al Model Contract EN.

---

## Contexto para el lector

En el régimen económico vigente hasta v4 la modelo cobraba un porcentaje del bruto de sus sesiones sin exposición directa a chargebacks/refunds — la plataforma absorbía el riesgo económico completo. Con ADR-052 §D2 (reparto 75–79% para la modelo, más alto que el estándar del sector) el equilibrio cambia: **la modelo comparte responsabilidad económica** en los eventos que están directamente vinculados a su comportamiento en sesión, mientras que los costes operativos generales de la plataforma siguen absorbidos por el %empresa. Esta cláusula formaliza qué eventos afectan al payout de la modelo y con qué garantías.

---

## Cláusulas — Versión ES

### Cláusula X.1 — Categorías de costes y reparto de responsabilidad

Las siguientes categorías de costes derivados de la operación se clasifican en dos grupos:

**a) Costes operativos estándar, absorbidos íntegramente por Shareme Technologies OÜ dentro del porcentaje de empresa bruto**:
- Comisiones del proveedor de pagos (variable y fijo por transacción, tarjeta o cripto).
- Reservas rolling que el proveedor de pagos aplique sobre las transacciones.
- Coste técnico variable (ancho de banda WebRTC, servidores STUN/TURN, infraestructura cloud por minuto emitido).
- Coste de moderación proactiva mensual (Sightengine, monitoring, revisiones).

**b) Descuentos aplicables al payout siguiente de la Modelo, por eventos económicos específicos vinculados a esa Modelo**:
- **Chargeback** solicitado por el cliente sobre una sesión concreta en la que participó esa Modelo.
- **Refund** aprobado por Shareme Technologies OÜ tras una queja específica del cliente sobre esa Modelo (contenido no acordado, cancelación unilateral por la Modelo, sesión no completada por causa imputable a la Modelo).
- **Sanciones económicas del proveedor de pagos** derivadas de un incumplimiento claro y documentado de la Modelo (por ejemplo, contenido en sesión que dispara alerta del proveedor y multa a la plataforma).

Los descuentos del punto (b) solo aplican cuando existe **evidencia atribuible a la Modelo**, entendida como:
- Registro de la sesión (fecha, duración, cliente, tarifa) que vincula el evento al perfil de la Modelo.
- Notificación oficial del proveedor de pagos identificando la transacción.
- Registro de moderación o queja documentada según proceda.

No se aplicarán descuentos a esta categoría por: (i) errores técnicos no imputables a la Modelo (equipamiento defectuoso, conexión inestable, corte de sesión por infraestructura), (ii) no-shows (que se gestionan por vía disciplinaria, no económica), (iii) avisos o warnings administrativos sin evento económico asociado.

### Cláusula X.2 — Aplicación del descuento al payout

Cuando se produzca un evento del tipo descrito en la Cláusula X.1 (b), Shareme Technologies OÜ:

1. Notificará a la Modelo con **antelación mínima de 7 días naturales** antes de aplicar el descuento. La notificación se cursará por correo electrónico a la dirección registrada y quedará visible en el **historial de descuentos** del panel de la Modelo (Cláusula X.5).
2. La notificación indicará: motivo, fecha del evento, importe a descontar, sesión o transacción vinculada, y evidencia disponible.
3. El descuento se aplicará sobre el **payout siguiente** una vez transcurrido el plazo de notificación, salvo que la Modelo abra una disputa según la Cláusula X.4, en cuyo caso el descuento queda **suspendido hasta resolución**.
4. Si el importe a descontar excede el payout siguiente, el saldo pendiente se **arrastra a los payouts posteriores** hasta compensar, con un **límite máximo de arrastre de 90 días naturales** desde el evento original. Transcurrido ese plazo sin compensar, el saldo no compensado queda absorbido por Shareme Technologies OÜ.

En ningún caso la aplicación del descuento generará un saldo negativo indefinido ni obligará a la Modelo a aportar fondos adicionales fuera de sus ingresos en la plataforma.

### Cláusula X.3 — Umbral de suspensión temporal por chargebacks

Con el objetivo de proteger la salud económica de la plataforma y de mantener el ratio de chargebacks agregado dentro de los límites que exigen los proveedores de pagos:

1. Se calcula mensualmente el ratio individual de la Modelo como **(importe total de chargebacks atribuibles a la Modelo en el mes) / (facturación bruta atribuida a la Modelo en el mes)**, sobre ventana de **30 días naturales rolling**.
2. Si este ratio supera el **5%** en un mes calendario, la cuenta de la Modelo entra en **estado de suspensión temporal** — se pausa el matching de sesiones y se paraliza la ejecución de payouts pendientes hasta revisión.
3. La revisión la realiza el equipo de operaciones de Shareme Technologies OÜ, en un plazo máximo de **15 días naturales** desde la suspensión.
4. La reactivación requiere que se haya subsanado la causa (por ejemplo, cambio de comportamiento verificable, respuesta satisfactoria a queja del cliente, aclaración de un chargeback disputable) y se confirme por escrito por el equipo de operaciones. La Modelo puede aportar evidencia adicional durante la revisión.
5. Reincidencia superior a **3 suspensiones temporales en 12 meses** puede motivar la **cancelación definitiva** del acuerdo de colaboración, con liquidación del saldo pendiente conforme a las reglas generales del contrato.

### Cláusula X.4 — Derecho a disputa del descuento

La Modelo tiene derecho a **disputar cualquier descuento** notificado según la Cláusula X.2:

1. La disputa se abre desde el propio panel de la Modelo mediante el mecanismo habilitado a tal efecto (Cláusula X.5) o mediante correo electrónico dirigido a la dirección de soporte de Shareme Technologies OÜ.
2. La apertura de disputa **suspende automáticamente la ejecución del descuento** hasta que se resuelva.
3. La Modelo puede aportar cualquier evidencia relevante: descripción de la sesión, comunicaciones previas con el cliente, capturas del chat de la sesión, cualquier otro material que considere pertinente.
4. Shareme Technologies OÜ resolverá la disputa en un plazo máximo de **10 días hábiles** desde su apertura. La resolución se comunicará por escrito con motivación.
5. Si la disputa se estima total o parcialmente, el descuento se anulará o reducirá según proceda, y quedará constancia en el historial.
6. Si la disputa se desestima, el descuento se ejecutará en el payout siguiente disponible.
7. La resolución de Shareme Technologies OÜ es vinculante en el ámbito interno del contrato. La Modelo conserva sus derechos legales generales conforme a la legislación aplicable.

### Cláusula X.5 — Transparencia en el panel de la Modelo

Shareme Technologies OÜ pone a disposición de la Modelo, en su panel de gestión, la siguiente información en tiempo real:

- **Tramo actual** de reparto vigente con su porcentaje, umbral inferior y umbral del siguiente tramo.
- **Rango de precio** permitido en su tramo y **tarifa por minuto elegida** dentro de ese rango.
- **Estatus Pro** cuando corresponda, con el toggle de aceptación de clientes trial.
- **Historial completo de descuentos** aplicados o notificados, con: fecha, motivo, importe, sesión o transacción vinculada, evidencia disponible, estado (notificado / en disputa / aplicado / anulado).
- **Ratio individual de chargebacks** del mes en curso y de los últimos 3 meses, con indicación visual cuando se aproxime al umbral del 5%.
- **Botón de disputa** asociado a cada descuento no ejecutado, que abre el mecanismo descrito en la Cláusula X.4.

Esta transparencia es requisito operativo de la política de descuentos. En ausencia de acceso funcional al panel por parte de la Modelo, la aplicación de descuentos según la Cláusula X.2 queda suspendida hasta que el acceso se restablezca.

### Cláusula X.6 — Consentimiento explícito

La Modelo, al aceptar la versión v5 del presente Model Collaboration Agreement, **presta consentimiento expreso** a la aplicación automática de los descuentos regulados en las Cláusulas X.1 a X.5 y de la reserva anti-chargeback de la Cláusula X.7, en los términos descritos, con las garantías de notificación previa, derecho de disputa y transparencia establecidas.

### Cláusula X.7 — Reserva anti-chargeback en el periodo inicial

Con el objetivo de disponer de un colchón económico frente a posibles chargebacks o refunds tempranos y de proteger tanto a Shareme Technologies OÜ como a la Modelo frente a saldos negativos disruptivos en su primer ciclo de actividad:

1. Durante los **primeros 90 días naturales** desde la fecha de aceptación del presente contrato v5, Shareme Technologies OÜ retendrá el **5% de cada payout** de la Modelo en una reserva interna vinculada a su cuenta. Esta retención se aplica **con independencia del método de pago del cliente** (tarjeta o cripto), unificando el tratamiento operativo.
2. La reserva es plenamente visible para la Modelo en su panel de gestión, con importe acumulado, fecha de cada retención y fecha estimada de liberación.
3. Los importes retenidos se utilizan **exclusivamente** para compensar descuentos originados por las Cláusulas X.1 a X.2 antes de tocar el payout activo. El uso de la reserva se registra en el historial de descuentos (Cláusula X.5) con la misma transparencia.
4. Transcurridos los 90 días naturales, el importe acumulado que **no haya sido consumido** por descuentos se libera a favor de la Modelo en su siguiente payout, con notificación explícita del importe liberado.
5. Si la Modelo cesa su actividad en la plataforma antes de que finalicen los 90 días (baja voluntaria, cancelación del acuerdo), la reserva se liquida siguiendo el mismo criterio: importe no consumido se transfiere a la Modelo junto con el saldo final; importe consumido por descuentos ya aplicados no se devuelve.
6. La reserva **no aplica** a Modelos que reactivan una cuenta ya existente en la plataforma con historial previo verificable de baja voluntaria (no de suspensión disciplinaria). En estos casos la cuenta reanuda con el porcentaje pleno del payout desde el primer día.

---

## Clauses — English Version

### Clause X.1 — Cost Categories and Responsibility Allocation

Costs arising from the operation are classified in two groups:

**a) Standard operating costs, fully absorbed by Shareme Technologies OÜ within the gross platform share**:
- Payment provider fees (variable and fixed per transaction, card or crypto).
- Rolling reserves applied by the payment provider on transactions.
- Variable technical cost (WebRTC bandwidth, STUN/TURN servers, cloud infrastructure per streamed minute).
- Monthly proactive moderation cost (Sightengine, monitoring, reviews).

**b) Deductions applicable to the Model's next payout, for specific economic events linked to that Model**:
- **Chargeback** requested by the customer over a specific session in which that Model participated.
- **Refund** approved by Shareme Technologies OÜ following a specific customer complaint about that Model (content not agreed, unilateral cancellation by the Model, session not completed for reasons attributable to the Model).
- **Payment provider penalties** derived from a clear and documented breach by the Model (for example, in-session content triggering a provider alert and a fine to the platform).

The deductions in point (b) only apply where **evidence attributable to the Model** exists, understood as:
- Session record (date, duration, customer, rate) linking the event to the Model's profile.
- Official notification from the payment provider identifying the transaction.
- Moderation record or documented complaint as applicable.

No deductions in this category will apply for: (i) technical errors not attributable to the Model (defective equipment, unstable connection, session drop due to infrastructure), (ii) no-shows (handled through disciplinary channels, not economic), (iii) administrative notices or warnings with no associated economic event.

### Clause X.2 — Application of the Deduction to the Payout

Where an event described in Clause X.1 (b) occurs, Shareme Technologies OÜ shall:

1. Notify the Model with **a minimum of 7 calendar days' advance notice** before applying the deduction. Notice shall be given by email to the registered address and shall be visible in the **deduction history** of the Model's dashboard (Clause X.5).
2. The notice shall state: reason, event date, amount to be deducted, linked session or transaction, and available evidence.
3. The deduction shall be applied on the **next payout** once the notice period has elapsed, unless the Model opens a dispute under Clause X.4, in which case the deduction is **suspended until resolution**.
4. If the amount to be deducted exceeds the next payout, the pending balance is **carried over to subsequent payouts** until offset, with a **maximum carry-over of 90 calendar days** from the original event. After that period without offset, the uncompensated balance is absorbed by Shareme Technologies OÜ.

In no event shall the application of the deduction generate an indefinite negative balance or oblige the Model to contribute funds beyond her earnings on the platform.

### Clause X.3 — Temporary Suspension Threshold for Chargebacks

In order to protect the economic health of the platform and to maintain the aggregate chargeback ratio within the limits required by payment providers:

1. The Model's individual monthly ratio is calculated as **(total amount of chargebacks attributable to the Model in the month) / (gross billing attributed to the Model in the month)**, over a **rolling 30-calendar-day window**.
2. If this ratio exceeds **5%** in a calendar month, the Model's account enters **temporary suspension** — session matching is paused and pending payout execution is halted until review.
3. The review is conducted by the operations team of Shareme Technologies OÜ within a maximum of **15 calendar days** from suspension.
4. Reactivation requires that the cause has been remedied (for example, verifiable behavior change, satisfactory response to customer complaint, clarification of a disputable chargeback) and is confirmed in writing by the operations team. The Model may provide additional evidence during the review.
5. More than **3 temporary suspensions within 12 months** may lead to **definitive termination** of the collaboration agreement, with settlement of the outstanding balance pursuant to the general rules of the contract.

### Clause X.4 — Right to Dispute the Deduction

The Model has the right to **dispute any deduction** notified pursuant to Clause X.2:

1. The dispute is opened from the Model's dashboard through the mechanism provided (Clause X.5) or by email to the Shareme Technologies OÜ support address.
2. Opening a dispute **automatically suspends the execution of the deduction** until resolved.
3. The Model may provide any relevant evidence: description of the session, prior communications with the customer, chat screenshots, any other material she considers pertinent.
4. Shareme Technologies OÜ shall resolve the dispute within a maximum of **10 business days** from opening. The resolution shall be communicated in writing with reasoning.
5. If the dispute is upheld in whole or in part, the deduction shall be voided or reduced as appropriate, and shall be recorded in the history.
6. If the dispute is rejected, the deduction shall be executed on the next available payout.
7. Shareme Technologies OÜ's resolution is binding within the internal scope of the contract. The Model retains her general legal rights under applicable law.

### Clause X.5 — Transparency on the Model's Dashboard

Shareme Technologies OÜ provides the Model, on her management dashboard, with the following real-time information:

- **Current tier** of applicable share with its percentage, lower threshold, and next tier threshold.
- **Price range** permitted in her tier and **per-minute rate chosen** within that range.
- **Pro status** where applicable, with the trial customer acceptance toggle.
- **Complete history of deductions** applied or notified, with: date, reason, amount, linked session or transaction, available evidence, status (notified / disputed / applied / voided).
- **Individual chargeback ratio** for the current month and the last 3 months, with visual indication when approaching the 5% threshold.
- **Dispute button** associated with each non-executed deduction, opening the mechanism described in Clause X.4.

This transparency is an operational requirement of the deduction policy. In the absence of functional dashboard access by the Model, the application of deductions under Clause X.2 shall be suspended until access is restored.

### Clause X.6 — Explicit Consent

The Model, upon accepting version v5 of this Model Collaboration Agreement, **grants express consent** to the automatic application of the deductions regulated in Clauses X.1 to X.5 and of the anti-chargeback reserve set forth in Clause X.7, on the terms described, with the guarantees of prior notice, right to dispute and transparency established.

### Clause X.7 — Anti-chargeback Reserve during the Initial Period

In order to provide an economic buffer against potential early chargebacks or refunds and to protect both Shareme Technologies OÜ and the Model from disruptive negative balances during her first activity cycle:

1. For the **first 90 calendar days** from the date of acceptance of this v5 contract, Shareme Technologies OÜ shall withhold **5% of each Model's payout** in an internal reserve linked to her account. This withholding applies **regardless of the customer's payment method** (card or crypto), unifying operational treatment.
2. The reserve is fully visible to the Model in her management dashboard, with accumulated amount, date of each withholding, and estimated release date.
3. The withheld amounts are used **exclusively** to offset deductions arising from Clauses X.1 to X.2 before touching the active payout. Use of the reserve is recorded in the deduction history (Clause X.5) with the same transparency.
4. After the 90 calendar days, the accumulated amount **not consumed** by deductions is released in favor of the Model on her next payout, with explicit notification of the released amount.
5. If the Model ceases activity on the platform before the 90 days end (voluntary termination, agreement cancellation), the reserve is settled following the same criterion: unused amount is transferred to the Model together with the final balance; amount consumed by already-applied deductions is not refunded.
6. The reserve **does not apply** to Models reactivating an existing account on the platform with verifiable prior history of voluntary termination (not disciplinary suspension). In these cases the account resumes with full payout percentage from day one.

---

## Decisiones del operador — valores confirmados

Los siguientes valores concretos han sido confirmados por el operador el 2026-07-25 y quedan integrados en el texto anterior. Se preserva el histórico completo (contexto, alternativas evaluadas, riesgos) para trazabilidad de por qué se eligió cada uno.

### 1. Umbral chargebacks — 5% mensual con ventana rolling 30 días — CONFIRMADO

El §D7 del ADR-052 dice "~5%" sin fijar cifra exacta. El operador confirma **5% estrictos** con ventana rolling 30 días.

- Referencia sector: Visa Rule ID 0003356 obliga a que la plataforma agregada mantenga el chargeback ratio por debajo del **1% mensual** para MCC 5967 (adult content) y por debajo del 0.9% para tarjetas no-cripto. Si supera esos límites, la plataforma pasa a categoría "high-risk" con reservas mayores y comisiones más altas del PSP.
- Alternativa evaluada y descartada: 3% individual (más estricto). No se elige porque en la fase actual sólo cripto (NOWPayments) los chargebacks son prácticamente inexistentes; 5% da margen operativo sin arrastrar al agregado.
- **Revisar** cuando se integre PSP tarjeta: probable bajada a 3% para proteger el agregado bajo el 1% Visa.

### 2. Ventana de notificación previa — 7 días naturales — CONFIRMADO

7 días naturales entre notificación del descuento y aplicación al payout.

- Alineado con la cadencia típica del PayoutRequest (bajo demanda, no automático). La modelo típicamente pide el payout cada 1-4 semanas, 7 días es cómodo.
- Alternativa evaluada y descartada: 3 días hábiles. Más rápido pero puede leerse como poca ventana en un juzgado si la modelo alega ausencia.
- Cumple con lo razonable para un juzgado UE, no colisiona con normas imperativas (la Modelo es contraparte profesional, no consumidor).

### 3. SLA resolución disputa — 10 días hábiles — CONFIRMADO

10 días hábiles desde apertura de disputa hasta resolución escrita.

- Plazo estándar del sector para gestión de queries operacionales.
- Riesgo asumido: si el volumen de disputas crece con muchas modelos activas y no se puede cumplir, la modelo tiene argumento legal directo. Mitigar con dotación de operaciones proporcional al volumen.

### 4. Arrastre máximo saldo pendiente — 90 días naturales — CONFIRMADO

Si un descuento excede el payout se arrastra a posteriores con **máximo 90 días**. Pasado ese plazo el saldo no compensado lo absorbe Shareme Technologies OÜ.

- Alineado con la ventana operacional del PSP (60-120 días típicos de chargeback tarjeta).
- Alternativa evaluada y descartada: 180 días. Se acerca a "cláusula perpetua" que un juzgado europeo puede tumbar.

### 5. Reincidencia — 2 suspensiones en 12 meses → cancelación definitiva — CONFIRMADO

2 suspensiones temporales en 12 meses habilitan la cancelación definitiva del acuerdo con liquidación del saldo pendiente según reglas generales.

- Más estricto que la sugerencia inicial de 3 en 12m. Se aplica criterio del operador: no dar más de una segunda oportunidad tras una primera suspensión, porque en el sector adult la reincidencia por comportamiento problemático suele confirmar patrón, no incidente aislado.
- Consideración residual: en un juicio, una modelo puede argumentar que la primera suspensión fue disputable. Mitigación cubierta por Cláusula X.4 (la modelo puede disputar la primera suspensión antes de que se ejecute; si gana, no computa para reincidencia).

### 6. Reserva anti-chargeback 5% primeros 90 días — CONFIRMADO E INCLUIDO (Cláusula X.7)

Cláusula nueva X.7 añadida al borrador (ES + EN). Retención del 5% de cada payout durante los primeros 90 días naturales desde aceptación del v5. Aplica independientemente del método de pago del cliente (cripto o tarjeta).

- Criterio del operador: preferible dejar la infraestructura contractual lista aunque hoy con solo cripto los chargebacks sean raros, para no depender de "acordarse de añadirla" cuando llegue la tarjeta. La retención no perjudica a la Modelo (se libera íntegra tras 90 días si no hay descuentos); solo protege a la plataforma en el escenario adverso.
- Redacción de la cláusula neutral respecto a método de pago (evita relanzar la discusión cuando se integre tarjeta).
- Alcance: aplica solo a modelos nuevas o reactivadas tras suspensión disciplinaria. No aplica a modelos que reactivan una cuenta con historial previo verificable de baja voluntaria.

### 7. Jurisdicción aplicable — NO ES DECISIÓN NUEVA

El Model Contract v4 vigente ya contiene la cláusula de jurisdicción y ley aplicable (asume Estonia, tribunales de Tallinn, alineado con la sede de Shareme Technologies OÜ). Al hacer bump a v5 esa cláusula se mantiene tal cual. **No se lista como decisión pendiente** — era falsa alarma del borrador original.

### Zonas grises operativas — mitigación documentada

**a) "Contenido no acordado" en la Cláusula X.1 (b)**. Expresión intencionalmente amplia para cubrir casos que no se pueden pre-catalogar. En una disputa un juez puede requerir mayor concreción. Mitigación: mantener la práctica de que cada queja de refund tenga un texto libre del cliente explicando el motivo, y usar ese texto como evidencia atribuible.

**b) "Sanciones económicas del proveedor de pagos"**. Aplicable sobre todo con Visa/Mastercard cuando se integre tarjeta. Con NOWPayments cripto las sanciones son extremadamente raras. La cláusula queda preparada. Cuando se integre PSP tarjeta, revisar si el propio contrato del PSP obliga a repasar esta cláusula.

---

## Estado de implementación técnica de las cláusulas

Este bloque documenta qué respaldo técnico tiene hoy cada cláusula del borrador, para que el operador sepa qué es publicable con seguridad y qué requiere desarrollo del **Sub-frente 3 técnico de ADR-052** antes de aplicarse en la práctica. Verificado por recorrido del código el 2026-07-25.

### Cláusulas con infraestructura técnica lista

**Cláusula X.5 puntos 1-3 (transparencia panel: tramo, %, rango precio, tarifa elegida, estatus Pro, toggle trial)** — **LISTO**. Todo esto vive en `/model/economics` desde ADR-052 Sub-frente 3.C. `ModelPricingPanel.jsx` lo pinta al día. Ninguna cláusula del borrador toca aquí funcionalidad que no exista.

**Cláusula X.6 (consentimiento explícito al aceptar v5)** — **INFRAESTRUCTURA LISTA**. `ModelContractManifestService` con verificación SHA256 y estado `acceptedCurrent=false` ya está cableado a los flujos sensibles (assets, KYC docs, payouts, handshake WS de matching/messages tanto para role=MODEL como para FORM_MODEL). Al publicar el PDF v5 con manifest actualizado, las 18 modelos vivas pasan automáticamente a estado "necesitan re-aceptar" y no pueden operar hasta firmar. Migración V7 protege la evidencia con FK ON DELETE RESTRICT.

**Cláusula X.1 (categorías de costes)** — **DECLARATIVA**. No requiere código. Es marco contractual.

### Cláusulas con implementación pendiente (Sub-frente 3 técnico ADR-052)

**Cláusula X.2 (notificación previa 7 días + arrastre 90 días)** — **NO IMPLEMENTADA**.
- No existe entidad `DeductionEvent` ni tabla `payout_deductions`.
- No existe sistema de notificación email 7 días antes de aplicar descuento.
- No existe lógica de arrastre entre payouts sucesivos con corte a 90 días.
- Implementación estimada: entidad + repositorio + servicio + integración con `PayoutRequestService` existente + template de email + job diario para procesar arrastres.

**Cláusula X.3 (umbral 5% suspensión temporal + reactivación en 15 días)** — **NO IMPLEMENTADA**.
- No existe cálculo automático del ratio individual rolling 30d por modelo.
- No existe suspensión automática al superar umbral.
- **Falta estado nuevo en `PayoutRequest`**: hoy `REQUESTED / APPROVED / REJECTED / PAID / CANCELED`. Necesita añadir `UNDER_REVIEW` (o similar) para paralizar payouts pendientes cuando la modelo entra en suspensión.
- No existe flujo de reactivación tras revisión.
- No existe conteo de reincidencia 2/12m para escalar a cancelación definitiva.

**Cláusula X.4 (disputa con SLA 10 días hábiles)** — **NO IMPLEMENTADA**.
- No existe botón de disputa en panel modelo (`ModelPricingPanel.jsx` no tiene sección de descuentos).
- No existe sistema de tickets internos con SLA.
- No existe endpoint para abrir disputa ni para gestionarla desde admin.

**Cláusula X.5 puntos 4-6 (historial descuentos, ratio chargebacks, botón disputa)** — **NO IMPLEMENTADA**.
- Falta la lectura y renderizado en el panel de la modelo.
- Depende de que la Cláusula X.2 (entidad DeductionEvent) esté implementada primero.

**Cláusula X.7 (reserva 5% primeros 90 días)** — **NO IMPLEMENTADA**.
- No existe campo `reserve_balance` ni tabla de tracking de reservas.
- No existe lógica de retención en el momento del payout.
- No existe job de liberación tras 90 días.
- No existe visualización en panel modelo.

### Deudas técnicas confirmadas expuestas por el borrador

**A. Registro de causa del cierre de sesión**. La Cláusula X.1(b) menciona "cancelación unilateral por la Modelo" como causal de refund atribuible. Verificado: `StreamService.endSession(clientId, modelId, endReason)` acepta el parámetro `endReason`, pero los únicos valores usados en el código son `"low-balance"` (2 sitios: `MatchingHandlerSupport:1725` y `MessagesWsHandlerSupport:635`) o `null` (mayoría de callers). No existen valores como `MODEL_HUNG`, `CLIENT_HUNG`, `TECHNICAL_ERROR`. **Para que la atribución sea legítima cuando se implemente §D9**, el sistema debe distinguir la causa del cierre y persistirla en `stream_records`. Sin esta información no se puede aplicar la parte de "cancelación unilateral por la Modelo" con evidencia auditable.

**B. Estado UNDER_REVIEW en PayoutRequest**. Ver Cláusula X.3 arriba.

**C. Tabla payout_deductions o similar**. Necesaria para materializar las Cláusulas X.2, X.4, X.5 puntos 4-6. Debe incluir: `id`, `model_user_id`, `stream_record_id` (opcional, para eventos vinculados a sesión concreta), `reason` (CHARGEBACK / REFUND / PSP_PENALTY), `amount_eur`, `status` (NOTIFIED / IN_DISPUTE / APPLIED / VOIDED / EXPIRED), `notified_at`, `apply_after` (notified_at + 7 días), `applied_at`, `voided_at`, `evidence_json`, timestamps.

**D. Tabla payout_reserves o similar**. Necesaria para materializar la Cláusula X.7. Debe incluir: `id`, `model_user_id`, `contract_accepted_at` (baseline del cálculo de 90 días), `balance_eur` (acumulado retenido), `released_at`, `released_amount_eur`, timestamps.

### Consecuencia práctica para publicar el v5

El operador puede publicar el Model Contract v5 con las 7 cláusulas ya redactadas y hacer re-aceptación forzada de las 18 modelos vivas. Desde ese momento las modelos consienten legalmente la política. **Pero la ejecución automática seguirá siendo manual** hasta que se materialice el Sub-frente 3 técnico:

1. Chargeback real → operador lo detecta en dashboard NOWPayments (o en el futuro Visa) → SQL manual para registrar la deducción → email manual a la modelo con la notificación → ajuste manual del PayoutRequest cuando toque procesar.
2. Umbral 5% superado → cálculo SQL manual mensual → suspensión manual vía admin → email manual.
3. Disputa → email de la modelo a soporte → gestión manual → resolución manual con SLA.
4. Reserva 5% → retención manual al procesar cada payout hasta que se automatice.

El **valor de publicar el v5 ya** aunque la implementación técnica venga después: legitimar legalmente cualquier descuento manual que se aplique en el ínterin. Sin v5 firmado, un descuento manual hoy sería impugnable con base en el v4 que no contempla la política. Con v5 firmado, la modelo ha consentido la política aunque la ejecución sea aún artesanal.

**Prioridad del Sub-frente 3 técnico**: dependerá del volumen real de chargebacks/refunds una vez PROD arranque con tráfico. Con solo cripto y volumen bajo, el manual es sostenible. Cuando aparezcan los primeros 5-10 chargebacks reales o cuando se integre PSP tarjeta, la automatización se vuelve urgente.

---

## Referencias

- [ADR-052 §D7 — Responsabilidad económica de la modelo](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)
- [ADR-052 §D9 — Transparencia en el panel de la modelo](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)
- [known-debt.md #D-26 — T&C y contrato de modelo v5](../04-operations/known-debt.md)
- [known-debt.md R5 — Model Collaboration Agreement v5 con lenguaje nuevo](../04-operations/known-debt.md) (bloque 2026-06-27)
- [known-debt.md G4 — Fuente del Model Collaboration Agreement no está en el repo](../04-operations/known-debt.md) (bloque 2026-06-27)
- [pricing.md — Modelo de reparto autoservicio](pricing.md)
