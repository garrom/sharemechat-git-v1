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

La seguridad WebSocket no descansa en el cierre HTTP de rutas, sino en autenticación y validaciones dentro de los handlers. Además, la configuración versionada de orígenes permitidos para WebSocket sólo refleja test y localhost, aunque otras capas del sistema ya contemplan audit y dominios públicos adicionales.
