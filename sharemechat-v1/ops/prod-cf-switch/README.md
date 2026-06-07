# prod-cf-switch — Switch del origin público al SPA coming-soon

Estado capturado el **2026-06-07**. Material de referencia y rollback del
switch del origin por defecto de la distribución CloudFront pública
`E2FWNC80D4QDJC` (sharemechat.com / www.sharemechat.com) del bucket de
landing legacy (`sharemechat-landing-prod`) al bucket SPA producto
(`sharemechat-frontend-prod`), en periodo PRELAUNCH industrial
([ADR-009](../../docs/06-decisions/adr-009-product-operational-mode.md)).

## Cambios aplicados durante el switch

1. **Function CloudFront `redirect-spa-prod`** — publish DEV → LIVE. La
   versión LIVE previa (sin redirects legacy `.html`) queda persistida
   en este directorio como artefacto de rollback.
2. **Distribution `E2FWNC80D4QDJC`** —
   `DefaultCacheBehavior.TargetOriginId` cambia de
   `s3-sharemechat-landing-prod` a `s3-sharemechat-frontend-prod-spa`.
3. **Invalidación** `/*`.

Resto intacto: behavior `/api/*`, los 3 origins (el landing legacy se
mantiene en la distribución como origin secundario disponible para
rollback inmediato), aliases, certificado ACM, CustomErrorResponses
(Quantity 0), bucket `sharemechat-landing-prod` (los 11 HTMLs estáticos
siguen en su sitio).

## Estado de la function LIVE post-switch

- Nombre: `redirect-spa-prod`
- Runtime: `cloudfront-js-1.0`
- Asociada en `DefaultCacheBehavior.FunctionAssociations[*]` con
  `EventType=viewer-request`.
- Lógica:
  - `www.sharemechat.com → https://sharemechat.com<uri>` (301).
  - 5 redirects legacy `.html` → ruta canónica SPA (301):
    `/legal.html→/legal`, `/faq.html→/faq`, `/safety.html→/safety`,
    `/community-guidelines.html→/community-guidelines`,
    `/cookie-settings.html→/cookies-settings` (singular legacy → plural
    SPA).
  - Bypass de rutas backend / assets: `/api/*`, `/match`, `/messages`,
    `/uploads/*`, `/assets/*`, `/static/*`,
    `/.well-known/acme-challenge/*`, `/favicon.ico`, `/robots.txt`.
  - SPA fallback: cualquier `uri` sin extensión → `/index.html` (para
    que React Router resuelva el deep-link client-side).

## Procedimiento de rollback (~6-10 min)

Si tras el switch hay que volver a servir la landing legacy desde
`sharemechat.com`, ejecutar EN ESTE ORDEN:

```bash
# 1) Revertir la function LIVE a la versión previa
#    (sobreescribe DEVELOPMENT con el código de este artefacto y publica).
ETAG_DEV=$(aws cloudfront describe-function --name redirect-spa-prod \
            --stage DEVELOPMENT --query ETag --output text)
aws --profile sharemechat-provisioner cloudfront update-function \
    --name redirect-spa-prod \
    --if-match "$ETAG_DEV" \
    --function-config Comment="rollback pre-switch",Runtime="cloudfront-js-1.0" \
    --function-code fileb://./redirect-spa-prod-LIVE-rollback.js

NEW_ETAG_DEV=$(aws cloudfront describe-function --name redirect-spa-prod \
                --stage DEVELOPMENT --query ETag --output text)
aws --profile sharemechat-provisioner cloudfront publish-function \
    --name redirect-spa-prod \
    --if-match "$NEW_ETAG_DEV"

# 2) Revertir el DefaultCacheBehavior.TargetOriginId al bucket landing
aws cloudfront get-distribution-config --id E2FWNC80D4QDJC > current.json
# Editar JSON manualmente (o via Python):
#   DistributionConfig.DefaultCacheBehavior.TargetOriginId
#     "s3-sharemechat-frontend-prod-spa" -> "s3-sharemechat-landing-prod"
# Resto INTACTO (origins, /api/*, aliases, cert, function association).
ETAG_DIST=$(python -c "import json; print(json.load(open('current.json'))['ETag'])")
aws --profile sharemechat-provisioner cloudfront update-distribution \
    --id E2FWNC80D4QDJC \
    --if-match "$ETAG_DIST" \
    --distribution-config file://current.json
aws cloudfront wait distribution-deployed --id E2FWNC80D4QDJC

# 3) Invalidar
aws --profile sharemechat-provisioner cloudfront create-invalidation \
    --distribution-id E2FWNC80D4QDJC --paths "/*"
```

El bucket `sharemechat-landing-prod` y los 3 origins de la distribución
permanecen intactos durante el switch, por lo que el rollback es
siempre posible. Estimación: ~6-10 min (1-2 min function + 3-5 min wait
deploy + 1-2 min wait invalidation).

## Artefacto

- [`redirect-spa-prod-LIVE-rollback.js`](./redirect-spa-prod-LIVE-rollback.js)
  — código de la versión LIVE previa (ETag `ETVPDKIKX0DER`,
  LastModified `2026-05-24T21:17:01Z`).

## Referencias

- Snapshot pre-switch:
  [`docs/_snapshots/state-prod-2026-06-07.yaml`](../../docs/_snapshots/state-prod-2026-06-07.yaml).
- Snapshot post-switch:
  [`docs/_snapshots/state-prod-2026-06-07-postswitch.yaml`](../../docs/_snapshots/state-prod-2026-06-07-postswitch.yaml).
- ADR-009 (Product Operational Mode):
  [`docs/06-decisions/adr-009-product-operational-mode.md`](../../docs/06-decisions/adr-009-product-operational-mode.md).
- Bitácora del switch:
  [`docs/project-log.md`](../../docs/project-log.md) — entrada
  `2026-06-07 — Switch del origin público al SPA coming-soon`.
