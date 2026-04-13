# Arquitectura realtime

SharemeChat separa el realtime en dos canales WebSocket:

- `/match` para matching aleatorio
- `/messages` para mensajería y llamada directa

## `/match`

Responsabilidades principales:

- autenticación del usuario dentro del handler
- entrada en colas de matching
- emparejamiento entre cliente y modelo
- chat embebido del flujo aleatorio
- coordinación de señalización WebRTC

Dependencia operativa minima:

- Redis como soporte de colas de matching, estado de disponibilidad y coordinacion realtime

## `/messages`

Responsabilidades principales:

- push realtime de mensajes
- lectura y notificaciones
- gifts en contexto conversacional
- ring y llamada directa
- señalización de llamada entre usuarios habilitados

## Confirmación de stream

La evidencia actual del código indica que la confirmación operativa del stream ocurre principalmente por mensajes WebSocket y no por el endpoint REST legacy de media ack. Ese endpoint sigue existiendo y debe considerarse parte de una zona de transición.

## Riesgo técnico documentado

La seguridad WebSocket no descansa en el cierre HTTP de rutas, sino en autenticación y validaciones dentro de los handlers. La configuracion versionada de origenes permitidos ya contempla TEST, AUDIT y localhost. La publicacion efectiva de `/match` y `/messages` sigue dependiendo ademas de que la capa publica del entorno enrute esas rutas al backend correcto y no a un fallback HTML.
