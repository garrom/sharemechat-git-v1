# Contrato Master ↔ SharemeChat — v2 (borrador)

> **Estado**: borrador (2026-08-02). Reescritura completa v1 → v2 tras análisis técnico-legal + decisiones operativas S7.b (suspensión) y S6.b (vendor-agnostic).
> **Versión propuesta**: `master_contract_v2_2026-08-02`.
> **Base legal**: derecho de Estonia. Jurisdicción exclusiva: tribunales de Tallinn.
> **Emisor**: Shareme Technologies OÜ (en adelante también, comercialmente, "SharemeChat").
> **Publicación**: PDF definitivo se genera con `ops/legal-pdfs/generate_legal_pdfs.py` a partir de este MD y se sube al bucket `assets.sharemechat.com/legal/master_contract.pdf` + manifest `master_contract.manifest.json`.
>
> ⚠️ **Aviso operativo**: este borrador es una propuesta interna redactada por el equipo. Requiere **revisión legal externa por abogado especializado en Estonia + sector adult + GDPR** antes de publicación en PROD. No es un documento legalmente vinculante hasta cierre de revisión y firma administradores.

---

## Preámbulo

Este contrato regula la relación jurídica entre **Shareme Technologies OÜ** ("SharemeChat") y el **Master** (persona física identificada mediante KYC), en su calidad de operador de un estudio de webcam que gestiona modelos bajo su umbrella en la plataforma SharemeChat.

La aceptación del presente contrato es requisito **previo** a la activación del rol Master en la plataforma y al inicio del proceso KYC. La aceptación queda registrada de forma inmutable en la plataforma con el hash SHA-256 del PDF firmado + fecha + dirección IP + user agent, generando prueba forense en caso de disputa futura.

---

## 1. Definiciones

A efectos del presente contrato:

**SharemeChat**: nombre comercial de Shareme Technologies OÜ, titular y operador de la plataforma.

**Plataforma**: sitio web y servicios asociados accesibles bajo el dominio `sharemechat.com` y sus subdominios operativos.

**Master**: persona física registrada en la plataforma con el rol técnico `MASTER`, verificada mediante KYC, que opera un estudio de webcam y gestiona modelos bajo su umbrella.

**Modelo bajo umbrella**: persona física registrada como modelo en la plataforma cuyo campo `master_user_id` referencia la cuenta de un Master concreto. Sus ingresos se atribuyen a la cuenta del Master.

**Tramo**: nivel de la tabla escalonada `T1`–`T4` que determina el porcentaje que SharemeChat abona al Master por la actividad de cada modelo bajo umbrella. El tramo se calcula individualmente por cada modelo en función de su facturación bruta rolling 30 días.

**Split interno**: porcentaje pactado privadamente entre el Master y cada modelo sobre el importe que el Master percibe por la actividad de esa modelo. Registrable en la plataforma como referencia auditable pero **no regulado** por SharemeChat.

**Rail**: canal técnico habilitado por SharemeChat para ejecutar payouts (transferencias del saldo del Master a una cuenta externa de titularidad del Master).

**Saldo**: importe económico acumulado en el ledger de la cuenta Master en la plataforma, disponible para solicitar payouts.

---

## 2. Partes

**Parte A — SharemeChat**:
- Denominación social: Shareme Technologies OÜ.
- Forma jurídica: Osaühing (sociedad limitada) de Estonia.
- Número de registro mercantil: 16970330.
- Domicilio social: Tallinn, Estonia (dirección exacta en registro público estonio).
- Representación: los administradores de la sociedad según registro mercantil vigente.
- Contactos operativos:
  - General: `operations@sharemechat.com`.
  - Protección de datos: `privacy@sharemechat.com`.
  - Cumplimiento AML: `compliance@sharemechat.com`.

**Parte B — Master**:
- Persona física identificada mediante KYC del proveedor Didit.
- Datos personales asociados a la cuenta `users.id` referenciada en el registro de aceptación de este contrato.
- Opcionalmente: representante autorizado de una empresa cuyos datos identificativos declara al alta (razón social, número de registro, país). La declaración de empresa **NO exime** a la persona física de la responsabilidad personal derivada de este contrato — el Master responde personalmente frente a SharemeChat.

---

## 3. Objeto del contrato

SharemeChat autoriza al Master a operar en la plataforma bajo el rol técnico `MASTER`, con las capacidades y restricciones descritas en las secciones siguientes.

Capacidades otorgadas:

- Registrar personas físicas como modelos bajo su umbrella mediante flujo de invitación por email documentado en sección 5.
- Gestionar operativamente esas modelos (activar/desactivar, ajustar tarifa dentro del rango vigente de su tramo, consultar estadísticas económicas y de actividad).
- Recibir en el ledger de su cuenta plataforma el importe generado por la actividad de sus modelos según el régimen económico de la sección 6.
- Solicitar payouts del saldo acumulado según los rails habilitados y umbrales operativos vigentes.

Restricciones expresas:

- **No** realizará streams personalmente bajo el rol `MASTER`. Si el Master desea también actuar como modelo, deberá registrarse por separado como modelo individual con cuenta distinta.
- **No** tendrá acceso a datos personales de identificación de las modelos bajo su umbrella (nombre real, fecha nacimiento, documento, dirección, teléfono, email personal). Estos datos permanecen bajo control exclusivo de SharemeChat como responsable del tratamiento.
- **No** gestionará credenciales de las modelos bajo su umbrella. Cada modelo genera y controla su propia contraseña; el Master no la conoce ni podrá conocerla en ningún momento.

---

## 4. Compromisos operativos del Master

El Master declara y garantiza:

4.1. Que actúa por cuenta propia o como representante autorizado de la empresa declarada, con capacidad jurídica suficiente para vincular a la parte que representa.

4.2. Que las modelos que registra bajo su umbrella han sido **previamente informadas por escrito** de:
- La relación contractual privada entre el Master y ellas mismas.
- El hecho de que los ingresos generados por su actividad serán abonados a la cuenta plataforma del Master, quien las liquidará según acuerdo privado entre las partes.
- Los términos y condiciones de SharemeChat, que la modelo firma personalmente antes de operar.

El Master conservará documentación probatoria de dicha información previa (email, mensaje firmado o equivalente) y la entregará a SharemeChat bajo requerimiento razonable en caso de disputa o investigación.

4.3. Que garantiza el consentimiento libre e informado de cada modelo respecto a su participación en la plataforma, sin coacción alguna, respetando su libertad para dejar de operar en cualquier momento.

4.4. Que no coacciona ni instrumentaliza el proceso de aceptación del contrato modelo ni el proceso KYC de la modelo. Reconoce que la firma del contrato modelo y el KYC son actos personalísimos de la modelo, ejecutados desde su propia cuenta con su propia contraseña.

4.5. Que no realizará streams personalmente bajo el rol MASTER (ver también sección 3, restricciones expresas).

4.6. Que asume íntegramente la responsabilidad de retribuir a cada modelo bajo su umbrella según **acuerdo privado escrito** con esa modelo, y que registra en la plataforma el porcentaje pactado con cada modelo como referencia auditable en caso de disputa.

**Contenido mínimo del acuerdo privado Master ↔ modelo** (obligatorio):
- Identidad completa de ambas partes.
- Porcentaje pactado sobre el importe que el Master recibe de SharemeChat por la actividad de la modelo.
- Forma, plazo y canal de pago al que el Master abona a la modelo la parte pactada.
- Duración del acuerdo y forma de terminación.
- Idioma común entre las partes.

4.7. Que respeta las normas de conducta y contenido de la plataforma (moderación, restricciones legales sobre contenido adulto, prohibición absoluta de contenido con menores o no consentido) y traslada estas normas a las modelos bajo su umbrella.

4.8. Que cumple con la normativa de prevención de blanqueo de capitales y financiación del terrorismo (AML/CFT) aplicable a su jurisdicción y a Estonia, y colabora con SharemeChat en cualquier requerimiento razonable derivado de obligaciones AML de SharemeChat.

---

## 5. Alta y gestión de modelos bajo el Master

5.1. **Alta de modelo**: el Master registra a la modelo mediante formulario en la plataforma proporcionando el email personal de la modelo (obligatorio, propio, no reutilizado). El sistema envía a la modelo un email de activación con enlace único de un solo uso.

5.2. **Primer acceso de la modelo**: al abrir el enlace, la modelo genera su propia contraseña. Esta contraseña queda bajo control exclusivo de la modelo. El Master **no conoce** ni podrá conocer esa contraseña.

5.3. **Firma personal del contrato modelo**: la modelo firma personalmente el contrato modelo vigente en la plataforma, tras cambiar su contraseña.

5.4. **KYC individual**: la modelo pasa personalmente el proceso KYC con su propia documentación de identidad. El KYC es un acto personalísimo; el Master **no** puede sustituir a la modelo.

5.5. **Activación operativa**: la modelo queda operativa bajo el umbrella del Master una vez cumplidas: (a) aceptación del contrato modelo, (b) KYC aprobado, (c) revisión y activación por administración.

5.6. **Desactivación por el Master**: el Master puede desactivar a una modelo bajo su umbrella (`is_active=false`). La modelo mantiene sus datos personales, historial y saldo. **Diferencia clave con liberación (8.3)**: la desactivación es **reversible** por el propio Master en cualquier momento reactivándola.

5.7. **Salida voluntaria de la modelo**: si una modelo decide abandonar el estudio Master, dispone del derecho no impedible por el Master de contactar con soporte SharemeChat para pasar a operar como modelo individual. Su historial se preserva; su reparto pasa al régimen individual vigente publicado en la plataforma.

---

## 6. Régimen económico

6.1. **Porcentaje sobre ingreso bruto**: el importe generado por cada stream de las modelos bajo umbrella del Master se calcula **individualmente por modelo** según el tramo (`T1`–`T4`) que le corresponda en la tabla vigente publicada por SharemeChat en el panel Master (sección "Régimen económico"), consultable en todo momento tras autenticación.

El tramo de cada modelo se calcula por su propia facturación bruta rolling 30 días. El importe resultante se acredita en la cuenta plataforma del Master, que recibe la suma de lo devengado por todas sus modelos.

Al momento de la aceptación del presente contrato, la tabla vigente es la que se recoge en el **Anexo I** (informativo). SharemeChat se reserva el derecho a modificar los umbrales y porcentajes con **preaviso mínimo de 30 días naturales**, notificando al Master por email a la dirección de contacto registrada. Durante el plazo de preaviso el Master puede terminar el contrato conforme a la sección 10.2 **sin penalización**; transcurrido el plazo sin terminación, se entiende que el Master acepta la modificación.

6.2. **Split interno Master ↔ modelo**: acuerdo privado entre el Master y cada modelo. SharemeChat **no participa** en dicho reparto y **no regula** el porcentaje interno. El Master está obligado a registrar en la plataforma el porcentaje pactado con cada modelo como referencia auditable en caso de disputa futura.

6.3. **Sin fees adicionales**: SharemeChat **no cobra** al Master ninguna cuota fija de suscripción, ni fee de registro, ni fee por modelo activa, ni fee por transacción individual. La retribución de SharemeChat consiste exclusivamente en el porcentaje descrito en 6.1.

6.4. **Trials de primer minuto**: cuando una modelo bajo umbrella del Master atiende a un cliente en su primer minuto de prueba, se devenga una tarifa plana según valor vigente publicado en la plataforma (a fecha de este contrato: 0,07 EUR/min). SharemeChat absorbe íntegramente este coste. El importe se acredita a la cuenta del Master con el mismo criterio de atribución que 6.1, y el Master lo reparte internamente con la modelo según lo pactado (6.2).

6.5. **Regalos (gifts)**: cuando un cliente envía un regalo de pago a una modelo bajo umbrella del Master, el importe se acredita en la cuenta plataforma del Master siguiendo **el mismo criterio de tramo y atribución que 6.1**. El split interno Master ↔ modelo sobre los regalos sigue el mismo acuerdo privado (6.2).

6.6. **Transparencia hacia la modelo**: SharemeChat expone a cada modelo bajo umbrella el importe bruto que su actividad ha generado y el porcentaje pactado con su Master, para permitirle validar la liquidación privada. El Master consiente esta transparencia como condición de operar bajo el modelo umbrella.

---

## 7. Payouts (retirada de fondos)

7.1. **Canales habilitados**: SharemeChat proporciona al Master **múltiples canales** de payout. La lista de canales operativos, así como sus condiciones específicas (fees, tiempos, umbrales), se publica en el panel Master y puede evolucionar a lo largo de la vigencia del contrato. La modificación del listado o de condiciones específicas de un canal no altera las cláusulas económicas de la sección 6.

7.2. **Umbral mínimo por solicitud**: 100 EUR.

7.3. **Máximo por solicitud**: 1.000 EUR. Este máximo es revisable por SharemeChat en función del volumen operativo del Master y del histórico de operación.

7.4. **Frecuencia**: on-demand por parte del Master. SharemeChat comunica al menos **mensualmente** el estado agregado del saldo pendiente y los payouts ejecutados; y bajo solicitud puntual del Master en cualquier momento.

7.5. **Verificación previa**: SharemeChat puede requerir verificación adicional (KYC actualizado, prueba de titularidad del canal declarado, verificación AML/sanciones) antes de ejecutar un payout.

7.6. **Costes de canal**: los costes de transferencia del canal elegido (fees del proveedor, comisiones bancarias, comisiones de red en cripto) corren por cuenta del Master. SharemeChat descuenta esos costes del importe transferido cuando aplique y refleja el desglose en el ledger visible del Master.

---

## 8. Confidencialidad

8.1. **Obligación recíproca**: durante la vigencia de este contrato y durante los **cinco (5) años** siguientes a su terminación, cada parte se obliga a mantener bajo estricta confidencialidad toda información no pública recibida de la otra parte, incluyendo (sin limitación): datos económicos, listados de modelos, porcentajes pactados, algoritmos internos, información técnica de la plataforma.

8.2. **Excepciones**: no queda cubierto por la obligación de confidencialidad aquello que: (a) sea de dominio público sin culpa de la parte receptora, (b) la parte receptora ya conocía antes de la revelación, (c) deba ser revelado por requerimiento legal o judicial (con notificación previa razonable a la otra parte cuando sea legalmente posible).

8.3. **Uso limitado**: la información confidencial recibida solo podrá utilizarse para los fines derivados de la ejecución del presente contrato.

---

## 9. Protección de datos (GDPR, Reglamento UE 2016/679)

9.1. **Responsable del tratamiento**: Shareme Technologies OÜ es responsable del tratamiento de los datos personales de los usuarios de la plataforma (modelos, clientes, Masters), en cumplimiento del Reglamento (UE) 2016/679 y de la legislación estonia de protección de datos (Isikuandmete Kaitse Seadus).

9.2. **Datos personales del Master tratados**:
- Identidad: nombre, fecha nacimiento, documento identificación, dirección postal.
- Contacto: email, teléfono si se declara.
- Datos biométricos: capturas KYC (documento + selfie + liveness) recabadas por el proveedor Didit y almacenadas por SharemeChat. Este tratamiento se ampara en el artículo 9.2.a RGPD (consentimiento explícito) para las finalidades declaradas.
- Datos económicos: importes generados, payouts, saldos, transacciones.

9.3. **Finalidades y bases legales**:
| Finalidad | Base legal |
|---|---|
| Ejecución del presente contrato | Art. 6.1.b RGPD |
| Verificación KYC + AML/CFT | Art. 6.1.c (obligación legal) + Art. 9.2.g (interés público) |
| Cumplimiento de obligaciones fiscales y contables | Art. 6.1.c |
| Prevención de fraude | Art. 6.1.f (interés legítimo) |
| Comunicaciones operativas del servicio | Art. 6.1.b |
| Marketing directo (solo si opt-in explícito) | Art. 6.1.a (consentimiento) |

9.4. **Datos personales de las modelos bajo umbrella**: el Master **NO tiene acceso** a datos personales de identificación de las modelos bajo su umbrella. SharemeChat mantiene control exclusivo como responsable del tratamiento.

9.5. **Datos operativos visibles al Master**: el Master ve exclusivamente: nickname público, avatar, estado KYC (APPROVED/PENDING/REJECTED — nunca el documento), estatus operativo, estadísticas económicas (bruto 30d, tramo, ingresos), tarifa vigente, disponibilidad, rating.

9.6. **Transferencias internacionales**: los proveedores utilizados por SharemeChat para procesar datos personales están ubicados en la Unión Europea o en países con decisión de adecuación de la Comisión Europea. Cuando en el futuro sea necesario recurrir a proveedores en países terceros sin decisión de adecuación, se articularán mecanismos válidos conforme al Capítulo V RGPD (Cláusulas Contractuales Tipo, Reglas Corporativas Vinculantes, etc.), notificándolo al Master.

9.7. **Delegado de Protección de Datos (DPO)**: SharemeChat ha designado un Delegado de Protección de Datos, dado el tratamiento a gran escala de datos biométricos (Art. 37.1.b RGPD). Contacto: `dpo@sharemechat.com`.

9.8. **Derechos del interesado**: el Master conserva los derechos que le reconoce el RGPD:
- Acceso (art. 15), rectificación (art. 16), supresión (art. 17), oposición (art. 21), portabilidad (art. 20), limitación (art. 18).
- Ejercicio: mediante escrito a `privacy@sharemechat.com`. SharemeChat responderá en el **plazo máximo de 30 días naturales**, prorrogable en dos meses adicionales cuando la solicitud sea compleja (art. 12.3 RGPD), notificándolo al Master.
- **Reclamación ante Autoridad de Control**: si el Master considera vulnerados sus derechos, puede presentar reclamación ante la Autoridad de Protección de Datos de Estonia (Andmekaitse Inspektsioon, `aki.ee`) o, alternativamente, ante la autoridad de control del Estado miembro de su residencia habitual.

9.9. **Conservación**: SharemeChat conserva los datos personales del Master y de la aceptación del presente contrato durante el tiempo de vigencia de la relación contractual **y los plazos exigidos por normativa fiscal, contable y AML aplicable** (mínimo 10 años tras el fin de la relación para obligaciones AML de Estonia). Transcurrido el plazo, los datos se suprimen o anonimizan.

---

## 10. Duración, suspensión y terminación

10.1. **Duración**: indefinida. Este contrato entra en vigor en la fecha de aceptación registrada en la plataforma y permanece vigente hasta terminación por cualquiera de las partes.

10.2. **Terminación por el Master**: el Master puede terminar el contrato en cualquier momento notificándolo por escrito a SharemeChat. Al momento de la terminación:
- Las modelos bajo su umbrella quedan **liberadas** como modelos individuales (el campo `master_user_id` de cada modelo se pone a `NULL`), preservando su histórico y saldo. Su régimen económico pasa al régimen individual vigente publicado en la plataforma. **La liberación no es reversible** unilateralmente por el Master reactivado: si el Master quisiera volver a onboardearlas, debería enviarles nueva invitación y contar con su nuevo consentimiento.
- El saldo pendiente del Master queda procesable según el flujo estándar de payout de la sección 7.

10.3. **Suspensión por SharemeChat**: SharemeChat puede suspender la cuenta Master en caso de:
- Incumplimiento grave del presente contrato o de las políticas de conducta de la plataforma.
- Sospecha razonable de fraude, blanqueo, financiación del terrorismo, o cualquier actividad ilegal.
- Requerimiento de autoridad competente.

Durante la suspensión:
- Las modelos bajo umbrella quedan **liberadas** como individuales automáticamente (mismo mecanismo que 10.2).
- El Master **conserva** su acceso de solo consulta a la plataforma (histórico, saldo, exportación de datos).
- El Master **conserva** el derecho a solicitar payout final del saldo pre-suspensión, procesado por SharemeChat con verificación adicional AML/sanciones.
- El Master **pierde** temporalmente la capacidad de invitar nuevas modelos, editar splits, gestionar métodos de cobro y firmar nuevos acuerdos.
- SharemeChat comunicará al Master la razón y el procedimiento de recurso (plazo mínimo 5 días hábiles para alegar) en un plazo razonable tras la suspensión.

10.4. **Terminación por SharemeChat**: SharemeChat puede terminar el contrato con **preaviso mínimo de 30 días naturales**, salvo en los casos de suspensión inmediata descritos en 10.3, donde la terminación puede ser inmediata.

10.5. **Reactivación tras suspensión**: si tras la investigación SharemeChat resuelve reactivar al Master, se restablece la capacidad de operación. Las modelos previamente liberadas **no se re-asignan automáticamente**; el Master puede, si lo desea, enviarles nueva invitación (que la modelo puede o no aceptar).

---

## 11. Responsabilidad

11.1. **Responsabilidad del Master**: el Master responde íntegramente frente a SharemeChat por cualquier reclamación derivada de:
- Incumplimiento del presente contrato.
- Actividad de las modelos bajo su umbrella que vulnere las políticas de conducta de la plataforma o la normativa aplicable.
- Reclamaciones de terceros (incluidas modelos bajo su umbrella) derivadas del acuerdo privado Master ↔ modelo.

11.2. **Responsabilidad de SharemeChat**: SharemeChat responde exclusivamente por el correcto funcionamiento técnico de la plataforma según los niveles de servicio publicados. SharemeChat **no** responde de:
- Pérdidas económicas derivadas de decisiones comerciales del Master.
- Disputas entre el Master y cualquier modelo bajo su umbrella.
- Impuestos personales o societarios del Master (obligación exclusiva del Master).

11.3. **Límite de responsabilidad**: sin perjuicio de lo dispuesto en la normativa imperativa aplicable, **la responsabilidad total agregada de SharemeChat frente al Master derivada del presente contrato queda limitada a la mayor de las siguientes cantidades**: (a) el importe equivalente a las retribuciones que SharemeChat haya percibido derivadas de la actividad del Master durante los seis (6) meses anteriores al hecho generador de la responsabilidad, (b) diez mil euros (10.000 EUR).

11.4. **Exclusiones a la limitación**: la limitación de 11.3 no aplicará a daños causados por dolo o negligencia grave de SharemeChat, ni a los supuestos en los que la normativa imperativa prohíba la limitación de responsabilidad.

---

## 12. Cesión del contrato

12.1. **Cesión por el Master**: el Master **no** puede ceder su posición contractual, total o parcialmente, sin consentimiento expreso previo por escrito de SharemeChat. Tampoco puede permitir la utilización de su cuenta por parte de terceros.

12.2. **Cesión por SharemeChat**: SharemeChat podrá ceder libremente su posición contractual como parte de operaciones societarias (fusión, escisión, adquisición, reestructuración de grupo) notificándolo al Master con al menos treinta (30) días naturales de antelación. El Master conservará el derecho a terminar el contrato conforme a 10.2 si no está conforme con la cesión.

---

## 13. Fuerza mayor

13.1. Ninguna de las partes será responsable del incumplimiento de sus obligaciones cuando dicho incumplimiento se deba a causas ajenas a su control razonable y no imputables a su culpa, incluyendo (sin limitación): caídas de proveedores de infraestructura crítica, ataques cibernéticos masivos, decisiones de autoridad, catástrofes naturales, conflictos armados.

13.2. La parte afectada notificará a la otra la circunstancia de fuerza mayor a la mayor brevedad posible y adoptará las medidas razonables para minimizar sus efectos.

13.3. Si la fuerza mayor se prolonga durante más de treinta (30) días naturales, cualquiera de las partes podrá terminar el contrato conforme a la sección 10.

---

## 14. Cumplimiento normativo AML / CFT / sanciones

14.1. **Compromiso del Master**: el Master declara que la totalidad de los fondos que recibe de SharemeChat tienen origen lícito y que no será utilizado, directa o indirectamente, en ninguna actividad de blanqueo de capitales, financiación del terrorismo o incumplimiento de sanciones internacionales (UE, ONU, OFAC estadounidense).

14.2. **Colaboración**: el Master colaborará razonablemente con los procedimientos AML/CFT de SharemeChat, incluyendo actualización periódica de KYC, aportación de documentación cuando sea razonablemente solicitada, y respuesta a requerimientos derivados de obligaciones legales de SharemeChat.

14.3. **Sanciones internacionales**: SharemeChat se reserva el derecho a suspender inmediatamente cualquier operativa y payout cuando, por aplicación de listas de sanciones internacionales o requerimiento de autoridad competente, no pueda ejecutar la operación sin infringir la normativa aplicable.

---

## 15. Nulidad parcial

Si alguna cláusula del presente contrato fuera declarada nula o inaplicable por autoridad competente, dicha declaración no afectará a la validez del resto del contrato. Las partes negociarán de buena fe una cláusula sustitutiva que preserve la finalidad económica y jurídica de la cláusula afectada dentro de los límites de la legalidad.

---

## 16. Notificaciones

16.1. **Canal**: salvo indicación distinta, las notificaciones entre las partes se realizarán por correo electrónico a las direcciones declaradas por cada parte (SharemeChat en sección 2; Master en el registro de su cuenta).

16.2. **Validez**: las notificaciones por correo electrónico se consideran válidamente cursadas y recibidas transcurridas 48 horas desde su envío, salvo prueba en contrario de fallo de entrega técnico.

16.3. **Actualización de dirección**: cada parte se obliga a mantener actualizada su dirección de contacto. Las notificaciones a la última dirección declarada son plenamente eficaces aunque la parte haya cambiado de dirección sin notificarlo.

---

## 17. Modificaciones del contrato

17.1. SharemeChat puede modificar el presente contrato mediante publicación de una nueva versión con **preaviso mínimo de 30 días naturales**, notificando al Master por email a la dirección declarada.

17.2. La nueva versión entra en vigor tras el plazo de preaviso. Si el Master no está conforme, puede terminar el contrato conforme a la sección 10.2 **sin penalización**.

17.3. Cada versión del contrato se identifica de forma inmutable con: código de versión (`master_contract_vN_YYYY-MM-DD`), hash SHA-256 del PDF, fecha de publicación. La aceptación del Master queda vinculada a esa versión específica.

---

## 18. Legislación aplicable y jurisdicción

18.1. **Ley aplicable**: el presente contrato se rige por el derecho de Estonia.

18.2. **Jurisdicción**: para cualquier controversia derivada del presente contrato, las partes se someten expresamente a la jurisdicción exclusiva de los tribunales de Tallinn (Estonia), con renuncia expresa a cualquier otro fuero que pudiera corresponderles.

18.3. **Resolución previa amistosa**: antes de acudir a la vía judicial, las partes intentarán resolver cualquier controversia mediante negociación de buena fe durante al menos treinta (30) días naturales tras notificación por escrito por la parte reclamante.

---

## 19. Idioma

19.1. El presente contrato se redacta originalmente en **español**. Cualquier traducción a otros idiomas (inglés u otros) se proporciona a título informativo y como facilidad para las partes.

19.2. **En caso de discrepancia entre el texto español y cualquier traducción, prevalecerá la versión española.**

---

## 20. Aceptación

La aceptación del presente contrato por parte del Master se registra en la plataforma mediante la firma electrónica ejecutada al pulsar el botón "Acepto el contrato Master" en el flujo de onboarding, tras haber abierto y leído el PDF publicado. Esta aceptación queda inmutablemente registrada en la base de datos de SharemeChat con:

- Identificador de la cuenta del Master.
- Versión del contrato aceptada.
- Hash SHA-256 del PDF de esa versión.
- Timestamp UTC de la aceptación.
- Dirección IP desde la que se ejecutó la aceptación.
- User agent del navegador.

Este registro tiene valor probatorio pleno en caso de disputa, en el sentido del Reglamento (UE) 910/2014 (eIDAS) aplicable en Estonia.

La firma administradores de SharemeChat sobre esta versión consta en el manifest del PDF (`master_contract.manifest.json` en el bucket de assets) con timestamp UTC + hash SHA-256 firmado.

---

## Anexo I — Tabla de tramos vigente al momento de la aceptación (informativo)

**Régimen económico aplicable a las modelos bajo umbrella del Master** (fuente: `model_pricing_tiers` régimen INDIVIDUAL vigente al 2026-08-02):

| Tramo | Umbral facturación bruta 30d | % SharemeChat abona al Master | Rango tarifa modelo permitida |
|---|---|---|---|
| T1 | 0 EUR | 50 % | 1 EUR/min (fijo) |
| T2 | 1.000 EUR | 54 % | 1–3 EUR/min |
| T3 | 4.000 EUR | 57 % | 1–6 EUR/min |
| T4 | 15.000 EUR | 60 % | 1–9 EUR/min |

**Ejemplo ilustrativo**: una modelo bajo umbrella del Master, con 2.500 EUR de facturación bruta rolling 30d, se sitúa en tramo T2. Un stream de 60 minutos facturado a 2 EUR/min (120 EUR bruto) genera al Master un abono de 120 × 54 % = 64,80 EUR. El Master lo reparte con la modelo según el split interno pactado privadamente (6.2).

**Este Anexo es informativo**: la tabla vigente es la publicada en tiempo real en el panel Master de la plataforma. Modificaciones futuras siguen el procedimiento de la cláusula 6.1.

---

**FIN DEL CONTRATO — Versión `master_contract_v2_2026-08-02` (borrador)**
