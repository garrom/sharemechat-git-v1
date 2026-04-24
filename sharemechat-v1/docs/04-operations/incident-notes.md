# Notas de incidencias

## Incidencias o tensiones tecnicas observables desde el material actual

### Trazabilidad minima insuficiente de accesos publicos en AUDIT

Se detecta una carencia operativa relevante para un entorno no productivo expuesto a validacion PSP: el corpus actual no permite afirmar que exista trazabilidad minima, continua y explotable de las IPs que acceden a las superficies publicas de AUDIT y de su admin.

La evidencia disponible en repositorio y documentacion permite sostener solo estos hechos:

- el backend esta preparado para operar detras de proxy
- Spring Boot opera con `server.forward-headers-strategy=native`
- el codigo ya consume `X-Forwarded-For` y `X-Real-IP` para extraer IP cliente en varios flujos
- en AUDIT se alinearon al menos `Host`, `X-Real-IP`, `X-Forwarded-For` y `X-Forwarded-Proto` en `/match` y `/messages`
- la comparacion completa de configuracion Nginx real sigue fuera del repositorio principal
- el repositorio principal no contiene configuracion versionada de `access_log` o formato de logs HTTP por host/ruta para las superficies publicas

La trazabilidad efectiva hoy queda fragmentada:

- login de producto y login de backoffice guardan IP y user-agent en `refresh_tokens`
- password reset guarda IP y user-agent en `password_reset_tokens`
- consentimiento guarda solo `ip_hint` truncado, no IP completa
- los logs backend versionados muestran errores y eventos de negocio, pero no existe evidencia de un access log HTTP general por request con host, ruta e IP
- el backoffice audit log documentado corresponde a cambios de acceso y permisos, no a accesos HTTP entrantes

La limitacion principal no es de parsing de cabeceras en backend, sino de observabilidad perimetral: sin `access_log` efectivo en la capa HTTP publica o sin un logging HTTP equivalente fuera del repo, no puede reconstruirse de forma fiable quien entro a `audit` y a `admin.audit` por host, ruta y momento, especialmente para frontend estatico o visitas anonimas que no alcanzan un flujo backend con persistencia propia.

La salida operativa minima y pragmatica para este caso queda acotada a:

- registrar accesos HTTP en la capa publica que ya sirve o enruta ambas superficies
- incluir como minimo timestamp, host solicitado, ruta, metodo, status y IP cliente resuelta desde la cadena de proxies
- mantener esa operativa fuera del corpus principal con documentacion solo a nivel logico

Mientras no se valide esa capa real fuera del repo, la siguiente comprobacion correcta sigue siendo extraer:

- configuracion efectiva de `access_log` del vhost publico de AUDIT
- formato real de log usado por host y ruta
- evidencia de si edge/CDN deja logs explotables o si la unica fuente util es Nginx del host publico
- muestras saneadas de access logs para confirmar que la IP util no se pierde en la cadena de proxies

Resolucion posterior documentable:

- AUDIT ya dispone de logging perimetral activo en la capa publica de las superficies `audit` y `admin.audit`
- la validacion operativa confirma que ambas superficies generan trazabilidad minima de accesos a nivel perimetral
- el vhost API/realtime del backend ya aportaba trazabilidad complementaria mediante access log en Nginx
- para `/api` y para las rutas realtime publicadas por ese vhost, la IP real del cliente queda correlable en backend a traves de cabeceras reenviadas como `X-Forwarded-For`
- no se han modificado behaviors funcionales, origins, routing de aplicacion, backend ni frontend
- no se ha introducido hardening adicional; la mejora queda acotada a observabilidad minima operativa

Con ello, la carencia inicial deja de ser ausencia de visibilidad y pasa a un estado mas acotado: AUDIT ya cuenta con trazabilidad minima util para revisiones manuales de accesos, aunque no con un sistema centralizado o avanzado de monitorizacion.

### Pipeline desacoplado de auditoria y defensa perimetral en AUDIT

Sobre la base de trazabilidad minima ya resuelta, AUDIT opera ya con una cadena desacoplada de observabilidad y respuesta perimetral fuera de la aplicacion:

- `audit-access-normalizer`
- `audit-access-classifier`
- `audit-access-reporter`
- `audit-access-blocker`

La finalidad operativa de esa cadena queda acotada a:

- deteccion de accesos hostiles
- clasificacion diaria por señales y scoring determinista
- reporting operativo
- auto-defensa perimetral mediante deny list consumida por Nginx

La explotacion diaria ya no es teorica: el sistema ha detectado trafico hostil real de Internet contra AUDIT y se opera de forma desacoplada del backend Java.

La automatizacion diaria trabaja siempre sobre el dia anterior en UTC para evitar mezclar actividad parcial del dia en curso con el resumen operativo.

Como hardening acotado adicional en la capa publica, se ha introducido bloqueo especifico frente a probes hacia `.env` en Nginx. Ese ajuste reduce una familia concreta de ruido hostil sin sustituir la visibilidad general ni el resto del pipeline desacoplado.

### Fallback SPA no homogeneo entre entornos

La documentacion previa apuntaba a diferencias entre TEST y AUDIT en la capa edge del frontend publico. La implicacion practica es riesgo de fallo al refrescar rutas internas del producto en AUDIT.

### Origenes WebSocket versionados de forma parcial

La configuracion Java de WebSocket sigue reflejando explicitamente test y localhost, mientras otras capas del proyecto ya contemplan audit y dominios publicos adicionales. Esto puede convertirse en una desviacion entre entorno pretendido y configuracion realmente versionada.

### Integraciones externas con madurez desigual

Email parece mas asentado que PSP y KYC externo. La documentacion debe seguir tratando esas areas como susceptibles de cambios y validaciones adicionales.

### Enforcement de compliance no totalmente homogeneo

El material analizado indica que parte del enforcement es mas estricto en REST que en WebSocket. Este punto debe permanecer visible como riesgo operativo y de diseno.

### Bypass incorrecto entre consentimiento de producto y acceso backoffice

Se detecto un bug funcional en frontend: usuarios con acceso real de backoffice podian heredar `consentRequired` de producto y quedar bloqueados por `AuthenticatedConsentModal` y por guardas de acciones sensibles en dashboards de producto.

La causa no estaba en backend ni en DTOs, sino en que el gating de consentimiento de producto se derivaba solo de `sessionUser?.consentRequired` sin excluir superficie admin ni acceso real de backoffice.

La correccion aplicada acota el consentimiento de producto a este criterio:

- solo en superficie producto
- solo cuando el usuario no tiene acceso real de backoffice
- solo cuando `consentRequired === true`

El age gate guest queda desactivado en superficie admin. El gating autenticado de producto se sigue aplicando a clientes y modelos reales.

### Bootstrap de sesion duplicado en backoffice

Se detecto una incidencia de arquitectura frontend en el flujo de login del backoffice: varios componentes intentaban bootstrapear o revalidar sesion en paralelo y acababan generando llamadas duplicadas a `/api/users/me`, respuestas `401` intermitentes y rebotes innecesarios entre `/login` y `/dashboard-admin`.

La correccion aplicada deja estas reglas:

- `SessionProvider` es la unica fuente de verdad del estado de sesion
- `AdminAccessPage` deja de lanzar `refresh()` en mount
- `AdminLoginForm` solo navega a `/dashboard-admin` si la revalidacion de sesion devuelve un usuario con acceso real de backoffice
- `RequireRole` deja de actuar como bootstrap secundario y pasa a ser un guard pasivo

### Respuesta HTML inesperada en login admin

Tras corregir el bootstrap duplicado de sesion, el patron observable en `admin.test` paso a ser:

- `POST /api/admin/auth/login` visto por navegador como `200 text/html`
- `GET /api/users/me` inmediatamente despues con `401`
- backend registrando `Email verification requerida: Debes validar tu email antes de acceder al backoffice.`

El codigo versionado de `AdminAuthController` y `GlobalExceptionHandler` no explica un `200 text/html` para ese caso: el backend deberia propagar `403 application/json` con `code=EMAIL_NOT_VERIFIED`.

La hipotesis operativa principal pasa a ser una desviacion en la capa de publicacion/routing de la superficie admin, donde una ruta `/api/*` podria estar recibiendo fallback SPA, rewrite incorrecto o sustitucion de errores por HTML. La siguiente accion correcta es verificacion operativa comparando origin/backend frente a la capa publica antes de tocar React o backend.

### Simplificacion del enforcement de email no verificado en backoffice

Para reducir complejidad y evitar gestionar `EMAIL_NOT_VERIFIED` endpoint por endpoint en la superficie admin, el control de email pendiente deja de cortar el login en `AdminAuthController`.

La restriccion pasa a concentrarse en un unico punto visible de la UI privada:

- el usuario con acceso real de backoffice puede iniciar sesion
- `DashboardAdmin` detecta `emailVerifiedAt` ausente
- la interfaz interna queda bloqueada de forma casi total
- solo se exponen el aviso superior, el reenvio de validacion y el cierre de sesion

Con este cambio, el enforcement deja de depender del flujo de login y se alinea con un patron de bloqueo visual centralizado, mas parecido al gating ya usado en la superficie de producto.

### Fallo de uploads de documentos en AUDIT

Se detecto una incidencia operativa repetible en `audit.sharemechat.com/model-documents`: la subida de documentos de usuario termina en `500` y el backend registra `java.nio.file.AccessDeniedException: /usr/share/nginx/html/uploads`.

El flujo versionado de uploads usa `StorageService` con implementacion `LocalStorageService` por defecto y escribe directamente en `app.storage.local.root`, configurado como `/usr/share/nginx/html/uploads`. En el profile de AUDIT no existe override versionado para cambiar de proveedor ni de ruta.

El problema inmediato no es de frontend ni del controller de modelo, sino del almacenamiento operativo local sobre una ruta del filesystem que en AUDIT no admite escritura para el proceso backend. La incidencia reabre la decision pendiente sobre si mantener uploads locales endurecidos o mover documentos de usuario a una estrategia de storage desacoplada del host.

La recomendacion documentada pasa a ser migrar uploads privados de usuario a storage privado desacoplado del host, con S3 como direccion objetivo y acceso mediado por backend para documentos sensibles.

La base tecnica ya queda implementada en el codigo versionado:

- `StorageService` soporta proveedor local y proveedor S3
- existe proxy backend para servir contenido privado
- la subida sigue pasando por backend

Como endurecimiento posterior, el proxy privado `/api/storage/content` deja de admitir acceso anonimo. El media de perfil sigue disponible para usuarios autenticados dentro del flujo funcional del producto, mientras verification y KYC quedan restringidos a propietario o backoffice.

La incidencia operativa deja de ser falta de diseño y pasa a depender de activar correctamente la configuracion S3 por entorno, empezando por AUDIT.
Resolucion documentable:

- AUDIT ya activa storage S3 privado para uploads sensibles
- la validacion operativa confirmo que el backend necesitaba credenciales AWS resolubles por el host en runtime
- el bloqueo real de infraestructura era la ausencia de instance profile operativo en la maquina del backend
- una vez corregido ese punto, la subida dejo de fallar por infraestructura S3

El error posterior de validacion de contenido de fichero pertenece a una linea funcional distinta y no reabre la incidencia de storage en AUDIT.

La misma estrategia ya ha quedado activada tambien en TEST sin cambios adicionales en Spring Boot. La validacion de TEST confirma que la aplicacion estaba igualmente preparada a nivel de codigo y que el trabajo restante era operativo, no de implementacion backend.

Como cierre posterior del frente legacy, TEST y AUDIT ya han eliminado tambien:

- referencias persistidas antiguas a `/uploads/...`
- dependencia operativa del filesystem local legado para estos documentos

Ambos entornos quedan documentados como operativos exclusivamente sobre S3 privado con acceso mediado por backend para este tipo de contenido.

### Preview negro de teasers en dashboard trial de usuario en AUDIT

Se detecta una incidencia real en `dashboard-user-client` para usuarios trial (`ROLE_USER` + `FORM_CLIENT`) en AUDIT: el card derecho de previews de modelos deja de renderizar el media y el usuario percibe un bloque negro o sin contenido util.

Patron confirmado:

- el frontend carga correctamente la lista de teasers desde `GET /api/models/teasers`
- el DTO devuelve `avatarUrl` y `videoUrl`
- `VideoChatRandomUser` intenta renderizar el teaser con `BlurredPreview` sobre un elemento `<video src=...>`
- las URLs de media apuntan a `/api/storage/content`, es decir, media gestionada y protegida por backend
- el navegador recibe respuesta HTML en lugar de media reproducible y termina mostrando error de decodificacion o preview negro

Flujo tecnico afectado:

- `DashboardUserClient` monta `VideoChatRandomUser`
- `VideoChatRandomUser` carga teasers y mapea `avatarUrl` y `videoUrl`
- `BlurredPreview` intenta abrir ese media como video o poster
- `StorageController` resuelve la URL protegida y aplica control de acceso por tipo de media

Causa raiz confirmada:

- el backend permite que `ROLE_USER` consulte `GET /api/models/teasers`
- pero `StorageController` restringe el acceso a `MODEL_PROFILE` a roles `CLIENT` y `MODEL`
- un usuario trial `USER + FORM_CLIENT` queda por tanto fuera del acceso al media real del teaser aunque la lista de teasers se entregue correctamente

Impacto:

- degradacion visible de UX en onboarding trial
- perdida del efecto de preview o blur visual en el dashboard trial
- impacto directo en validaciones de producto y demo PSP del flujo trial

Estado:

- correccion backend acotada ya aplicada en codigo
- la correccion no abre `MODEL_PROFILE` a `ROLE_USER`: introduce una via separada para teaser promocional exacto de modelo `APPROVED`, validado por `storageKey` normalizado contra `urlPic` y `urlVideo`
- pendiente de validacion operativa final en entorno para cerrar la incidencia como resuelta
- no apunta a TURN, signaling ni backend realtime; el problema pertenece al control de acceso del media protegido y a su efecto visible en frontend

### WebSocket realtime desalineado en AUDIT frente a TEST

Se detecta una incidencia operativa en AUDIT al intentar abrir los canales realtime `wss://audit.sharemechat.com/messages` y `wss://audit.sharemechat.com/match`.

Lo validado hasta ahora apunta a este patron:

- navegador recibe `200 text/html` en lugar de `101 Switching Protocols`
- cliente y modelo registran fallo de conexion WebSocket
- Nginx en la EC2 ya expone bloques `location /messages` y `location /match` con `proxy_pass` al backend y cabeceras `Upgrade`
- una llamada local de comprobacion contra Nginx devuelve `405` con `Allow: GET,CONNECT`, lo que indica que la ruta llega al backend WebSocket y no a una pagina SPA en esa capa
- Spring Boot registra `Handshake failed due to unexpected HTTP method: HEAD` durante la validacion con `curl -I`, lo que es consistente con handlers WebSocket registrados

La inferencia operativa principal es que la rotura no esta en el frontend ni en la configuracion base de Spring Boot o Nginx de la EC2, sino en una capa publica anterior a la maquina del backend. La hipotesis mas fuerte es desalineacion de routing o behavior para `/messages*` y `/match*` en AUDIT frente a TEST, con caida en origin o fallback HTML equivocado.

Queda ademas una segunda desviacion ya visible en codigo versionado: `WebSocketConfig` solo permite origenes de TEST y localhost. Aunque eso no explica por si solo un `200 text/html`, si la capa edge se corrige sin tocar esa lista, AUDIT podria seguir fallando despues con rechazo de origen.

Correccion minima aplicada en codigo:

- `WebSocketConfig` ya incluye `https://audit.sharemechat.com` junto a TEST y localhost

Con ello, el backend deja de mantener una desalineacion propia de origen permitido. El frente pendiente para cerrar la incidencia queda acotado a la capa publica de AUDIT, donde `/messages*` y `/match*` deben replicar el mismo routing efectivo que TEST hacia backend/Nginx y dejar de devolver HTML.

Resolucion posterior documentable:

- la publicacion de `/messages*` y `/match*` en AUDIT quedo nivelada con TEST
- WebSocket paso a funcionar correctamente en la capa publica
- aun asi, seguia sin haber emparejamiento entre cliente y modelo
- los logs del backend mostraban `Unable to connect to Redis`
- en la maquina de AUDIT no existia Redis instalado ni servicio escuchando en `127.0.0.1:6379`

La causa raiz real del fallo de matching ya no estaba en WebSocket, sino en la ausencia de Redis en el entorno AUDIT. El backend depende de Redis para:

- colas de matching
- estado de disponibilidad
- coordinacion en tiempo real

La resolucion aplicada fue:

- instalacion de Redis en la EC2 de AUDIT
- habilitacion y arranque del servicio
- verificacion de escucha local en `127.0.0.1:6379`
- reinicio posterior del backend

Resultado verificado:

- matching operativo en AUDIT
- cliente y modelo emparejan
- flujo realtime completo funcionando en el entorno

### Rechazo 413 en subida de video de perfil en AUDIT

Se detecta una incidencia operativa en AUDIT al subir el video de perfil de modelo mediante `POST /api/models/documents`.

Sintoma observado:

- navegador recibe `413 Content Too Large`
- la subida de foto de perfil si funciona en el mismo flujo
- el fichero probado era un MP4 de 24.3 MB, 20 segundos, alta resolucion y bitrate alto

Lo que queda soportado por codigo versionado es:

- `ModelController` acepta `video` dentro de `/api/models/documents`
- `StorageService` permite extensiones `mp4` y `webm`
- `app.storage.max-file-size-bytes=52428800`
- `spring.servlet.multipart.max-file-size=50MB`
- `spring.servlet.multipart.max-request-size=60MB`

Con esa evidencia, el fichero probado no deberia ser rechazado por el limite de storage ni por los limites multipart versionados en Spring Boot. La causa queda acotada a una capa HTTP previa al controller.

Diagnostico operativo confirmado:

- en Nginx de AUDIT no existe `client_max_body_size`
- eso deja activo el limite efectivo por defecto de Nginx
- el `413` se produce antes de llegar al backend

La correccion minima necesaria para AUDIT es explicita:

- fijar `client_max_body_size 60M` en la configuracion efectiva de Nginx del entorno

El valor `60M` se elige para respetar el `spring.servlet.multipart.max-request-size=60MB` ya versionado en backend y evitar rechazo prematuro en la capa HTTP publica.

El caso no apunta por ahora a una regla funcional de negocio especifica para video de perfil. La siguiente accion correcta es validar y alinear el limite efectivo de subida en la capa publica con los limites ya versionados en backend, y despues decidir una politica explicita de producto para video de perfil.

### Divergencia estructural de Nginx entre TEST y AUDIT

Las incidencias reales ya resueltas en AUDIT confirman que TEST y AUDIT no han estado realmente nivelados en la capa Nginx y publicacion HTTP.

Hechos confirmados por operacion:

- AUDIT sufrio desviaciones reales en routing publico de WebSocket
- AUDIT sufrio rechazo `413` por limite HTTP de subida no alineado con backend
- TEST y AUDIT ya quedaron alineados al menos en `client_max_body_size 60M`

Tambien queda confirmado a nivel operativo que TEST mantiene mas configuracion historica de Nginx que AUDIT, incluyendo mas headers, proxy headers, hardening y bloques adicionales. Sin embargo, el repositorio principal no contiene los ficheros reales de Nginx de ambos entornos, por lo que la comparacion exacta por directiva sigue pendiente de inventario controlado fuera del repo.

Con la evidencia disponible, la clasificacion correcta de diferencias queda asi:

- ya causaron incidencia real: routing publico de WebSocket y limite HTTP de subida en AUDIT
- plausiblemente relevantes, pero no todavia inventariadas con prueba documental en repo: headers de seguridad, proxy headers, timeouts, redirects y otros bloques historicos presentes en TEST
- no verificables aun como inocuas o necesarias sin extraer antes la configuracion real de ambos entornos

La siguiente accion correcta no es copiar TEST a ciegas sobre AUDIT, sino:

- extraer configuracion real de ambos entornos
- clasificar diferencias inocuas frente a diferencias funcionales o de hardening
- nivelar en AUDIT solo lo que tenga impacto demostrado o valor claro de endurecimiento

Resolucion posterior documentable:

- se realizo una nivelacion controlada del vhost API de AUDIT respecto a TEST
- no se modifico el `nginx.conf` global
- no se arrastraron bloques legacy de `/uploads` ni `/assets`
- en `/api` se alinearon `X-Forwarded-Proto`, `Authorization` y la estrategia de `proxy_hide_header`
- en `/match` y `/messages` se alinearon `Host`, `X-Real-IP`, `X-Forwarded-For` y `X-Forwarded-Proto`
- en `/messages` se alinearon tambien los timeouts largos
- a nivel server se anadieron headers razonables de hardening y cierre explicito de rutas no previstas con `404`

La validacion operativa posterior confirmo:

- `nginx -t` correcto
- recarga correcta
- raiz del vhost API cerrada con `404`
- headers de hardening presentes
- proxy `/api` operativo
- matching, `/messages` y uploads funcionando

Con ello, la divergencia relevante ya documentada en el vhost API de AUDIT queda resuelta. La deuda residual pasa a ser de trazabilidad y comparacion futura de configuracion real fuera del repo, no de un fallo funcional abierto en ese vhost.

### Fallo de WebRTC cross-network con ICE failed

Se detecta una incidencia operativa en videochat aleatorio: cliente y modelo llegan a emparejar, completan offer y answer por WebSocket y llegan a recibir `peerStream`, pero la conexion termina degradando a `iceConnectionState=failed`.

Patron observado:

- el problema aparece sobre todo cuando ambos usuarios estan en redes distintas o con IP publica distinta
- en escenarios mas favorables, como misma red, el comportamiento parece mejor
- Firefox muestra `ICE failed, your TURN server appears to be broken`
- el frontend registra offer, answer, `peerStream` remoto y despues `iceConnectionState=failed`

Lo que queda soportado por codigo versionado es:

- la senalizacion WebRTC se coordina por `/match` y `/messages`
- el frontend usa `simple-peer`
  - en el estado inicial analizado, la configuracion `iceServers` estaba hardcodeada en frontend y no entregada por backend
- los puntos activos encontrados usan STUN publico y un TURN publico estatico `turn:openrelay.metered.ca:80` con credenciales igualmente estaticas
- no existe en backend un servicio versionado que emita credenciales TURN propias del entorno ni configuracion ICE por entorno

La causa raiz probable ya no apunta a signaling ni a regalos, sino a una estrategia de TURN/ICE insuficiente para escenarios cross-network:

- misma red o NAT favorable pueden sobrevivir con candidatos directos
- cuando el flujo necesita relay de verdad, la dependencia de un TURN publico estatico y no controlado por el proyecto pasa a ser fragil
- el codigo actual tampoco muestra variantes `turns` o transportes alternativos endurecidos para ese relay

La revision del flujo de regalos no aporta evidencia de que el regalo destruya o renegocie el peer por si mismo. En random, el handler de regalo valida, procesa contabilidad y emite un mensaje WebSocket `gift`; los cierres explicitos de peer documentados siguen ligados a `next`, `low-balance`, `trial-ended` o desconexion.

Como avance posterior de esta linea, la fase transicional de aplicacion ya centraliza la configuracion ICE en backend mediante un endpoint dedicado y elimina los `iceServers` hardcodeados del frontend. Con ello, la fuente de verdad deja de estar repartida por React y pasa a variar por entorno desde backend sin cambiar codigo de interfaz.

El problema cross-network no debe darse por resuelto con ese cambio: la siguiente accion correcta sigue siendo sustituir la dependencia actual de TURN publico estatico por una estrategia controlada por el proyecto y observable por entorno.

Avance operativo posterior ya ejecutado en AUDIT:

- se ha desplegado una implementacion minima de TURN para el entorno
- la implementacion se mantiene en una unica instancia
- no se ha introducido alta disponibilidad en esta fase
- la validacion operativa del propio servidor TURN ya muestra actividad correcta de `ALLOCATE`, `CREATE_PERMISSION` y `CHANNEL_BIND`
- la ejecucion de esta fase se alinea con el despliegue TURN minimo para AUDIT documentado en ADR-005

Validacion posterior ya confirmada en la propia aplicacion:

- backend AUDIT publicando configuracion ICE por entorno
- frontend consumiendo esa configuracion desde backend
- evidencia frontend de `candidateType=relay`
- evidencia frontend de `ICE selected pair: relay (TURN)`
- evidencia de `iceConnectionState=connected` y `connectionState=connected`

Validacion funcional end-to-end ya confirmada en AUDIT:

- sesion RANDOM confirmada
- streaming funcional
- gifts RANDOM operativos sobre sesion confirmada

Con esta evidencia, la fase minima de TURN en AUDIT queda cerrada a nivel operativo del entorno.

Cierre operativo posterior ya validado en el propio entorno:

- el arranque manual ad hoc de coturn deja de formar parte de la operativa normal
- la ejecucion persistente queda absorbida por un servicio systemd del entorno con arranque automatico al boot
- el reinicio completo de la maquina confirma recuperacion automatica del servicio en estado `active (running)`
- la configuracion estable ya no usa el certificado de ejemplo de coturn y queda apoyada en certificado valido del entorno
- la validacion de cierre se apoya en relay TURN efectivo en navegador, no solo en proceso levantado

La siguiente etapa natural ya no pertenece a esta incidencia en AUDIT, sino a replicar el mismo patron de forma controlada en TEST sin reabrir la decision de arquitectura ya tomada.

### Riesgo de confirmacion y cobro prematuros en random videochat

Se detecta una incidencia tecnica con impacto directo de negocio en el flujo de random videochat.

Patron observado y soportado por codigo:

- cliente y modelo pueden llegar a emparejar y completar signaling
- el problema real no es necesariamente el gift, sino que la media remota puede no consolidarse de forma usable
- la confirmacion operativa del stream no se hace hoy por validacion backend de media extremo a extremo, sino cuando ambos frontends emiten `tech-media-ready`

Hallazgos concretos:

- `tech-media-ready` se emite desde frontend cuando el estado local y remoto del track de video queda en `live`
- esa condicion es mejor que el signaling puro, pero sigue sin exigir de forma explicita `iceConnectionState=connected` o `completed`
- backend confia en que ambos clientes envien `tech-media-ready` y en ese momento marca `confirmed_at` y `billable_start`
- el endpoint REST `POST /api/streams/{streamRecordId}/ack-media`, mas alineado con una confirmacion industrial de media conectada, existe pero no se usa en el flujo principal analizado

Impacto de negocio confirmado por codigo:

- si la sesion nunca llega a confirmarse, `endSession` la cierra sin cargos
- si la sesion se confirma de forma prematura y despues la media se degrada o ICE falla, el cierre economico sigue calculando el cargo final desde `start_time`, no desde `confirmed_at` o `billable_start`
- ademas, en random los gifts pueden procesarse contra la sesion activa del par aunque esa sesion aun no este confirmada; el flujo de regalo no exige `confirmed_at` para random cuando ya existe `streamId` activo

La siguiente correccion minima correcta ya no es solo de TURN/ICE:

- endurecer el gating de `tech-media-ready`
- evitar que backend tome esa senal como unica fuente suficiente para confirmar y empezar tramo facturable
- desacoplar el calculo economico final de `start_time` y llevarlo al inicio facturable real
- endurecer tambien el gating de gifts en random si el producto no quiere permitir cobro mientras la sesion no tenga media usable

Resolucion posterior aplicada sobre gifts:

- en random ya no se permite procesar regalos de pago si no existe una sesion activa valida para el par
- en calling ya no se permite degradar a regalo de chat cobrable cuando la llamada no tiene `streamRecordId` confirmado
- backend valida ademas que cualquier `streamRecordId` usado para cobrar un gift pertenezca al par correcto, siga activo y tenga `confirmed_at` no nulo

Con ello, queda corregido el bug de negocio confirmado en MySQL donde RANDOM y CALLING podian generar `GIFT_SEND`, `GIFT_EARNING` y `GIFT_MARGIN` sin sesion confirmada. La deuda que sigue abierta es distinta: el tramo facturable del stream continua dependiendo de una confirmacion prematura y del calculo final desde `start_time`.

Resolucion posterior aplicada sobre autoridad tecnica de confirmacion:

- `tech-media-ready` deja de confirmar por si solo la sesion en RANDOM y CALLING
- `ack-media` pasa a ser la autoridad real para confirmar `confirmed_at` y `billable_start`
- frontend emite `ack-media` solo tras media local y remota en `live`, conexion usable y un margen corto de estabilidad
- backend exige doble ACK valido de ambos lados sobre el mismo `streamRecordId` antes de confirmar

Con este cambio queda corregida la parte de confirmacion prematura ligada a `tech-media-ready` como autoridad unica. El problema tecnico cross-network no se da por resuelto: la conectividad WebRTC puede seguir fallando mientras la estrategia TURN/ICE siga siendo fragil.

Correccion posterior acotada en CALLING:

- se detecto un false positive todavia posible en llamadas 1 a 1 porque `ack-media` podia salir con `local track live`, `remote track live` y conexion usable aunque el elemento `<video>` remoto real aun no hubiera entrado en reproduccion efectiva
- la correccion aplicada se limita al frontend de CALLING: el ACK ahora exige ademas `onPlaying` real del `<video ref={callRemoteVideoRef}>`
- RANDOM no cambia y backend no cambia: `ack-media` sigue siendo la autoridad compartida y `StreamService.ackMedia(...)` mantiene el doble ACK como confirmacion real

### Diagnostico fino pendiente en regalo random tras match

Se mantiene una incidencia operativa en random donde, tras un periodo de sesion ya emparejada y con streaming visible, el backend registra `gift_random_in` pero deja de llegar a `gift_random_validate_ok`, `processGift` y `gift_random_emit`.

Con la evidencia disponible, el fallo queda acotado a retornos tempranos dentro de `MatchingHandlerSupport.handleGiftInMatch()` antes de completar la validacion del peer y de la sesion activa. La siguiente accion correcta es instrumentacion diagnostica minima en ese metodo para distinguir con logs saneados si el descarte se produce por:

- `senderId` nulo
- rol emisor distinto de `client`
- `giftId` invalido
- peer ausente o no abierto
- `peerUserId` nulo
- rol destino distinto de `model`
- `streamId` ausente o invalido

Diagnostico posterior confirmado:

- el stream RANDOM del par existe y ya estaba confirmado
- varios gifts consecutivos funcionan correctamente dentro de la misma sesion
- mas tarde `statusService.getActiveSession(clientId, modelId)` puede devolver `null` aunque el peer siga vivo y no exista `stream_ended` previo
- el rechazo se produce entonces en `MatchingHandlerSupport.handleGiftInMatch()` con `reasonCode=stream_id_invalid`

La siguiente correccion minima correcta es mantener la resolucion actual via runtime/Redis y, si falla, hacer fallback a base de datos para recuperar el stream RANDOM confirmado y activo mas reciente del par antes de rechazar el regalo.

### Chat no visible en CALLING mobile

Se detecto una incidencia frontend ya resuelta en el videochat 1 a 1 de favoritos.

Patron observado:

- en mobile, durante CALLING, el video seguia funcionando
- el chat del overlay no se mostraba visualmente
- el problema afectaba tanto a cliente como a modelo
- desktop seguia funcionando correctamente
- RANDOM seguia funcionando correctamente

La clasificacion correcta del fallo fue de layout responsive y composicion visual, no de backend, signaling ni WebRTC.

La evidencia tecnica revisada en codigo apuntaba a esta composicion en la rama mobile de CALLING:

- chat renderizado dentro de `StyledChatContainer`
- overlay absoluto sobre el video
- sin composicion explicita suficiente para garantizar visibilidad del contenido del chat en mobile

La resolucion aplicada se limito al frontend de CALLING favoritos:

- ajuste local del contenedor de chat en mobile para forzar composicion visible
- uso de layout flex en columna
- anclaje inferior del contenido del chat
- z-index explicito para asegurar visibilidad sobre el video

El arreglo se mantuvo acotado a:

- `VideoChatFavoritosCliente.jsx`
- `VideoChatFavoritosModelo.jsx`

No se modificaron:

- backend
- TURN
- signaling
- logica WebRTC
- RANDOM
- desktop

### Mensajes de saldo insuficiente no alineados con el idioma activo

Se detecta una incidencia funcional de i18n en flujos de compra, gifts y calling: el aviso de saldo insuficiente puede mostrarse en un idioma distinto al activo del usuario o como texto backend sin traducir.

La evidencia versionada apunta a una causa combinada:

- el frontend sigue detectando algunos casos por substring textual como `Saldo insuficiente`
- hay modales y alerts con textos hardcodeados en componentes de dashboard
- `apiFetch` y varios componentes siguen propagando `err.data.message`, `err.text` o `err.message` como mensaje final de UI
- backend REST y WebSocket emiten errores funcionales como texto libre en castellano en lugar de codigos estables de negocio

El problema no es de locale del navegador ni de carga de diccionarios, sino de arquitectura de errores: la UI depende todavia de mensajes raw del backend y de heuristicas por texto.

La direccion correcta de correccion es:

- definir codigos funcionales estables para errores de saldo y regalo
- mapear esos codigos en frontend con `i18n.t(...)`
- evitar que la UI dependa del idioma del backend
- dejar el idioma final como responsabilidad exclusiva del frontend

Con ello, el chat en CALLING mobile vuelve a mostrar correctamente:

- texto
- emojis
- gifts

### Salto visual del video remoto en Chromium durante fase inicial de media

Se detecta una incidencia frontend reproducible en videochat cuando el flujo ya ha establecido sesion WebRTC, pero el video remoto todavia no ha quedado visualmente listo.

### Pantalla negra en arranque por orden de inicializacion en VideochatStyles

Tras la Fase 2 de limpieza base del stage remoto desktop, la aplicacion podia arrancar con pantalla negra y error `ReferenceError: can't access lexical declaration before initialization` en `VideochatStyles.js`.

La causa fue de inicializacion de modulo en frontend: `StyledDesktopCallChatList` se declaro antes de `StyledChatList`, aunque dependia de ese simbolo mediante `styled(StyledChatList)`.

La correccion aplicada es minima y sin cambio funcional: solo se reordena la declaracion para que `StyledChatList` quede inicializado antes de su extension. No se introducen cambios de comportamiento ni se mezcla este ajuste con la Fase 3.

Patron observado:

- afecta a Chromium en escritorio
- se ha observado en Chrome y Edge
- no se reproduce en Firefox
- no se reproduce en mobile
- afecta tanto a RANDOM como a CALLING
- el backend, signaling y la sesion WebRTC terminan funcionando correctamente
- el problema visible es un encogimiento temporal del contenedor de video remoto durante los primeros segundos antes de reproduccion estable

La evidencia revisada en codigo apunta a una combinacion de fase pre-media y layout:

- el `srcObject` remoto se enlaza cuando existe `remoteStream`
- las ramas de render de RANDOM y CALLING cambian de layout al detectar `remoteStream` o estado de llamada activa
- los callbacks de video `onLoadedMetadata`, `onCanPlay` y `onPlaying` llegan despues
- en Chromium, la fase entre `remoteStream` disponible y video remoto visualmente listo parece mas larga que en Firefox

Puntos concretos del frontend donde se observa este patron:

- `DashboardClient.jsx` y `DashboardModel.jsx` enlazan `remoteStream` a `remoteVideoRef`
- `VideoChatRandomCliente.jsx` y `VideoChatRandomModelo.jsx` cambian el layout desktop a `full-remote` en cuanto existe `remoteStream`
- `VideoChatFavoritosCliente.jsx` y `VideoChatFavoritosModelo.jsx` muestran el stage de llamada en escritorio segun estado de llamada, no segun readiness visual del video
- `VideochatStyles.js` concentra los wrappers comunes del remoto (`StyledCallCardDesktop`, `StyledCallVideoArea`, `StyledRemoteVideo`)

La causa raiz probable queda acotada a que el layout visible depende demasiado pronto de la presencia del stream remoto y no de una fase posterior de readiness visual del elemento `<video>`.

La siguiente correccion correcta debe mantenerse en frontend y quedar desacoplada de WebRTC y signaling:

- reservar area estable para el remoto desde la fase pre-media
- evitar que la composicion visible dependa de dimensiones intrinsecas todavia no disponibles del `<video>`
- introducir un estado visual explicito de readiness del video remoto apoyado en eventos del elemento (`loadedmetadata`, `canplay` o `playing`)
- mantener placeholder o stage estable hasta que el video remoto quede listo para pintar sin reflow perceptible

Estado operativo posterior:

- se llego a probar una primera implementacion frontend basada en placeholder y estado local de readiness del remoto
- esa variante introdujo una fase visual explicita con fondo negro y texto `Conectando...` hasta `onPlaying`
- no rompio match, signaling, WebRTC, sesion ni visibilidad final del remoto
- la mejora se considera parcial y valida como hardening visual no disruptivo
- aun asi, no resolvio el encogimiento de la card en Chrome desktop, lo que confirma que el problema no era solo de visibilidad del video sino tambien de geometria/layout

Intento posterior de endurecimiento geometrico:

- se probo un ajuste contenido sobre `StyledPane` y `StyledCallCardDesktop` en `VideochatStyles.js`
- el comportamiento visual cambio, pero el bug no quedo resuelto
- en esa variante la card tendia a quedar mas pegada arriba
- la hipotesis de trabajo paso a apuntar menos al pane por si solo y mas al layout `full-remote` basado en grid

Intento estructural posterior ya revertido:

- se probo una variante mas agresiva sobre `StyledSplit2` para que `full-remote` dejara de usar `0fr 1fr` y pasara a una sola columna real
- en la misma linea se oculto de forma efectiva el pane izquierdo en ese modo
- esa variante introdujo una regresion mas grave: el remoto dejo de verse correctamente
- la variante se descarto y se hizo rollback
- ese cambio no debe considerarse baseline valida ni punto de reentrada

Estado valido actual tras rollback:

- el remoto vuelve a verse
- RANDOM vuelve a estar funcional a nivel de match, signaling, WebRTC y TURN
- el placeholder `Conectando...` previo se mantiene como mejora parcial no disruptiva
- el bug visual original sigue abierto: en desktop RANDOM, durante aproximadamente 2 a 5 segundos previos a la reproduccion remota real, la card o superficie remota puede encogerse en Chrome y luego corregirse sola
- Firefox desktop sigue comportandose mejor en esa fase transitoria

El problema no debe darse por resuelto todavia. La deuda abierta ya no esta en backend, TURN o signaling, sino en como el frontend separa:

- estado funcional de match o llamada
- presencia tecnica de `remoteStream`
- readiness visual real del elemento `<video>`
- composicion del stage remoto y sus overlays

El roadmap de trabajo posterior queda registrado en `docs/07-roadmap/pending-hardening.md` para evitar reabrir esta incidencia con parches locales no trazables.

Cierre operativo posterior de esta linea de trabajo:

- la linea reciente de cambios sobre RANDOM desktop y stage remoto se cierra y se revierte como base de trabajo
- el resultado de esa iteracion contamino el comportamiento funcional y la capacidad de validacion del sistema, por lo que deja de considerarse aceptable como baseline
- se prioriza volver al ultimo estado funcional conocido, aunque reaparezca temporalmente el defecto visual del card remoto encogido
- no debe considerarse vigente ningun rediseño parcial o wiring temporal asociado a esa iteracion descartada
- la unica mejora de esa linea que se mantiene como valida es el placeholder previo a `playing`, al no introducir regresion funcional y aportar una fase visual transitoria explicita

Cierre posterior de la variante reciente de integracion en RANDOM desktop:

- el objetivo original seguia siendo acotado: corregir el salto o encogimiento visual temporal del card remoto durante los primeros segundos previos a la reproduccion real del video
- la regresion observada en la iteracion reciente ya no fue un problema visual acotado, sino una rotura clara del render desktop en frontend con match funcional pero composicion rota, doble pane o doble card visible y ausencia de video util en pantalla
- queda explicitamente descartado que la causa raiz de esta regresion pertenezca a signaling, matching, TURN o backend; la rotura introducida fue de integracion y render desktop en frontend
- esta variante queda cerrada como linea fallida y no debe retomarse como base activa de trabajo
- cualquier reentrada futura en este frente debera partir de una base funcional conocida y exigir validacion incremental mucho mas estricta entre fases para no volver a contaminar el flujo funcional de RANDOM desktop

### WebSocket /messages inestable en TEST por AllowedMethods restringidos en CloudFront

Se detecto una incidencia operativa en TEST donde el canal realtime `wss://test.sharemechat.com/messages` no quedaba establecido de forma fiable desde navegador, mientras que en AUDIT el mismo flujo funcionaba correctamente con el mismo codigo de aplicacion.

Contexto TEST vs AUDIT:

- mismo frontend React, mismo backend Spring Boot, misma logica de auth y misma configuracion nginx efectiva sobre `/messages`
- diferencia real concentrada en la capa edge (CloudFront), no en aplicacion ni en la EC2

Sintomas observados en TEST:

- navegador (Firefox) reportando `no puede establecer una conexion con el servidor en wss://test.sharemechat.com/messages`
- consola frontend con `WebSocket is closed before the connection is established`
- consola frontend con `[CALL][cleanup] reason= forced-end` y `[CALL][Client] sin target: abre un chat de Favoritos para elegir destinatario`
- access log de nginx registrando `GET /messages HTTP/1.1 101` seguido de cierre inmediato con `body_bytes_sent=4`, consistente con trama WebSocket CLOSE inmediata tras el upgrade
- backend emitiendo `[WS][messages][AUTH_FAIL] sid=... reason=no_token uri=wss://api.test.sharemechat.com/messages` en `MessagesWsHandlerSupport` en los intentos reales propagados por edge CloudFront
- login REST, `/api/users/me`, `/api/webrtc/config` y resto de endpoints REST respondiendo `200` con normalidad en el mismo ciclo

Estado funcional previo al fix:

- login operativo en TEST
- API REST operativa en TEST
- solo `/messages` fallaba en TEST
- el mismo flujo en AUDIT era estable

Diagnostico:

- nginx de TEST y AUDIT verificados con `nginx -T`: bloques `location /messages` equivalentes, con `proxy_http_version 1.1`, `proxy_set_header Upgrade $http_upgrade`, `proxy_set_header Connection "upgrade"`, `proxy_read_timeout 3600s`, `proxy_send_timeout 3600s`
- curl WebSocket local contra `127.0.0.1:8080/messages` en ambos entornos devuelve `101 Switching Protocols` con `Sec-WebSocket-Accept` correcto; backend equivalente en ambos
- OriginRequestPolicy (`Managed-AllViewerExceptHostHeader`), CachePolicy (`Managed-CachingDisabled`), ViewerProtocolPolicy (`https-only`), origin y timeouts identicos en TEST y AUDIT
- la unica asimetria estructural encontrada estaba en la behavior `/messages*` de CloudFront

Diferencia encontrada entre entornos:

- CloudFront TEST (`E2Q4VNDDWD5QBU`) behavior `/messages*`: `AllowedMethods = [HEAD, GET, OPTIONS]`
- CloudFront AUDIT (`E1ILXV7P6ENUV8`) behavior `/messages*`: `AllowedMethods = [HEAD, DELETE, POST, GET, OPTIONS, PUT, PATCH]`

AWS documenta que, para que una cache behavior soporte WebSocket de forma fiable, debe declarar el set completo de metodos HTTP. Con el set reducido, CloudFront puede completar el handshake `101` en algunos intentos pero no sostener el transporte ni propagar de forma consistente cabeceras y cookies durante el upgrade. Esto explica tanto los `AUTH_FAIL reason=no_token` del backend (cookie JWT no llega en la fase de handshake) como la percepcion en navegador de conexion cerrada antes de establecerse.

Cambio aplicado:

- entorno: TEST
- distribucion: `E2Q4VNDDWD5QBU`
- behavior: `/messages*`
- `AllowedMethods` actualizado a `[HEAD, DELETE, POST, GET, OPTIONS, PUT, PATCH]`
- `CachedMethods` sin cambios (`[HEAD, GET]`)
- resto de behaviors, origins, policies, functions y Lambda associations sin tocar
- sin cambios en nginx, backend, frontend, TURN, EC2 ni otros entornos
- operacion realizada via `aws cloudfront update-distribution` con `If-Match` al `ETag` previo y backup intacto de la configuracion anterior guardado antes de aplicar

Resultado verificado tras propagacion:

- `/messages*` de TEST queda nivelada con AUDIT en `AllowedMethods`
- WebSocket `/messages` estable desde navegador, sin cierres prematuros tras el `101`
- desaparecen errores de conexion en consola frontend
- dejan de producirse entradas `[WS][messages][AUTH_FAIL] reason=no_token` asociadas al trafico real desde edges CloudFront
- flujo `/messages` funcionalmente equivalente al de AUDIT

Estado operativo ya alcanzado en AUDIT:

- componente desplegado en EC2 en `/opt/sharemechat-audit-access-blocker`
- configuracion instalada en:
  - `/etc/sharemechat-audit-access-blocker/config.env`
  - `/etc/sharemechat-audit-access-blocker/allowlist.conf`
- units systemd instaladas y cargadas:
  - `sharemechat-audit-access-blocker.service`
  - `sharemechat-audit-access-blocker.timer`
- timer activo con siguiente ejecucion diaria a `05:30 UTC`
- salidas reales de DRY-RUN generadas bajo `/var/log/sharemechat-audit-access-blocker/`
- estado persistente real generado en `/var/lib/sharemechat-audit-access-blocker/ips.json`

Validacion operativa ya realizada:

- dry-run manual para `2026-04-22`:
  - `ips=3`
  - `carril_A=0`
  - `carril_B=0`
  - `carril_C=3`
  - `allowlisted=0`
- dry-run manual para `2026-04-18`:
  - `ips=14`
  - `carril_A=4`
  - `carril_B=0`
  - `carril_C=10`
  - `allowlisted=0`
  - proposed deny list generada con:
    - `141.98.11.181`
    - `35.180.134.18`
    - `62.60.130.227`
    - `85.11.167.38`

Observacion abierta antes de plantear bloqueo real:

- la IP `129.212.226.182`, clasificada como `MALICIOSA` con `main_reason=xmlrpc_scan+many_routes_6`, quedo en Carril C
- esto no invalida el despliegue DRY-RUN, pero si obliga a revisar el tratamiento de IOCs aisladas tipo `xmlrpc_scan` antes de promocionar el componente a bloqueo real

Lecciones:

- el sintoma de "WebSocket closed before established" con `101` presente en nginx no implica que nginx o backend sean la causa; puede originarse en la capa CDN aunque el handshake aparezca completado
- restringir `AllowedMethods` en una behavior que transporta WebSocket rompe el comportamiento aunque el upgrade inicial sea visible en logs
- la nivelacion entre entornos debe incluir explicitamente la capa CloudFront, no solo nginx y backend

Recomendacion operativa:

- cualquier cache behavior de CloudFront que transporte WebSocket (`/messages*`, `/match*` o futuras rutas realtime) debe declarar `AllowedMethods = [HEAD, DELETE, POST, GET, OPTIONS, PUT, PATCH]` en todos los entornos
- esta regla aplica a cualquier distribucion nueva que se provisione para el proyecto

### WebRTC roto en TEST por cableado de properties y host TURN apagado

Se detecto una incidencia operativa en TEST donde el signaling WebRTC ya funcionaba correctamente, pero la conexion de media WebRTC nunca quedaba establecida y la UI mostraba `Could not establish the connection. Please try again.`

Contexto TEST vs AUDIT:

- mismo codigo de aplicacion en ambos entornos
- AUDIT ya habia cerrado la fase minima de TURN propio segun ADR-004 y ADR-005, con evidencia en navegador de `candidateType=relay` y selected pair `relay (TURN)`
- TEST seguia pendiente de replicar el patron, tal como anticipaban `test-levelling-plan.md` Fase 3 y `known-risks.md`

Sintomas observados en TEST:

- WebSocket `/match` estable con `101 Switching Protocols`
- consola frontend con `WebRTC: ICE failed, your TURN server appears to be broken`
- `iceConnectionState=failed`
- `connectionState=failed`
- `candidateType=unknown`
- `protocol=unknown`
- secuencia `checking` -> `connecting` -> `iceGatheringState: complete` -> `FAILED`
- sin aparicion de candidatos `relay` en la instrumentacion ya versionada del frontend (`relay (TURN)`, `srflx (STUN)`, `host (direct)`)

Estado funcional previo al fix:

- `/api/webrtc/config` respondia sin incluir la URL TURN propia del entorno
- las variables de entorno `TEST_WEBRTC_TURN_URL_UDP` y `TEST_WEBRTC_TURN_URL_TCP` estaban presentes en la maquina del backend pero no tenian efecto en Spring
- en paralelo, la EC2 designada como servidor TURN de TEST (`Server-Test-Sharemechat`, EIP `63.180.48.12`) estaba `stopped` en AWS tras una parada manual previa

Diagnostico:

- inspeccion de `src/main/resources/application.properties` mostro que el bloque `# WebRTC / ICE` del perfil TEST estaba cableado con claves genericas `${WEBRTC_ICE_SERVER_2_URLS:turn:openrelay.metered.ca:80}`, `${WEBRTC_ICE_SERVER_2_USERNAME:openrelayproject}` y `${WEBRTC_ICE_SERVER_2_CREDENTIAL:openrelayproject}`
- ese cableado no referenciaba `TEST_WEBRTC_TURN_URL_UDP/TCP/TLS` ni `TEST_WEBRTC_TURN_USERNAME/CREDENTIAL`, por lo que las variables del entorno nunca se inyectaban en `WebRtcProperties` ni viajaban al frontend via `/api/webrtc/config`
- ademas el default residual apuntaba al TURN publico `openrelay.metered.ca:80`, precisamente la dependencia que ADR-004 habia decidido abandonar y que ya habia causado el incidente cross-network previo en AUDIT
- la verificacion de AWS confirmo que la EC2 TURN de TEST estaba `stopped`, por lo que aunque las URLs hubieran sido correctas tampoco habia proceso coturn escuchando
- los Security Groups del entorno TEST (`turn-test-sg`) si exponian UDP 3478, TCP 3478 y UDP 49152-65535 abiertos a `0.0.0.0/0`, equivalentes a `turn-audit-sg`, por lo que la accesibilidad de red no era el problema

Diferencia encontrada entre entornos:

- `application-audit.properties` ya tenia el bloque WebRTC parametrizado con `AUDIT_WEBRTC_TURN_URL_UDP`, `AUDIT_WEBRTC_TURN_URL_TCP`, `AUDIT_WEBRTC_TURN_URL_TLS`, `AUDIT_WEBRTC_TURN_USERNAME` y `AUDIT_WEBRTC_TURN_CREDENTIAL`, con defaults vacios y sin fallback a TURN publico
- `application.properties` (perfil TEST) mantenia un bloque heredado anterior a la estrategia decidida en ADR-004, basado en claves genericas y con fallback a relay publico

Cambio aplicado:

- entorno: TEST
- fichero: `src/main/resources/application.properties`
- bloque: `# WebRTC / ICE`
- claves antiguas `WEBRTC_ICE_SERVER_2_URLS`, `WEBRTC_ICE_SERVER_2_USERNAME`, `WEBRTC_ICE_SERVER_2_CREDENTIAL` sustituidas por:
  - `app.webrtc.ice-servers[2].urls[0]=${TEST_WEBRTC_TURN_URL_UDP:}`
  - `app.webrtc.ice-servers[2].urls[1]=${TEST_WEBRTC_TURN_URL_TCP:}`
  - `app.webrtc.ice-servers[2].urls[2]=${TEST_WEBRTC_TURN_URL_TLS:}`
  - `app.webrtc.ice-servers[2].username=${TEST_WEBRTC_TURN_USERNAME:}`
  - `app.webrtc.ice-servers[2].credential=${TEST_WEBRTC_TURN_CREDENTIAL:}`
- STUN en `ice-servers[0]` e `ice-servers[1]` sin cambios
- no se modifico el codigo Java (`WebRtcConfigController`, `WebRtcProperties`, DTO), el frontend ni `application-audit.properties`
- en paralelo se ejecuto la parte operativa del entorno: arranque de la EC2 TURN de TEST y redeploy del backend con las variables `TEST_WEBRTC_TURN_*` pobladas

Resultado verificado tras redeploy y arranque del entorno:

- backend TEST publicando configuracion ICE por entorno via `/api/webrtc/config` con la URL TURN propia del entorno y credenciales del entorno
- frontend consumiendo esa configuracion sin cambios
- evidencia frontend de `candidateType=relay`
- evidencia frontend de `ICE selected pair: relay (TURN)`
- `iceConnectionState=connected`
- `connectionState=connected`
- reproduccion efectiva del video remoto (`remoteVideoPlaying`)
- backend confirmando `startSession`, `random_match_emit`, `tech-media-ready` en ambos lados y doble `ackMedia` valido sobre el mismo `streamRecordId`
- flujo de gifts RANDOM operativo sobre sesion confirmada
- cierre limpio de sesion con `DISCONNECT`

Con ello la fase minima de TURN en TEST queda cerrada a nivel funcional, alineada con el patron ya validado en AUDIT.

Lecciones:

- el problema en TEST no era de arquitectura de aplicacion: ADR-004 y ADR-005 ya estaban implementadas en codigo, y AUDIT ya las operaba correctamente
- la rotura era combinacion de dos factores de entorno: un cableado de properties heredado que no leia las variables especificas de TEST y una EC2 TURN apagada
- variables de entorno con prefijo especifico del entorno (`TEST_WEBRTC_TURN_*`, `AUDIT_WEBRTC_TURN_*`) solo sirven si el fichero `application-<profile>.properties` las referencia explicitamente; no basta con pasarlas al proceso
- un default residual hacia TURN publico en properties puede enmascarar un fallo de cableado durante mucho tiempo al hacer que la aplicacion parezca configurada aunque nunca use el relay propio
- la paridad entre entornos debe cubrir los tres planos a la vez: codigo de aplicacion, cableado de properties por perfil y estado operativo real de la EC2 TURN

Recomendacion operativa:

- cualquier perfil de entorno que use TURN propio debe parametrizar `ice-servers[2]` con variables especificas del entorno (`<ENV>_WEBRTC_TURN_URL_UDP`, `<ENV>_WEBRTC_TURN_URL_TCP`, `<ENV>_WEBRTC_TURN_URL_TLS`, `<ENV>_WEBRTC_TURN_USERNAME`, `<ENV>_WEBRTC_TURN_CREDENTIAL`), con defaults vacios y sin fallback a relay publico
- la validacion minima de un entorno nuevo debe incluir: respuesta de `/api/webrtc/config` con URL TURN propia, EC2 TURN en estado `running`, coturn `active (running)` bajo systemd y evidencia en navegador de selected pair `relay (TURN)`
- esta regla aplica a PRO cuando se provisione, manteniendo el mismo contrato logico ya validado en AUDIT y TEST

### Refresh de rutas SPA roto en TEST por ausencia de fallback en CloudFront

Se detecto una incidencia operativa en TEST donde la navegacion interna de la SPA funcionaba correctamente desde la home, pero el refresh directo o acceso por URL a rutas internas como `/model`, `/client` o equivalentes devolvia `403 AccessDenied` con cuerpo XML de S3 en lugar de servir `index.html`.

Contexto TEST vs AUDIT:

- mismo frontend React, mismo build, misma estrategia de router en cliente
- AUDIT ya resolvia el refresh SPA de forma estable en la capa edge
- TEST no disponia de ningun mecanismo equivalente en su distribucion CloudFront

Sintomas observados en TEST:

- `GET https://test.sharemechat.com/model` respondia `403 Forbidden`
- cuerpo de respuesta era XML de S3 con `<Error><Code>AccessDenied</Code>...`
- navegacion interna React entre rutas seguia funcionando con normalidad (history API sin golpear edge)
- solo fallaba el refresh directo, el acceso por URL y la apertura en nueva pestaña
- el resto de superficies de TEST (login REST, `/api/*`, WebSocket `/match` y `/messages`, assets con extension) respondian con normalidad

Estado previo al fix:

- distribucion TEST `E2Q4VNDDWD5QBU` con origen S3 via OAC `ENGNDDRO1OGZV` para el bucket `sharemechat-frontend-test`
- `DefaultCacheBehavior.FunctionAssociations.Quantity = 0` (sin CloudFront Function asociada)
- `CustomErrorResponses` con un unico item: `404 -> /index.html (200)`
- ningun mecanismo de rewrite de rutas SPA en viewer-request

Diagnostico:

- el problema no estaba en backend, ni en frontend, ni en la EC2, ni en Nginx; el refresh ni siquiera alcanza el backend
- con OAC, S3 devuelve `403 AccessDenied` (no `404 NoSuchKey`) para claves inexistentes porque el principal no tiene `s3:ListBucket`; por ese motivo el CustomErrorResponse `404 -> index.html` ya existente no disparaba y el XML de S3 llegaba hasta el navegador
- sin CloudFront Function que reescriba rutas SPA a `/index.html`, cualquier URI sin extension que no existiera fisicamente en el bucket resultaba en un `403` visible al usuario
- AUDIT no sufria el mismo fallo porque su distribucion si tenia resuelto el fallback edge

Diferencia encontrada entre entornos:

- AUDIT (`E1ILXV7P6ENUV8`): CloudFront Function `redirect-spa-audit` asociada al `DefaultCacheBehavior` en `viewer-request`, y ademas `CustomErrorResponses` con `403 -> /index.html (200)` y `404 -> /index.html (200)`
- TEST (`E2Q4VNDDWD5QBU`): ninguna CloudFront Function asociada y `CustomErrorResponses` solo con `404 -> /index.html (200)`

Cambio aplicado:

- entorno: TEST
- distribucion: `E2Q4VNDDWD5QBU`
- creacion de CloudFront Function `redirect-spa-test`, runtime `cloudfront-js-1.0`, publicada en `LIVE`
- logica equivalente a `redirect-spa-audit`: passthrough explicito para `/api/`, `/match`, `/messages`, `/uploads/`, `/assets/`, `/static/`, `/.well-known/acme-challenge/`, `/favicon.ico` y `/robots.txt`; reescritura a `/index.html` para cualquier URI sin punto (rutas SPA sin extension); assets con extension pasan sin modificar
- asociacion al `DefaultCacheBehavior` unicamente en `viewer-request`
- no se añadio `CustomErrorResponse 403 -> /index.html` de forma deliberada, para evitar el efecto lateral ya observado en AUDIT donde esa redireccion global podia hacer que rutas `/api/admin/auth/login` devolvieran `200 text/html` en lugar de `403 application/json` con `code=EMAIL_NOT_VERIFIED`
- no se tocaron origins, OAC, bucket policy, otras cache behaviors, AllowedMethods, timeouts, aliases ni policies
- operacion realizada via `aws cloudfront create-function` + `publish-function` + `update-distribution` con `If-Match` al `ETag` previo y backup completo de la configuracion anterior antes de aplicar

Resultado verificado tras propagacion:

- refresh directo a rutas SPA (`/model`, `/client`, etc.) sirve `index.html` con `200` y la SPA hidrata correctamente la ruta
- `/api/*` sigue alcanzando el backend sin reescritura
- `/match` y `/messages` mantienen el `101 Switching Protocols` y no reciben reescritura porque la funcion los excluye y porque tienen su propia behavior
- assets con extension (`/assets/<hash>.js`, `/favicon.ico`) se sirven con su `Content-Type` correcto sin pasar por `/index.html`
- flujo funcional end-to-end de TEST sin regresion en login, matching, realtime, gifts ni storage privado
- unica diferencia efectiva respecto al estado previo: presencia de `FunctionAssociations` con `redirect-spa-test` en `DefaultCacheBehavior` viewer-request; resto de la distribucion intacto

Lecciones:

- el fallback SPA para distribuciones CloudFront con origen S3 via OAC debe resolverse en `viewer-request` con CloudFront Function, no confiando en `CustomErrorResponses` sobre codigos de error del origen
- con OAC, la ausencia de clave en S3 devuelve `403`, no `404`; un `CustomErrorResponse 404 -> /index.html` aislado no cubre el caso real
- añadir `CustomErrorResponse 403 -> /index.html` como solucion alternativa es tentador pero arrastra un riesgo latente: al ser global de distribucion, puede interceptar tambien respuestas `403` legitimas de `/api/*` y transformarlas en HTML, confundiendo al frontend y rompiendo contratos JSON del backoffice (ya observado en AUDIT con el login admin)
- la reescritura en viewer-request permite excluir explicitamente rutas sensibles (`/api/`, realtime, assets versionados, acme-challenge) y solo actuar sobre URIs SPA sin extension, evitando efectos colaterales
- la paridad edge entre entornos debe listar explicitamente: funciones CloudFront asociadas, `CustomErrorResponses`, `AllowedMethods` por behavior, origins y OAC; cualquier divergencia de esos cuatro ejes puede producir sintomas funcionales aparentemente desconectados

Recomendacion operativa:

- cualquier distribucion CloudFront nueva del proyecto que sirva la SPA desde S3 via OAC debe asociar una CloudFront Function de rewrite SPA al `DefaultCacheBehavior` en `viewer-request`, con allowlist explicita de prefijos passthrough (`/api/`, `/match`, `/messages`, `/uploads/`, `/assets/`, `/static/`, `/.well-known/acme-challenge/`, `/favicon.ico`, `/robots.txt`) y reescritura a `/index.html` solo para URIs sin extension
- el nombre de la funcion debe ser especifico del entorno (`redirect-spa-<env>`) para evitar acoplamiento cruzado entre distribuciones
- no se recomienda añadir `CustomErrorResponse 403 -> /index.html` como parche general; si en algun entorno ya existe (caso AUDIT), debe tratarse como deuda a revisar, no como patron a replicar
- la validacion minima de esta capa en un entorno nuevo debe incluir: refresh directo a una ruta SPA (`200` + `text/html`), `GET /api/*` devolviendo JSON del backend, WebSocket `/match` y `/messages` con `101`, y un asset versionado sirviendose con su `Content-Type` real
- esta regla aplica a PRO cuando se provisione, manteniendo el mismo contrato edge ya validado en AUDIT y ahora en TEST


## Bloqueador perimetral de AUDIT incorporado en modo DRY-RUN

Contexto:

- el pipeline de auditoria de accesos de AUDIT existia con tres componentes versionados en `ops/`: `audit-access-normalizer`, `audit-access-classifier` y `audit-access-reporter`
- la capa de bloqueo real en nginx seguia viva en EC2 como `/etc/nginx/deny-audit-ips.conf`, sin fichero versionado en el repo, sin allowlist y sin TTL por IP
- los reportes diarios del clasificador evidencian trafico hostil persistente: escaneos `xmlrpc_scan`, `dotenv_probe`, `wordpress_scan`, `wlwmanifest_scan`, UAs de herramientas (`sqlmap`, `masscan`, `zgrab`, `nikto`, `nmap`) y picos de volumen por IPs residenciales
- se detectaron casos borde con IPs ruidosas que oscilan entre `SOSPECHOSA`, `MALICIOSA` y `CRITICA` por volumen y rutas sensibles sin disparar un IOC hostil reproducible sobre rutas hostiles; un bloqueo guiado solo por score habria generado falsos positivos

Estado previo:

- decision humana ad-hoc sobre que IPs añadir a `deny-audit-ips.conf`
- sin historial estructurado por IP ni ventana deslizante
- sin diff previo a la accion, sin simulacion, sin trazabilidad de por que una IP entra o sale de la deny list
- sin separacion entre "observar" y "bloquear"

Diagnostico:

- el siguiente paso natural no era saltar directamente a bloqueo automatico en caliente, sino introducir primero un componente deterministico que propusiera decisiones sobre la misma evidencia del clasificador, con carriles explicitos y TTL, y lo hiciera en modo DRY-RUN durante un periodo de validacion
- con eso se consigue validar la politica sobre trafico real sin riesgo de falsos positivos en produccion de AUDIT, y cerrar el drift de "hay bloqueo real en EC2 pero no hay codigo versionado ni politica documentada"

Cambio aplicado:

- entorno: AUDIT (solo preparacion de pipeline, NO se modifica nginx ni deny list viva)
- nuevo componente versionado en `ops/audit-access-blocker/` con estructura `bin/`, `lib/`, `config/`, `systemd/`, `README.md`, siguiendo el patron de los otros tres componentes del pipeline
- el binario Python `lib/block_access.py` consume el `summary.jsonl` diario del clasificador y aplica una politica de decision en tres carriles:
  - Carril A (TTL largo, 30 dias): UA scanner con firma conocida, `shell_probe`, override `hostile_plus_admin_sensitive`, `classification=CRITICA` con IOC hostil en rutas hostiles, o 2+ rutas hostiles distintas el mismo dia
  - Carril B (TTL medio, 14 dias): IOC hostil repetido en >=2 dias distintos dentro de una ventana de 7 dias, con al menos un dia `MALICIOSA` o `CRITICA`
  - Carril C: observar, no bloquear
- soporte de allowlist por IP y CIDR, cargada desde `ALLOWLIST_IPS` y/o un fichero `/etc/sharemechat-audit-access-blocker/allowlist.conf`
- estado persistente por IP en `/var/lib/sharemechat-audit-access-blocker/ips.json` con `first_seen`, `last_seen`, historial `hostile_days[]` recortado y bloque `block` con carril, TTL y `expires_at`; prune automatico de bloqueos expirados y de historial antiguo
- salidas diarias advisory:
  - `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.deny-audit-ips.proposed.conf` con sintaxis `deny <IP>;` + comentario de carril, TTL y razones
  - `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.blocker-diff.txt` con decision razonada por IP
  - `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.ips.json` snapshot del estado persistente
- units systemd versionadas `sharemechat-audit-access-blocker.service` + `sharemechat-audit-access-blocker.timer`, con dependencia temporal del clasificador; el timer trabaja sobre el dia anterior en UTC
- se actualiza `ops/audit-access/README.md` para reflejar el paso de 3 a 4 componentes, incluyendo el nuevo diagrama y las rutas operativas del blocker

Resultado verificado:

- el componente, por construccion, NO escribe `/etc/nginx/deny-audit-ips.conf`, NO ejecuta `nginx -t` ni reload, NO bloquea trafico real; tanto el wrapper bash como el binario Python abortan si `DRY_RUN != 1`
- la deny list viva de nginx en AUDIT permanece intacta y bajo control manual exactamente igual que antes de este cambio
- el resto de pipeline (`normalizer`, `classifier`, `reporter`) no se modifica; el blocker se añade como cuarta etapa sin tocar las entradas ni las salidas de las etapas previas
- TEST no se ha tocado en ningun punto: no hay componente `test-access-blocker`, no hay cambios en `ops/test-access-*`, no hay cambios en la distribucion CloudFront de TEST ni en su Nginx

Lecciones:

- un cambio con potencial de falso positivo sobre trafico productivo (bloqueo perimetral) debe llegar primero como simulacion versionada con diff, no como parche en caliente; la misma disciplina aplicada a cambios edge (CloudFront Function) aplica aqui
- el scoring agregado del clasificador es util para priorizar revision humana, pero NO es suficiente como unico criterio de bloqueo; los carriles deben anclarse en IOCs concretos (firmas de UA scanner, rutas de escaneo conocidas, overrides semanticos) mas que en el score bruto
- la politica de bloqueo debe ser auditable IP por IP y reversible por TTL; sin expiracion, una deny list manual crece hasta volverse opaca y tiende a contener IPs legitimas bloqueadas por cambios de proveedor o NAT
- mantener el blocker fuera de la aplicacion Java/Spring y fuera del plano de datos de nginx durante la fase DRY-RUN reduce el riesgo de regresion funcional y preserva la independencia del pipeline de auditoria

Recomendacion operativa:

- el blocker debe ejecutarse en AUDIT en modo DRY-RUN durante un periodo minimo de validacion (orden de 14 dias) antes de plantear activacion real
- durante ese periodo la allowlist debe consolidarse con IPs de operacion, oficina, proveedores de uptime y auditor externo; toda entrada de allowlist debe llevar comentario justificando su presencia
- el paso a bloqueo real debe ser un cambio posterior, explicito y versionado, que incluya como minimo: escritura atomica con backup de `/etc/nginx/deny-audit-ips.conf`, validacion previa con `nginx -t`, reload controlado, mecanismo de desbloqueo manual por IP y alerta si la propuesta diaria supera un umbral
- mientras tanto, la deny list viva en EC2 se sigue gestionando manualmente; el blocker en DRY-RUN solo informa, no sustituye a operacion
- cuando se provisione PRO, el blocker podra extenderse con un componente hermano `product-access-blocker` replicando estructura, pero nunca debe activarse directamente en caliente sobre PRO sin un periodo DRY-RUN previo equivalente
- TEST queda fuera de esta fase: no esta nivelado todavia con este componente, no debe crearse aun `test-access-blocker` y no conviene mezclar esta validacion de AUDIT con la fase pendiente de TEST


## Refinamiento del blocker tras validacion DRY-RUN

Contexto:

- el componente `audit-access-blocker` llevaba varios dias ejecutandose en modo DRY-RUN en AUDIT, generando salidas reales en `/var/log/sharemechat-audit-access-blocker/`
- el analisis de los diffs diarios y del estado persistente revelo dos puntos a corregir antes de poder activar el modo real (DRY_RUN=0)

Problema 1: deteccion incompleta de IOCs hostiles

- caso concreto detectado: IP `129.212.226.182` con `classification=MALICIOSA`, `score=78`, `main_reason=xmlrpc_scan+many_routes_6`
- `evidence.hostile_hits` estaba vacio para esa entrada; la funcion `extract_hostile_iocs()` original solo consultaba esa fuente y `evidence.matched_rule_labels`
- resultado incorrecto: `hostile_days[]` del estado persistente acumulaba esa IP con `hostile_iocs=[]`, bloqueando la activacion del Carril B aunque el IOC `xmlrpc_scan` estuviera presente en `main_reason`
- correccion aplicada: `extract_hostile_iocs()` ampliada a cuatro fuentes en orden sin duplicar: `evidence.hostile_hits`, `evidence.matched_rule_labels`, `matched_rules` (fallback si evidence ausente), y parseo de `main_reason` via `re.split(r"[+\s,;|]+", ...)` filtrando tokens de volumen (`many_routes_*`, `request_burst_*`, `multi_host`, `query_heavy`)
- resultado tras correccion: `xmlrpc_scan` queda registrado en `hostile_days[]`; si la IP reaparece en >=2 dias dentro de la ventana con severidad MALICIOSA/CRITICA, activara Carril B correctamente

Problema 2: razon de Carril C incorrecta cuando habia IOC hostil aislado

- caso concreto: la misma IP `129.212.226.182` con `xmlrpc_scan` detectado (Fuente 4) quedaba en Carril C correctamente (primera aparicion, sin repeticion), pero el diff mostraba `"clasificacion=MALICIOSA sin IOC hostil en ruta hostil"` — mensaje inexacto que ocultaba la presencia del IOC
- causa: en `evaluate_decisions()`, el bloque `if classification in HIGH_SEVERITY` se evaluaba antes que `elif hostile_iocs_today`
- correccion aplicada: reorder a `if hostile_iocs_today` → `elif HIGH_SEVERITY` → `else`; el diff muestra ahora `"IOC hostil aislado sin repeticion ni criterio Carril A"` + `"iocs_today=xmlrpc_scan"` para ese caso

Cambio adicional preparado (DRY_RUN=0):

- el wrapper bash y el binario Python se actualizan para soportar `DRY_RUN=0` como modo real controlado, exclusivo para Carril A
- flujo: preflight `nginx -t` → escritura atomica con backup timestamp → postflight `nginx -t` → `systemctl reload nginx`, con rollback automatico si cualquier paso falla
- soporte de fichero de bloqueos manuales (`deny-audit-ips.manual.conf`): preservado en el fichero live por encima del bloque auto-generado; nunca modificado por el componente
- en el config.env de EC2 AUDIT, `DRY_RUN` sigue siendo `1`; el cambio a `0` requiere checklist explicito (>=14 dias DRY-RUN sin anomalias, allowlist revisada, test manual previo)

Estado tras el refinamiento:

- estado persistente reseteado en EC2 tras el cambio de logica de extraccion de IOCs (comportamiento esperado y documentado); ventana historica de Carril B se reconstruye en 7 dias de actividad real
- validacion DRY-RUN manual para `2026-04-22`: `ips=3`, `carril_A=0`, `carril_B=0`, `carril_C=3`, `allowlisted=0`
- validacion DRY-RUN manual para `2026-04-18`: `ips=14`, `carril_A=4`, `carril_B=0`, `carril_C=10`, `allowlisted=0`; proposed deny list con `141.98.11.181`, `35.180.134.18`, `62.60.130.227`, `85.11.167.38`
- deteccion IOC correcta, no falso positivo para primera aparicion aislada, logica A/B/C intacta: confirmado

Lecciones:

- un campo `main_reason` con tokens compuestos (`ioc+volume_suffix`) puede ser la unica fuente de evidencia IOC si `evidence.hostile_hits` esta vacio; la extraccion de IOC debe cubrir todas las fuentes disponibles en orden, no solo las canonicas
- la explicabilidad del diff es critica para detectar inconsistencias en la logica de carriles antes de activar el modo real; un mensaje de razon incorrecto (aunque el carril final sea correcto) puede ocultar bugs de extraccion durante semanas de DRY-RUN
- tras cambiar la logica de extraccion de IOC, el estado persistente anterior queda parcialmente inconsistente; el reset controlado del estado es preferible a mantener un historial con `hostile_iocs=[]` que bloquea Carril B

Recomendacion operativa:

- revisar el diff diario durante al menos 7 dias adicionales tras el reset del estado para confirmar que Carril B se activa correctamente para IPs con IOCs repetidos
- la activacion de `DRY_RUN=0` en EC2 AUDIT queda pendiente de ese periodo de observacion adicional y de la ejecucion del checklist documentado en `ops/audit-access-blocker/README.md`


## Activacion del bloqueo real en AUDIT

Fecha: `2026-04-24`.

Contexto:

- el blocker llevaba en modo DRY-RUN desde su despliegue inicial; los diffs diarios confirmaban propuestas coherentes con la politica de carriles A/B/C
- tras el refinamiento de logica (4-source IOC extraction, correccion de razon Carril C) y el consiguiente reset del estado persistente, se observaron 7+ dias adicionales de salidas correctas
- se ejecuto el checklist completo de activacion documentado en `ops/audit-access-blocker/README.md` y todas las condiciones quedaron satisfechas

Cambio aplicado:

- `DRY_RUN` cambiado de `1` a `0` en `/etc/sharemechat-audit-access-blocker/config.env` en EC2 AUDIT
- el resto de la configuracion (`CARRIL_A_TTL_DAYS`, `CARRIL_B_TTL_DAYS`, `CARRIL_B_WINDOW_DAYS`, `ALLOWLIST_FILE`, `NGINX_DENY_FILE`, `NGINX_MANUAL_DENY_FILE`) se mantiene sin cambios

Activacion manual de validacion ejecutada sobre `2026-04-18`:

```bash
sudo /opt/sharemechat-audit-access-blocker/bin/block-audit-access.sh \
  --config /etc/sharemechat-audit-access-blocker/config.env \
  --date 2026-04-18
```

Resultado:

```
[blocker REAL carril_A] 2026-04-18 ips=14 carril_A=4 carril_B=0 carril_C=10 \
  allowlisted=0 nginx_test_before=ok nginx_test_after=ok ips_bloqueadas=4 reload=ok
```

IPs bloqueadas en `/etc/nginx/deny-audit-ips.conf`:

```nginx
# Auto-generado por audit-access-blocker - Carril A - 2026-04-18
deny 141.98.11.181;
deny 35.180.134.18;
deny 62.60.130.227;
deny 85.11.167.38;
```

Validacion nginx:

- `nginx -t` preflight: `ok`
- `nginx -t` postflight: `ok`
- `systemctl reload nginx`: `ok`
- rollback: no necesario

Comportamiento del sistema tras la activacion:

- Carril A: bloqueo real en nginx con TTL de 30 dias; el timer de las `05:30 UTC` escribe y recarga nginx automaticamente cada dia si hay IPs nuevas en Carril A
- Carril B: solo propuesta en `.proposed.conf`; no toca nginx
- Carril C: solo observacion en diff
- allowlist: aplicada antes de cualquier decision de carril; ninguna IP allowlisted puede llegar al fichero live
- fichero manual (`/etc/nginx/deny-audit-ips.manual.conf`): preservado en el fichero live si existe; nunca modificado por el componente

Garantias de seguridad operativa mantenidas:

- cualquier fallo en `nginx -t` postflight provoca rollback automatico desde backup con timestamp
- cualquier fallo en `systemctl reload` provoca rollback + intento de reload con la config anterior
- el fichero live nunca queda en estado inconsistente: o se confirma el cambio con ambos `nginx -t` ok, o se restaura el estado previo

Impacto:

- primer bloqueo automatizado real en AUDIT; elimina la gestion manual ad-hoc de la deny list para IPs claramente maliciosas clasificadas en Carril A
- el sistema es deterministico, auditable por IP (historial en `ips.json`, diff razonado diario) y reversible por TTL (30 dias) o por intervencion manual sobre el fichero live
- alineado con requisitos de control y trazabilidad de PSP: cada decision de bloqueo tiene fecha, razon, carril, TTL y IOCs concretos asociados

Lecciones:

- la fase DRY-RUN previa fue critica para detectar el gap de extraccion de IOC en `main_reason` antes de que afectara a bloqueos reales; sin ella, IPs con `xmlrpc_scan+many_routes_6` habrian llegado al fichero live con razon incorrecta o habrian sido clasificadas en C sin registrar el IOC en el historial, impidiendo que Carril B se activara
- el checklist de activacion (preflight, test manual, revision de diff y journalctl antes de dejar el timer en automatico) debe seguirse en cualquier entorno donde se active el modo real del blocker

Recomendacion operativa:

- revisar periodicamente el diff diario y el estado persistente para detectar IPs que hayan expirado pero sigan siendo activamente hostiles (posible acortamiento del TTL o rebloqueo manual)
- cuando se provisione bloqueo real en TEST, seguir el mismo proceso: DRY-RUN >= 14 dias, refinamiento si procede, checklist, activacion manual supervisada antes del timer automatico
- la extension del bloqueo real a Carril B es una decision separada que requiere analisis especifico de falsos positivos para la ventana de 7 dias


## Despliegue del blocker en TEST (modo DRY-RUN)

Fecha: `2026-04-25`.

Contexto:

- AUDIT ya tenia el blocker activo en modo real (DRY_RUN=0, Carril A) desde `2026-04-24`
- TEST quedaba sin el componente desplegado; la gestion de la deny list en TEST seguia siendo manual y sin trazabilidad estructurada
- el codigo del componente `ops/test-access-blocker/` habia sido nivelado con AUDIT (4-source IOC extraction, Carril C reason fix, soporte DRY_RUN=0 preparado) pero no estaba instalado en EC2 TEST
- objetivo del despliegue: activar la fase de observacion en TEST con DRY_RUN=1, sin afectar nginx ni bloquear trafico real, como paso previo obligatorio antes de cualquier activacion de bloqueo real en TEST

Acciones realizadas en EC2 TEST (`63.180.48.12`):

- copia del componente a `/opt/sharemechat-test-access-blocker/` con estructura `bin/`, `lib/`, `config/`, `systemd/`
- creacion de `/etc/sharemechat-test-access-blocker/config.env` (`DRY_RUN=1`) y `allowlist.conf`
- creacion de directorios `/var/lib/sharemechat-test-access-blocker/` y `/var/log/sharemechat-test-access-blocker/`
- instalacion de `sharemechat-test-access-blocker.service` y `sharemechat-test-access-blocker.timer` en systemd
- `systemctl daemon-reload` + `systemctl enable --now sharemechat-test-access-blocker.timer`
- timer configurado a `05:45 UTC` (no solapa con el timer de AUDIT a `05:30 UTC`)

Validacion manual ejecutada:

```
[blocker DRY-RUN] 2026-04-23 ips=4 carril_A=0 carril_B=0 carril_C=4 allowlisted=0
```

Estado final tras el despliegue:

- componente funcionando sin errores
- salidas diarias generandose en `/var/log/sharemechat-test-access-blocker/`
- estado persistente inicializado en `/var/lib/sharemechat-test-access-blocker/ips.json`
- sin impacto en nginx: NO escribe `/etc/nginx/deny-test-ips.conf`, NO ejecuta `nginx -t`, NO hace reload
- trafico de TEST sin modificacion

Diferencia clave con AUDIT:

| Entorno | Modo | Efecto en nginx |
|---------|------|----------------|
| AUDIT | `DRY_RUN=0` | Carril A bloquea real; `deny-audit-ips.conf` escrito y recargado diariamente |
| TEST | `DRY_RUN=1` | Solo propuesta advisory; nginx intacto; sin bloqueo real |

Lecciones:

- el despliegue en DRY-RUN primero es la pauta correcta para cualquier entorno nuevo; permite validar la politica A/B/C sobre trafico real sin riesgo de falsos positivos en nginx
- la separacion de timers (05:30 AUDIT / 05:45 TEST) evita solapamiento de carga en casos de dependencia de recursos compartidos del pipeline

Recomendacion operativa:

- mantener TEST en observacion (DRY_RUN=1) durante al menos 14 dias desde el despliegue antes de evaluar el paso a modo real
- usar las salidas de TEST como referencia comparativa frente a AUDIT: el trafico de TEST puede incluir testers internos, QA manual y trafico sintetico que justifiquen entradas adicionales en la allowlist antes de activar bloqueo real
- cualquier cambio a DRY_RUN=0 en TEST debe seguir el mismo checklist que se siguio en AUDIT: ejecucion manual supervisada, revision de diff y journalctl, y confirmacion de nginx_test_before=ok + nginx_test_after=ok + reload=ok antes de dejar el timer en automatico
