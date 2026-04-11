# README INTERNO - SHAREMECHAT PRE

## RESUMEN EJECUTIVO

SharemeChat, según el código actual del repositorio, es una plataforma de videochat 1:1 con dos superficies principales: producto y backoffice. En producto conviven dos experiencias realtime distintas: random matching tipo random/call con WebSocket en `/match` y comunicación directa entre usuarios relacionados por favoritos/chat/call con WebSocket en `/messages`. El sistema incluye registro/login, onboarding diferenciado para cliente y modelo, wallet interna, gifts, favoritos, bloqueo entre usuarios, KYC de modelo, aceptación de contrato de modelo, consent/age gate, trazabilidad de streams y un backoffice administrativo con módulos operativos y de administración interna.

Las superficies verificadas en código son: web pública de acceso/login/legales, dashboards de `USER` onboarding, dashboards de `CLIENT` y `MODEL`, perfil y documentos, backoffice en superficie frontend separada, APIs REST, dos handlers WebSocket, persistencia MySQL, estado efímero/operativo en Redis, storage local servido por Nginx y varias integraciones externas PARCIAL / NO TOTALMENTE CABLEADO.

PRE aparece como el entorno real actualmente configurado: dominios `test.sharemechat.com` y `admin.test.sharemechat.com`, `cookieDomain` `.test.sharemechat.com`, callback URLs de PRE, base de datos RDS de test y orígenes WS de test/localhost.

## MAPA GENERAL DEL SISTEMA

PRODUCTO y BACKOFFICE están separados a nivel de superficie frontend, pero comparten backend Spring Boot y comparten base de datos. Esto está verificado en `frontend/src/App.jsx` y `frontend/src/utils/runtimeSurface.js`.

La superficie PRODUCTO usa rutas públicas y privadas como `/`, `/login`, `/client`, `/model`, `/dashboard-user-client`, `/dashboard-user-model`, `/perfil-client`, `/perfil-model`, `/model-documents`, `/model-kyc`, `/change-password` y páginas legales/FAQ/safety/rules.

La superficie BACKOFFICE usa el mismo frontend React pero con `REACT_APP_SURFACE=admin` y origen `https://admin.test.sharemechat.com`. Cuando `isAdminSurface()` es true, `App.jsx` renderiza `AdminAccessPage`, `AdminEmailVerificationPage` y `DashboardAdmin` con `RequireRole(backofficeRoles=['ADMIN', 'SUPPORT', 'AUDIT'])`.

La organización de alto nivel verificada es:

- Frontend React con dos superficies
- Backend Spring Boot con controllers REST
- Handlers WebSocket separados para matching y messages
- Persistencia principal MySQL
- Persistencia operativa/estado Redis
- Storage local en disco servido como `/uploads/*`
- Autenticación por JWT en cookies con refresh token persistido

## STACK TECNOLOGICO REAL

### Frontend

- React 17
- `react-router-dom` 5
- `styled-components`
- `simple-peer` para WebRTC
- `socket.io-client` está en `package.json` pero NO VERIFICADO EN CODIGO como canal principal del producto actual
- MSW presente como `devDependency`

### Backend

- Spring Boot 3.5.5
- Java 17
- Spring Web
- Spring Security
- Spring WebSocket
- Spring Data JPA
- Spring Validation
- Spring Mail
- JJWT para JWT
- `org.json`
- Apache Commons Lang3

### WebSocket / WebRTC

- WebSocket server nativo de Spring en `/match` y `/messages`
- Allowed origins verificados: `https://test.sharemechat.com` y `http://localhost:3000`
- WebRTC en frontend mediante `simple-peer`
- Confirmación técnica de stream vía mensajes WS `tech-media-ready` / `call:tech-media-ready`
- Existe endpoint REST `ack-media`, pero el flujo principal verificado hoy confirma stream por WebSocket. El endpoint `ack-media` existe pero aparece PARCIAL / NO TOTALMENTE CABLEADO frente al flujo principal.

### Base de datos

- MySQL
- JPA con `ddl-auto=validate`
- Base configurada en PRE sobre RDS hostname `db1-sharemechat-test-v2...eu-central-1.rds.amazonaws.com`

### Redis

Sí aplica.

`spring.redis.host=localhost`

Redis se usa para status, sesiones activas, locks de stream, rate limit de next y sets de seen. Esto está verificado en `StatusService`, `StreamLockService`, `SeenService` y `NextRateLimitService`.

### Seguridad/autenticación

- JWT access token en cookie `httpOnly`
- refresh token persistido en tabla `refresh_tokens`
- `CookieJwtAuthenticationFilter` para auth HTTP
- Validación de JWT interna dentro de handlers WS para `/match` y `/messages`
- Autorización de backoffice mediante authorities `BO_ROLE_*` y `BO_PERMISSION_*` además del `ROLE_<productRole>`

### Infraestructura si puede inferirse de código/config

- Backend escucha en `0.0.0.0:8080`
- `forward-headers-strategy=native`
- Subdominios de PRE: `test.sharemechat.com` y `admin.test.sharemechat.com`
- Uploads locales en `/usr/share/nginx/html/uploads`
- Detección de IP por headers de proxy/CDN: `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `True-Client-IP`
- Detección de país por headers de edge/CDN: `CloudFront-Viewer-Country`, `CF-IPCountry`, `X-AppEngine-Country`, `X-Country-Code`
- AWS está referenciado en código/config por RDS y SMTP host `smtp.mail.eu-west-1.awsapps.com`
- S3 NO VERIFICADO EN CODIGO

### Integraciones externas presentes en código

- Microsoft Graph Email
- SMTP
- CCBill
- Veriff
- Legal assets externos en `assets.sharemechat.com/legal`
- Nginx/local uploads

No se verifica ninguna integración PSP/KYC final plenamente operativa de extremo a extremo; varias están PARCIAL / NO TOTALMENTE CABLEADO.

## ENTORNO PRE

PRE representa el entorno de test operativo configurado en código. Las señales verificadas son:

- `auth.cookieDomain=.test.sharemechat.com`
- `app.frontend.reset-url=https://test.sharemechat.com/reset-password`
- `kyc.veriff.callback-url=https://test.sharemechat.com/api/kyc/veriff/webhook`
- `runtimeSurface PRODUCT_APP_ORIGIN=https://test.sharemechat.com`
- `runtimeSurface ADMIN_APP_ORIGIN=https://admin.test.sharemechat.com`
- WebSocket origins incluyen `https://test.sharemechat.com`
- Base de datos apunta a `db1_sharemechat_test` en RDS
- `legal.baseUrl` apunta a `assets.sharemechat.com/legal`

Piezas claramente activas o preparadas para PRE:

- Producto web
- Backoffice web
- REST backend
- WS `/match` y `/messages`
- JWT/refresh
- MySQL
- Redis
- Storage local
- Email provider graph o smtp, según property
- Country access
- Consent events
- Wallet/ledger interno
- Moderation reports
- Backoffice administration tables
- Accounting audit interno

Piezas verificadas como PARCIAL / NO TOTALMENTE CABLEADO:

- CCBill `session/notify` como capa de billing transicional
- Veriff `enabled=false` por configuración
- Flujo manual/Veriff coexistente de KYC con parte de configuración administrativa
- `ack-media` REST respecto al flujo principal de confirmación por WS
- Algunas migraciones manuales de backoffice y `stream_records.billable_start` existen en `db/manual`, lo que indica evolución incremental del esquema

## PRODUCTO - LOGICA DE NEGOCIO REAL

### Roles reales de producto

Roles verificados en `Constants.Roles`:

- `USER`
- `CLIENT`
- `MODEL`
- `ADMIN`

Además `SUPPORT` aparece tratado por `ProductAccessGuardService` como rol restringido a backoffice. `SUPPORT` como rol de producto existe en control de acceso, aunque no esté en `Constants.Roles`.

### Significado real de roles

- `USER`: cuenta base registrada pero no escalada todavía a `CLIENT` o `MODEL` operativo
- `CLIENT`: usuario con wallet cliente activa y acceso al dashboard cliente
- `MODEL`: modelo aprobado con acceso a dashboard modelo
- `ADMIN`: rol de producto con acceso implícito de backoffice
- `SUPPORT`: aparece como rol restringido al backoffice si existe en `users.role`

### Flujo real de registro/login cliente

Registro cliente: `POST /api/users/register/client`

- Requiere guest age gate previo por `consent_id`
- `UserService.registerClient` crea `users.role=USER` y `userType=FORM_CLIENT`
- Persiste `confirAdult=true`, `acceptTerm` y `termVersion`

Login: `POST /api/auth/login`

- `AuthController` valida rate limit, country access, autenticación y emite cookies `access/refresh`

### Flujo real de registro/login modelo

Registro modelo: `POST /api/users/register/model`

- Requiere guest age gate previo
- `UserService.registerModel` crea `users.role=USER`, `userType=FORM_MODEL` y `verificationStatus=PENDING`
- Exige mayoría de edad por fecha de nacimiento y aceptación de términos

Login reutiliza `AuthController`.

### Cómo se escala de USER a CLIENT

`POST /api/transactions/first`

`TransactionService.processFirstTransaction` exige `USER + FORM_CLIENT`.

Hace:

- crea `transaction`
- crea `balance`
- sincroniza fila `clients`
- promueve `users.role` a `CLIENT`
- exige email verificado antes de activar premium

### Cómo se escala de USER a MODEL

El onboarding se mantiene en `USER + FORM_MODEL`.

KYC/contrato/documentos/model onboarding operan en ese estado.

Cuando admin aprueba, `AdminService.reviewModel` actualiza `verificationStatus` y promueve `users.role` a `MODEL`, además de asegurar fila `models`.

### Qué pantallas/rutas principales existen

Públicas:

- `Home`
- `Blog`
- `ForgotPassword`
- `ResetPassword`
- `ProductEmailVerificationPage`
- `Legal`
- `Faq`
- `Safety`
- `Rules`
- `Config` cookies

Privadas producto:

- `DashboardUserClient`
- `DashboardUserModel`
- `DashboardClient`
- `DashboardModel`
- `PerfilClient`
- `PerfilModel`
- `ModelDocuments`
- `ModelKycVeriffPage`
- `ChangePasswordPage`

### Qué enforcement real hay en consentimiento/age gate

Consent anónimo:

- eventos `age_gate_accept` y `terms_accept` en `consent_events`
- registro/login exigen guest age gate, no guest terms como gate anónimo
- registro sí valida `acceptedTerm` en DTO y persiste `acceptTerm/termVersion` en `users`

Consent autenticado:

- `ConsentController /api/consent/accept` actualiza `users.confirAdult`, `acceptTerm` y `termVersion`
- `ConsentEnforcementService` bloquea algunos endpoints REST sensibles como `messages/favorites/ack-media`
- En `/api/users/me` se resuelve compliance y se informa en DTO, pero no se bloquea
- En WebSocket `/match` y `/messages` hoy se registra observación de non-compliance pero no se bloquea la conexión. Esto es un hecho verificado en handlers.

### Qué diferencias hay entre lo que parece y lo que realmente hace el sistema

La UI y el naming sugieren varios flujos completamente cerrados, pero el código muestra que algunas piezas están en transición:

- billing PSP
- KYC provider
- algunos paths legacy de media ack
- consent con enforcement heterogéneo REST/WS

Aun así, el producto base sí tiene cableado real en matching, messaging, wallet, gifts, documents, moderation y backoffice.

## REALTIME Y STREAMING

### Random/match frente a favoritos/chat/call directo

Random/match usa WebSocket `/match` y `MatchingHandler/MatchingHandlerSupport`.

Chat directo, mensajería, ringing y call directo usan WebSocket `/messages` y `MessagesWsHandler/MessagesWsHandlerSupport`.

### Qué endpoint WS usa cada uno

- `/match` para random matching y chat embebido durante random
- `/messages` para inbox/chat directo, `msg:new`, `msg:read`, `msg:gift`, `call-user`, `call:accept`, `call:reject`, `call:tech-media-ready` y señalización asociada

### Cómo se establece la señalización

Los handlers WS autentican internamente por JWT extraído de cookie/query/header.

Matching:

- `set-role` mapea rol desde DB a `client/model`
- `start-match` mete al usuario en colas por bucket idioma/país y empareja
- chat durante random usa tipo `chat` y persiste `MessageDTO` por `MessageService.send`

Messages:

- envío directo de mensajes verifica `favoriteService.canUsersMessage`
- llamadas directas verifican relación válida, disponibilidad y `client-model pair`

### Cómo se confirma el stream

Random:

`MatchingHandlerSupport.handleTechMediaReady` acaba llamando a `streamService.confirmActiveSession(clientId, modelId)`

Call directo:

`MessagesWsHandlerSupport.handleCallTechMediaReady` llama a `streamService.confirmActiveSession(clientId, modelId)`

Existe también `StreamController ack-media` con `streamService.ackMedia`, pero el flujo principal visible en código actual confirma por WS. Eso está PARCIAL / NO TOTALMENTE CABLEADO respecto a la arquitectura principal.

### Cómo se cierra

Random y calling usan `streamService.endSession` o `endSessionAsync`.

Hay cortes por:

- disconnect
- low-balance
- timeout
- admin kill

Handlers limpian pares/ringing/sesiones y Redis.

`StreamService` registra `ENDED` y eventos especiales como `CUT_LOW_BALANCE`, `DISCONNECT` o `TIMEOUT` cuando aplica.

### Qué se persiste y qué no

Se persiste:

- `stream_records`
- `stream_status_events`
- `messages`
- `balances/transactions` asociadas a streams
- gifts ligados a `stream/call context` cuando corresponde
- `user_trial_streams` para trial

Estado efímero no persistente principal:

- colas y status en Redis
- sesiones WS en memoria de handlers
- marcadores `tech-media-ready` por sesión
- seen TTL en Redis

### Cómo funciona el chat real

- REST `/api/messages/**` para `history/send/read`
- WS `/messages` para push realtime y notificaciones
- Durante random también puede persistirse chat en `MatchingHandlerSupport` usando `MessageService.send`
- Relación de mensajería/call depende de `FavoriteService.canUsersMessage`

### Cómo funcionan gifts dentro del realtime

WS `/messages` tipo `msg:gift`

`MessagesWsHandlerSupport` valida contexto de call si existe.

`TransactionService.processGiftInChat / processGift` hace el ledger.

Registra:

- cargo al cliente
- ingreso al modelo
- margen plataforma

Si existe `stream/call context` se asocia al `streamRecord` resuelto.

## ECONOMIA Y TRAZABILIDAD

### Cómo funciona realmente wallet / balances / transactions

`TransactionService` es la pieza central.

Mantiene:

- ledger inmutable en `transactions` y `balances`
- caches mutables en `clients.saldo_actual` y `models.saldo_actual`
- para plataforma usa `platform_transactions` y `platform_balances`

Hay locking por usuario y locking ordenado para gifts.

Primer pago promueve `USER` a `CLIENT`.
`addBalance` recarga wallet del cliente.
`requestPayout` genera `payout_requests` y revisión administrativa posterior.

### Qué pasa con gifts

`GiftController` y WS `msg:gift` terminan en `GiftService/TransactionService`.

Se carga `Gift` por catálogo.
Se calcula reparto `model-share` y margen plataforma.

Se persiste:

- `transaction` del cliente
- `balance` del cliente
- `transaction` del modelo
- `balance` del modelo
- `platform_transaction` y `platform_balance` si hay margen

La trazabilidad del gift puede ligarse a `streamRecord` si existe `calling context` resuelto.

### Qué se guarda en DB

Economía:

- `transactions`
- `balances`
- `clients`
- `models`
- `platform_transactions`
- `platform_balances`
- `payout_requests`
- `payment_sessions`
- `gifts`

Streaming/traza:

- `stream_records`
- `stream_status_events`
- `user_trial_streams`

Mensajería y relaciones:

- `messages`
- `favorite_clients`
- `favorite_models`
- `user_blocks`
- `user_languages`

Cuenta y seguridad:

- `users`
- `refresh_tokens`
- `password_reset_tokens`
- `email_verification_tokens`
- `unsubscribes`
- `consent_events`

Modelo/KYC:

- `model_documents`
- `model_contract_acceptances`
- `model_kyc_sessions`
- `kyc_webhook_events`
- `kyc_provider_configs`
- `model_review_checklists`
- `model_earning_tiers`
- `model_tier_daily_snapshots`

Moderación y home:

- `moderation_reports`
- `home_featured_models`

Backoffice:

- `backoffice_roles`
- `permissions`
- `role_permissions`
- `user_backoffice_roles`
- `user_permission_overrides`
- `backoffice_access_audit_log`

Accounting audit:

- `audit_runs`
- `accounting_anomalies`

### Capacidad real de reconstrucción

Es razonablemente alta para streams y wallet:

- `stream_records` guarda `start_time`, `confirmed_at`, `billable_start`, `end_time` y `stream_type`
- `stream_status_events` añade eventos `CREATED`, `CONFIRMED`, `BILLING_STARTED`, `ENDED` y especiales
- `transactions/balances` permiten reconstruir wallet por usuario
- `platform_transactions/platform_balances` permiten reconstruir margen plataforma
- `payment_sessions` permite reconstruir sesiones de pago transicionales
- `moderation_reports`, `consent_events` y `backoffice_access_audit_log` añaden trazas complementarias

### Qué partes están completas y cuáles parciales

Completas/operativas en código:

- ledger interno
- streams y eventos
- gifts
- refund manual
- payout requests
- accounting audit interno

PARCIAL / NO TOTALMENTE CABLEADO:

- PSP real
- `PaymentSession` hacia CCBill real
- KYC provider real habilitado
- algunas rutas legacy de media ack

## BACKOFFICE

### Qué es realmente el backoffice en este repo

Es una superficie frontend separada y una capa de permisos interna sobre el mismo backend y base de datos del producto. `DashboardAdmin` compone paneles operativos y de administración. `AdminAuthController` hace login específico de backoffice y exige acceso efectivo de backoffice más email verificado.

### Qué módulos reales existen

- Overview
- Operaciones
- Modelos
- Moderación
- Finanzas
- Ajustes financieros
- Control interno
- Datos internos
- Administración
- Perfil backoffice

Esto está verificado en `DashboardAdmin.jsx` y sus paneles importados:

- `AdminOverviewPanel`
- `AdminStatsPanel`
- `AdminActiveStreamsPanel`
- `AdminModelsPanel`
- `AdminModerationPanel`
- `AdminFinancePanel`
- `AdminAuditPanel`
- `AdminDataPanel`
- `AdminAdministrationPanel`
- `AdminProfilePage`

### Qué roles backoffice existen

- `ADMIN`
- `SUPPORT`
- `AUDIT`

### Cómo se resuelven permisos efectivos

`BackofficeAccessService.loadProfile(userId, productRole)` construye:

- roles efectivos
- permisos efectivos
- aplica overrides

Si `productRole=ADMIN`, añade acceso implícito `ADMIN`.

Luego:

- carga roles explícitos de `user_backoffice_roles`
- carga permisos desde `role_permissions`
- aplica `user_permission_overrides` sumando o quitando permisos

`UserDetailsServiceImpl` convierte eso en authorities `BO_ROLE_*` y `BO_PERMISSION_*`.

### Qué significa inherit / grant / remove si aparece

El naming exacto `inherit/grant/remove` NO VERIFICADO EN CODIGO como términos literales de UI o API.

Lo verificado en código es:

- roles de backoffice asignados por tablas
- `override additions`: permisos permitidos adicionales
- `override removals`: permisos retirados

`BackofficeAccessService` los maneja como `overrideAdditions` y `overrideRemovals`, persistidos en `user_permission_overrides` con `allowed=true/false`.

### Qué módulos son solo ADMIN

Según `DashboardAdmin` y `capabilities`:

- `review` de modelos
- `change KYC mode`
- `view sensitive docs`
- `refunds` manuales
- `kill streams`
- `view DB`
- `view audit`
- `administration` de backoffice

### Qué partes están ya operativas y cuáles parciales

Operativas:

- login de backoffice
- overview
- streams activos
- stats overview
- model review
- moderation review
- finance summary/tops/refunds
- data queries internas
- administración de usuarios/roles/permisos de backoffice
- audit log de backoffice

PARCIAL / NO TOTALMENTE CABLEADO:

- texto de “base preparada para futura gestión” aparece en copy de administración, pero el módulo ya tiene endpoints y tablas; la parte exacta de cobertura funcional completa depende del alcance de paneles y permisos actuales
- NO VERIFICADO EN CODIGO un módulo separado de soporte fuera de `DashboardAdmin`

## SEGURIDAD Y CONTROL DE ACCESO

### Cómo funciona auth real

Producto:

`AuthController login` emite `access_token` y `refresh_token` en cookies `httpOnly`, `sameSite=None`, `secure` según config.

Refresh token persiste en DB y rota en `/api/auth/refresh`.

Logout revoca refresh y borra cookies.

`/api/users/me` bootstrap de sesión y devuelve `UserDTO` completo del usuario autenticado.

Backoffice:

`AdminAuthController login` exige que `BackofficeAccessService.loadProfile` tenga `ADMIN/SUPPORT/AUDIT` efectivos y que el email esté verificado.

Emite las mismas cookies `access/refresh`.

### JWT / refresh

- JWT access usa `jwt.secret` y expiración 15 minutos
- refresh expiración 14 días
- refresh token persistido con hash SHA-256, ip y `userAgent`
- refresh rota token y revoca el anterior

### /api/users/me

Sigue siendo endpoint de self completo.

Devuelve `UserDTO` con campos ricos de cuenta, consent y backoffice del propio usuario.

No bloquea por consent; solo lo informa.

### Roles y permisos

- roles de producto en `users.role`
- permisos backoffice por authorities derivadas
- `SecurityConfig` mezcla reglas por role y por permission authority
- `ProductAccessGuardService` bloquea `SUPPORT` en superficies de producto si el rol `SUPPORT` aparece como product role

### Seguridad en WebSocket

`SecurityConfig` permite `/match/**` y `/messages/**` a nivel HTTP.

La autenticación real la hacen `MatchingHandlerSupport.resolveUserId` y `MessagesWsHandlerSupport.resolveUserId` validando JWT dentro del handler.

Esto implica diferencia entre seguridad HTTP y enforcement real en handlers.

### Diferencias entre seguridad HTTP y enforcement real

HTTP:

- muchas rutas se cierran por role/authority en `SecurityConfig`

WS:

- `permitAll` a nivel HTTP pero auth/negocio dentro del handler

REST:

- consent se bloquea en algunos controllers por `ConsentEnforcementService`

WS:

- consent hoy se observa pero no se bloquea en `afterConnectionEstablished`

## MODELO DE DATOS UTIL

### Producto

- `users`: cuenta principal, rol, `userType`, status, risk, consent canónico
- `clients`: wallet/cache de cliente
- `models`: wallet/cache de modelo y métricas básicas
- `client_documents`: foto de cliente
- `model_documents`: documentos KYC y media de modelo
- `messages`: chat persistido
- `favorite_clients` y `favorite_models`: relación de favoritos
- `user_blocks`: bloqueos entre usuarios
- `user_languages`: preferencias/idiomas de usuario
- `home_featured_models`: destacados para home pública
- `unsubscribes`: baja voluntaria y trazas asociadas

### Economía

- `transactions`: asientos económicos por usuario
- `balances`: snapshot secuencial de balance por usuario
- `platform_transactions`: asientos económicos de plataforma
- `platform_balances`: snapshot secuencial de balance de plataforma
- `gifts`: catálogo de regalos
- `payout_requests`: retiros de modelos
- `payment_sessions`: sesiones de pago PSP transicionales

### Streaming / realtime

- `stream_records`: sesión random/calling con tiempos clave
- `stream_status_events`: eventos de ciclo de vida del stream
- `user_trial_streams`: consumo y trazas de trial no premium

### Moderación

- `moderation_reports`: reports de usuarios con workflow operativo

### Consent

- `consent_events`: evidencia de age gate / terms y enlaces guest-user

### Seguridad de cuenta

- `refresh_tokens`: refresh cookies persistidas
- `password_reset_tokens`: reset password
- `email_verification_tokens`: verificación de email

### KYC

- `model_kyc_sessions`: sesiones KYC del modelo
- `kyc_webhook_events`: eventos webhook del proveedor
- `kyc_provider_configs`: configuración del modo/proveedor KYC
- `model_contract_acceptances`: aceptación de contrato de modelo
- `model_review_checklists`: checklist operativo de revisión
- `model_earning_tiers` y `model_tier_daily_snapshots`: tiers y snapshots de rendimiento

### Backoffice

- `backoffice_roles`: catálogo de roles de backoffice
- `permissions`: catálogo de permisos
- `role_permissions`: relación rol-permiso
- `user_backoffice_roles`: asignación de roles a usuarios
- `user_permission_overrides`: overrides `allowed/denied` por usuario
- `backoffice_access_audit_log`: auditoría de cambios de acceso backoffice

### Accounting audit

- `audit_runs`: ejecuciones de auditoría contable interna
- `accounting_anomalies`: anomalías detectadas por auditoría interna

## INTEGRACIONES EXTERNAS

### Email

Operativa en código.

Interface `EmailService` con dos implementaciones condicionales:

- `GraphEmailService` si `email.provider=graph`
- `SmtpEmailService` si `email.provider=smtp`

Por defecto PRE usa `EMAIL_PROVIDER:graph`.

SMTP también está configurado con `smtp.mail.eu-west-1.awsapps.com`.

Conclusión: email operativo, con dos proveedores alternativos.

### PSP

CCBill está presente en `BillingController` y `CcbillService`.

`createSessionForPack` crea `PaymentSession` y devuelve `paymentUrl` sandbox + campos provisionales.

`notify` procesa `APPROVED` y completa `PaymentSession`.

Estado: PARCIAL / NO TOTALMENTE CABLEADO.

### KYC

Veriff está presente en `KycProviderController`, `ModelKycSessionService`, `VeriffClientImpl` y `VeriffProperties`.

`kyc.veriff.enabled=false` en PRE.

`VeriffClientImpl` genera también sesión mock si procede.

Existe configuración de modo KYC y modo `MANUAL / VERIFF`.

Estado: PARCIAL / NO TOTALMENTE CABLEADO.

### Legal docs

`legal.baseUrl` y `legal.modelContractPath` apuntan a `assets.sharemechat.com/legal`.

`ModelContractManifestService` y `ModelContractService` usan contrato de modelo.

Estado: operativo en código para contrato y aceptación.

### Uploads

`StorageService` con `LocalStorageService`.

Archivos servidos como `/uploads/*`.

Estado: operativo local, no S3.

## ESTADO ACTUAL DEL PROYECTO EN PRE

### Piezas que parecen sólidas y operativas

- registro/login base con JWT y refresh
- dashboards separados por rol
- matching random por WS
- mensajería y call directo por WS
- persistencia de streams y eventos
- wallet interna y ledger
- gifts con reparto económico
- moderation reports
- backoffice con permisos efectivos y administración interna
- email verification y password reset
- storage local con validación de magic bytes
- country access y rate limits básicos

### Piezas que parecen parciales

- PSP / CCBill
- Veriff / KYC provider habilitado
- `ack-media` REST frente al flujo principal WS
- algunos naming y caminos legacy en status/model availability/permissions canónicas
- surface dual de admin/producto depende de variable de build/env

### Piezas que parecen sensibles desde negocio/compliance

- consent/age gate
- KYC de modelos
- wallet, refund y payout
- moderación
- trazabilidad de streams y balances
- country access
- backoffice permissions

Todo esto existe en código con distintos grados de madurez.

### Limitaciones importantes observadas desde código

- varias integraciones externas están PARCIAL / NO TOTALMENTE CABLEADO
- hay coexistencia de flujos nuevos y legacy en algunas zonas
- parte del enforcement crítico no es homogéneo entre REST y WS
- hay subsistemas avanzados de auditoría contable y backoffice que conviven con piezas transicionales de PSP/KYC

## INVENTARIO DE FICHEROS CLAVE

### Frontend producto

- `frontend/src/App.jsx`: routing principal de producto y admin surface
- `frontend/src/components/SessionProvider.jsx`: bootstrap de sesión y `/users/me`
- `frontend/src/components/RequireRole.jsx`: guard de acceso por `role/backofficeRole/userType`
- `frontend/src/pages/dashboard/DashboardUserClient.jsx`: dashboard `USER FORM_CLIENT`
- `frontend/src/pages/dashboard/DashboardUserModel.jsx`: dashboard `USER FORM_MODEL`
- `frontend/src/pages/dashboard/DashboardClient.jsx`: dashboard `CLIENT` con random, call, wallet y gifts
- `frontend/src/pages/dashboard/DashboardModel.jsx`: dashboard `MODEL` con random, call y estado operativo
- `frontend/src/pages/subpages/PerfilClient.jsx`: perfil propio cliente
- `frontend/src/pages/subpages/PerfilModel.jsx`: perfil propio modelo
- `frontend/src/pages/subpages/ModelDocuments.jsx`: documentos onboarding modelo
- `frontend/src/pages/subpages/ModelKycVeriffPage.jsx`: UI de KYC modelo
- `frontend/src/realtime/matchSocketEngine.js`: cliente realtime random/match
- `frontend/src/realtime/msgSocketEngine.js`: cliente realtime messages/call
- `frontend/src/consent/GuestConsentGate.jsx`: gate de consent en superficie pública
- `frontend/src/consent/AgeGateModal.jsx`: modal age gate
- `frontend/src/consent/AuthenticatedConsentModal.jsx`: consent autenticado
- `frontend/src/config/http.js`: wrapper fetch con cookies y refresh
- `frontend/src/utils/runtimeSurface.js`: separación product/admin surface y URLs de PRE

### Frontend backoffice

- `frontend/src/pages/admin/DashboardAdmin.jsx`: shell principal de backoffice
- `frontend/src/pages/admin/AdminAccessPage.jsx`: login backoffice
- `frontend/src/pages/admin/AdminOverviewPanel.jsx`: overview backoffice
- `frontend/src/pages/admin/AdminStatsPanel.jsx`: stats operativas
- `frontend/src/pages/admin/AdminActiveStreamsPanel.jsx`: streams activos
- `frontend/src/pages/admin/AdminModelsPanel.jsx`: revisión de modelos/KYC/checklist
- `frontend/src/pages/admin/AdminModerationPanel.jsx`: reports de moderación
- `frontend/src/pages/admin/AdminFinancePanel.jsx`: finanzas y refunds
- `frontend/src/pages/admin/AdminAuditPanel.jsx`: control interno/auditoría
- `frontend/src/pages/admin/AdminDataPanel.jsx`: consultas internas de datos
- `frontend/src/pages/admin/AdminAdministrationPanel.jsx`: administración de usuarios/permisos backoffice
- `frontend/src/utils/backofficeAccess.js`: helpers de roles/permisos backoffice

### Backend producto

- `src/main/java/com/sharemechat/security/SecurityConfig.java`: reglas HTTP por ruta/rol/permiso
- `src/main/java/com/sharemechat/security/CookieJwtAuthenticationFilter.java`: auth HTTP por cookie JWT
- `src/main/java/com/sharemechat/controller/AuthController.java`: login/refresh/logout producto
- `src/main/java/com/sharemechat/controller/UserController.java`: registro, `/users/me`, perfil, avatars, unsubscribe
- `src/main/java/com/sharemechat/controller/MessagesController.java`: REST de mensajes
- `src/main/java/com/sharemechat/controller/TransactionController.java`: primer pago, add balance, payout
- `src/main/java/com/sharemechat/controller/GiftController.java`: catálogo/regalos
- `src/main/java/com/sharemechat/controller/FavoritesController.java`: favoritos
- `src/main/java/com/sharemechat/controller/UserBlockController.java`: bloqueos
- `src/main/java/com/sharemechat/controller/StreamController.java`: ack media stream
- `src/main/java/com/sharemechat/controller/ConsentController.java`: age gate / terms / accept
- `src/main/java/com/sharemechat/controller/ModelController.java`: `/models/me`, documents, stats de modelo
- `src/main/java/com/sharemechat/controller/ClientController.java`: `/clients/me` y foto cliente
- `src/main/java/com/sharemechat/controller/ModelContractController.java`: contrato de modelo
- `src/main/java/com/sharemechat/controller/ModelKycController.java`: onboarding KYC modelo
- `src/main/java/com/sharemechat/controller/KycProviderController.java`: start/webhook Veriff
- `src/main/java/com/sharemechat/controller/KycConfigController.java`: lectura de modo KYC
- `src/main/java/com/sharemechat/handler/MatchingHandlerSupport.java`: runtime random/match
- `src/main/java/com/sharemechat/handler/MessagesWsHandlerSupport.java`: runtime messages/calls
- `src/main/java/com/sharemechat/service/UserService.java`: lógica de users, roles, DTOs
- `src/main/java/com/sharemechat/service/StreamService.java`: streams, confirmación, cierre, trazabilidad
- `src/main/java/com/sharemechat/service/TransactionService.java`: ledger/wallet/gifts/payouts/refunds
- `src/main/java/com/sharemechat/service/MessageService.java`: persistencia de mensajes
- `src/main/java/com/sharemechat/service/FavoriteService.java`: relación de mensajería/favoritos
- `src/main/java/com/sharemechat/service/ConsentService.java`: eventos y aceptación de consent
- `src/main/java/com/sharemechat/service/ConsentEnforcementService.java`: bloqueo REST de consent
- `src/main/java/com/sharemechat/service/CountryAccessService.java`: bloqueo por país
- `src/main/java/com/sharemechat/service/StatusService.java`: status Redis y sesiones activas
- `src/main/java/com/sharemechat/service/StreamLockService.java`: locks Redis para streams
- `src/main/java/com/sharemechat/service/SeenService.java`: TTL de vistos en random

### Backend backoffice

- `src/main/java/com/sharemechat/controller/AdminAuthController.java`: login backoffice
- `src/main/java/com/sharemechat/controller/AdminController.java`: APIs admin/backoffice
- `src/main/java/com/sharemechat/service/BackofficeAccessService.java`: roles, permisos, overrides y audit log backoffice
- `src/main/java/com/sharemechat/service/AdminService.java`: operaciones admin sobre modelos, finanzas, datos internos
- `src/main/java/com/sharemechat/security/BackofficeAuthorities.java`: catálogo de roles y permisos backoffice
- `src/main/java/com/sharemechat/accountingaudit/controller/AccountingAuditAdminController.java`: auditoría contable interna
- `src/main/java/com/sharemechat/accountingaudit/job/AccountingAuditJobImpl.java`: job de auditoría contable
- `src/main/java/com/sharemechat/accountingaudit/repository/BalanceLedgerAuditRepository.java`: consultas de consistencia ledger/stream

## GLOSARIO OPERATIVO INTERNO

### USER

Cuenta base autenticable que aún no ha escalado a `CLIENT` o `MODEL` operativo.

### CLIENT

Usuario premium/cliente con wallet activa, balance y acceso a random/calls/gifts desde dashboard cliente.

### MODEL

Modelo aprobado administrativamente, con dashboard de modelo y saldo/ingresos propios.

### RANDOM

Modo de emparejamiento aleatorio gestionado por WebSocket `/match`.

### CALLING

Tipo de stream directo entre `CLIENT` y `MODEL` iniciado desde mensajería/favoritos; se persiste como `stream_type=CALLING`.

### FAVORITOS

Relación entre usuarios que habilita mensajería y llamadas directas según `FavoriteService.canUsersMessage`.

### STREAM RECORD

Fila en `stream_records` que representa una sesión random o calling con tiempos `start/confirmed/billable/end`.

### CONSENT

Estado de aceptación de mayoría de edad y términos, con canónico en `users` y evidencia en `consent_events`.

### KYC

Flujo de onboarding del modelo, con modo configurable `MANUAL` o `VERIFF` y sesiones/model docs asociados.

### BACKOFFICE ROLE

Rol efectivo de backoffice `ADMIN`, `SUPPORT` o `AUDIT`, independiente del rol de producto y resuelto por `BackofficeAccessService`.

### OVERRIDE

Permiso individual añadido o retirado a un usuario de backoffice en `user_permission_overrides`.

### PAYMENT SESSION

Sesión de pago transicional PSP en `payment_sessions`, hoy asociada al adapter CCBill.

### PAYOUT REQUEST

Solicitud de retiro de modelo, revisable administrativamente.

### USER TRIAL STREAM

Registro de trial para usuarios onboarding no premium, separado del stream de pago normal.

## CIERRE

El estado real de PRE, según el código actual del repositorio, es el de un sistema funcional amplio y ya segmentado entre producto y backoffice, con backend y base de datos compartidos, realtime operativo en dos canales WS, ledger interno y trazabilidad de stream/economía razonablemente desarrollados. Al mismo tiempo, PRE muestra varias piezas externas y transicionales todavía PARCIAL / NO TOTALMENTE CABLEADO, especialmente en PSP y KYC provider. La fotografía operativa actual es la de una base de producto/backoffice real y activa en entorno test, con dominios y configuración explícitos de PRE, sobre la que conviven componentes maduros y adaptadores aún en transición.
