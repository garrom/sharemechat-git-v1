# Contrato Master ↔ SharemeChat — v3.1 (borrador)

> **Versión propuesta**: `master_contract_v3_1_2026-08-03`.
> **Base legal**: derecho de Estonia. Jurisdicción: tribunales de Tallinn.
> **Emisor**: Shareme Technologies OÜ ("SharemeChat").
> **PDF**: se genera con `ops/legal-pdfs/generate_master_contract_v3_pdf.py` y se publica en `assets.sharemechat.com/legal/master_contract.pdf`.

---

## 1. Partes

**Parte A — SharemeChat**:
Shareme Technologies OÜ, sociedad de Estonia (registry code 17444422), domicilio en Lõõtsa tn 5, 11415 Tallinn.
Contactos: `operations@sharemechat.com` (general), `legal@sharemechat.com` (notificaciones legales, RGPD, DPO, AML).

**Parte B — Master**:
Persona física identificada mediante KYC de la plataforma, en su calidad de operador de un estudio de webcam que gestiona modelos a través de SharemeChat. Puede declarar los datos identificativos de la empresa desde la que opera; la persona física responde en todo caso frente a SharemeChat.

---

## 2. Objeto del contrato

SharemeChat autoriza al Master a operar en la plataforma con el rol técnico `MASTER`. Puede:

- Registrar modelos y gestionarlas desde su cuenta Master.
- Ajustar la tarifa de cada modelo dentro del rango vigente de su tramo.
- Consultar estadísticas económicas y de actividad de sus modelos.
- Recibir en su cuenta el importe generado por la actividad de sus modelos según el reparto de la sección 5.
- Solicitar retiros de saldo (payouts) desde su cuenta.

El Master **no**:

- Realiza streams personalmente bajo el rol Master. Si quiere actuar también como modelo, se registra por separado con otra cuenta.
- Accede a los datos personales de identificación de las modelos (nombre real, documento, dirección, teléfono, email personal). Estos datos son de exclusivo control de SharemeChat.
- Gestiona las contraseñas de las modelos. Cada modelo controla la suya.

---

## 3. Requisitos y verificación

El Master debe ser mayor de edad y completar el proceso de verificación de identidad (KYC) que la plataforma tenga habilitado en cada momento. SharemeChat puede solicitar reverificación cuando existan motivos razonables (cambio de datos, revisión periódica, requerimiento AML).

---

## 4. Alta y gestión de modelos

El Master registra a una modelo indicando su email. La plataforma envía un enlace único de activación a la modelo. En el primer acceso, la modelo genera su propia contraseña, firma personalmente el contrato de modelo vigente y pasa su propio KYC. El Master no puede sustituir a la modelo en ninguno de estos pasos.

Una modelo puede quedar **desactivada** por el Master, manteniendo sus datos e histórico, y reactivada por el Master en cualquier momento.

Una modelo puede solicitar a SharemeChat pasar a operar como **modelo individual** (dejar el estudio Master). SharemeChat evalúa cada solicitud caso a caso, ponderando el histórico, las circunstancias y la posición del Master, e informa al Master antes de decidir, ofreciéndole un plazo razonable para exponer objeciones. SharemeChat no tramita este cambio como automatismo ni lo promueve, pero se reserva la facultad de resolverlo cuando existan motivos muy justificados, por ejemplo, incumplimientos del Master frente a la modelo o cierre del estudio.

---

## 5. Régimen económico

**Reparto sobre bruto**: por cada stream de una modelo gestionada por el Master, SharemeChat abona al Master un porcentaje sobre el bruto según el tramo que le corresponda a esa modelo (`T1`–`T4`). El tramo se calcula individualmente por cada modelo según su propia facturación bruta de los últimos 30 días. La tabla vigente se publica en el panel Master y puede consultarse en todo momento.

SharemeChat puede modificar la tabla con **preaviso mínimo de 30 días naturales** por email. Durante el preaviso el Master puede terminar el contrato sin penalización.

**Reparto interno con la modelo**: es acuerdo privado entre el Master y cada una de sus modelos. SharemeChat no participa ni regula el porcentaje pactado, pero el Master está obligado a registrarlo en la plataforma como referencia auditable en caso de disputa.

**Sin cuotas ni comisiones adicionales**: SharemeChat no cobra al Master cuota de suscripción, fee de registro, fee por modelo activa ni fee por transacción. La retribución de SharemeChat es exclusivamente el porcentaje sobre bruto que retiene según el tramo.

**Primer minuto de prueba (trial)**: cuando una modelo del Master atiende a un cliente en su primer minuto trial, el cliente no paga. SharemeChat abona al Master una compensación proporcional al tiempo consumido del primer minuto trial, calculada sobre la tarifa por minuto publicada en el panel Master. Esta compensación se abona íntegra al Master, con independencia del tramo vigente. El reparto de este tiempo con la modelo dentro del estudio queda a acuerdo interno entre Master y modelo.

**Regalos (gifts)**: los regalos que un cliente envía a una modelo del Master se acreditan al Master siguiendo el mismo criterio de reparto que 5.1.

**Transparencia a la modelo**: cada modelo puede consultar en la plataforma el importe bruto que su actividad ha generado y el porcentaje que tiene pactado con su Master. Esto permite a la modelo validar la liquidación privada.

---

## 6. Retiros de saldo (payouts)

En este contrato se utiliza indistintamente **retiro de saldo** y **payout** para referirse a la operación por la que el Master transfiere a un canal externo (e-wallet, cuenta bancaria, wallet cripto) el saldo acumulado en su cuenta SharemeChat.

- **Múltiples canales**: SharemeChat proporciona al Master varios canales de payout. La lista vigente y sus condiciones (comisiones aplicables, tiempos de acreditación, umbrales) se publican en el panel Master y pueden evolucionar sin necesidad de firmar una nueva versión de este contrato.
- **Mínimo por solicitud**: 100 EUR.
- **Máximo por solicitud**: 1.000 EUR (revisable según volumen operativo del Master).
- **Frecuencia**: bajo demanda del Master.
- **Verificación previa**: SharemeChat opera en un sector con normativas AML/CFT (prevención de blanqueo y financiación del terrorismo) y con proveedores de pago (bancos, e-wallets, redes cripto) que a su vez le imponen obligaciones de identificación. Antes de ejecutar un payout puede requerir KYC actualizado, prueba de titularidad del canal receptor o chequeo contra listas de sanciones internacionales. No es una facultad discrecional de SharemeChat: son requerimientos externos que la plataforma debe cumplir para poder operar.
- **Costes de canal**: las comisiones del canal elegido (proveedor de e-wallet, red de cripto, banco) corren por cuenta del Master y se descuentan del importe transferido.

---

## 7. Conducta y contenido

El Master se compromete a que él mismo y las modelos de su estudio respetan las normas de la plataforma y la ley aplicable. En particular:

- Ninguna actividad ilegal.
- Contenido con menores estrictamente prohibido en cualquier forma. Aplica tolerancia cero, con reporte inmediato a autoridades competentes cuando corresponda.
- Nada de contenido no consentido ni de terceros no autorizados en cámara.
- Nada de coacción, tráfico, explotación o intento de mover a las modelos fuera de la plataforma.
- **Prohibido intercambiar datos personales con clientes o mover la relación fuera de la plataforma**. Ni el Master ni las modelos de su estudio pueden pedir, ofrecer o intercambiar teléfono, email personal, redes sociales, apps de mensajería (WhatsApp, Telegram, Signal, etc.), enlaces a otras plataformas de webcam ni ningún otro medio de contacto directo con el cliente. Toda la interacción y la monetización deben permanecer en SharemeChat. El Master es responsable de trasladar esta prohibición a sus modelos y de reportar a SharemeChat cualquier tentativa que detecte.
- Origen lícito de fondos y colaboración razonable con requerimientos AML/CFT o de listas de sanciones internacionales.

El Master es responsable de trasladar y hacer cumplir estas normas a las modelos que gestiona.

---

## 8. Protección de datos (RGPD)

**Responsable del tratamiento**: Shareme Technologies OÜ.

**Datos del Master tratados**: identidad, contacto, KYC (incluidos datos biométricos capturados durante la verificación con el proveedor externo) y datos económicos derivados de la operativa.

**Finalidades**: ejecutar el contrato, cumplir obligaciones legales (fiscales, contables, AML), prevenir fraude y comunicaciones operativas del servicio. Las bases legales son las que el RGPD prevé para cada finalidad (art. 6.1.b/c/f y art. 9.2.a para biometría, con consentimiento explícito).

**Datos de las modelos**: el Master no accede a datos personales de identificación de sus modelos. Solo ve nickname público, avatar, estado KYC (aprobado/pendiente/rechazado — no el documento), estadísticas económicas, tarifa vigente y disponibilidad.

**Derechos del interesado**: acceso, rectificación, supresión, oposición, portabilidad y limitación. Se ejercen por escrito a `legal@sharemechat.com`. SharemeChat responde en el plazo máximo de 30 días naturales.

**Reclamación**: el Master puede reclamar ante la Autoridad de Protección de Datos de Estonia (Andmekaitse Inspektsioon) o ante la autoridad del Estado de su residencia.

**DPO**: SharemeChat ha designado Delegado de Protección de Datos por procesar biometría a gran escala (art. 37.1.b RGPD). Contacto: `legal@sharemechat.com`.

**Conservación**: los datos del Master se conservan durante la vigencia del contrato más el plazo mínimo exigido por la normativa fiscal, contable y AML aplicable.

---

## 9. Duración, suspensión y terminación

**Duración**: indefinida. Entra en vigor con la aceptación registrada en la plataforma.

**Terminación por el Master**: en cualquier momento, notificándolo a SharemeChat. Las modelos que gestionaba pasan a operar como modelos individuales, preservando historial y saldo. El saldo pendiente del Master queda procesable según el flujo de payout normal.

**Suspensión por SharemeChat**: puede suspender la cuenta Master por incumplimiento grave del contrato, sospecha razonable de fraude/AML o requerimiento de autoridad. Durante la suspensión:

- Las modelos del Master quedan liberadas como individuales.
- El Master conserva acceso de solo consulta a su cuenta (historial, saldo, datos).
- El Master puede solicitar el payout final del saldo acumulado antes de la suspensión, con verificación adicional.
- El Master no puede invitar nuevas modelos, editar acuerdos ni gestionar métodos de cobro.
- SharemeChat le comunica el motivo y le da al menos 5 días hábiles para alegar.

**Terminación por SharemeChat**: con preaviso mínimo de 30 días naturales, salvo casos de suspensión inmediata previstos arriba.

**Reactivación tras suspensión**: se restaura la capacidad operativa. Las modelos que quedaron liberadas no se re-asignan automáticamente; el Master puede reinvitarlas si lo desea y ellas aceptan.

---

## 10. Responsabilidad y bloqueos de terceros

**Responsabilidad del Master**: el Master responde frente a SharemeChat por sus incumplimientos del contrato y por la actividad de las modelos de su estudio que vulnere las normas de la plataforma o la ley aplicable.

**Alcance del servicio de SharemeChat**: SharemeChat proporciona la plataforma "tal cual" y "según disponibilidad". No garantiza que el servicio esté libre de interrupciones ni de errores. En particular, **SharemeChat no responde** frente al Master por:

- Pérdida de ingresos, lucro cesante o pérdida de oportunidad comercial del Master o de sus modelos.
- Pérdida de datos, pérdida de reputación o daños indirectos, consecuenciales, especiales o punitivos de cualquier tipo.
- Interrupciones, caídas o degradación del servicio por causas de fuerza mayor, ataques externos, fallos de red o de terceros proveedores (infraestructura cloud, CDN, WebRTC, moderación, KYC).
- Disputas privadas entre el Master y sus modelos.
- Obligaciones fiscales, laborales, contables o administrativas del Master o de sus modelos.

**Bloqueos y retenciones por terceros (bancos, procesadores de pago, redes cripto, reguladores)**: los pagos, retiros y liquidaciones se ejecutan a través de proveedores externos (procesadores de pago, e-wallets, redes cripto, bancos corresponsales). Estos terceros pueden **retener, congelar, revertir o cancelar** operaciones por decisiones propias (auditorías AML/CFT, sanciones internacionales, cambio de política de riesgo, chargebacks, cierre unilateral de cuenta), sin que SharemeChat pueda garantizar ni contradecir esas decisiones. Cuando esto ocurre:

- SharemeChat **no puede** transferir al Master los fondos que un tercero haya retenido, mientras estén retenidos.
- SharemeChat gestionará razonablemente con el tercero la resolución del bloqueo y mantendrá informado al Master.
- SharemeChat **no responde** por los daños directos ni indirectos derivados del bloqueo del tercero.
- El Master reconoce que operar en el sector adult conlleva un riesgo operativo real de bloqueo por terceros y acepta ese riesgo como parte inherente del contrato.

**Distinción importante entre saldo y responsabilidad**: el **saldo económico** que el Master haya acumulado en su cuenta como retribuciones legítimamente ganadas es **su dinero**, no está sujeto a ningún límite y se le paga íntegro conforme al procedimiento de retiros (sección 6). Lo mismo aplica a los importes pendientes de liquidar y a los payouts en curso: SharemeChat no puede quedarse con ese dinero. El límite de responsabilidad que se establece a continuación **no toca ese saldo**: aplica exclusivamente a **indemnizaciones adicionales por daños** que SharemeChat pudiera deber al Master por perjuicios ocasionados por su propia gestión (por ejemplo, caídas prolongadas del servicio, errores de facturación, suspensiones injustificadas).

**Límite de indemnización por daños**: la indemnización total agregada que SharemeChat pudiera deber al Master por su propia gestión queda limitada a la mayor de las siguientes cantidades: (a) el importe equivalente a las retribuciones que SharemeChat haya percibido derivadas de la actividad del Master en el mes anterior al hecho generador; (b) 100 EUR. Esta cifra no pretende minusvalorar la posición del Master ni excluye reclamar el saldo pendiente: es un techo de indemnización adicional que refleja que SharemeChat, a su vez, no recibe de sus propios proveedores de pago capacidad para asumir exposiciones superiores frente al Master (procesadores como Segpay limitan su indemnización a 50 USD; wallets como Paxum operan sin cifra explícita). Esta limitación no aplica a daños causados por dolo o negligencia grave de SharemeChat, en cuyo caso responde conforme a la ley aplicable sin tope contractual.

---

## 11. Confidencialidad

Cada parte mantendrá bajo confidencialidad la información no pública recibida de la otra (datos económicos, listado de modelos, porcentajes pactados, información técnica) durante la vigencia del contrato y los 3 años siguientes a su terminación. No aplica a información que sea de dominio público, que la parte receptora ya conocía, o que deba revelarse por requerimiento legal.

---

## 12. Modificaciones del contrato

SharemeChat puede publicar nuevas versiones del contrato con preaviso mínimo de 30 días naturales por email. Si el Master no está conforme, puede terminar el contrato conforme al punto 9 sin penalización. Cada versión se identifica de forma inmutable con código de versión, fecha y hash SHA-256 del PDF.

---

## 13. Ley aplicable y jurisdicción

Este contrato se rige por el derecho de Estonia. Para cualquier controversia las partes se someten a los tribunales de Tallinn. Antes de acudir a la vía judicial, las partes intentarán una solución amistosa durante al menos 30 días desde la notificación por escrito de la parte reclamante.

---

## 14. Aceptación

La aceptación se registra en la plataforma al pulsar el botón "Acepto el contrato Master" tras abrir y leer el PDF publicado. Queda inmutablemente registrada con: cuenta del Master, versión aceptada, hash SHA-256 del PDF, timestamp UTC, dirección IP y user agent. Este registro tiene valor probatorio en caso de disputa (Reglamento eIDAS UE 910/2014 aplicable en Estonia).

---

**FIN DEL CONTRATO — Versión `master_contract_v3_1_2026-08-03` (borrador)**
