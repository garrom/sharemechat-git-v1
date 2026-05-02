# Arquitectura backend

El backend es una aplicacion Spring Boot sobre Java 17 que concentra:

- autenticacion y sesion
- APIs REST de producto
- APIs de backoffice
- senalizacion realtime
- logica economica
- trazabilidad operativa

## Areas funcionales principales

- autenticacion con JWT y refresh token persistido
- usuarios, perfiles y onboarding
- wallet, gifts, payout y refund
- mensajes, favoritos y bloqueos
- streams y su trazabilidad
- moderacion
- backoffice y permisos
- auditoria contable interna

## Persistencia y estado

- MySQL como persistencia principal
- Redis para rate limiting, estado online, locks, seen state y deteccion de abuso de autenticacion

## Streams, confirmacion media y facturacion

La facturacion de streams se apoya en una separacion explicita entre tiempo tecnico y tiempo facturable:

- `start_time`: instante tecnico de creacion del `stream_record` en el match o llamada. No es referencia de facturacion final.
- `confirmed_at`: instante en que el backend confirma la sesion tras doble ACK media valido.
- `billable_start`: inicio facturable del stream. Se escribe atomically junto a `confirmed_at` y coincide con el por construccion.
- `end_time`: instante de cierre de la sesion.

Flujo resumido:

`start_time` -> senalizacion WebRTC -> doble ACK media cliente/modelo -> `confirmed_at`/`billable_start` -> facturacion desde `billable_start` -> `end_time`.

Garantias actuales:

- frontend solo emite `ack-media` tras media local y remota en `live`, conexion WebRTC usable y margen de estabilidad
- backend exige ACK valido de cliente y modelo del mismo `streamRecordId`
- backend no confirma streams cerrados
- sin `confirmed_at` no hay cobro
- `endSession` calcula los segundos facturables desde `billable_start`, con fallback defensivo a `confirmed_at`
- `endIfBelowThreshold` calcula el consumo acumulado desde `confirmed_at`, coherente con `billable_start`

Estado: Fase 1 (doble ACK media) y Fase 2 (alineacion de inicio facturable) implementadas y validadas en TEST con datos reales. La validacion confirmo que `seconds_from_billable` puede diferir de `seconds_from_start` y que `STREAM_CHARGE`, `STREAM_EARNING`, `STREAM_MARGIN` y gifts quedan coherentes con el inicio facturable real.

## Auth-risk: deteccion y respuesta progresiva sobre login

El backend incluye una capa de deteccion de abuso de autenticacion separada del rate limit clasico de `ApiRateLimitService`. La capa esta implementada y validada con trafico real en TEST y AUDIT sobre login de producto. Su objetivo no es regular el caudal de peticiones sino observar patrones de fallo, calcular un nivel de riesgo y aplicar una respuesta proporcional sin alterar el contrato HTTP.

Componentes implicados:

- `service/AuthRiskService` concentra el flujo de eventos, scoring y respuesta progresiva
- `service/AuthRiskContext` es el record interno con `ip`, `uaHash`, `emailHash` (HMAC-SHA256 truncado), `userId`, `channel` y `env`
- `constants/AuthRiskConstants` agrupa eventos, niveles, canales, reasons y prefijos de claves Redis

Eventos registrados hoy:

- `LOGIN_ATTEMPT`, `LOGIN_SUCCESS` y `LOGIN_FAILURE` en login de producto
- el resto de superficies de autenticacion (login admin, refresh, forgot/reset password) quedan fuera de esta iteracion

Estado en Redis bajo namespace `ar:{env}:`:

- contadores cortos de fallos por `emailHash` y por IP, con TTL corto
- sets de IPs distintas por `emailHash` y de `emailHash` distintos por IP, con TTL largo
- clave de bloqueo temporal por `emailHash` cuando el nivel alcanza CRITICAL, con TTL configurable

### Flujo del login con Auth-risk integrado

1. `LOGIN_ATTEMPT` se registra inmediatamente despues del rate limit clasico y del control de pais. Actualiza los sets `ips:email` y `emails:ip` (no incrementa fallos).
2. Si `isEmailBlocked(emailHash)` devuelve true (existe la clave de bloqueo en Redis), el flujo entra en **short-circuit**: se emite log `LOGIN_FAILURE` con `reason=temporal_block_active` y se lanza `InvalidCredentialsException` sin contactar con `UserService`. **El short-circuit no contamina contadores ni sets ni aplica delay**, lo que evita extender el bloqueo y degradar UX innecesariamente sobre el `emailHash` ya bloqueado.
3. Si no hay bloqueo activo, se invoca `userService.authenticateAndLoadUser`:
   - en exito → `LOGIN_SUCCESS`, scoring sin incrementar contadores, login completa
   - en fallo → `LOGIN_FAILURE` con incremento de contadores y actualizacion de sets, scoring sobre el estado resultante
4. Tras el scoring del `LOGIN_FAILURE`, la respuesta progresiva se aplica si la propiedad `authrisk.response.enabled` esta activa:
   - `HIGH` → retardo aleatorio dentro del rango configurado antes de propagar el 401
   - `CRITICAL` → creacion del bloqueo temporal con `SET NX EX`; si la creacion fue efectiva, se aplica tambien el retardo; si la clave ya existia, no se refresca TTL ni se aplica retardo adicional
5. La excepcion se propaga al `GlobalExceptionHandler` exactamente igual que en cualquier credencial invalida: el contrato HTTP devuelto al frontend es indistinguible.

### Garantias estructurales

- **Bloqueo solo por `emailHash`**: nunca por IP. Bloquear por IP introduciria impacto desproporcionado sobre redes con NAT corporativo o salida movil agregada y duplicaria lo que ya hace `ApiRateLimitFilter`.
- **Contrato HTTP uniforme**: credencial incorrecta y `emailHash` bloqueado producen el mismo status, mismo body, sin `Set-Cookie` y sin headers diferenciadores. La unica senal externa observable es la latencia, deliberadamente aleatoria en el rango configurado.
- **Fail-open absoluto**: si Redis no responde, si la salt no esta definida, o si cualquier excepcion ocurre dentro del scoring, el login funciona como antes. La capa nunca puede convertirse en single point of failure de la autenticacion.
- **Privacidad operativa**: los logs `[AUTH-RISK]` nunca contienen email plano, password, JWT, refresh token raw ni hash de refresh token; solo `emailHash` y `uaHash` truncados, IP, nivel y razones.
- **Activacion separable**: la observacion (`authrisk.enabled`) y la respuesta progresiva (`authrisk.response.enabled`) se controlan con propiedades independientes, resolubles por variable de entorno por servidor. El namespace Redis se aisla por entorno con `authrisk.env` (validado actualmente en `ar:test:*` y `ar:audit:*`).

## Product Operational Mode (implementado, alcance parcial)

El backend dispone de una capa transversal de admisión al producto, gobernada por un enum (`OPEN/PRELAUNCH/MAINTENANCE/CLOSED`), dos flags independientes de registro (cliente y modelo) y una flag de simulación económica directa. Decisión completa en [ADR-009](../06-decisions/adr-009-product-operational-mode.md).

Componentes en código:

- `service/ProductOperationalModeService`: regla de decisión centralizada. Pura, sin I/O. Consume `ProductOperationalProperties`. Expone `decideForRequest(...)` y `decideForWsHandshake(...)`.
- `security/ProductOperationalModeFilter`: filtro REST `OncePerRequestFilter`, registrado en `SecurityConfig` tras `CookieJwtAuthenticationFilter`. Resuelve la sesión backoffice (mediante `ROLE_ADMIN`, `BO_ROLE_*` y `BO_PERMISSION_*` ya existentes) únicamente para mantener vivo `/api/auth/refresh` de admin durante modos restrictivos. Extrae `userId` desde el JWT en cookie únicamente cuando el modo es restrictivo y la allowlist está poblada.
- `security/ProductOperationalModeWsInterceptor`: `HandshakeInterceptor`, registrado en `WebSocketConfig` para `/match` y `/messages`. Sin inspección de authorities. Misma extracción optimizada de `userId`.
- `config/ProductOperationalProperties`: binding de `product.access.mode`, `product.access.allowlist.user-ids`, `product.registration.client.enabled`, `product.registration.model.enabled` y `product.simulation.transactions-direct.enabled`.
- `constants/ProductOperationalConstants`: códigos (`PRODUCT_UNAVAILABLE`, `PRODUCT_MAINTENANCE`, `REGISTRATION_CLOSED`, `SIMULATION_DISABLED`), scopes (`product`, `client`, `model`, `transactions-direct`), header `X-Product-Mode`, prefijo de log `[PRODUCT-MODE]`.

Aplicación server-side:

- toda decisión de admisión vive en un único servicio; el filtro y el interceptor son consumidores
- backoffice exento por whitelist explícita de `/api/admin/**` y `/api/admin/auth/login` y, además, por excepción específica en `/api/auth/refresh` cuando la sesión es backoffice
- respuesta de bloqueo HTTP 503 con cuerpo JSON estable: `{ "code", "scope", "mode", "message" }` y header opcional `X-Product-Mode`
- en `/api/auth/refresh` bloqueado para una sesión de producto, el filtro borra `access_token` y `refresh_token` poniendo `Max-Age=0`; las cookies de backoffice nunca se tocan
- la flag de simulación económica directa bloquea `POST /api/transactions/first` y `POST /api/transactions/add-balance` incluso con `PRODUCT_ACCESS_MODE=OPEN`; la allowlist no salta esta flag
- `POST /api/transactions/payout` queda fuera de la flag de simulación directa
- `POST /api/billing/ccbill/session` queda clasificado como path de producto y se bloquea en modos restrictivos
- `POST /api/billing/ccbill/notify` sigue en whitelist permanente
- todo bloqueo se loguea con prefijo `[PRODUCT-MODE]` y campos `path`, `method`, `mode`, `decision`, `reason`; nunca emails, passwords, tokens ni cookies

Esta capa **no sustituye** ninguna capa existente:

- los **roles** (`ROLE_*` y `BackofficeAuthorities`) siguen siendo la autoridad de autorización dentro de las superficies admitidas
- **auth-risk** sigue siendo la capa específica de abuso de credenciales sobre login real
- el **rate limiting** clásico (`ApiRateLimitFilter` y derivados) sigue regulando caudal por IP y por superficie
- el **country gate** (`CountryAccessService`) sigue regulando admisión por país en los puntos donde ya aplica

Las cuatro capas son ortogonales y se mantienen separadas para no mezclar fases de negocio (prelaunch, mantenimiento, cierre) con autorización, abuso de credenciales, caudal u origen geográfico.

### Alcance validado actualmente

- **cierre de registro server-side** mediante flags independientes (`PRODUCT_REGISTRATION_CLIENT_ENABLED=false` y/o `PRODUCT_REGISTRATION_MODEL_ENABLED=false`), validado con tráfico real en TEST y AUDIT
- **gobierno de endpoints económicos directos** mediante `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false`, validado en TEST con `SIMULATION_DISABLED` para `POST /api/transactions/first` y `POST /api/transactions/add-balance`
- ausencia de regresión sobre payout, login, matching/realtime, sesiones, gifts ni el resto de flujos no afectados

### Alcance disponible pero no ejercitado

- modos `PRELAUNCH`, `MAINTENANCE` y `CLOSED` aplicados a producto (login, refresh, endpoints REST funcionales, handshake WS): el código está; falta validación operativa
- allowlist por `userId` dentro de modos restrictivos: implementada; sin ejercitar
- frontend: tratamiento explícito de `PRODUCT_UNAVAILABLE`, `PRODUCT_MAINTENANCE`, `REGISTRATION_CLOSED` y `SIMULATION_DISABLED` si aplica a la superficie que invoque esos endpoints
- limitación consciente: durante modos restrictivos, una sesión backoffice cuyo `access_token` haya expirado puede ser tratada como producto en `/api/auth/refresh` porque `Authentication` no está poblado; el admin podría necesitar re-login en ese estado. No se resuelve en esta iteración.

## Observaciones relevantes

- el storage versionado para uploads privados soporta proveedor local y proveedor S3
- el backend mantiene el control de acceso a documentos privados mediante proxy propio
- el proxy de storage exige autenticacion para todo acceso
- el media funcional de modelos se sirve a owner, CLIENT, MODEL o backoffice; el media funcional de clientes se sirve a owner, MODEL o backoffice
- verification y KYC quedan limitados a propietario o backoffice
- el backend esta preparado para operar detras de proxy
- existe una capa versionada de bloqueo por pais basada en cabeceras reenviadas por proxy/CDN, pero su enforcement actual no es global: el codigo la aplica hoy en registro client/model, login producto, refresh y login admin
- las integraciones de email estan mejor asentadas que PSP y KYC externo

## Incertidumbres que se preservan

El codigo muestra evolucion incremental en varias areas. Hay piezas que parecen operativas y otras transicionales. La documentacion debe tratar como parciales, salvo nueva validacion, la integracion PSP final y la activacion plena del proveedor KYC.

La misma cautela aplica al bloqueo por pais: el backend ya resuelve pais de origen desde headers de infraestructura, pero la cobertura sigue siendo parcial entre REST y WebSocket y no debe darse por cerrada como politica global del sistema sin nueva decision e implantacion especifica.
