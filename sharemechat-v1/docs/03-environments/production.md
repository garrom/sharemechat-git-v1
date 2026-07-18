# Entorno PRODUCTION

## Propósito

La información disponible sugiere que PRODUCTION se usa principalmente para:

- landing pública
- publicación de assets compartidos

## Hosts canónicos

Decisión documentada en [ADR-015](../06-decisions/adr-015-canonical-domains-per-environment.md). Resumen para PROD:

- Producto público: `https://sharemechat.com` (apex sin www)
- Variante con www: `https://www.sharemechat.com` → 301 al apex
- Backoffice: `https://admin.sharemechat.com`
- API y realtime: bajo el host del producto, paths `/api/...`, `/messages`, `/match`
- Blog: subdirectorio `https://sharemechat.com/blog/<slug>`
- Activos legales: `https://assets.sharemechat.com/legal/...` (compartido con TEST y AUDIT)
- Cookie domain: `.sharemechat.com`

La política de redirección www → apex se implementa en CloudFront/edge, no en backend.

## Alcance documentado

El material actual no permite afirmar con la misma solidez que exista en este repositorio una configuración completa de producto y backoffice en producción equivalente a TEST.

Por tanto, este documento se mantiene deliberadamente sobrio:

- producción pública y assets sí aparecen reflejados en documentación previa
- el backend de producción no debe darse por documentado aquí sin validación adicional

## Política

Cualquier ampliación futura de este documento debe apoyarse en evidencia versionada o en una actualización documental específica del entorno.

## Product Operational Mode previsto

Product Operational Mode ya existe en backend (ver [ADR-009](../06-decisions/adr-009-product-operational-mode.md)), pero PROD no está documentado aquí como producto completo desplegado.

La intención de configuración para PROD es:

- en **Fase 1 — Prelaunch público controlado** del roadmap, modo `PRELAUNCH` con registros de cliente y modelo abiertos. Producto bloqueado server-side y backoffice operativo.
- al alcanzar **Fase 5 — PROD público limitado**, transición a modo `OPEN` con registros abiertos.
- modo `MAINTENANCE` reservado para ventanas operativas controladas en cualquier momento posterior.
- `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false` siempre.

Cualquier acreditación de saldo en PROD debe pasar por PSP validado. Los webhooks CCBill requieren verificación de firma y contrato operativo cerrado antes de circular dinero real.

## Estado real 2026-07-18 — modo `PRELAUNCH` con vendors reales activos

PROD operando en modo `PRODUCT_ACCESS_MODE=PRELAUNCH` desde su despliegue (Fase 1 del roadmap). El gate `ProductOperationalModeFilter` deja abiertos solo `POST /api/users/register/{client,model}` y `POST /api/auth/{login,refresh}`; todo el resto devuelve 503 con `X-Product-Mode=PRELAUNCH` y la SPA muestra `<PreLaunchScreen/>`.

**Vendors reales activos** (retiro del override belt-and-suspenders ADR-045 completado el 2026-07-18 tras validación funcional en TEST/AUDIT):

- **Didit** (ADR-035 KYC edad + identidad): `KYC_DIDIT_ENABLED=true` en `config.env` PROD. Workspace del operador está en producción real (no sandbox), api-key + webhook creados específicamente para PROD. Retención de datos = 6 meses (default panel Didit). Overrides retirados del `application-prod.properties` en commit `30cbf8e`.
- **SightEngine** (ADR-037 moderación visual): `MODERATION_SIGHTENGINE_ENABLED=true`. Cuenta única compartida TEST/AUDIT/PROD. Override retirado en commit `5437025`.
- **NOWPayments** (ADR-051 PSP cripto): `PSP_NOWPAYMENTS_ENABLED=true` con base-url `api.nowpayments.io/v1/`. Primer flujo real end-to-end validado por operador. Filtro `pay_currencies` por pack activo (P10 sin BTC).

Cuando `PRODUCT_ACCESS_MODE` pase a `OPEN` (Fase 5 del roadmap), los tres vendors entran vivos automáticamente sin cambios de config.

## Primer registro real en PROD (2026-06-30)

Hito de negocio: 2026-06-30 22:34 UTC se completó el primer signup público real en PROD desde IP `77.111.246.51` (país detectado US, ui_locale `es`). Nickname `Zzzz`, email `miorenrir@tokmail.net` (verificado 22:36:41). Estado: `role=USER`, `user_type=FORM_CLIENT`, sin actividad posterior (esperable dado PRELAUNCH). Detectado 18 días después durante inspección manual — motivación directa para implementar el 2026-07-18 la notificación automática al buzón admin (ver `docs/05-backoffice/admin-operations.md` sección *Notificación al buzón admin en nuevos registros*) y el panel *Clientes y Modelos* (embudo agregado sin bajar a BD).
