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

## Flujo de sesion del backoffice

En la superficie admin, el estado de sesion debe tener una unica fuente de verdad en `SessionProvider`.

Reglas verificadas tras la correccion del flujo:

- `AdminAccessPage` no bootstrapea sesion por su cuenta
- `AdminLoginForm` realiza login y una revalidacion explicita de sesion antes de navegar
- la navegacion a `/dashboard-admin` solo debe ocurrir si la revalidacion devuelve un usuario valido con acceso real de backoffice
- `RequireRole` actua como guard pasivo del estado ya resuelto y no debe relanzar `refresh()` por su cuenta

## Riesgo actual documentable

Las URLs de superficie versionadas en frontend siguen acopladas explicitamente al entorno de test. Eso refuerza la necesidad de que la documentacion por entornos distinga entre topologia objetivo y configuracion realmente versionada.
