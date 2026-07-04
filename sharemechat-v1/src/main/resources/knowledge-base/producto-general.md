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

## Preguntas frecuentes

Respuestas breves a las preguntas más comunes de los usuarios. Para
información detallada, consultar la sección temática correspondiente
o el fichero de referencia asociado.

### Sobre el producto

**¿Qué es SharemeChat?**
Plataforma de citas para adultos verificados con videochat privado
1-a-1 en tiempo real. Ver secciones anteriores de este mismo fichero.

**¿Es una app o web?**
Es una web responsiva accesible desde cualquier navegador moderno
en desktop y móvil.

**¿Necesito descargar algo?**
No. Solo abrir en el navegador con cámara y micrófono habilitados.

**¿Hay restricciones geográficas?**
Sí, no está disponible en todos los países. Si no puedes acceder desde
tu ubicación, verás un mensaje explicativo.

### Sobre la edad

**¿Edad mínima?**
18 años en todo el mundo. Sin excepciones.

**¿Cómo verifican mi edad?**
A través de Didit, especialista en verificación de identidad. Ver la
fila `onboarding-cliente` u `onboarding-modelo` según rol.

### Sobre precios y pagos

**¿Cuánto cuesta?**
1 EUR por minuto de videochat. Sin cargos ocultos, sin suscripciones.
Ver la fila `pagos-y-saldo`.

**¿Qué packs de recarga hay?**
10 EUR, 20 EUR (22 EUR con bonus) y 40 EUR (44 EUR con bonus).

**¿El saldo caduca?**
No mientras la cuenta esté activa.

**¿Aceptan facturas?**
No emitimos facturas fiscales por defecto. Contactar con soporte si
tienes una necesidad específica.

**¿Puedo pedir reembolso?**
Sí, caso por caso, contactando con soporte.

### Sobre el uso

**¿Puedo probar sin pagar?**
El registro es gratuito. La verificación de edad también. Para
sesiones de videochat necesitas saldo cargado.

**¿Cómo funciona el matching random?**
El sistema te empareja con una modelo disponible en ese momento. Ver
secciones anteriores de este mismo fichero.

**¿Puedo elegir modelo específica?**
Solo a través del sistema de favoritos. Si te añades como favorito
mutuo, puedes iniciar sesión directa. Ver la fila `chat-y-favoritos`.

**¿Se pueden compartir imágenes en el chat?**
No. El chat es solo texto, emojis y gifts.

### Sobre modelos

**¿Cómo se hace modelo?**
Registro con rol de modelo, aceptación del contrato, verificación KYC
completa vía Didit, aprobación admin. Ver la fila `onboarding-modelo`.

**¿Cuánto gana una modelo?**
Los detalles operativos de payout se comunican a las modelos aprobadas
desde su dashboard. No forman parte del contenido público.

**¿Con qué frecuencia se paga?**
No hay calendario fijo. La modelo solicita el retiro cuando desea
liquidar el balance acumulado.

**¿Cómo se paga?**
El método concreto se comunica a la modelo en el proceso de solicitud
de retiro, dentro de su dashboard.

### Sobre seguridad y privacidad

**¿Se graban las sesiones?**
No. Sin grabación, sin broadcast público.

**¿Quién puede ver el chat?**
Solo las dos partes de la conversación. No hay terceros.

**¿Cómo denuncio un problema?**
Desde el producto (reporte P2P) o desde el canal público /complaint.
Ver la fila `moderacion-y-seguridad`.

**¿Cómo bloqueo a otro usuario?**
Desde la lista de favoritos o durante videochat. Ver la fila
`chat-y-favoritos`.

### Sobre la cuenta

**¿Cómo cambio mi contraseña?**
Desde la sección de perfil.

**¿He olvidado mi contraseña?**
"¿Olvidaste tu contraseña?" en el formulario de login.

**¿Cómo cambio mi email?**
Contactar con soporte. No es self-service.

**¿Cómo cierro mi cuenta?**
Contactar con soporte.

**¿Puedo tener dos cuentas?**
No. Cuenta única por persona. Cuentas duplicadas pueden violar Terms.

### Sobre contacto

**¿Con quién contacto para X?**
- Dudas generales: este chat de soporte.
- Denuncias: safety@sharemechat.com o /complaint.
- GDPR: contact+gdpr@sharemechat.com.
- Otros: contact@sharemechat.com.

**¿Cuál es vuestro horario?**
Ver la fila `empresa-y-contacto`. Este Agente IA está disponible 24/7.
El equipo humano opera en horario europeo.

---

## Notas para el Agente IA (uso interno)

- Este fichero combina la descripción general del producto y las
  preguntas frecuentes transversales. Actúa como fallback natural
  cuando el router determinístico no identifica un caso específico.

- Cuando un usuario pregunta desde la sección FAQ, la respuesta debe
  ser conversacional (no como FAQ formal), adaptada al usuario y con
  la profundidad adecuada al tipo de pregunta.

- Si una pregunta no está aquí, buscar en la fila temática
  correspondiente y responder desde el conocimiento general.

- Si tras responder, el usuario sigue con dudas sobre lo mismo,
  probablemente necesita algo más específico. Preguntar qué le
  interesa concretamente antes de repetir información.
