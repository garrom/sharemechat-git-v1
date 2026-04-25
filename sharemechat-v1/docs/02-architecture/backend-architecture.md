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

El backend incluye una capa de deteccion de abuso de autenticacion separada del rate limit clasico de `ApiRateLimitService`. Su objetivo no es regular el caudal de peticiones sino observar patrones de fallo, calcular un nivel de riesgo y aplicar una respuesta proporcional sin alterar el contrato HTTP.

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

Niveles y respuesta:

- `NORMAL` y `SUSPICIOUS` solo registran log
- `HIGH` aplica un retardo aleatorio dentro de un rango configurable antes de devolver el error de credenciales
- `CRITICAL` crea una clave de bloqueo temporal por `emailHash` mediante `SET NX EX`, sin refrescar TTL si ya existe; durante el bloqueo, los siguientes intentos para ese `emailHash` devuelven el mismo 401 que un fallo normal y no contaminan los contadores ni los sets

Garantias relevantes:

- la respuesta HTTP es identica entre credencial incorrecta y `emailHash` bloqueado: mismo status, mismo mensaje, sin headers adicionales y sin cookies
- los logs no contienen email plano, password, JWT, refresh token raw ni hash de refresh token; solo `emailHash`, `uaHash`, IP y nivel
- toda la cadena es fail-open: si Redis no responde o la salt esta vacia, la deteccion queda en no-op y el login funciona como antes
- la activacion de respuesta progresiva esta gobernada por una propiedad independiente, separable por entorno

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
