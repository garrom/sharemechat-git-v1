# El producto SharemeChat

## Qué es SharemeChat

SharemeChat es una plataforma de citas para adultos verificados que ofrece
video chat privado 1-a-1 en tiempo real.

La propuesta es simple: personas adultas que quieren conectar por video
de forma privada, con verificación de identidad de ambas partes y
moderación real durante las sesiones. No hay salas públicas, no hay
grabación, no hay terceros observando la conversación. La interacción
es directa entre dos personas que han consentido conectarse.

Todos los usuarios pasan por verificación de identidad y edad (Didit)
antes de poder usar la plataforma.

## Estructura del producto

La zona pública contiene: landing, blog, registro, login, documentación
legal y FAQ. No contiene material adulto.

La zona autenticada del usuario incluye:

- **Videochat (random)**: matching aleatorio con modelo disponible.
- **Favoritos**: lista de contactos guardados, con chat de texto persistente
  y opción de iniciar videochat 1-a-1 directo.
- **Saldo**: gestión de recarga y consumo.
- **Comprar**: acceso a packs de recarga.
- **Idioma**: selector español / inglés.
- **Perfil**: gestión de datos personales.

## Cómo funciona el videochat

SharemeChat tiene dos bloques principales de videochat, ambos con video
streaming + chat de texto persistente:

### Videochat random

Accesible desde la pestaña "Videochat" del navbar.

El sistema empareja al cliente con una modelo disponible en ese momento
siguiendo un algoritmo FIFO (la siguiente disponible entra en la cola).
No hay priorización por tier de modelo, rating ni ninguna otra variable:
el matching es puramente aleatorio dentro del pool de modelos activas
que cumplen los filtros (país, no bloqueada, no admin).

La sesión se inicia cuando ambas partes están conectadas con cámara
activa. Cualquiera de las dos puede terminar la sesión en cualquier
momento.

### Videochat 1-a-1 con favoritos

Accesible desde la pestaña "Favoritos" del navbar.

Cliente y modelo deben ser favoritos mutuos (los dos han enviado o
aceptado la petición de favoritos). Dentro de la zona de favoritos hay
dos modos:

- **Chat de texto puro**: para interactuar con contactos guardados
  fuera de videochat.
- **Videochat 1-a-1 directo**: iniciable en cualquier momento desde
  el chat con un favorito.

En todos los videochats, el usuario tiene acceso a estas acciones sobre
el otro participante: bloquear, desbloquear, reportar, eliminar de
favoritos, ver perfil completo.

## Chat de texto

El chat de texto en zona favoritos y durante videochat se guarda en
base de datos. El histórico se conserva y el usuario puede revisar
mensajes anteriores con cada uno de sus favoritos.

Durante el chat, el usuario dispone de:

- **Emojis**: gratuitos e ilimitados.
- **Regalos (gifts)**: catálogo de pago que el cliente puede enviar a
  la modelo durante o después de una sesión. Los regalos disponibles
  tienen precios variados y aparecen en el catálogo del propio chat.

## Sistema de favoritos

Los favoritos son bidireccionales: cualquier parte (cliente o modelo)
puede enviar la petición. La petición queda en standby hasta que la
otra parte acepte o rechace.

Una vez aceptada, ambas partes ven al otro en su lista de favoritos y
pueden interactuar por chat o iniciar videochat 1-a-1.

## Bloqueo y reporte

Un usuario puede bloquear a otro en cualquier momento. El bloqueo es
simétrico funcional: cuando bloqueas a otro usuario, ninguno de los
dos puede contactar con el otro (ni matching, ni chat, ni favoritos)
hasta que decidas desbloquear voluntariamente. El bloqueo es perpetuo
hasta desbloqueo.

Los reportes disponibles cubren las siguientes categorías:

- **ABUSE** (abuso)
- **HARASSMENT** (acoso)
- **FRAUD** (fraude)
- **MINOR** (menor de edad aparente)
- **OTHER** (otro)

Los reportes se envían al equipo de moderación de SharemeChat. El equipo
revisa cada reporte y aplica las acciones que correspondan según las
políticas del producto (advertencia, suspensión, o baneo del usuario
reportado, según severidad).

Si el reporte se rechaza por falta de evidencia suficiente, SharemeChat
comunica al reportante que no se ha encontrado evidencia y le anima
a volver a reportar si vuelven a ocurrir situaciones similares.

## Requisitos técnicos

- **Navegador**: Chrome, Firefox, Edge o Safari en versión reciente.
- **Cámara y micrófono**: acceso obligatorio del navegador. Sin cámara
  operativa no se pueden iniciar sesiones de videochat.
- **Conexión de internet**: recomendada mínima 5 Mbps para video
  fluido.
- **Dispositivos**: desktop, laptop, móvil (iOS y Android) soportados.

## Idiomas

La interfaz del producto está disponible en español e inglés. El idioma
se detecta automáticamente según el navegador del usuario, y se puede
cambiar manualmente desde el navbar.

La documentación pública (Terms, Privacy, Complaints, etc.) está
actualmente disponible únicamente en inglés. La traducción al español
está en el roadmap.

## Disponibilidad geográfica

SharemeChat opera desde Estonia, en la Unión Europea. La empresa titular
es Shareme Technologies OÜ (Registry code 17444422, Lõõtsa tn 5, 11415
Tallinn, Estonia).

El servicio está disponible en aproximadamente 28 países para el flujo
de cliente (Unión Europea, Reino Unido, Estados Unidos, Canadá, México,
principales países de Latinoamérica, Australia y Nueva Zelanda entre
otros) y en aproximadamente 46 países para el flujo de modelo
(superset del cliente, incluyendo más países de Latinoamérica y varios
de Europa del Este).

Si un usuario intenta acceder desde un país no soportado, verá un
mensaje explicativo al intentar registrarse. Por seguridad, el mensaje
es uniforme y no especifica el país concreto.

## Edad mínima

**18 años en todo el mundo**, sin excepción y sin trucos.

La verificación de edad se realiza mediante Didit, especialista
third-party en verificación de identidad.

Para modelos, el proceso incluye documento de identidad oficial, selfie,
análisis de liveness y face match. Es el flujo completo de identidad.

Para clientes, el proceso incluye estimación de edad facial con
fallback documental si es necesario, para confirmar mayoría de edad.

Cualquier intento de acceso por menor de 18 años se bloquea y se
registra para revisión de moderación.
