# Chat y favoritos

## Cómo se piden favoritos

En el dashboard del cliente, aparecen las modelos disponibles como 
tarjetas con foto. El cliente puede pulsar el botón de añadir sobre 
una modelo para enviarle petición de favorito.

La modelo recibe la petición en su zona de favoritos, con un icono 
indicando peticiones pendientes. Puede ver quién le está pidiendo 
(nickname y perfil público) antes de decidir.

Opciones de la modelo:

- **Aceptar**: ambas partes se ven mutuamente en su lista de favoritos 
  y pueden interactuar por chat de texto y videochat 1-a-1.
- **Rechazar**: la petición se descarta silenciosamente. El cliente 
  no recibe notificación del rechazo.

Los favoritos son bidireccionales: la modelo también puede iniciar 
una petición al cliente si lo desea, siguiendo el mismo flujo (cliente 
recibe petición pendiente y decide).

## Chat de texto

El chat entre favoritos es solo de texto, con soporte para emojis y 
regalos (gifts).

### Emojis

Los emojis son gratuitos e ilimitados. Se envían desde el input del 
chat.

### Regalos (gifts)

Los gifts los envía únicamente el cliente hacia la modelo desde el 
catálogo del chat. Cada gift tiene un precio fijo en euros que se 
descuenta del saldo del cliente en el momento del envío.

Los gifts se descuentan del saldo del cliente en el momento del envío. 
La modelo los recibe como parte de sus ingresos por la sesión.

Los gifts quedan visibles en el historial del chat entre las dos 
partes.

### Envío de imágenes o archivos

Actualmente el chat no permite envío de imágenes ni archivos. Solo 
texto, emojis y gifts.

## Videochat 1-a-1 con favoritos

Desde el chat con un favorito, cualquiera de las dos partes puede 
iniciar videochat 1-a-1 directo. La sesión se factura al cliente al 
precio estándar (1 EUR por minuto), igual que el videochat random.

Cualquiera de las dos partes puede terminar la sesión en cualquier 
momento.

## Acciones sobre otro usuario

Tanto en la zona favoritos como durante videochat, cada participante 
tiene acceso a estas acciones sobre el otro:

### Ver perfil completo

Muestra la información pública del otro usuario: nickname, fotos, 
videos si es modelo, y biografía.

Los datos privados (email, fecha de nacimiento, país) no se exponen.

### Eliminar de favoritos

Elimina al otro usuario de la lista de favoritos. Esta acción es 
independiente de bloquear.

### Bloquear

Bloquea al otro usuario. El bloqueo impide nueva comunicación entre 
ambas partes por cualquier vía: chat, videochat 1-a-1 con favorito, o 
matching random.

El bloqueo persiste hasta que la parte que bloqueó decida desbloquear 
voluntariamente. Un usuario puede desbloquear cuando quiera desde su 
lista de bloqueos.

Bloquear no elimina automáticamente al otro usuario de favoritos: son 
dos acciones distintas que el usuario puede realizar por separado 
según su intención.

### Reportar

Envía un reporte al equipo de moderación con una de las categorías 
disponibles:

- **ABUSE** (abuso)
- **HARASSMENT** (acoso)
- **FRAUD** (fraude)
- **MINOR** (menor de edad aparente)
- **OTHER** (otro)

El equipo revisa cada reporte y aplica las acciones que correspondan 
según las políticas del producto.

## Notificaciones del sistema

Actualmente el usuario no recibe emails ni notificaciones push del 
sistema para eventos del chat (nueva petición de favorito, nuevo 
mensaje recibido, videochat entrante).

La única indicación es un icono visual en la zona de favoritos que 
señala peticiones pendientes o novedades sin ver.

---

## Notas para el Agente IA (uso interno)

- **Envío de emojis por la modelo**: verificado en código que ambos 
  roles pueden enviar emojis. Si una modelo reporta que no puede 
  enviar emojis desde su UI, puede ser un problema visual del frontend 
  (selector no visible). Sugerir intentar copiar directamente un 
  emoji en el input y confirmar que llega. Registrar el caso para 
  seguimiento.

- **Envío de imágenes o archivos**: no está en el roadmap explícito. 
  Si un usuario insiste, explicar que el chat está enfocado en texto y 
  emojis para mantener la experiencia segura y directa. No prometer 
  que se añadirá.

- **Rechazo silencioso de favoritos**: si un cliente pregunta si su 
  petición fue rechazada, NO especular. Indicar que el sistema respeta 
  la privacidad de la modelo y no notifica los rechazos. Puede seguir 
  usando matching random para conocer a otras modelos.

- **Notificaciones email/push**: si un usuario pregunta por 
  notificaciones para no perder actividad, confirmar que actualmente 
  la indicación es visual dentro del producto. No prometer notificaciones 
  externas.

- **Bloqueo vs eliminar**: son dos acciones independientes. El usuario 
  puede eliminar sin bloquear (borra de la lista pero podrían volver a 
  matchear en el futuro por random), o puede bloquear sin eliminar 
  (queda en la lista pero no puede comunicar), o hacer ambas por 
  separado. Si un usuario pregunta la diferencia, explicarla así de 
  claro.

- **Chat histórico tras eliminar de favoritos**: el chat se conserva 
  técnicamente en el sistema. Si el usuario vuelve a hacer match en el 
  futuro (nueva petición aceptada), el chat previo NO se recupera en 
  la UI: parte de cero. Si un usuario pregunta específicamente, 
  indicar que cada match empieza con conversación nueva.
