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
