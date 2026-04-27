# ADR-009: Capa única de Product Operational Mode para gating server-side por entorno

## Estado

Diseñada. Pendiente de implementación. Sustituye y generaliza al diseño previo de "gating de prelaunch" como flag binaria, que queda absorbido por esta decisión.

## Contexto

SharemeChat necesita poder controlar de forma operativa la **admisión al producto** en función del entorno y de la fase del roadmap, sin reabrir auth, roles ni la arquitectura WebSocket.

Casos de uso reales que motivan la decisión:

- **PRO prelaunch (Fase 1 del roadmap)**: registro de clientes y modelos abierto, pero login y acceso al producto bloqueados; backoffice plenamente operativo; superficie pública con mensaje "Coming Soon".
- **TEST y AUDIT**: producto abierto para cuentas existentes, pero registro público cerrado server-side aunque alguien conozca la URL del endpoint.
- **Mantenimiento**: producto temporalmente no disponible; backoffice operativo; registro configurable.
- **Cierre total**: producto cerrado; registro cerrado; solo backoffice.

El backend ya separa correctamente producto y backoffice por path (`/api/admin/**` vs resto) y por autoridad (`ROLE_ADMIN` y `BackofficeAuthorities` vs `CLIENT/MODEL/USER`). La autenticación REST descansa en `CookieJwtAuthenticationFilter` y la WS resuelve identidad dentro del handler. Existen ya varias capas independientes con flags por entorno: `ApiRateLimitFilter`, `AuthRiskService`, `CountryAccessService`. Lo que falta es una capa equivalente que regule **admisión global** en lugar de regular tráfico individual.

## Problema

Era necesario decidir:

- cómo expresar de forma operativa el estado del producto sin acoplarlo a roles ni a auth-risk
- dónde aplicar el gate para que cubra REST, WebSocket y refresh de sesión sin duplicación
- cómo permitir backoffice y webhooks externos durante cualquier modo restrictivo
- cómo modelar registro de cliente y registro de modelo de forma independiente del modo, para poder cerrarlos en TEST/AUDIT manteniendo el producto abierto
- qué contrato HTTP devolver al frontend para que distinga prelaunch de mantenimiento sin entrar en bucles de refresh ni de reconexión WS

## Decisión

Se introduce una capa nueva, **Product Operational Mode**, gobernada por una propiedad principal y dos flags de registro independientes, aplicada server-side mediante un filtro REST y un interceptor WebSocket.

### Modos

Una propiedad enum gobierna el estado global del producto:

- **OPEN**: producto abierto normalmente. Comportamiento equivalente al actual.
- **PRELAUNCH**: producto bloqueado para login, refresh, acceso REST funcional y WebSocket. Registro permitido si las flags de registro están a `true`. Email verification, forgot/reset password y backoffice siguen operando. Pensado para Fase 1 del roadmap en PRO.
- **MAINTENANCE**: producto bloqueado temporalmente con semántica de "vuelve más tarde". Backoffice operativo. Registro según flags.
- **CLOSED**: producto cerrado completamente. Registro también cerrado, independientemente de las flags. Backoffice operativo.

### Flags de registro

Dos flags independientes del modo:

- **client registration enabled**: habilita o deshabilita `POST /api/users/register/client`.
- **model registration enabled**: habilita o deshabilita `POST /api/users/register/model`.

Defaults:

- modo `OPEN`
- flags de registro a `true`

Justificación de defaults: preservan exactamente el comportamiento actual del sistema cuando las variables de entorno no están seteadas. Cualquier cierre se hace por configuración explícita por entorno, igual que `auth-risk` (default `false`, encendido por entorno).

### Aplicación server-side

La decisión vive en dos puntos canónicos:

- **Filtro REST**: registrado en la cadena de seguridad tras `CookieJwtAuthenticationFilter`. Inspecciona path, modo y, si hay sesión, perfil de backoffice. Permite o bloquea.
- **Handshake interceptor WebSocket**: registrado en la configuración WS para `/match` y `/messages`. Decide la admisión antes de abrir el socket; el handler no se entera.

Ambos puntos consumen la misma lógica de decisión, encapsulada en un servicio único. El filtro y el interceptor son consumidores; la regla vive en un solo sitio.

### Backoffice exento

Una sesión cuya `Authentication` resuelve un usuario con perfil de backoffice no vacío (vía la lógica ya existente de `BackofficeAccessService`/`BackofficeAuthorities`) **queda exenta** del gate en cualquier modo restrictivo. Los paths `/api/admin/**` y `/api/admin/auth/login` están además en whitelist explícita por path, antes incluso de inspeccionar la autenticación.

Una allowlist opcional por `userId` permite, en Fase 4 del roadmap (PRO privado funcional), abrir el producto a invitados controlados sin cambiar el modo.

### Whitelist permanente

Independientes del modo:

- `OPTIONS /**`
- `POST /api/admin/auth/login`, `/api/admin/**`
- `GET /api/public/home/**`, `GET /api/users/avatars/**`
- `GET /api/users/me`
- `POST /api/auth/logout`
- `/api/email-verification/**`
- `POST /api/auth/password/forgot`, `POST /api/auth/password/reset`
- `/api/consent/**`
- `POST /api/billing/ccbill/notify`, `POST /api/kyc/veriff/webhook`

### Respuesta HTTP a alto nivel

Todas las respuestas de bloqueo usan **status 503 Service Unavailable** con un cuerpo JSON estable que contiene un campo `code` discriminante:

- `PRODUCT_UNAVAILABLE` para PRELAUNCH y CLOSED
- `PRODUCT_MAINTENANCE` para MAINTENANCE
- `REGISTRATION_CLOSED` para registro deshabilitado, con `scope` `client` o `model`

El status 503 se elige sobre 401, 403 y 423 para no contaminar los flujos existentes:

- 401 dispara refresh automático en el frontend y `auth:logout` — enmascararía la causa real y produciría bucles
- 403 implica "autenticado sin permisos", lo que confunde un kill switch operativo con una decisión de roles
- 423 Locked tiene tooling pobre y no encaja con el helper `apiFetch` actual

En el endpoint de refresh bloqueado, la respuesta puede acompañar `Set-Cookie` con `Max-Age=0` para `access_token` y `refresh_token` cuando la sesión es de producto, dejando al cliente en estado limpio. Las cookies de backoffice no se tocan.

El handshake WebSocket bloqueado responde con 503 sin body y opcionalmente con un header de modo, suficiente para que el cliente WS distinga del cierre por error genérico y no entre en reconexión.

## Por qué no solo frontend

Un gate visible solo en UI (ocultar formularios, redirigir rutas) deja todos los endpoints REST y los handshakes WebSocket abiertos a cualquier cliente que conozca la URL o que ya tenga una cookie válida. La UI puede seguir siendo elegante, pero **no es autoridad**: la autoridad operativa debe vivir en backend para ser realmente efectiva frente a tráfico no UI (curl, scripts, cookies copiadas, herramientas de auditoría).

## Por qué no mezclarlo con roles

Roles deciden *qué* puede hacer un usuario autenticado. El modo operativo decide *si* dejas pasar al usuario en este momento. Mezclar ambas decisiones en el modelo de seguridad existente:

- contaminaría `SecurityConfig` con condicionales operativos
- haría imposible cerrar el producto sin romper backoffice o sin tocar el grafo de permisos granulares
- introduciría acoplamiento entre fases de negocio (prelaunch, mantenimiento) y autorización (`ROLE_*`)

La separación se mantiene: `SecurityConfig` define autenticación y autorización; el filtro de Product Operational Mode decide admisión global por encima de eso.

## Por qué no una flag aislada de prelaunch

Un diseño previo proponía una única flag binaria `product.prelaunch.enabled`. Se descarta por tres razones:

- el sistema necesita expresar **al menos cuatro estados operativos distintos** (OPEN, PRELAUNCH, MAINTENANCE, CLOSED), no dos
- una flag de prelaunch no cubre el caso TEST/AUDIT, que requiere producto abierto y registro cerrado simultáneamente — eso forzaría a abrir y cerrar la flag por motivos contradictorios
- la flag binaria mezcla "prelaunch" con cualquier otro motivo de bloqueo (mantenimiento, cierre), perdiendo la capacidad de comunicar al frontend qué tipo de bloqueo es

El enum + flags separadas permite expresar las cuatro situaciones reales del roadmap y de la operación con la misma capa, sin volver a abrir la decisión en cada fase.

## Consecuencias

- el sistema dispone de un kill switch operativo del producto controlable por variable de entorno y reversible sin redeploy de código
- TEST/AUDIT pueden cerrar registro público server-side sin afectar a las cuentas existentes
- PRO puede operar en modo PRELAUNCH durante Fase 1 con backoffice y registro abiertos
- el frontend puede mostrar "Coming Soon" y "Mantenimiento" como estados diferenciados, sin convertirse en autoridad de seguridad
- la lógica de admisión queda centralizada en un único servicio, separada de auth, roles, rate limit, country gate y auth-risk
- aparece dependencia operativa de tener bien aislado `cookieDomain` por entorno, para que cookies de TEST/AUDIT no valgan en PRO; esa dependencia ya forma parte de Fase 0 del roadmap (paridad properties/env de PRO)
- el cambio de modo se asume con reinicio controlado del backend mientras no exista hot-reload de propiedades; documentar el procedimiento operativo en runbooks
- durante PRELAUNCH no se ejecuta `auth-risk` sobre login porque el filtro corta antes; se considera aceptable ya que no hay tráfico real de credenciales en ese estado, y se reactiva al volver a OPEN

## Riesgos

- **Bloqueo accidental de backoffice**: mitigado por whitelist explícita de `/api/admin/**` y por inspección de perfil backoffice. Validación manual obligatoria en el procedimiento.
- **Bloqueo de webhooks externos** (PSP, KYC): mitigado por whitelist explícita.
- **`/api/users/me` afectado**: roto sería catastrófico para sesión admin y product. Se mantiene siempre permitido. La protección efectiva descansa en los demás endpoints.
- **Bucles de refresh**: el status 503 nunca dispara refresh en el cliente; las cookies de producto se borran al primer intento bloqueado de `/api/auth/refresh`.
- **Bucles de reconexión WS**: los engines deben tratar el 503 sobre handshake como cierre definitivo del modo, sin reintento.
- **Endpoints producto futuros**: si se añade un endpoint nuevo bajo prefijos ya cubiertos (`/api/clients/**`, `/api/transactions/**`, etc.), queda cubierto automáticamente. Los endpoints fuera de esos prefijos exigen revisión.
- **Cookies cross-entorno**: el control depende de que `cookieDomain` esté correctamente aislado por entorno. Riesgo asumido y trasladado a Fase 0.
- **Cambio de modo con reinicio**: cualquier transición operativa requiere parada coordinada. No se diseña hot-reload en esta iteración.
- **Frontend con bundle viejo cacheado**: clientes que no entienden los nuevos códigos deben tener un fallback genérico que no rompa la pantalla.

## Relación con el roadmap

Esta capa pertenece a **Fase 0 — Cierre de riesgos pre-PRO** del roadmap principal. Entrega tres capacidades que el roadmap necesita explícitamente:

- cierre de registro público server-side en TEST y AUDIT
- modo PRELAUNCH operativo en PRO para habilitar Fase 1
- modo MAINTENANCE disponible para operación posterior a GO LIVE

La implementación efectiva no es prerrequisito de Fase 0 al completo, pero **sí lo es para Fase 1 (Prelaunch público controlado)**: sin esta capa, no hay forma server-side de tener registro abierto y producto cerrado a la vez.

## Alternativas consideradas

- **Solo guards en frontend**: descartado por bypass trivial vía cookie válida o llamada directa a endpoints.
- **Decoradores por controller**: descartado por dispersión de la decisión y dificultad de cubrir WebSocket de forma coherente.
- **Solo `requestMatchers` en `SecurityConfig`**: descartado porque no cubre WebSocket (que está `permitAll` y autentica en handler) y porque sobrecarga la cadena de seguridad con responsabilidades operativas.
- **Flag binaria única `product.prelaunch.enabled`**: descartada por insuficiencia expresiva (sección "Por qué no una flag aislada de prelaunch").
- **Tres o cuatro flags binarias separadas** (`product.login.enabled`, `product.access.enabled`, `product.ws.enabled`, etc.): descartado por explosión combinatoria y por permitir estados inseguros como "login OFF + access ON" donde un usuario con cookie ya válida sigue dentro.
- **Persistir el modo en BD**: descartado en esta iteración por simplicidad operativa; el modo es decisión de despliegue, no dato de aplicación.

## Estado de implementación

- diseño cerrado y aprobado
- implementación pendiente
- documentos de arquitectura, runbooks y entornos actualizados con estado "diseñado / pendiente de implementación"
- la presente ADR es la fuente de verdad de la decisión hasta que la implementación quede absorbida en arquitectura
