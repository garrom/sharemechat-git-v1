# SharemeChat - Arquitectura AWS y Estado Actual

## Vision General

Este documento describe la arquitectura actual de SharemeChat combinando dos fuentes de verdad:

- Verificado en codigo y configuracion del repositorio
- Verificado operativamente en AWS CLI

Cuando un elemento esta validado por AWS CLI pero no aparece definido como IaC en este repositorio, debe leerse asi:

- Verificado operativamente en AWS CLI
- No versionado como IaC en este repositorio

Estado actual consolidado:

- Frontend React unico con dos superficies/builds: `product` y `admin`
- Backend Spring Boot Java 17
- API REST bajo `/api`
- WebSocket bajo `/match` y `/messages`
- Persistencia principal MySQL sobre RDS
- Redis como pieza real de runtime
- JWT en cookies con refresh token persistido
- Uploads servidos por el backend con storage local expuesto como `/uploads/*`
- Distribucion publica/admin/assets apoyada operativamente en CloudFront + S3

## Que esta verificado en codigo y que esta verificado operativamente en AWS

Verificado en codigo y configuracion del repositorio:

- Frontend React unico con dos superficies/builds:
  - `frontend/.env.product` -> `REACT_APP_SURFACE=product`
  - `frontend/.env.admin` -> `REACT_APP_SURFACE=admin`
- Origenes funcionales del frontend:
  - producto -> `https://test.sharemechat.com`
  - admin -> `https://admin.test.sharemechat.com`
- API base del frontend -> `/api`
- WebSocket del frontend -> `/match` y `/messages`
- Backend Spring Boot con handlers WebSocket en `/match` y `/messages`
- CORS backend para `test.sharemechat.com`, `www.test.sharemechat.com`, `admin.test.sharemechat.com` y `localhost:3000`
- MySQL como datasource real
- Redis como dependencia y runtime real para estado, rate limiting, locks y seen state
- JWT en cookies con refresh token persistido en `refresh_tokens`
- Storage real versionado como `local`, servido por Nginx desde `/usr/share/nginx/html/uploads`
- Existe `application-audit.properties`, pero hoy sigue apuntando a la base TEST

Verificado operativamente en AWS CLI. No versionado como IaC en este repositorio:

- Distribuciones CloudFront activas para publico TEST, admin TEST, assets TEST, assets PROD y landing PROD
- Dominios Route53 apuntando a CloudFront o a backend segun el caso
- Buckets S3 concretos de frontend/admin/assets
- OAC activos para buckets S3
- Certificados ACM usados por distribuciones TEST/admin/assets
- Cache policies, origin request policies y response headers policies asociadas a las distribuciones
- Funcion CloudFront `redirect-www-to-root-test` activa en la distribucion publica TEST

## Dominios y superficies

Verificado en codigo:

- Producto:
  - `https://test.sharemechat.com`
- Backoffice:
  - `https://admin.test.sharemechat.com`
- El frontend no esta separado en dos codebases. Es una sola app React con dos superficies/builds.

Verificado operativamente en AWS CLI. No versionado como IaC en este repositorio:

- `test.sharemechat.com` -> CloudFront `d38hgrd7fbqsch.cloudfront.net`
- `www.test.sharemechat.com` -> CloudFront `d38hgrd7fbqsch.cloudfront.net`
- `admin.test.sharemechat.com` -> CloudFront `d3ml1axp2tpmmv.cloudfront.net`
- `api.test.sharemechat.com` -> A record `63.180.48.12`
- `assets.test.sharemechat.com` -> CloudFront `d25qzf8rg01we9.cloudfront.net`
- `assets.sharemechat.com` -> CloudFront `d99amkbl8rwf7.cloudfront.net`
- `sharemechat.com` -> CloudFront `dzwmag96rivxf.cloudfront.net`
- `www.sharemechat.com` -> CloudFront `dzwmag96rivxf.cloudfront.net`

Superficies activas:

- Producto TEST:
  - dominio principal `test.sharemechat.com`
  - variante `www.test.sharemechat.com` redirigida a raiz por CloudFront Function
- Backoffice TEST:
  - dominio `admin.test.sharemechat.com`
- API TEST:
  - dominio `api.test.sharemechat.com`
- Assets:
  - `assets.test.sharemechat.com`
  - `assets.sharemechat.com`

## CloudFront

Verificado operativamente en AWS CLI. No versionado como IaC en este repositorio:

Distribucion publica TEST `E2Q4VNDDWD5QBU`:

- aliases:
  - `test.sharemechat.com`
  - `www.test.sharemechat.com`
- origins:
  - `api.test.sharemechat.com`
  - `sharemechat-frontend-test.s3.eu-central-1.amazonaws.com`
- default behavior -> S3 frontend
- cache behaviors:
  - `/.well-known/acme-challenge/*` -> `api.test.sharemechat.com`
  - `/api/*` -> `api.test.sharemechat.com`
  - `/match*` -> `api.test.sharemechat.com`
  - `/messages*` -> `api.test.sharemechat.com`
  - `/uploads/*` -> `api.test.sharemechat.com`
  - `/assets/*` -> `api.test.sharemechat.com`
- custom error:
  - `404 -> /index.html -> 200`
- function:
  - `redirect-www-to-root-test`
- certificate:
  - `arn:aws:acm:us-east-1:430118829334:certificate/f5d87124-5b29-41c5-857f-6d284b076f0e`
- OAC frontend:
  - `ENGNDDRO1OGZV`

Distribucion admin TEST `E28YCPVIRB4ASH`:

- alias:
  - `admin.test.sharemechat.com`
- origins:
  - `sharemechat-admin-test.s3.eu-central-1.amazonaws.com`
  - `api.test.sharemechat.com`
- default behavior -> S3 admin
- cache behavior:
  - `/api/*` -> `api.test.sharemechat.com`
- custom errors:
  - `403 -> /index.html -> 200`
  - `404 -> /index.html -> 200`
- certificate:
  - `arn:aws:acm:us-east-1:430118829334:certificate/cd68cecf-a4bf-41dd-a2b9-32525e0ac61f`
- OAC admin:
  - `E2TS16WJI0T1GG`

Distribucion assets TEST `E1WZ44LRD39ZAO`:

- alias:
  - `assets.test.sharemechat.com`
- origin:
  - `assets-sharemechat-test1.s3.eu-central-1.amazonaws.com`
- default behavior -> S3 assets
- certificate:
  - `arn:aws:acm:us-east-1:430118829334:certificate/16ce844c-8784-494c-badf-e32aaeba9a77`
- OAC assets:
  - `E3GIOGPHBFBHL5`

Distribucion assets PROD `E3UAOU6AUNI0CM`:

- alias:
  - `assets.sharemechat.com`
- origin:
  - `assets-sharemechat-prod.s3.eu-central-1.amazonaws.com`

Distribucion landing PROD `E2FWNC80D4QDJC`:

- aliases:
  - `sharemechat.com`
  - `www.sharemechat.com`
- origin:
  - `sharemechat-landing-prod.s3.eu-central-1.amazonaws.com`
- default behavior -> S3 landing prod
- function:
  - `redirect-www-to-root-prod`
- OAC:
  - `E1QL6VLQ6WI3IK`

Policies y function verificadas operativamente en AWS CLI:

- Managed cache policy frontend/assets:
  - `658327ea-f89d-4fab-a63d-7e88639e58f6 = Managed-CachingOptimized`
- Managed no-cache backend:
  - `4135ea2d-6df8-44a3-9df3-4b5a84be39ad = Managed-CachingDisabled`
- Public/backend origin request policy:
  - `b689b0a8-53d0-40ab-baf2-68738e2966ac = Managed-AllViewerExceptHostHeader`
- Admin API origin request policy:
  - `f11445e9-c064-4f11-9cd8-6c29ce615f28 = admin-api-origin-request-v2`
- Admin response headers policy:
  - `eaab4381-ed33-4a86-88ca-d9558dc6cd63 = Managed-CORS-with-preflight-and-SecurityHeadersPolicy`

CloudFront Function `redirect-www-to-root-test`, verificada operativamente en AWS CLI. No versionada como IaC en este repositorio:

- redirige `www.test.sharemechat.com` a `test.sharemechat.com`
- deja pasar `/api/`, `/match`, `/messages`, `/uploads/`, `/assets/`, `/static/`
- reescribe rutas SPA a `/index.html`
- contiene logica de allowlist IP comentada/desactivada y un bloque de denegacion por IP activo en el codigo LIVE mostrado por AWS CLI

## S3

Verificado operativamente en AWS CLI. No versionado como IaC en este repositorio:

Buckets:

- `sharemechat-frontend-test`
- `sharemechat-admin-test`
- `assets-sharemechat-test1`
- `assets-sharemechat-prod`

Estado operativo de los buckets TEST relevantes:

- region `eu-central-1`
- Block Public Access activo
- AES256 activo
- bucket policy restringida a `cloudfront.amazonaws.com` con `SourceArn` de su distribucion

OAC verificados operativamente:

- `ENGNDDRO1OGZV`
- `E2TS16WJI0T1GG`
- `E3GIOGPHBFBHL5`

Configuracion comun OAC:

- `SigningProtocol: sigv4`
- `SigningBehavior: always`
- `OriginType: s3`

## Backend

Verificado en codigo y configuracion del repositorio:

- Backend Spring Boot
- Java 17
- escucha en `0.0.0.0:8080`
- `server.forward-headers-strategy=native`
- API base bajo `/api`
- WebSocket bajo `/match` y `/messages`
- backend con autenticacion stateless y filtros JWT

Verificado operativamente en AWS CLI:

- El frontend publico y el admin enrutan hacia `api.test.sharemechat.com` para trafico backend
- `api.test.sharemechat.com` esta publicado en DNS como A record `63.180.48.12`

No versionado como IaC en este repositorio:

- tipo exacto de instancia, security groups, balanceadores y provisionamiento de host

## Base de datos

Verificado en codigo y configuracion del repositorio:

- datasource MySQL
- driver `com.mysql.cj.jdbc.Driver`
- conexion JDBC contra host RDS:
  - `db1-sharemechat-test-v2.c1gsc6qg4l8y.eu-central-1.rds.amazonaws.com:3306/db1_sharemechat_test`

Persistencia reflejada en codigo:

- usuarios
- streams
- mensajes
- transacciones
- refresh tokens
- entidades administrativas y auditoria interna

La presencia en AWS como RDS se sustenta operativamente por el endpoint RDS embebido en configuracion y por el uso real del datasource, pero el aprovisionamiento RDS no esta versionado como IaC en este repositorio.

## Redis

Verificado en codigo y configuracion del repositorio:

- Redis es una pieza real de runtime
- configuracion:
  - `spring.redis.host=localhost`
  - `spring.redis.port=6379`
- dependencia presente en el backend

Usos reales en codigo:

- `ApiRateLimitService` -> rate limiting API y WebSocket
- `StatusService` -> estado online/busy/offline y sesiones activas
- `StreamLockService` -> locks de runtime
- `SeenService` -> estado de vistos
- soporte de auditoria interna sobre incoherencias runtime/Redis

Redis no aparece en la version previa del README, pero si forma parte de la arquitectura real versionada del proyecto.

## Seguridad y autenticacion

Verificado en codigo y configuracion del repositorio:

- JWT para access token
- refresh token persistido en base de datos
- access token y refresh token servidos en cookies `HttpOnly`
- `auth.cookieDomain=.test.sharemechat.com`
- `auth.secureCookies=true`
- expiracion de access token configurada
- refresh token con rotacion y revocacion persistida
- tabla `refresh_tokens` modelada en codigo
- login de producto en `/api/auth/login`
- refresh de producto en `/api/auth/refresh`
- login de backoffice en `/api/admin/auth/login`
- CORS permitido para:
  - `https://test.sharemechat.com`
  - `https://www.test.sharemechat.com`
  - `https://admin.test.sharemechat.com`
  - `http://localhost:3000`

Verificado operativamente en AWS CLI. No versionado como IaC en este repositorio:

- Certificado publico TEST:
  - `DomainName: test.sharemechat.com`
  - `SAN: test.sharemechat.com, *.test.sharemechat.com`
- Certificado admin TEST:
  - `DomainName: *.test.sharemechat.com`
- Certificados ACM asociados a distribuciones CloudFront TEST/admin/assets

Importante:

- La capa CloudFront/S3 usa certificados ACM y OAC verificados operativamente en AWS CLI
- La capa de autenticacion JWT/refresh esta verificada en codigo del backend

## Storage y uploads

Verificado en codigo y configuracion del repositorio:

- `app.storage.type=local`
- `app.storage.local.root=/usr/share/nginx/html/uploads`
- `LocalStorageService` es la implementacion activa por defecto
- los ficheros se publican como rutas `/uploads/*`
- el comentario y la logica de `LocalStorageService` confirman que Nginx sirve esos uploads locales

Esto significa:

- el storage real versionado en el backend es local/Nginx para `/uploads`
- no hay implementacion S3 de uploads versionada en este repositorio

Verificado operativamente en AWS CLI:

- la distribucion publica TEST enruta `/uploads/*` a `api.test.sharemechat.com`

Sobre assets:

- existe dominio dedicado de assets:
  - `assets.test.sharemechat.com`
  - `assets.sharemechat.com`
- por tanto `/assets/*` no debe interpretarse como el mecanismo principal de publicacion de assets estaticos del dominio dedicado
- en la distribucion publica TEST si existe un cache behavior `/assets/* -> api.test.sharemechat.com`, verificado operativamente en AWS CLI

## Flujo alto nivel request -> frontend/backend -> persistencia

Flujo publico TEST:

- navegador -> `test.sharemechat.com`
- CloudFront publico TEST
- contenido SPA por defecto desde bucket S3 `sharemechat-frontend-test`
- rutas backend:
  - `/api/*` -> `api.test.sharemechat.com`
  - `/match*` -> `api.test.sharemechat.com`
  - `/messages*` -> `api.test.sharemechat.com`
  - `/uploads/*` -> `api.test.sharemechat.com`
  - `/.well-known/acme-challenge/*` -> `api.test.sharemechat.com`
- fallback SPA:
  - `404 -> /index.html -> 200`

Flujo admin TEST:

- navegador -> `admin.test.sharemechat.com`
- CloudFront admin TEST
- contenido SPA por defecto desde bucket S3 `sharemechat-admin-test`
- ruta backend:
  - `/api/*` -> `api.test.sharemechat.com`
- fallback SPA:
  - `403 -> /index.html -> 200`
  - `404 -> /index.html -> 200`

Flujo backend y persistencia, verificado en codigo:

- frontend usa `API_BASE=/api`
- frontend abre WebSocket a `/match` y `/messages`
- backend procesa autenticacion con JWT en cookies y refresh token persistido
- backend persiste datos estructurales en MySQL
- backend usa Redis para estado efimero y control operativo
- backend sirve uploads locales como `/uploads/*`

Flujo assets dedicado, verificado operativamente en AWS CLI:

- navegador -> `assets.test.sharemechat.com` o `assets.sharemechat.com`
- CloudFront assets
- S3 assets como origin por defecto

## Estado actual de AUDIT

Verificado en codigo y configuracion del repositorio:

Existe `application-audit.properties` con:

- `spring.application.name=sharemechat-audit`
- `spring.datasource.url=jdbc:mysql://db1-sharemechat-test-v2.c1gsc6qg4l8y.eu-central-1.rds.amazonaws.com:3306/db1_sharemechat_test`
- `auth.cookieDomain=.audit.sharemechat.com`
- `jwt.secret=${JWT_SECRET_AUDIT}`
- `app.frontend.reset-url=https://audit.sharemechat.com/reset-password`
- `consent.hmacSecret=${CONSENT_SECRET_AUDIT}`
- `kyc.veriff.callback-url=https://audit.sharemechat.com/api/kyc/veriff/webhook`

Interpretacion alineada con el estado actual:

- AUDIT existe hoy a nivel de profile/config parcial en el repositorio
- AUDIT no aparece desplegado ni aislado completamente en este repositorio
- el datasource AUDIT sigue apuntando a la base TEST
- por tanto AUDIT no puede describirse como entorno ya clonado y aislado a nivel de base de datos

No hay evidencia operativa AWS CLI aportada aqui de distribuciones, buckets, Route53 o despliegue activo de `audit.sharemechat.com`.

## Conclusion

La arquitectura actual combinada, segun codigo del repositorio y evidencia operativa AWS CLI, es la siguiente:

- producto y backoffice se publican como dos superficies de una unica app React
- CloudFront y S3 distribuyen frontend publico, frontend admin y assets dedicados
- el backend Spring Boot atiende `/api`, `/match`, `/messages` y `/uploads/*`
- MySQL sobre RDS es la persistencia principal
- Redis es runtime real para estado y control operativo
- la autenticacion real es JWT en cookies con refresh token persistido
- los uploads versionados en backend usan storage local/Nginx, no S3
- la capa AWS de CloudFront, S3, OAC, ACM y Route53 esta verificada operativamente en AWS CLI, pero no esta versionada como IaC en este repositorio
- AUDIT existe hoy como configuracion parcial y todavia apunta a la base TEST
