# Vision general de integraciones

## Email

El backend abstrae el envio de correo con dos proveedores:

- Microsoft Graph
- SMTP

Es una de las integraciones mejor asentadas en el codigo actual.

## PSP

Existe adaptacion hacia CCBill para iniciar sesiones y recibir notificaciones, pero la integracion no esta cerrada de extremo a extremo. **CCBill** quedo silente en onboarding y la via activa actual es **Segpay**, sin contrato firmado todavia. El principio operativo declarado es de redundancia (no depender de un unico PSP). Direccion y detalle en [psp-strategy.md](../01-business/psp-strategy.md). Riesgos abiertos por PSP no cerrado y por webhook sin validar en [known-risks.md](../04-operations/known-risks.md).

## Verificacion de edad e identidad (Veriff)

Existe integracion con **Veriff** como proveedor unico para los tres flujos de verificacion (decision direccional en [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md)):

- **KYC de modelos**: activo-manual hoy. Endpoint `/api/kyc/veriff/start` operativo para onboarding del modelo. Automatizacion completa pendiente antes del go-live.
- **Estimacion facial de edad de clientes**: planificada. Se activara en la primera recarga del monedero, con secundaria por tarjeta/open banking y documento como ultimo recurso.
- **Validacion documental secundaria**: planificada.

La configuracion del entorno de test mantiene `kyc.veriff.enabled=false`. La integracion debe documentarse como disponible pero no plenamente activa por defecto.

## Moderacion (vendors de IA)

Estado actualizado tras cierre del Paquete 1 y sub-paquetes P2.1 + P2.2 del frente Moderacion IA del streaming (commits `6cebf90`, `9d2662c`, `3e97839`; ver bitacora `project-log.md`).

**Dominio arquitectonico**: [ADR-030](../06-decisions/adr-030-moderation-pipeline-build-vs-rent.md) (build control plane, rent clasificadores), [ADR-036](../06-decisions/adr-036-moderation-pipeline-architectural-stance.md) (captura cliente-side, cadencia configurable, fail-closed-soft), [ADR-037](../06-decisions/adr-037-moderation-visual-vendor-sightengine.md) (Sightengine como Plan A del vendor visual).

**Clasificacion visual**: **Sightengine seleccionado** y operativo. Workflow consolidado en dashboard del operador (id `wfl_kVAtM2rkY4uiyMcyPBhUB`). Image API frame-a-frame, sincrono.

- Hive y AWS Rekognition quedan como contingencias documentadas en ADR-037, sin onboarding paralelo.
- La decision granular de escalado AMBER/RED se delega al `summary.action` del workflow Sightengine, editable desde el dashboard sin redeploy (P2.2).
- CRITICAL para MINORS (>0.3) y GORE (>0.5) se mantiene en codigo como kill switch innegociable (no delegado al vendor).

**Deteccion de CSAM**: cubierta tacticamente por el modelo `minor` de Sightengine (sintesis `faces[*].attributes.age.minor` -> CRITICAL kill switch). Vendor dedicado (PhotoDNA/Thorn Safer/Hive especifico CSAM) queda como deuda estrategica para evaluar segun volumen (ver `known-debt.md`). **Nunca construir CSAM propio**.

**Estado por entorno**:

- **TEST**: pipeline completo activo. Endpoint `POST /api/streams/{id}/frames` (rol MODEL, multipart JPEG/PNG, cap 5 MB), captura cliente-side en `DashboardModel.jsx` cadencia 15s, executor dedicado `moderationExecutor` (core=20, max=30), evidencia visual en bucket S3 `sharemechat-moderation-evidence-test` (SSE-S3, TTL 30d, IAM scoped, solo severity >= AMBER). `active_mode=SIGHTENGINE`. JAR `c10fa7bb...` desplegado.
- **AUDIT**: backend del Paquete 1 (`e49a6a1`) con `active_mode=MOCK`. Activacion SIGHTENGINE diferida a sub-paquete posterior.
- **PROD**: backend del Paquete 1 (`6cebf90`) con `active_mode=MOCK`, modo PRELAUNCH. Activacion SIGHTENGINE diferida a sub-paquete posterior pre-go-live.

**Posicionamiento operativo confirmado** tras P2.2 (alineado con AN 5196 / Visa Rule ID 0003356 / practica CooMeet/LuckyCrush): adult dating 1-a-1 con nudity consensual entre adultos verificados permitido. La politica granular vive en el workflow del dashboard del operador, no en codigo. Refactor de policies publicas (`docs/01-business/`) para alinear lenguaje declarado con la operacion real queda como deuda estrategica.

**Tambien operativo**: corte de sesion, registro de stream records, moderacion de assets estaticos del catalogo del modelo (cola admin completa con audit log, ya desplegada desde antes del Paquete 1).

## Activos legales

El sistema consume activos legales externos desde un dominio dedicado de assets. Esto justifica separar conceptualmente uploads operativos y assets publicados.

## Storage

Los uploads privados del producto ya tienen soporte versionado para:

- storage local transicional
- storage S3 privado

La subida sigue pasando por backend. No existe en esta fase subida directa desde frontend a S3 ni exposicion publica del bucket para documentos privados.
