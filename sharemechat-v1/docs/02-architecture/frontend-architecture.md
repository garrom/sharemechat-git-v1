# Arquitectura frontend

El frontend es una unica aplicacion React con dos superficies de ejecucion:

- `product`
- `admin`

La separacion se resuelve por variable de entorno y por seleccion de rutas en tiempo de arranque.

## Responsabilidades

La superficie de producto cubre:

- acceso publico y paginas informativas
- login, verificacion y recuperacion de cuenta
- dashboards para cliente y modelo
- onboarding documental
- experiencias realtime de matching, chat y llamada

La superficie de admin cubre:

- acceso backoffice
- panel operativo
- moderacion
- finanzas
- auditoria interna
- administracion de accesos

## Observaciones verificadas

- el frontend usa `react-router-dom` 5
- la separacion producto/admin se centraliza en `runtimeSurface.js`
- el frontend apunta a `API_BASE=/api`
- las rutas realtime usan `/match` y `/messages`
- WebRTC en cliente se apoya en `simple-peer`

## I18n de superficies

La estrategia aprobada mantiene un unico motor i18n compartido para `product` y `admin`, reutilizando la infraestructura actual basada en `i18next` y `SessionProvider`.

La separacion entre superficies se resuelve a nivel logico y de recursos, no mediante dos infraestructuras distintas. El objetivo es evitar duplicacion tecnica y, a la vez, no mezclar sin criterio los copys de producto y backoffice.

La primera iteracion de i18n en backoffice se divide en dos subfases de bajo riesgo:

- Fase 1A: shell autenticado, layout y selector visible de idioma dentro del shell
- Fase 1B: acceso interno, login, verificacion interna de email y selector visible de idioma en acceso y login

Los paneles operativos del backoffice quedan fuera de esta primera iteracion.

## Flujo de sesion del backoffice

En la superficie admin, el estado de sesion debe tener una unica fuente de verdad en `SessionProvider`.

Reglas verificadas tras la correccion del flujo:

- `AdminAccessPage` no bootstrapea sesion por su cuenta
- `AdminLoginForm` realiza login y una revalidacion explicita de sesion antes de navegar
- la navegacion a `/dashboard-admin` solo debe ocurrir si la revalidacion devuelve un usuario valido con acceso real de backoffice
- `RequireRole` actua como guard pasivo del estado ya resuelto y no debe relanzar `refresh()` por su cuenta

## Product Operational Mode en frontend (diseñado, pendiente de implementación)

El frontend deberá tratar como estado funcional los códigos emitidos por backend cuando esté activo Product Operational Mode (ver [ADR-009](../06-decisions/adr-009-product-operational-mode.md)):

- `PRODUCT_UNAVAILABLE` — producto bloqueado por modo `PRELAUNCH` o `CLOSED`. Pantalla de "Coming Soon".
- `PRODUCT_MAINTENANCE` — producto bloqueado temporalmente por modo `MAINTENANCE`. Pantalla de mantenimiento.
- `REGISTRATION_CLOSED` — registro deshabilitado para la superficie indicada (`scope` `client` o `model`). Mensaje localizado en el modal de registro.

Reglas estructurales que se mantienen:

- el frontend **solo muestra estado**, no es autoridad de seguridad. El bloqueo real vive en backend.
- el status HTTP asociado a estos códigos es 503 y **no debe disparar refresh automático** en `apiFetch`.
- los engines de WebSocket deben tratar el cierre de handshake con código de modo como cierre definitivo, sin reintento.
- la build de backoffice ignora estos códigos: cualquier redirección a "Coming Soon" o "Mantenimiento" aplica solo al build de producto.

Estado actual: diseñado, pendiente de implementación. Hasta que se implemente, el frontend no necesita conocer estos códigos.

## Riesgo actual documentable

Las URLs de superficie versionadas en frontend siguen acopladas explicitamente al entorno de test. Eso refuerza la necesidad de que la documentacion por entornos distinga entre topologia objetivo y configuracion realmente versionada.
