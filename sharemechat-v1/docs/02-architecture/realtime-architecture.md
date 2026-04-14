# Arquitectura realtime

SharemeChat separa el realtime en dos canales WebSocket:

- `/match` para matching aleatorio
- `/messages` para mensajeria y llamada directa

## `/match`

Responsabilidades principales:

- autenticacion del usuario dentro del handler
- entrada en colas de matching
- emparejamiento entre cliente y modelo
- chat embebido del flujo aleatorio
- coordinacion de senalizacion WebRTC

Dependencia operativa minima:

- Redis como soporte de colas de matching, estado de disponibilidad y coordinacion realtime
- la configuracion ICE efectiva se sirve ahora desde backend mediante un endpoint dedicado y el frontend la inyecta al crear `simple-peer`
- el profile de entorno puede publicar varias URLs para un mismo servidor ICE y mantener `username` y `credential` por variables de entorno, lo que permite preparar TURN propio por entorno sin cambiar el contrato backend/frontend

## `/messages`

Responsabilidades principales:

- push realtime de mensajes
- lectura y notificaciones
- gifts en contexto conversacional
- ring y llamada directa
- senalizacion de llamada entre usuarios habilitados

## Confirmacion de stream

La confirmacion operativa del stream deja de depender directamente de `tech-media-ready` por WebSocket. Ese mensaje se mantiene como senal auxiliar y de observabilidad, pero la autoridad real pasa a ser `POST /api/streams/{streamRecordId}/ack-media`.

En random y calling, frontend emite ahora `ack-media` cuando detecta condiciones tecnicas mas fuertes que el signaling puro:

- media local en estado `live`
- media remota en estado `live`
- `RTCPeerConnection` o ICE en estado conectado usable
- un margen corto de estabilidad antes de enviar el ACK

Backend no marca `confirmed_at` ni `billable_start` con un ACK individual. La sesion solo queda confirmada cuando recibe doble ACK valido de ambos lados sobre el mismo `streamRecordId`.

La evidencia actual del codigo sigue mostrando una deuda tecnica distinta: el cierre economico de `stream_records` continua calculando el cargo final desde `start_time` y no desde `confirmed_at` o `billable_start`. Aunque la autoridad de confirmacion tecnica ya es mas fuerte, ese tramo economico sigue pendiente de correccion separada.

## Riesgo tecnico documentado

La seguridad WebSocket no descansa en el cierre HTTP de rutas, sino en autenticacion y validaciones dentro de los handlers. La configuracion versionada de origenes permitidos ya contempla TEST, AUDIT y localhost. La publicacion efectiva de `/match` y `/messages` sigue dependiendo ademas de que la capa publica del entorno enrute esas rutas al backend correcto y no a un fallback HTML.

La conectividad WebRTC cross-network sigue dependiendo de la calidad real de la estrategia TURN/ICE usada por el proyecto. Aunque la fuente de verdad de ICE ya se centraliza en backend y puede variar por entorno sin tocar React, el codigo versionado actual no muestra provision dinamica de credenciales TURN ni una estrategia propia de relay ya desplegada.

La aplicacion ya instrumenta observabilidad minima de ICE en frontend para random y calling:

- trazas de `icecandidate` con tipo de candidato
- trazas de estado `iceConnectionState` y `connectionState`
- consulta de `RTCPeerConnection.getStats()` para identificar el selected candidate pair activo
- clasificacion visible en logs entre `relay (TURN)`, `srflx (STUN)` y `host (direct)`
