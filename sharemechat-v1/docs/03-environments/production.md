# Entorno PRODUCTION

## Propósito

La información disponible sugiere que PRODUCTION se usa principalmente para:

- landing pública
- publicación de assets compartidos

## Hosts canónicos

Decisión documentada en [ADR-015](../06-decisions/adr-015-canonical-domains-per-environment.md). Resumen para PRO:

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

Product Operational Mode ya existe en backend (ver [ADR-009](../06-decisions/adr-009-product-operational-mode.md)), pero PRO no está documentado aquí como producto completo desplegado.

La intención de configuración para PRO es:

- en **Fase 1 — Prelaunch público controlado** del roadmap, modo `PRELAUNCH` con registros de cliente y modelo abiertos. Producto bloqueado server-side y backoffice operativo.
- al alcanzar **Fase 5 — PRO público limitado**, transición a modo `OPEN` con registros abiertos.
- modo `MAINTENANCE` reservado para ventanas operativas controladas en cualquier momento posterior.
- `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false` siempre.

Cualquier acreditación de saldo en PRO debe pasar por PSP validado. Los webhooks CCBill requieren verificación de firma y contrato operativo cerrado antes de circular dinero real.
