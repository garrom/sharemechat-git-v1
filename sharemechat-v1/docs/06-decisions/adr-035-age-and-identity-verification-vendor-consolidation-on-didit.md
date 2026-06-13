# ADR-035 - Arquitectura de verificación de edad e identidad — consolidación de vendor en Didit

## Estado

Aceptado el 2026-06-13. **Supersede** a [ADR-029](adr-029-age-and-identity-verification-architecture.md).

Vendor único: **Didit** para los tres flujos (KYC modelo, age estimation cliente, fallback documental cliente). Las líneas estructurales del modelo de verificación (KYC obligatorio del modelo, "pre-pago SFW" como condición de diseño, estimación facial como método primario del cliente con step-up documental sólo en buffer zone, documento al 100% de consumidores explícitamente descartado) se mantienen intactas desde ADR-029: lo único que cambia es el proveedor.

## Contexto

ADR-029 fijó **Veriff** como proveedor único para los tres flujos. La implementación llegó a operar end-to-end en TEST contra la Test integration de Veriff (frente backend cerrado en commit `53c3036`: paso 1 HMAC salida + paso 1 HMAC webhook entrante + paso 2 country gating + paso 5 payload `createSession` + paso 6 mapeo del Decision webhook por `verification.code`). Sobre esa base operativa surgió el bloqueador comercial que motiva este ADR.

### Bloqueador comercial detectado

Tras la activación real de Veriff en TEST, el equipo de Veriff Support confirmó por escrito que **Age Estimation no está disponible en el plan Essential** (~49 USD/mes, self-serve, contrato mensual) sino en el plan **Enterprise** (~199 USD/mes, contrato anual, mínimo 1000 verificaciones/mes). El plan Essential sólo cubre Document + Selfie IDV.

### Restricción dura de presupuesto

SharemeChat es una OÜ pre-ingresos con runway diseñado para 12+ meses sin facturación. Una cuota fija de 199 USD/mes en compromiso anual es materialmente incompatible con esa restricción mientras no haya ingresos. Cualquier coste fijo del vendor de KYC introduce presión innecesaria sobre el runway hasta que el flujo de cliente genere recargas reales.

### Punto de partida ya en código

La infraestructura técnica del frente Veriff queda **operativa y dormida** en el repositorio: cliente HTTP con firma HMAC de salida, validación HMAC del webhook entrante con alineación de header, country gating al inicio del flujo KYC, payload de `createSession` con campos opcionales condicionales, mapeo del Decision webhook por `verification.code` como autoridad, idempotencia por `attemptId`. `kyc.veriff.enabled=false` en `application.properties` y en `config.env` de los tres entornos. Esta inversión técnica no se descarta — pasa a ser **contingencia accesible** para cualquier plan alternativo.

### Descubrimiento de Didit como alternativa viable

[Didit](https://didit.me) es un vendor self-serve que cubre los tres flujos del KYC con encaje natural al método decidido en ADR-029:

- **KYC bundle** (ID Verification + Passive Liveness + Face Match 1:1 + Device & IP Analysis): **500 verificaciones gratis al mes permanentes**; después **0,33 USD/bundle**. No hay contrato anual ni mínimos.
- **Age Estimation** facial: **0,10 USD/check** (no entra en el bundle gratuito; contador independiente). Devuelve edad estimada (decimal), score 0-100, confianza por cara detectada, y status `Approved`/`Declined` contra un `age_estimation_decline_threshold` que el integrador define.
- **Workflow Builder visual en consola** con orquestación interna: existe un patrón nativo *"Adaptive Age Verification Workflow"* documentado por Didit que ejecuta exactamente "estimación facial → step-up automático a Document+Selfie IDV si la edad estimada cae en buffer zone". La regla del buffer (`challenge age`) se configura en consola, no en código. **El integrador no tiene que orquestar el fallback en su backend**: se entrega un único webhook firmado con el resultado final del workflow.
- **Datos en UE por defecto** (AWS Ireland). Retención configurable de 1 mes a 10 años, o "unlimited" (default).
- **Webhooks firmados con HMAC-SHA256**: variante "Standard" sobre raw body en hex (compatible 1:1 con el helper `com.sharemechat.security.HmacSha256` ya validado en el frente Veriff). Replay protection nativa por ventana 5 min.
- **Certificaciones**: SOC 2 Type I (Type II en curso), ISO 27001:2022 + 27017 + 27018, iBeta Level 1 (ISO 30107-3 PAD), alineación GDPR.
- **REST API directa**. No hay SDK Java oficial — la integración desde Spring Boot reutiliza el mismo patrón `RestTemplate` + `HmacSha256` que ya usamos para Veriff.

### Alineación con requisitos comerciales y regulatorios

Investigación realizada confirma que el método decidido en ADR-029 (estimación facial primaria + step-up documental sobre buffer zone + documento como último recurso) sigue siendo defendible con Didit como proveedor:

- **Segpay** (vía activa de PSP, ver [psp-strategy.md](../01-business/psp-strategy.md)): el *Adult Content Due Diligence Checklist* exige "robust age verification" sin imponer vendor concreto ni certificación específica.
- **Card schemes** (Visa VIRP / VAMP, Mastercard Specialty Merchant Registration Program): mismas exigencias funcionales, vendor-agnósticas.
- **UK Ofcom** (Online Safety Act, guía de enero 2025 sobre "highly effective age assurance"): la estimación facial sigue siendo método aceptado al mismo nivel que la verificación documental; el step-up al documento cuando la facial es borderline es exactamente el patrón que la guía describe.
- **US post-*Free Speech Coalition v. Paxton***: el régimen estatal exige "reasonable methods" sin imponer vendor concreto; los mercados conflictivos siguen tratándose caso por caso (ver [geographic-strategy.md](../01-business/geographic-strategy.md)).

## Decisión — Plan A

Se adopta a **Didit como proveedor único** para los dos flujos KYC. La arquitectura de método decidida en ADR-029 se mantiene íntegra; cambia el vendor.

### Para el MODELO

- **Producto Didit**: KYC bundle (ID Verification + Passive Liveness + Face Match + Device & IP Analysis).
- **Disparador**: registro del modelo (mismo momento que ADR-029).
- **Resultado**: APPROVED / DECLINED / RESUBMISSION_REQUESTED vía webhook firmado HMAC-SHA256, procesado por el backend igual que se hace hoy para Veriff (mapeo a `users.verification_status`).
- **Coste**: 0 USD hasta 500 verificaciones/mes; después 0,33 USD/bundle.

### Para el CLIENTE

- **Producto Didit**: workflow "Adaptive Age Verification" configurado en consola Didit (no en código).
  - **Paso 1**: Age Estimation facial (0,10 USD/check) en la **primera recarga del monedero**.
  - **Paso 2**: si la edad estimada es ≥ `challenge age` (provisional **25 años**, con buffer de 7 años respecto al gate legal de 18; alineado con práctica del sector adult y con la guía Ofcom), el flujo pasa directo al pago.
  - **Paso 3 (fallback)**: si la edad estimada cae en buffer zone (< `challenge age` o confianza baja/media), el workflow exige Document + Selfie IDV automáticamente como step-up **dentro del mismo workflow**.
- **Disparador**: primera recarga del monedero (mismo momento que ADR-029; requisito "pre-pago SFW" intacto).
- **Resultado final**: APPROVED / DECLINED unificado vía un único webhook al final del workflow.
- **Coste**: 0,10 USD por cliente que llega al primer pago; +0 USD si el fallback queda dentro del free tier de 500 KYC bundles/mes.

### Consentimiento biométrico (GDPR Art. 9)

- **SharemeChat es controller, Didit es processor** del procesamiento biométrico.
- El **consentimiento explícito previo** (checkbox sin pre-marcar) es **responsabilidad de SharemeChat**, **antes** de redirigir al hosted flow de Didit. NO se delega en Didit aunque su flujo hosted incluya su propio paso de consentimiento.
- Disclosure legal del procesamiento biométrico, la finalidad, el processor y los derechos del usuario se incluyen en los términos+condiciones y en la política de privacidad de SharemeChat.

### Residencia y retención

- **Residencia**: UE (AWS Ireland) por defecto en Didit (aplicable al tier no-Enterprise que vamos a usar). No requiere acción.
- **Retención**: **configurar activamente a 6 meses** en consola Didit al momento de implementar. NO dejar el default "unlimited". Ámbito por aplicación Didit.

### Firma de webhooks entrantes

- Adoptar la variante **"Standard"** (raw body, HMAC-SHA256, hex, header `X-Signature`) que reutiliza 1:1 el patrón ya validado en el frente Veriff (commits `27796bb`/`ce0b4fd`): `com.sharemechat.security.HmacSha256` con comparación constant-time, body recibido como `byte[]` para preservar los bytes firmados.
- Validación de timestamp en ventana 5 minutos (replay protection nativa de Didit).
- Considerar migrar a la variante **V2** (canónica con sorted-keys + Unicode preserved + sin escape ASCII) si Didit recomienda explícitamente migrar más adelante.

### Estado de implementación

Hecho:
- Frente Veriff backend cerrado y operativo end-to-end en TEST (commits `27796bb`..`53c3036`). Queda **dormido**: `kyc.veriff.enabled=false` en `application.properties` y en `config.env` de los tres entornos. **No se elimina** del codebase; pasa a ser contingencia técnica accesible para los planes alternativos B/C/D documentados abajo.

Planificado:
- Cliente Didit en backend (REST), webhook handler y workflow configurado en consola Didit, reutilizando el patrón ya validado con Veriff.
- DPIA del flujo biométrico bajo GDPR, con Didit como processor.
- Solicitud y firma del DPA con Didit.
- Capa de consentimiento biométrico explícito en frontend antes del redirect al hosted flow.

## Planes alternativos documentados

Los planes B / C / D no se priorizan; se registran para que su activación, si llega, no requiera rehacer evaluación. Para los tres, **el código de Veriff actual NO se elimina** del repositorio.

### Plan B — Híbrido Didit + vendor ACCS-certificado

Mantener Didit para KYC modelo + Document+Selfie del cliente. Añadir un proveedor con certificación ACCS específica para la capa de age estimation del cliente. Candidatos identificados: **Persona**, **Yoti**.

Aplica si: Segpay, un PSP del Plan B, o algún mercado del white list (UK post-Ofcom maduro, algún estado US) exige age estimation con certificación específica (ACCS, NIST FATE) que Didit no presente.

### Plan C — Veriff modelo + Didit cliente

Reactivar la integración Veriff (`kyc.veriff.enabled=true` en TEST/AUDIT/PROD según corresponda) para el flujo del modelo. Mantener Didit sólo para el cliente (Age Estimation + fallback).

Aplica si: Didit demuestra problemas de madurez en el flujo KYC del modelo durante la implementación (mapeo de estados débil, soporte lento, decisiones inconsistentes) pero su Age Estimation cumple para el cliente.

### Plan D — Vuelta total a Veriff

Reactivar Veriff completo para el modelo (`kyc.veriff.enabled=true`) y descartar Didit en el modelo. Para el cliente, abrir camino a vendor de age estimation independiente (Plan B sin Didit) o aceptar documento para todos (reabrir el "documento al 100%" que ADR-029 descartó).

Aplica si: Didit cae como vendor por fuerza mayor (interrupción de servicio prolongada, cambio unilateral de planes, problemas regulatorios del propio Didit). 

Coste: tirar el trabajo de integración Didit. Beneficio: el camino sigue accesible sin esfuerzo técnico porque el código de Veriff continúa integrado y testeado en el repo.

### Invariante común a los tres planes

El frente Veriff backend (commits `27796bb`..`53c3036`) **permanece integrado** con `kyc.veriff.enabled=false`. No se actualizan sus credenciales en `config.env` de AUDIT ni PROD mientras el Plan A esté vivo (las de TEST son sandbox y siguen para retests si hace falta). Reactivar Veriff es un cambio de flag más sus credenciales reales, no una reintegración.

## Justificación

El cambio de Veriff a Didit conserva íntegramente la decisión arquitectónica de ADR-029 (vendor único cubre los tres flujos; método estimación facial + step-up documental para cliente; KYC documental + selfie + liveness obligatorio para modelo; pre-pago SFW). La sustitución del proveedor estaba **anticipada y normalizada en el propio ADR-029**: *"sustitución del proveedor en el futuro es posible sin reabrir esta decisión arquitectónica… requeriría un ADR menor de cambio de proveedor"*. Este ADR es ese cambio menor.

Económicamente, el Plan A elimina el coste fijo del vendor de KYC durante la fase pre-ingresos: 0 USD/mes contra ~49 USD/mes (Veriff Essential, sólo IDV; sin age estimation) o ~199 USD/mes (Veriff Enterprise, con age estimation). En horizonte anual el ahorro es material para una sociedad pre-ingresos. El coste variable de Didit sólo se devenga sobre flujos realmente ejecutados.

Técnicamente, Didit ofrece el **patrón Adaptive nativo** en consola que ADR-029 obligaba a implementar como orquestación interna del backend. La parte de fallback condicional, que en Veriff hubiera requerido lógica nuestra de "si estimación borderline → llamar a segundo endpoint Doc+Selfie", queda **resuelta dentro del workflow del vendor**. Esto reduce superficie de código a mantener y blinda la lógica de step-up contra regresiones de implementación.

El patrón técnico validado en el frente Veriff (helper HMAC genérico, `permitAll` + whitelist permanente del webhook, country gating al inicio del flujo KYC, idempotencia por identificador único de evento, decisión por código numérico del vendor) **se reusa íntegro** con Didit. La inversión técnica del frente Veriff no se pierde, queda como base sobre la que asentar Didit y como código dormido reactivable.

El método de verificación del cliente (estimación + step-up documental) sigue siendo defendible bajo el régimen Ofcom UK, UE DSA y los criterios actuales de card schemes. El check público del *Adult Content Due Diligence Checklist* de Segpay no impone vendor ni certificación específica; las eventuales exigencias adicionales se cubren con los planes B/C/D.

## Impacto

### Arquitectura

- Endpoint `/api/kyc/veriff/start` y `/api/kyc/veriff/webhook` permanecen en código pero quedan inactivos (gateados por `kyc.veriff.enabled=false`). Se añadirán endpoints análogos para Didit cuando se implemente el flujo de cliente y el reemplazo del modelo.
- El campo `User.dateOfBirth` y la columna `users.verification_status` siguen siendo la fuente de verdad interna para gating; cambia el origen que los rellena (de Veriff a Didit).
- `AgeGatePolicyService` actual (checkbox `confirAdult` + `acceptedTerm`) sigue como capa legal-defensiva mínima durante la transición, exactamente igual que en ADR-029. Deja de ser defendible cuando la plataforma vaya pública sin estimación facial operativa.
- El webhook entrante de Didit es `permitAll` por el mismo principio que el de Veriff (ver `SecurityConfig` y `ProductOperationalModeService.isAlwaysAllowed`). Se reutiliza el patrón existente.

### Operaciones

- **DPIA del flujo biométrico** con Didit como processor (entregable que en `compliance-deliverables.md` §6.1 estaba ya planificado bajo Veriff; ahora se actualiza con Didit).
- **DPA + TOMs** se solicitan a Didit por correo a `hello@didit.me` (Didit no expone DPA público en portal).
- **Configurar retención a 6 meses** en consola Didit al momento de implementar.
- **Diseñar el workflow "Adaptive Age Verification"** en consola Didit con `challenge age = 25` y buffer zone documentado.
- **Capa de consentimiento biométrico explícito** en frontend antes de redirigir al hosted flow.

### Riesgos

- **Madurez del vendor**: Didit es vendor joven (fundado 2023). Tiene SOC 2 Type I (Type II en curso). No publica ACCS ni evaluación NIST FATE específica para su Age Estimation. Si Segpay endurece criterio durante la due diligence, se activaría el Plan B/C/D.
- **Dependencia single-vendor**: igual riesgo que ADR-029 con Veriff. Mitigación: planes alternativos documentados arriba + código Veriff dormido reactivable.
- **Retención por defecto "unlimited"** en Didit: si se olvida configurar activamente la retención al implementar, el flujo procesaría datos biométricos sin política de borrado. **Bloqueante para go-live de producción**.

## Consecuencias

Positivas:

- **0 USD/mes en coste fijo** del vendor de KYC mientras no haya ingresos. Coste variable sólo cuando se ejecuta una verificación real.
- Patrón Adaptive nativo de Didit elimina la orquestación de fallback en el backend; menos código nuestro a mantener.
- Reutilización completa del patrón técnico validado con Veriff (HMAC, country gating, idempotencia, mapeo por código numérico).
- Misma defensibilidad regulatoria que ADR-029 (Ofcom, UE DSA, US post-Paxton), con vendor sustituido pero método idéntico.
- Veriff dormido es contingencia accesible sin coste técnico permanente.

Negativas:

- Dependencia single-vendor en Didit, vendor joven con menor track record que Veriff. Riesgo asumido.
- Trabajo de integración técnica del cliente Didit (que en ADR-029 también estaba planificado, ahora sobre otro vendor).
- Mantener Veriff dormido cuesta superficie de código a no romper en frentes futuros (refactors, security audits) aunque esté inactivo.

Trade-off asumido:

- Se prefiere el coste fijo cero y el patrón Adaptive nativo de Didit sobre la madurez probada de Veriff. La asimetría de riesgo se mitiga con planes B/C/D y con el código Veriff dormido.

## Acciones inmediatas registradas (no ejecutadas en este ADR)

1. Escribir a Segpay (Patricia) confirmando aceptación del método (estimación facial + step-up documental con Didit) ANTES de empezar implementación técnica del cliente.
2. Solicitar DPA + TOMs a Didit por correo a `hello@didit.me`.
3. Diseñar el workflow "Adaptive Age Verification" en consola Didit (challenge age 25, buffer zone), parametrizándolo para los tests sandbox antes de exposición a usuarios reales.
4. Configurar retención a 6 meses en consola Didit (no dejar el default "unlimited").
5. Iterar sobre la DPIA con Didit como processor (entregable que estaba ya en `compliance-deliverables.md` §6.1).
6. Implementación técnica del cliente Didit (frontend + backend), reutilizando el patrón ya validado en el frente Veriff (helper `HmacSha256`, `permitAll` + whitelist permanente del webhook, country gating al inicio del flujo, `byte[]` raw body para HMAC, idempotencia, mapeo por código de decisión).
7. Configurar credenciales Didit en `config.env` de TEST sólo (no AUDIT, no PROD) durante la fase de implementación.

## Notas

- ADR-029 queda **superseded por este ADR-035** y se marca explícitamente como tal al final de su fichero.
- `known-debt.md` **no se modifica** en este ADR: los pendientes técnicos del frente Veriff (todos cerrados en commits `27796bb`..`53c3036`) siguen como están. Las deudas nuevas del frente Didit se registrarán cuando aparezcan durante la implementación.
- `project-log.md` lleva una entrada con la fecha de hoy referenciando este ADR-035 y resumiendo el cambio de vendor.
- `psp-strategy.md` y `compliance-deliverables.md` apuntan hoy a ADR-029 en varios sitios. **No se actualizan en este ADR** para no acumular cambios documentales sin necesidad; la lectura de ADR-029 lleva al ADR-035 vía el status update. Cuando alguno de esos documentos sea editado por otro motivo, se actualizarán las referencias.
- El método de verificación de cliente (estimación + step-up documental + documento sólo como último recurso) **sigue fijo como requisito de producto**. Si el PSP final no acepta el método, se cambia de PSP — no se cambia el método. Esa invariante de ADR-029 no se relaja con este ADR.
