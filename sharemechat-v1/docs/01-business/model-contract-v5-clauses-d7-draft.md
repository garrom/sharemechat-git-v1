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

La Modelo, al aceptar la versión v5 del presente Model Collaboration Agreement, **presta consentimiento expreso** a la aplicación automática de los descuentos regulados en las Cláusulas X.1 a X.5, en los términos descritos, con las garantías de notificación previa, derecho de disputa y transparencia establecidas.

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

The Model, upon accepting version v5 of this Model Collaboration Agreement, **grants express consent** to the automatic application of the deductions regulated in Clauses X.1 to X.5, on the terms described, with the guarantees of prior notice, right to dispute and transparency established.

---

## Advertencias y decisiones pendientes del operador

El texto anterior contiene decisiones de negocio que el asistente ha calibrado según patrones típicos del sector adult cam. Antes de integrar en el Model Contract v5 vigente, el operador debe **confirmar o ajustar** los siguientes valores:

### 1. Umbral chargebacks 5% mensual — CALIBRAR

El §D7 del ADR-052 dice "~5%" sin fijar cifra exacta. El borrador usa **5% estrictos** con ventana rolling 30 días.

- **Referencia sector**: Visa Rule ID 0003356 obliga a que la plataforma agregada mantenga el chargeback ratio por debajo del **1% mensual** para MCC 5967 (adult content) y por debajo del 0.9% para tarjetas no-cripto. Si supera esos límites, la plataforma pasa a categoría "high-risk" con reservas mayores y comisiones más altas del PSP.
- **Consecuencia**: 5% individual por modelo puede ser demasiado permisivo si tienes 10 modelos activas. Si 2 modelos generan 5% cada una, arrastran el agregado hacia el límite Visa.
- **Sugerencia alternativa**: bajar a **3% individual** con la ventana rolling 30 días. Es más estricto pero deja margen para que el agregado se mantenga bajo 1%.
- **Decisión del operador**: [ ] 5% [ ] 3% [ ] otro __%

### 2. Ventana de notificación previa 7 días — CALIBRAR

El borrador fija 7 días naturales entre notificación del descuento y aplicación al payout.

- **Consideración práctica**: los payouts en Sharemechat operan bajo la política de PayoutRequest existente (mensual o bajo demanda según lo que decidas). Si un payout se solicita cada 15 días, 7 días de aviso es razonable. Si se ejecutan diariamente, 7 días es demasiado.
- **Consideración legal**: en jurisdicciones UE la Directiva 2011/83/UE sobre derechos consumidor exige plazos de reflexión (aunque aquí la modelo es contraparte profesional, no consumidor). Estonia no tiene requisito específico en Law of Obligations Act para descuentos B2B.
- **Sugerencia alternativa**: mantener 7 días si los payouts son mensuales; bajar a **3 días hábiles** si son diarios/semanales.
- **Decisión del operador**: [ ] 7 días naturales [ ] 3 días hábiles [ ] otro

### 3. SLA resolución disputa 10 días hábiles — CALIBRAR

El borrador fija 10 días hábiles desde apertura de disputa hasta resolución escrita.

- Es un plazo estándar del sector para gestión de queries operacionales.
- Si tu equipo de operaciones es pequeño (tú + 1-2 personas), 10 días hábiles es factible.
- Si el volumen de disputas crece (esperable con >50 modelos activas), puede requerir automatización o extensión a 15 días.
- **Decisión del operador**: [ ] 10 días hábiles [ ] 15 días hábiles [ ] otro

### 4. Límite de arrastre 90 días naturales — CALIBRAR

El borrador establece que si un descuento excede el payout, se arrastra a posteriores con **máximo 90 días** de arrastre; pasado ese plazo, el saldo no compensado lo absorbe la plataforma.

- Sin límite temporal el descuento podría arrastrarse indefinidamente contra futuras ganancias — un juzgado europeo típicamente tumba cláusulas de saldo negativo indefinido en contratos con contraparte débil.
- 90 días es equivalente al plazo típico de chargeback tarjeta (60-120 días). Alinea plazos.
- **Alternativa más agresiva**: 180 días de arrastre. Da más margen a la plataforma pero incrementa riesgo de disputa por acumulación.
- **Decisión del operador**: [ ] 90 días [ ] 180 días [ ] otro

### 5. Reincidencia 3 suspensiones/12 meses → cancelación definitiva — VALIDAR

El borrador establece que 3 suspensiones temporales en 12 meses habilitan la cancelación definitiva.

- Es una cláusula proporcional que protege a la plataforma sin ser draconiana.
- **Riesgo si se relaja**: una modelo con comportamiento crónico problemático puede acumular suspensiones sin salida.
- **Riesgo si se endurece** (por ejemplo 2 suspensiones): puede leerse como injusto en la primera reincidencia.
- **Decisión del operador**: [ ] 3 en 12m [ ] 2 en 12m [ ] otro

### 6. Zonas grises detectadas

**a) "Contenido no acordado" en la Cláusula X.1 (b)**. La expresión es intencionalmente amplia para cubrir casos que no se pueden pre-catalogar (peticiones específicas del cliente que la modelo ignora, comportamiento fuera del brief de la sesión, etc.). En una disputa un juez puede requerir mayor concreción. **Mitigación**: mantener la práctica actual de que cada queja de refund tenga un texto libre del cliente explicando el motivo, y usar ese texto como evidencia atribuible.

**b) "Cancelación unilateral por la Modelo"**. Cubre casos donde la modelo cuelga la sesión sin causa técnica. En la práctica requiere que el sistema distinga entre cortes técnicos y cortes voluntarios — hoy no hay tal distinción explícita en `endSession` (todos los cierres se tratan igual). **Antes de aplicar esta parte de la cláusula**, el sistema tiene que poder registrar la causa del cierre (cliente colgó / modelo colgó / corte técnico / kill switch moderación). Deuda técnica implícita que este borrador expone.

**c) "Sanciones económicas del proveedor de pagos"**. Aplicable sobre todo con Visa/Mastercard cuando integres tarjeta (hoy solo cripto). Con NOWPayments cripto las sanciones son extremadamente raras. La cláusula queda preparada para cuando integres tarjeta. **Nota**: cuando integres PSP tarjeta, revisar si el propio contrato del PSP obliga a repasar esta cláusula.

**d) "Estado de suspensión temporal"**. El borrador dice que "se pausa el matching de sesiones y se paraliza la ejecución de payouts pendientes". Técnicamente hoy la suspensión de matching se puede hacer vía `account_status` (SUSPENDED), pero la paralización de payouts pendientes hasta revisión no está automatizada. **Deuda técnica implícita**: cuando implementes la mecánica automática §D9 tendrás que cablear el flag de "payout paralizado por review" en la entidad PayoutRequest.

**e) Cláusula sobre reserva del 5% en primeros 90 días — NO INCLUIDA**. Muchas plataformas del sector adult retienen el 5% de los payouts iniciales de una modelo como buffer anti-chargeback (rolling reserve interno). Este borrador **NO incluye esa cláusula** porque el operador no ha pedido introducirla y añade complejidad operativa. Si en el futuro los chargebacks reales lo justifican, se puede incorporar como cláusula X.7. **Decisión del operador**: [ ] no incluir por ahora [ ] incluir con % ___ y ventana ___ días

### 7. Jurisdicción aplicable

El borrador presume que el Model Contract se rige por la ley de Estonia (Estonian Law of Obligations Act) al ser Shareme Technologies OÜ una sociedad estonia. Esta cláusula de jurisdicción **debe estar explícita** en el Model Contract v5 completo (probablemente ya lo esté en v4, verificar al rescatar la fuente). Este borrador **no la añade** porque asume que la trae el contrato base.

Recordatorio: en la UE existe la Regulación Roma I sobre ley aplicable a obligaciones contractuales, que permite pactar la ley aplicable pero con límite de las normas imperativas del país de la parte más débil. Si una modelo española demanda en España, un juzgado español puede aplicar normas imperativas españolas aunque el contrato diga "ley de Estonia".

---

## Referencias

- [ADR-052 §D7 — Responsabilidad económica de la modelo](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)
- [ADR-052 §D9 — Transparencia en el panel de la modelo](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)
- [known-debt.md #D-26 — T&C y contrato de modelo v5](../04-operations/known-debt.md)
- [known-debt.md R5 — Model Collaboration Agreement v5 con lenguaje nuevo](../04-operations/known-debt.md) (bloque 2026-06-27)
- [known-debt.md G4 — Fuente del Model Collaboration Agreement no está en el repo](../04-operations/known-debt.md) (bloque 2026-06-27)
- [pricing.md — Modelo de reparto autoservicio](pricing.md)
