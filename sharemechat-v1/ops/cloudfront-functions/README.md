# CloudFront Functions (copia canónica versionada)

Código fuente de las CloudFront Functions del proyecto. Son recuperables del servicio (`aws cloudfront get-function --name <nombre> --stage LIVE <salida>`), pero esta es la **copia canónica versionada** en el repositorio; hasta el 2026-05-27 solo existían como dumps sueltos en la raíz.

Todas son `cloudfront-js-1.0`, event type `viewer-request`.

## Ficheros

- `redirect-spa-prod.js` — función combinada de PRODUCTION: redirige `www.sharemechat.com` → apex (301) y aplica SPA fallback (reescribe a `/index.html` las rutas sin extensión, dejando pasar `/api/`, `/static/`, `/assets/`, etc.). Asociada a la distribución de producto PROD `E2FWNC80D4QDJC` (swap aplicado en PRO-6, sustituyó a `redirect-www-to-root-prod`).
- `redirect-spa-test.js` — SPA fallback del entorno TEST. Asociada a la distribución de producto TEST `E2Q4VNDDWD5QBU`. (El antiguo `redirect-spa-test.bin` suelto en la raíz era un duplicado byte-idéntico de este `.js`, descartado en la limpieza.)
- `redirect-www-to-root-prod.js` — función legacy que solo hacía `www` → apex en PROD. **Desasociada en PRO-6** al ser sustituida por `redirect-spa-prod.js` (combinada). Se conserva como referencia histórica; sigue existiendo en CloudFront pero sin distribución asociada.

## Notas

- La variante admin (`redirect-spa-admin-prod`, `redirect-spa-audit`, etc.) no está en esta carpeta porque no se rescató de la raíz; si se necesita su fuente canónica, descargarla de CloudFront y añadirla aquí.
- Estas funciones se editan en CloudFront vía consola/CLI y se publican a stage LIVE. Si se modifica el código, actualizar también esta copia versionada para mantener la paridad.

## Historial de cambios

### 2026-06-21
- Modificación de `redirect-spa-prod`: añadida rama `/blog/*` que reescribe a `<path>/index.html` en lugar de sustituir por `/index.html`. Habilita pre-render selectivo del blog. Ver [docs/01-business/seo/seo-edge-function-analysis-2026-06-21.md](../../docs/01-business/seo/seo-edge-function-analysis-2026-06-21.md).
- Distribución PROD `E2FWNC80D4QDJC`: añadido `CustomErrorResponses` con item `403 → /index.html (200)` para cubrir el caso de artículo publicado sin HTML pre-renderizado aún en S3 (S3 OAC devuelve 403 cuando la key no existe; CloudFront lo convierte a 200 + shell SPA y la SPA hidrata via API igual que hoy).
