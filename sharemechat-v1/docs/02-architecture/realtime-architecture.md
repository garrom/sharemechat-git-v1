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

## `/messages`

Responsabilidades principales:

- push realtime de mensajes
- lectura y notificaciones
- gifts en contexto conversacional
- ring y llamada directa
- senalizacion de llamada entre usuarios habilitados

## Confirmacion de stream

La evidencia actual del codigo indica que la confirmacion operativa del stream ocurre principalmente por mensajes WebSocket y no por el endpoint REST legacy de media ack. Ese endpoint sigue existiendo y debe considerarse parte de una zona de transicion.

En random y calling, la confirmacion efectiva se produce hoy cuando ambos clientes emiten `tech-media-ready` y backend marca `confirmed_at` y `billable_start`. La condicion que dispara ese mensaje en frontend ya no es la mera recepcion de signaling, pero sigue dependiendo de una senal derivada del estado local y remoto del track de video y no de una validacion backend de media usable extremo a extremo.

La evidencia actual del codigo tambien muestra que el cierre economico de `stream_records` sigue calculando el cargo final desde `start_time` y no desde `confirmed_at` o `billable_start`. Eso deja una deuda tecnica relevante: aunque la sesion no se cobra si nunca llega a confirmarse, una confirmacion prematura puede trasladar al tramo facturable tiempo previo a media realmente estable.

## Riesgo tecnico documentado

La seguridad WebSocket no descansa en el cierre HTTP de rutas, sino en autenticacion y validaciones dentro de los handlers. La configuracion versionada de origenes permitidos ya contempla TEST, AUDIT y localhost. La publicacion efectiva de `/match` y `/messages` sigue dependiendo ademas de que la capa publica del entorno enrute esas rutas al backend correcto y no a un fallback HTML.

La conectividad WebRTC cross-network sigue dependiendo de la calidad real de la estrategia TURN/ICE usada por el proyecto. Aunque la fuente de verdad de ICE ya se centraliza en backend y puede variar por entorno sin tocar React, el codigo versionado actual no muestra provision dinamica de credenciales TURN ni una estrategia propia de relay ya desplegada.
