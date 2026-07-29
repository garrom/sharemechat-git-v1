# Contrato Master ↔ SharemeChat — v1 (borrador)

> **Estado**: borrador (2026-07-29).
> **Versión propuesta**: `master_contract_v1_2026-07-29`.
> **Base legal**: derecho de Estonia. Jurisdicción exclusiva: tribunales de Tallinn.
> **Emisor**: Shareme Technologies OÜ.
> **Publicación**: PDF definitivo se genera con `ops/legal-pdfs/generate_legal_pdfs.py` a partir de este MD y se sube al bucket `assets.sharemechat.com/legal/master_contract.pdf` + manifest `master_contract.manifest.json`.
> **Referencias**: [ADR-056](../06-decisions/adr-056-sistema-master-studio.md).

---

## Preámbulo

El presente contrato regula la relación jurídica entre **Shareme Technologies OÜ** (en adelante "SharemeChat"), sociedad registrada en Estonia con número de identificación fiscal 16970330, con domicilio social en Tallinn, y el **Master** (persona física identificada mediante el proceso de verificación KYC de la plataforma), en su calidad de operador de un estudio de webcam que gestiona modelos bajo su umbrella.

La aceptación del presente contrato es requisito **previo** a la activación del rol Master en la plataforma y al inicio del proceso KYC. La aceptación queda registrada de forma inmutable en la plataforma con el hash SHA-256 del PDF presente + fecha + dirección IP + user agent, generando una prueba forense por si aparece disputa futura.

---

## 1. Partes

**Parte A — Titular de la plataforma**:
- Denominación social: Shareme Technologies OÜ.
- Forma jurídica: Osaühing (sociedad limitada) de Estonia.
- Número de registro mercantil: 16970330.
- Domicilio social: Tallinn, Estonia (dirección exacta en registro público).
- Representación: los administradores de la sociedad según registro mercantil vigente.
- Contacto operativo: [operations@sharemechat.com](mailto:operations@sharemechat.com).

**Parte B — Master**:
- Persona física identificada al 100 % mediante KYC del proveedor Didit (D6 del ADR-056).
- Datos personales asociados a la cuenta `users.id` referenciada en el registro de aceptación de este contrato.
- Opcionalmente: representante de una empresa cuya identificación fiscal se declara en el perfil Master (campos `masters.company_name`, `company_registration_number`, `company_country`). La declaración de empresa NO exime a la persona física de la responsabilidad personal derivada de este contrato.

---

## 2. Objeto del contrato

SharemeChat autoriza al Master a operar en la plataforma bajo el rol técnico `MASTER`, con las siguientes capacidades:

- Registrar en la plataforma personas físicas que operan como modelos bajo su umbrella, mediante el flujo de invitación por email documentado en la sección 4.
- Gestionar operativamente esas modelos (activar/desactivar, ajustar tarifa dentro del rango vigente de su tramo, recibir estadísticas económicas y de actividad).
- Recibir en su ledger de la plataforma el importe generado por la actividad de sus modelos según el régimen económico descrito en la sección 5.
- Solicitar retiros (payouts) del saldo acumulado según los rails habilitados y los umbrales operativos vigentes.

El Master **no** está autorizado a:
- Realizar streams personalmente bajo el rol MASTER (rol no habilitado técnicamente para streaming).
- Acceder a los datos personales (nombre real, fecha de nacimiento, documento de identidad, dirección postal, teléfono, email personal) de las modelos bajo su umbrella. Estos datos permanecen bajo control exclusivo de SharemeChat como responsable del tratamiento (D9 del ADR-056).
- Gestionar credenciales de las modelos bajo su umbrella (D7 del ADR-056). Cada modelo genera y controla su propia contraseña.

---

## 3. Compromisos operativos del Master

El Master declara y garantiza:

3.1. Que actúa por cuenta propia o como representante autorizado de la empresa declarada, con capacidad jurídica suficiente para vincular a la parte que representa.

3.2. Que las modelos que registra bajo su umbrella han sido previamente informadas de:
- La relación contractual privada entre el Master y ellas mismas.
- Que los ingresos generados por su actividad serán abonados a la cuenta plataforma del Master, quien las liquidará según acuerdo privado entre las partes.
- Los términos y condiciones de SharemeChat que la modelo firma personalmente.

3.3. Que garantiza el consentimiento libre e informado de cada modelo respecto a su participación en la plataforma, sin coacción alguna, respetando la libertad de la modelo para dejar de operar en cualquier momento.

3.4. Que no coacciona ni instrumentaliza el proceso de aceptación del contrato modelo ni el KYC de la modelo (D7 del ADR-056). Reconoce que la firma del contrato modelo y el KYC son actos personalísimos de la modelo, ejecutados desde su propia cuenta con su propia contraseña.

3.5. Que no realiza streams personalmente bajo el rol MASTER. Si el Master desea también actuar como modelo, se compromete a registrarse separadamente como modelo individual, con cuenta distinta.

3.6. Que asume la responsabilidad de retribuir a cada modelo bajo su umbrella según acuerdo privado documentado — off-platform — con esa modelo, y que registra en la plataforma el porcentaje pactado con cada modelo (`master_model_splits`) como referencia auditable.

3.7. Que respeta las normas de conducta y contenido de la plataforma (políticas de moderación, restricciones legales sobre contenido adulto, prohibición absoluta de contenido con menores o no consentido) y traslada estas normas a las modelos bajo su umbrella.

---

## 4. Alta y gestión de modelos bajo el Master

4.1. **Alta de modelo**: el Master registra a la modelo mediante formulario en la plataforma proporcionando el email personal de la modelo (obligatorio, propio, no reutilizado). El sistema envía a la modelo un email de activación con enlace único de un solo uso.

4.2. **Primer acceso de la modelo**: al abrir el enlace, la modelo genera su propia contraseña. Esta contraseña queda bajo control exclusivo de la modelo. El Master **no conoce** ni podrá conocer esa contraseña en ningún momento.

4.3. **Firma personal del contrato modelo**: la modelo firma personalmente el contrato modelo vigente (versión v6 con cláusula de autorización de abono al Master), tras haber cambiado su contraseña.

4.4. **KYC individual**: la modelo pasa personalmente el proceso KYC con su propia documentación de identidad. El KYC es un acto personalísimo. El Master **no** puede sustituir a la modelo en el proceso KYC.

4.5. **Activación operativa**: la modelo queda operativa bajo el umbrella del Master (`models.master_user_id = <master>`) tras: (a) aceptación contrato modelo v6, (b) KYC APPROVED, (c) revisión admin.

4.6. **Baja de modelo**: el Master puede desactivar a una modelo bajo su umbrella marcándola como inactiva (`is_active=0`). La modelo mantiene sus datos personales, historial y saldo. Puede reactivarse posteriormente si el Master así lo decide.

4.7. **Salida voluntaria de modelo**: si una modelo decide abandonar el estudio, dispone del derecho (no impedible por el Master) de contactar con soporte SharemeChat para pasar a operar como modelo individual (`master_user_id = NULL`). El histórico se preserva.

---

## 5. Régimen económico

5.1. **Porcentaje sobre ingreso bruto**: el importe generado por cada stream de las modelos bajo umbrella del Master se reparte según la tabla vigente `model_pricing_tiers` (régimen `MASTER`) publicada por SharemeChat. En el momento de la aceptación de este contrato, la tabla vigente es:

| Tramo | Facturación bruta agregada 30d del Master | % que recibe el Master | % SharemeChat |
|---|---|---|---|
| T1 | 0 € | 50 % | 50 % |
| T2 | 1.000 € | 60 % | 40 % |
| T3 | 4.000 € | 65 % | 35 % |
| T4 | 15.000 € | 70 % | 30 % |

El tramo se calcula sobre la **facturación bruta agregada** de todas las modelos activas bajo el umbrella del Master en los últimos 30 días naturales (rolling window). SharemeChat se reserva el derecho a modificar los umbrales y porcentajes con preaviso mínimo de 30 días naturales, mediante publicación de una versión superior del presente contrato y notificación al Master vía email.

5.2. **Reparto interno Master ↔ modelo**: es acuerdo privado entre el Master y cada modelo. SharemeChat NO participa en dicho reparto y NO regula el porcentaje interno. El Master está obligado a registrar en la plataforma el porcentaje pactado con cada modelo (`master_model_splits.internal_share_pct`) como referencia auditable en caso de disputa futura.

5.3. **Sin fees adicionales**: SharemeChat NO cobra al Master ninguna cuota fija de suscripción, ni fee de registro, ni fee por modelo activa, ni fee por transacción individual. La retribución de SharemeChat consiste exclusivamente en el porcentaje descrito en 5.1.

5.4. **Primer minuto trial**: cuando una modelo bajo umbrella del Master atiende a un cliente en su primer minuto de prueba, la modelo recibe una tarifa plana de 0,07 EUR/min (según property `billing.trial.first-minute-earning-eur-per-min` vigente). SharemeChat absorbe íntegramente este coste. El Master NO recibe importe por streams trial (el ingreso se atribuye directamente a la modelo).

5.5. **Regalos (gifts)**: cuando un cliente envía un regalo de pago a una modelo bajo umbrella del Master, el 90 % del importe del regalo se acredita al Master en su ledger (el % se define por property `gift.model-share` vigente, actualmente 90 %). El 10 % restante queda como margen SharemeChat. El reparto interno Master ↔ modelo sobre los regalos sigue el mismo acuerdo privado (5.2).

---

## 6. Payouts (retirada de fondos)

6.1. **Rails habilitados**: SharemeChat proporciona al Master los siguientes canales de payout (progresivamente activados según hoja de ruta del ADR-056 D12):
- **PAXUM** — e-wallet especializada en sector adult, prioritario para operativa LATAM.
- **YOURSAFE** — IBAN europeo + tarjeta prepago virtual.
- **NOWPAYMENTS_CRYPTO** — BTC, USDT, USDC.
- **SEPA_MANUAL** — fallback con intervención admin.

6.2. **Umbral mínimo por solicitud**: 100 EUR.

6.3. **Máximo por solicitud**: 1.000 EUR (revisable por SharemeChat en función del volumen operativo del Master).

6.4. **Frecuencia**: on-demand. SharemeChat comunica quincenalmente (día 1 y 16 de cada mes) el estado agregado del saldo pendiente y los payouts ejecutados.

6.5. **Verificación previa**: SharemeChat puede requerir verificación adicional (KYC actualizado, prueba de titularidad del rail declarado) antes de ejecutar payouts.

6.6. **Coste de rail**: los costes de transferencia del rail elegido (fees Paxum, fees red cripto, comisiones SEPA) corren por cuenta del Master. SharemeChat descuenta esos costes del importe transferido cuando aplique.

---

## 7. Protección de datos (GDPR, RGPD 679/2016)

7.1. **Responsable del tratamiento**: SharemeChat es responsable del tratamiento de los datos personales de los usuarios de la plataforma (modelos, clientes, Masters), en cumplimiento del Reglamento (UE) 2016/679 y la legislación de Estonia.

7.2. **Datos personales del Master**: el Master consiente el tratamiento de sus datos personales (identidad, contacto, KYC) para las finalidades exclusivas de: (a) verificación de identidad, (b) cumplimiento de obligaciones AML/CFT, (c) ejecución del presente contrato, (d) cumplimiento de obligaciones legales fiscales y contables.

7.3. **Datos personales de las modelos bajo umbrella**: el Master **NO tiene acceso** a los datos personales de identificación de las modelos bajo su umbrella (nombre real, fecha de nacimiento, documento, dirección, teléfono, email personal). Este tratamiento queda bajo control exclusivo de SharemeChat.

7.4. **Datos operativos visibles al Master**: el Master ve exclusivamente: nickname público, avatar, estado KYC (APPROVED/PENDING/REJECTED — no el documento), estatus operativo, estadísticas económicas (bruto 30d, tramo, ingresos), tarifa vigente, disponibilidad, rating.

7.5. **Derechos del interesado**: el Master conserva los derechos que le reconoce el RGPD (acceso, rectificación, supresión, oposición, portabilidad, limitación) que puede ejercer contactando con SharemeChat en la dirección de contacto declarada.

7.6. **Conservación**: SharemeChat conserva los datos del Master y de la aceptación del presente contrato durante el tiempo de vigencia de la relación contractual + los plazos exigidos por normativa fiscal, contable y AML aplicable (mínimo 10 años tras el fin de la relación).

---

## 8. Duración, suspensión y terminación

8.1. **Duración**: indefinida. El presente contrato entra en vigor en la fecha de aceptación registrada en la plataforma y permanece vigente hasta terminación por cualquiera de las partes.

8.2. **Terminación por el Master**: el Master puede terminar el contrato en cualquier momento notificándolo a SharemeChat. Al momento de la terminación:
- Las modelos bajo su umbrella quedan automáticamente liberadas como modelos individuales (`master_user_id = NULL`), preservando su histórico y saldo (D11 del ADR-056).
- El saldo pendiente del Master queda procesable según el flujo estándar de payout.

8.3. **Suspensión por SharemeChat**: SharemeChat puede suspender la cuenta Master en caso de:
- Incumplimiento grave del presente contrato o de las políticas de conducta de la plataforma.
- Sospecha razonable de fraude, blanqueo, financiación del terrorismo, o cualquier actividad ilegal.
- Requerimiento de autoridad competente.

Durante la suspensión:
- Las modelos bajo umbrella quedan liberadas como individuales automáticamente (D11).
- El saldo del Master queda congelado hasta resolución.
- SharemeChat comunicará al Master la razón y el procedimiento de recurso (5 días hábiles).

8.4. **Terminación por SharemeChat**: SharemeChat puede terminar el contrato con un preaviso mínimo de 30 días naturales, salvo en los casos de suspensión inmediata descritos en 8.3, donde la terminación puede ser inmediata.

---

## 9. Responsabilidad

9.1. **Responsabilidad del Master**: el Master responde íntegramente frente a SharemeChat por cualquier reclamación derivada de:
- Incumplimiento del presente contrato.
- Actividad de las modelos bajo su umbrella que vulnere las políticas de conducta de la plataforma.
- Reclamaciones de terceros (incluidas modelos bajo su umbrella) derivadas del acuerdo privado Master ↔ modelo.

9.2. **Responsabilidad de SharemeChat**: SharemeChat responde exclusivamente por el correcto funcionamiento técnico de la plataforma según los niveles de servicio publicados. SharemeChat no responde de:
- Pérdidas económicas derivadas de decisiones comerciales del Master.
- Disputas entre el Master y cualquier modelo bajo su umbrella.
- Impuestos personales o societarios del Master (que son de su exclusiva responsabilidad).

---

## 10. Legislación aplicable y jurisdicción

10.1. **Ley aplicable**: el presente contrato se rige por el derecho de Estonia.

10.2. **Jurisdicción**: para cualquier controversia derivada del presente contrato, las partes se someten expresamente a la jurisdicción exclusiva de los tribunales de Tallinn (Estonia), con renuncia expresa a cualquier otro fuero que pudiera corresponderles.

---

## 11. Modificaciones del contrato

11.1. SharemeChat puede modificar el presente contrato mediante publicación de una nueva versión con preaviso mínimo de 30 días naturales, notificando al Master por email a la dirección declarada.

11.2. La nueva versión entra en vigor tras el plazo de preaviso. Si el Master no está conforme, puede terminar el contrato conforme a la sección 8.2.

11.3. Cada versión del contrato se identifica de forma inmutable con: código de versión (`master_contract_vN_YYYY-MM-DD`), hash SHA-256 del PDF, fecha de publicación. La aceptación del Master queda vinculada a esa versión específica.

---

## 12. Aceptación

La aceptación del presente contrato por parte del Master se registra en la plataforma mediante la firma electrónica ejecutada al pulsar el botón "Acepto el contrato Master" en el flujo de onboarding. Esta aceptación queda inmutablemente registrada en la base de datos de SharemeChat con:

- Identificador de la cuenta del Master (`users.id`).
- Versión del contrato aceptada.
- Hash SHA-256 del PDF de esa versión.
- Timestamp UTC de la aceptación.
- Dirección IP desde la que se ejecutó la aceptación.
- User agent del navegador.

Este registro tiene valor probatorio pleno en caso de disputa.

---

**FIN DEL CONTRATO — Versión `master_contract_v1_2026-07-29`**
