# Vision general de integraciones

## Email

El backend abstrae el envio de correo con dos proveedores:

- Microsoft Graph
- SMTP

Es una de las integraciones mejor asentadas en el codigo actual.

## PSP

**Estado actualizado 2026-07-18**. La via viva de pagos en PROD es **NOWPayments** (cripto puente custodial, BTC/USDT/USDC), activada 2026-07-17 tras cerrar el frente ADR-051. Cubre el requisito Gate 3 del pivote soft launch (ADR-047: al menos un flujo de pago real end-to-end operativo en PROD).

Los PSP de tarjeta quedan asi:

- **Segpay**: DESCARTADO 2026-07-18 por incompatibilidad estructural (Segpay exige que el director/beneficiario efectivo resida en el mismo pais donde esta constituida la sociedad; SharemeChat es OU estonia con operador residente fuera de Estonia, lo que Segpay clasifica como indicio de empresa pantalla y bloquea el onboarding).
- **CardBilling (filial de Verotel)**: **primer PSP potencial de tarjeta** para sustituir a Segpay como via a explorar. Contacto formal pendiente.
- **CCBill**: quedo silente en onboarding tras conversaciones iniciales; sigue como via reactivable pero no activa. Integracion tecnica dormida (`CcbillService`, `POST /api/billing/ccbill/session`, webhook `/api/billing/ccbill/notify`) sin usarse hoy.
- **NOWPayments** (cripto): activa y operativa en PROD. Endpoints `/api/billing/nowpayments/checkout` + `/api/webhooks/nowpayments/ipn`, kill-switch triple (property + BD + credenciales).

Principio operativo: redundancia de PSP. Detalle y roadmap en [psp-strategy.md](../01-business/psp-strategy.md) y en [ADR-051](../06-decisions/adr-051-psp-puente-cripto-nowpayments.md). La interface `PaymentProvider` permite anadir un adapter CardBilling o cualquier otro vendor como bean adicional sin tocar orquestador ni ledger.

## Verificacion de edad e identidad (Didit)

**Estado actualizado 2026-07-18**. Vendor unico consolidado en **Didit** (decision direccional en [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md), consolidacion en [ADR-035](../06-decisions/adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md)):

- **KYC de modelos**: activo con vendor real en TEST/AUDIT (workspace sandbox compartido) y en PROD (workspace producción real, destino webhook `shareme-prod-kyc`, activado 2026-07-18). Endpoints `/api/kyc/didit/webhook` operativos. Automatizacion completa; el admin solo interviene para promover el user a role=MODEL una vez APPROVED.
- **Estimacion facial de edad de clientes**: activa. Workflow `shareme-client-age` (Adaptive Age Verification). Se activa en la primera recarga del monedero via el gate `ensureClientKycApproved` en el frontend.

**Veriff dormido como Plan B**: la integracion Veriff (`VeriffClient`, `VeriffClientImpl`, `VeriffProperties`, endpoints `/api/kyc/veriff/*`, pagina `ModelKycVeriffPage.jsx`) queda **integrada en el codigo pero apagada** con `kyc.veriff.enabled=false` en los 3 entornos. **NO se usa hoy**. Se conserva como contingencia contractual: si Didit cae por fuerza mayor (cierre de servicio, cambio unilateral de precios inaceptable, retirada de plan Free) reactivar Veriff es toggle de flag + credenciales reales, no reintegracion. Documentado en [ADR-035](../06-decisions/adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md) planes alternativos.

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
- **AUDIT**: `active_mode=MOCK`. No se activa SIGHTENGINE en AUDIT por decision de operacion (AUDIT sirve de espejo pre-PROD sin trafico real; el MOCK es suficiente para validaciones estructurales).
- **PROD**: **`active_mode=SIGHTENGINE` desde 2026-07-18** (retirado el override belt-and-suspenders de `application-prod.properties`). Cuenta compartida con TEST segun ADR-037. Modo PRELAUNCH del producto sigue vigente; SightEngine se activa preventivamente para que cuando abra el modo OPEN los primeros streams ya se analicen con vendor real.

**Posicionamiento operativo confirmado** tras P2.2 (alineado con AN 5196 / Visa Rule ID 0003356 / practica CooMeet/LuckyCrush): adult dating 1-a-1 con nudity consensual entre adultos verificados permitido. La politica granular vive en el workflow del dashboard del operador, no en codigo. Refactor de policies publicas (`docs/01-business/`) para alinear lenguaje declarado con la operacion real queda como deuda estrategica.

**Tambien operativo**: corte de sesion, registro de stream records, moderacion de assets estaticos del catalogo del modelo (cola admin completa con audit log, ya desplegada desde antes del Paquete 1).

## Activos legales

El sistema consume activos legales externos desde un dominio dedicado de assets. Esto justifica separar conceptualmente uploads operativos y assets publicados.

## Storage

Los uploads privados del producto ya tienen soporte versionado para:

- storage local transicional
- storage S3 privado

La subida sigue pasando por backend. No existe en esta fase subida directa desde frontend a S3 ni exposicion publica del bucket para documentos privados.
