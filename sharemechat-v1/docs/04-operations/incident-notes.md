# Notas de incidencias

## 2026-06-08 — Drift backend↔frontend en AUDIT producto: dashboard MODEL/CLIENT en blanco (solo footer)

### Sintoma reportado por el operador

Al loguearse en `audit.sharemechat.com` con un usuario de role MODEL o CLIENT, el dashboard no renderizaba: solo se veia el footer pegado debajo del header, sin contenido entre ambos. ADMIN seguia accediendo a su panel normalmente. Adicionalmente el operador noto que el overlay "COMING SOON" se mostraba en la home publica anonima de AUDIT (intencional por diseno desde el commit `db4f7ef` del 2026-06-07: `featureFlags.js` resuelve overlay siempre visible en TEST y AUDIT; el ruido era confusion, no regresion).

### Diagnostico

Analisis solo-lectura del estado vivo y del repo permitio establecer:

- Backend AUDIT corriendo el JAR `a930800657...` de fecha `2026-05-30 23:07 UTC` (sha verificado en `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar` via SSH a `audit-backend`).
- Frontend AUDIT producto sirviendo el bundle `main.56c27317.js` con `LastModified S3 2026-06-08 16:12:06 UTC` en el bucket `sharemechat-frontend-audit`.
- El bundle del 2026-06-08 lo construyo el operador en una sesion paralela (no en la sesion del agente) que ejecuto `npm run build:product` con el working tree del repo conteniendo seis ficheros uncommitted del frente i18n de paneles admin Audit.

El commit `d48e022 feat(prelaunch): wire PRODUCT_ACCESS_MODE=PRELAUNCH end-to-end + harden gate` introdujo a la vez:
- backend: `userController.setProductAccessMode(productOperationalModeService.currentMode().name())` en la respuesta de `/api/users/me` (linea 249 de `UserController.java`)
- frontend: el check defensivo `if (!mode) return null;` en `RequireRole.jsx:97-98`, donde `mode = String(user.productAccessMode || '').toUpperCase()`

El JAR del backend del 30-may fue compilado desde el commit `b54a0be`, anterior a `d48e022`, por lo que `/api/users/me` no incluia el campo `productAccessMode`. El bundle frontend, en cambio, ya incluia la lectura del campo. Para MODEL y CLIENT el resultado fue: `mode === ''` → `RequireRole` retorna `null` → el dashboard no se renderiza. ADMIN evita el problema porque su rama de chequeo es `backofficeRoles` (linea 87 de `RequireRole.jsx`) y sale `return children` antes de evaluar `productAccessMode`.

### Resolucion

Se nivelo el backend de AUDIT al estado actual de `main` (mismo JAR que corre en PROD/TEST), sin tocar configuracion ni infra: `PRODUCT_ACCESS_MODE=OPEN` permanece igual. JAR nuevo desplegado `7025145b9cf4a55f1ee1c23a1fe6d730f855d58f60d6c80eabdac622b118268a` (commit `1cb43a0`), backup `.bak-pre-lote3-20260608-211512` con el sha previo conservado en EC2 para rollback. Restart limpio del servicio systemd (`active`, "Started SharemechatV1Application in 29.989 seconds", sin ERROR ni Exception). Smoke confirmado por el operador.

### Lecciones y preventiva

El incidente se pudo producir porque (a) el deploy del frontend se hizo en una sesion paralela sin trazabilidad cruzada con el backend, (b) no habia mecanismo automatizable para detectar que el JAR desplegado en AUDIT llevaba 9 dias por detras del codigo del que se compilo el frontend, (c) `RequireRole.jsx` falla en silencio (return null) cuando el contrato API esta roto, lo que enmascara el origen del problema (el usuario ve pagina rota sin pista en consola).

La respuesta preventiva acordada empieza con el manifest de despliegue por entorno + check de drift (`ops/deploy-state/{audit,test,prod}.yaml` + `ops/scripts/check-deploy-drift.ps1`), Fase 1 paso 1 entregada el 2026-06-09 (ver `project-log.md`). El check, corrido contra un manifest sintetico que reproduce el estado de AUDIT del 2026-06-08 antes de nivelar, devuelve CRITICAL nombrando explicitamente `RequireRole.jsx`, `UserController.java`, `UserDTO.java` entre los ficheros del contrato tocados — exactamente los tres responsables del fallo. La integracion del check en el script de deploy frontend (que abortara automaticamente si CRITICAL) y la verificacion viva del commit del backend (endpoint `/api/health/version`) quedan pendientes para Fase 2.

---

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

Impacto de negocio original confirmado por codigo en ese momento:

- si la sesion nunca llega a confirmarse, `endSession` la cierra sin cargos
- si la sesion se confirmaba de forma prematura y despues la media se degradaba o ICE fallaba, el cierre economico calculaba el cargo final desde `start_time`, no desde `confirmed_at` o `billable_start`
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

Con ello, queda corregido el bug de negocio confirmado en MySQL donde RANDOM y CALLING podian generar `GIFT_SEND`, `GIFT_EARNING` y `GIFT_MARGIN` sin sesion confirmada. En ese momento quedaba abierta una deuda distinta: el tramo facturable del stream dependia de una confirmacion prematura y del calculo final desde `start_time`.

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

Resolucion posterior aplicada sobre inicio facturable:

- `confirmed_at` y `billable_start` se escriben de forma atomica y coinciden por construccion
- `endSession` calcula los segundos facturables desde `billable_start`, con fallback defensivo a `confirmed_at`
- `start_time` queda como instante tecnico del stream y ya no se usa como inicio facturable final
- validacion en TEST confirmo `STREAM_CHARGE`, `STREAM_EARNING`, `STREAM_MARGIN` y gifts coherentes con el inicio facturable real

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

- CloudFront TEST (distribución pública del entorno TEST) behavior `/messages*`: `AllowedMethods = [HEAD, GET, OPTIONS]`
- CloudFront AUDIT (distribución pública del entorno AUDIT) behavior `/messages*`: `AllowedMethods = [HEAD, DELETE, POST, GET, OPTIONS, PUT, PATCH]`

AWS documenta que, para que una cache behavior soporte WebSocket de forma fiable, debe declarar el set completo de metodos HTTP. Con el set reducido, CloudFront puede completar el handshake `101` en algunos intentos pero no sostener el transporte ni propagar de forma consistente cabeceras y cookies durante el upgrade. Esto explica tanto los `AUTH_FAIL reason=no_token` del backend (cookie JWT no llega en la fase de handshake) como la percepcion en navegador de conexion cerrada antes de establecerse.

Cambio aplicado:

- entorno: TEST
- distribucion: distribución pública del entorno TEST
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
  - proposed deny list operativa del pipeline perimetral (4 IPs)

Observacion abierta antes de plantear bloqueo real:

- una IP clasificada como maliciosa por el pipeline perimetral (`MALICIOSA` con `main_reason=xmlrpc_scan+many_routes_6`) quedo en Carril C
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
- en paralelo, la EC2 designada como servidor TURN de TEST estaba `stopped` en AWS tras una parada manual previa

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

- distribucion TEST distribución pública del entorno TEST con origen S3 via OAC `ENGNDDRO1OGZV` para el bucket `sharemechat-frontend-test`
- `DefaultCacheBehavior.FunctionAssociations.Quantity = 0` (sin CloudFront Function asociada)
- `CustomErrorResponses` con un unico item: `404 -> /index.html (200)`
- ningun mecanismo de rewrite de rutas SPA en viewer-request

Diagnostico:

- el problema no estaba en backend, ni en frontend, ni en la EC2, ni en Nginx; el refresh ni siquiera alcanza el backend
- con OAC, S3 devuelve `403 AccessDenied` (no `404 NoSuchKey`) para claves inexistentes porque el principal no tiene `s3:ListBucket`; por ese motivo el CustomErrorResponse `404 -> index.html` ya existente no disparaba y el XML de S3 llegaba hasta el navegador
- sin CloudFront Function que reescriba rutas SPA a `/index.html`, cualquier URI sin extension que no existiera fisicamente en el bucket resultaba en un `403` visible al usuario
- AUDIT no sufria el mismo fallo porque su distribucion si tenia resuelto el fallback edge

Diferencia encontrada entre entornos:

- AUDIT (distribución pública del entorno AUDIT): CloudFront Function `redirect-spa-audit` asociada al `DefaultCacheBehavior` en `viewer-request`, y ademas `CustomErrorResponses` con `403 -> /index.html (200)` y `404 -> /index.html (200)`
- TEST (distribución pública del entorno TEST): ninguna CloudFront Function asociada y `CustomErrorResponses` solo con `404 -> /index.html (200)`

Cambio aplicado:

- entorno: TEST
- distribucion: distribución pública del entorno TEST
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

- caso concreto detectado: una IP clasificada como maliciosa por el pipeline perimetral con `classification=MALICIOSA`, `score=78`, `main_reason=xmlrpc_scan+many_routes_6`
- `evidence.hostile_hits` estaba vacio para esa entrada; la funcion `extract_hostile_iocs()` original solo consultaba esa fuente y `evidence.matched_rule_labels`
- resultado incorrecto: `hostile_days[]` del estado persistente acumulaba esa IP con `hostile_iocs=[]`, bloqueando la activacion del Carril B aunque el IOC `xmlrpc_scan` estuviera presente en `main_reason`
- correccion aplicada: `extract_hostile_iocs()` ampliada a cuatro fuentes en orden sin duplicar: `evidence.hostile_hits`, `evidence.matched_rule_labels`, `matched_rules` (fallback si evidence ausente), y parseo de `main_reason` via `re.split(r"[+\s,;|]+", ...)` filtrando tokens de volumen (`many_routes_*`, `request_burst_*`, `multi_host`, `query_heavy`)
- resultado tras correccion: `xmlrpc_scan` queda registrado en `hostile_days[]`; si la IP reaparece en >=2 dias dentro de la ventana con severidad MALICIOSA/CRITICA, activara Carril B correctamente

Problema 2: razon de Carril C incorrecta cuando habia IOC hostil aislado

- caso concreto: la misma IP clasificada como maliciosa por el pipeline perimetral con `xmlrpc_scan` detectado (Fuente 4) quedaba en Carril C correctamente (primera aparicion, sin repeticion), pero el diff mostraba `"clasificacion=MALICIOSA sin IOC hostil en ruta hostil"` — mensaje inexacto que ocultaba la presencia del IOC
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
- validacion DRY-RUN manual para `2026-04-18`: `ips=14`, `carril_A=4`, `carril_B=0`, `carril_C=10`, `allowlisted=0`; proposed deny list operativa del pipeline perimetral (4 IPs)
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

IPs bloqueadas en `/etc/nginx/deny-audit-ips.conf`: 4 entradas en Carril A (deny list operativa del pipeline perimetral; las IPs concretas viven en la fuente operativa fuera del repo).

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

Acciones realizadas en EC2 TEST:

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


## Correccion de desalineacion temporal blocker vs classifier en AUDIT

Fecha: `2026-04-25`.

Contexto:

- el blocker de AUDIT llevaba activo en modo real (DRY_RUN=0) desde `2026-04-24`
- tras el primer run automatico completo del timer, el journal mostraba fallo por ausencia de `summary.jsonl`
- el pipeline completo parecia operativo pero el blocker no completaba su ejecucion diaria

Problema:

- el blocker fallaba cada dia antes de procesar ninguna IP
- el error era `summary not found` con la ruta del fichero del dia anterior del classifier
- el fichero existia en EC2, pero aun no estaba generado en el momento en que arrancaba el blocker

Causa raiz:

- el timer del blocker estaba configurado con `OnCalendar=*-*-* 05:30:00 UTC`
- el classifier se ejecuta aproximadamente a `07:10 UTC`
- resultado: el blocker arrancaba ~1h40m antes que el classifier y no encontraba el `summary.jsonl`

Correccion aplicada:

- `OnCalendar=*-*-* 05:30:00 UTC` → `OnCalendar=*-*-* 07:30:00 UTC` en la unit del timer del blocker en EC2 AUDIT
- `systemctl daemon-reload` + `systemctl restart sharemechat-audit-access-blocker.timer`
- el nuevo horario deja 20 minutos de margen tras la ejecucion del classifier

Validacion:

- runtime check (`check_ops_runtime.sh audit`) ejecutado tras el cambio: `errors=0 warnings=0`
- primera ejecucion automatica con el horario corregido: completada correctamente
- salida del dia verificada: `.deny-audit-ips.proposed.conf`, `.blocker-diff.txt`, `.ips.json` presentes
- Carril A escribio `/etc/nginx/deny-audit-ips.conf` y ejecuto reload correctamente

Impacto operativo:

- pipeline perimetral AUDIT completamente operativo end-to-end por primera vez en modo automatico real
- orden garantizado: normalizer → classifier (07:10) → blocker (07:30) → nginx actualizado diariamente
- el blocker ya no depende de ejecucion manual; el ciclo completo es autonomo bajo systemd

Lecciones:

- un timer bien configurado aisladamente puede ocultar una dependencia temporal con otro componente del pipeline hasta que se active el modo real; en DRY-RUN, el fallo por `summary not found` podia no ser evidente si la ejecucion manual usaba `--date` con ficheros ya existentes
- la dependencia temporal entre stages del pipeline debe documentarse explicita y operativamente en cada timer, no solo en los READMEs
- el runtime check es la herramienta correcta para detectar este tipo de problema en modo automatico: una vez corregido el timer, `errors=0 warnings=0` confirma el cierre

Recomendacion operativa:

- cualquier timer de un componente que dependa de un artefacto de un stage previo debe configurarse con al menos 15-20 minutos de margen sobre el horario esperado del componente anterior
- en TEST el timer del blocker esta configurado a `05:45 UTC`; si el classifier de TEST cambia su horario, debe revisarse si sigue habiendo margen suficiente


## Cierre prematuro de WebSocket /messages tras login por guard RequireRole

Fecha: `2026-04-26`.

### 1. Resumen

El canal `wss://*.sharemechat.com/messages` se cerraba de forma prematura inmediatamente despues de que el usuario completaba el login y llegaba al dashboard. El comportamiento era reproducible de forma fiable en Firefox. La causa no estaba ni en el backend, ni en la capa edge, ni en el transporte WebSocket, sino en como `RequireRole` reaccionaba al estado de sesion durante una segunda llamada a `loadMe` desencadenada automaticamente por el router.

### 2. Sintoma

- Consola del navegador (Firefox): `WebSocket is closed before the connection is established`
- Consola del navegador: `[CALL][cleanup] reason= forced-end`
- El canal `wss://*/messages` intentaba abrirse, se cerraba de inmediato y no volvia a abrirse
- Login REST y `/api/users/me` respondian siempre `200`; no habia `401` ni `auth:logout`
- El problema era consistente en Firefox y de aparicion intermitente en Chromium segun velocidad de carga

### 3. Causa raiz

El flujo de login ejecutaba dos llamadas consecutivas a `loadMe` sobre `SessionProvider`:

1. Llamada manual: `await refresh()` dentro de `LoginModalContent` tras `POST /api/auth/login` exitoso
2. Llamada automatica: `SessionProvider` escucha cambios de `location.pathname` via `useEffect([location?.pathname])`; la navegacion a la ruta del dashboard tras el login disparaba esta segunda llamada

La segunda llamada ejecutaba `setLoading(true)` mientras `user` ya estaba establecido. En ese momento, `RequireRole` evaluaba:

```jsx
if (loading) return null;  // guard original
```

Al devolver `null`, React desmontaba el arbol de componentes protegido, incluyendo `DashboardModel`. El efecto de limpieza al desmontar ejecutaba `stopAll()`, que a su vez llamaba a `handleCallEnd(true)` y `closeMsgSocket()`. Esto cerraba el WebSocket `/messages` recien abierto antes de que el handshake se consolidara.

La condicion original no distinguia entre `loading` con sesion ausente (bootstrap inicial legitimo) y `loading` con sesion ya disponible (revalidacion en caliente). Ambos casos terminaban desmontando el dashboard.

### 4. Solucion aplicada

Cambio en `frontend/src/components/RequireRole.jsx`, una linea:

```jsx
// Antes:
if (loading) return null;

// Despues:
if (loading && !user) return null;
```

Con esta condicion, `RequireRole` solo suspende el render cuando no existe sesion establecida. Si el usuario ya esta autenticado y `loadMe` esta revalidando en segundo plano, el arbol del dashboard permanece montado y el WebSocket `/messages` no recibe la señal de cierre.

No se modifico `SessionProvider`, `DashboardModel`, `msgSocketEngine` ni ningun componente de backend, edge o transporte.

### 5. Resultado

- WebSocket `/messages` queda establemente conectado tras el login en Firefox, Chrome y Edge
- `[CALL][cleanup] reason= forced-end` deja de aparecer en el flujo normal de entrada al dashboard
- La segunda llamada a `loadMe` no produce desmontaje visible del dashboard ni interrupciones del canal realtime
- Build `npm run build` completado sin errores ni advertencias nuevas (advertencias previas preexistentes sin cambio)
- Validado en `test.sharemechat.com` y `audit.sharemechat.com`

### Routing /sitemap.xml y /robots.txt en CloudFront TEST

Se intentó el routing edge para los nuevos endpoints SEO del CMS (Frente 2 sobre Fase 4A) en TEST. La parte CloudFront se aplicó con éxito y la distribución alcanzó `Deployed`, pero la validación final reveló que el cambio CloudFront por sí solo no es suficiente: nginx en la EC2 backend (`api-test-backend`, host `api.test.sharemechat.com`) no tiene `location` blocks que hagan `proxy_pass` para `/sitemap.xml` ni `/robots.txt`, devolviendo `404` al edge. CloudFront aplica entonces `CustomErrorResponses 404 -> /index.html (200)` y sirve el shell del SPA con `Content-Type: text/html`, que es peor para los crawlers que el estado pre-fix. Conforme a la regla de rollback ante validación final negativa, se restauró la `DistributionConfig` previa.

Contexto:

- backend Spring Boot ya expone `GET /sitemap.xml` y `GET /robots.txt` desde `SitemapController` (Frente 2), con XML dinámico y robots.txt con directiva `Sitemap:` absoluta resuelta vía `app.public.base-url` (ADR-015)
- bucket S3 del frontend (`sharemechat-frontend-test`) contiene `frontend/public/robots.txt` heredado de Create React App (`User-agent: *\nDisallow:`) y NO contiene `sitemap.xml`
- distribución CloudFront pública del entorno TEST con dos origenes: `api-test-backend` (custom origin → `api.test.sharemechat.com`) y `sharemechat-frontend-test.s3.eu-central-1.amazonaws.com-mjoiq0nk37l` (S3 + OAC)
- `DefaultCacheBehavior` apunta a S3 con la CloudFront Function `redirect-spa-test` asociada en `viewer-request` (ver sección anterior)
- `CustomErrorResponses` con un único item: `404 -> /index.html (200)`

Síntomas observados pre-fix:

- `GET https://test.sharemechat.com/sitemap.xml` → `403` con cuerpo `<Error><Code>AccessDenied</Code></Error>` y `server: AmazonS3`. El path caía en el `DefaultCacheBehavior`, llegaba a S3 vía OAC, el objeto no existía y S3 devolvía `403` (no `404`, comportamiento conocido con OAC). El `CustomErrorResponse 404` no disparaba.
- `GET https://test.sharemechat.com/robots.txt` → `200` con el placeholder estático de CRA, sin directiva `Sitemap:`, sin `Disallow: /api`. CloudFront servía el objeto desde S3 (la `redirect-spa-test` tiene `/robots.txt` como passthrough explícito, así que la URI no se reescribe a `/index.html`).

Diagnóstico:

- el SEO mínimo backend está bien implementado y compila correctamente (`mvn -DskipTests compile` → `BUILD SUCCESS`); el problema es de routing de capas
- existían dos capas que enrutaban estas paths al sitio incorrecto:
  - capa 1 (CloudFront): `DefaultCacheBehavior` enviaba `/sitemap.xml` y `/robots.txt` al origen S3 en vez de al backend
  - capa 2 (nginx en EC2): no expone `location /sitemap.xml` ni `location /robots.txt`; cualquier petición que llegue a nginx con esos paths cae en la `location /` por defecto y devuelve `404` sin alcanzar a Spring Boot
- la asimetría con `/api/*`, `/match*`, `/messages*`, `/uploads/*`, `/assets/*` es estructural: esos cinco paths sí tienen behavior CloudFront a backend Y `location` block en nginx; los nuevos endpoints SEO no tenían ninguno de los dos

Cambio aplicado y propagado en CloudFront:

- entorno: TEST
- distribución: `E2Q4VNDDWD5QBU` (alias `test.sharemechat.com`, `www.test.sharemechat.com`)
- backup completo de `DistributionConfig` previo guardado en `.cf-backups/cf-test-E2Q4VNDDWD5QBU-20260507T183511Z.json` con `ETag` previo `EXJPJUCNJGXOM`
- añadidos dos `CacheBehaviors` con `TargetOriginId=api-test-backend`, `CachePolicyId=4135ea2d-6df8-44a3-9df3-4b5a84be39ad` (`Managed-CachingDisabled`), `OriginRequestPolicyId=b689b0a8-53d0-40ab-baf2-68738e2966ac` (`Managed-AllViewerExceptHostHeader`), `AllowedMethods=[GET, HEAD]`, `CachedMethods=[GET, HEAD]`, `Compress=true`, `ViewerProtocolPolicy=redirect-to-https`, sin `FunctionAssociations` ni `LambdaFunctionAssociations`
- primera iteración con `PathPattern` literal `sitemap.xml` y `robots.txt` (sin slash inicial, según las indicaciones del runbook): la propagación llegó a `Deployed` pero las peticiones seguían cayendo en el `DefaultCacheBehavior`. La capa edge no estaba matcheando los patrones sin slash en esta distribución
- segunda iteración con `PathPattern` `/sitemap.xml` y `/robots.txt` (consistente con `/api/*`, `/messages*`, etc.): tras `Deployed`, los patterns SÍ matchean y CloudFront enruta al backend
- invalidaciones creadas para `/sitemap.xml` y `/robots.txt` en ambas iteraciones

Validación final post-cambio (con la segunda iteración aplicada y propagada):

- `GET /sitemap.xml` → `200` con `content-type: text/html`, `server: AmazonS3`, body = shell SPA (`<title>Sharemechat</title>...`), `x-cache: Error from cloudfront`, `etag` coincidente con el `index.html` del bucket frontend
- `GET /robots.txt` → idéntica respuesta: `200`, `text/html`, body shell SPA, `Error from cloudfront`
- interpretación: CloudFront enruta correctamente al backend, el backend (vía nginx) devuelve `404`, y el `CustomErrorResponse 404 -> /index.html (200)` global sirve la SPA desde S3 con código `200`. El comportamiento es funcionalmente peor que el estado pre-fix: un crawler recibe `200 text/html` para `/sitemap.xml`, lo que se interpreta como un sitemap presente pero malformado
- `api.test.sharemechat.com` no es accesible directamente desde fuera de CloudFront (security group restringido a rangos de edge), por lo que la verificación de la respuesta cruda del origen no fue posible desde el equipo de operación; la inferencia del 404 nginx se basa en los headers del response final (`server: AmazonS3` + `x-cache: Error from cloudfront` + body `index.html`)

Rollback aplicado:

- `aws cloudfront update-distribution --if-match E2YI48EGZDOLVF` con la `DistributionConfig` del backup
- distribución vuelve a `Deployed` con seis `CacheBehaviors` originales y `ETag=E3586FMDDXN344`
- estado post-rollback validado: `/sitemap.xml` → `403 application/xml` (S3 AccessDenied, mismo que pre-fix); `/robots.txt` → `200 text/plain` con el placeholder de CRA (`User-agent: *\nDisallow:`), mismo que pre-fix
- backup permanece en `.cf-backups/` para reaplicar el cambio cuando nginx esté nivelado

Lecciones:

- la nivelación de un endpoint nuevo entre capas (CloudFront → nginx → backend) debe planificarse como tres acciones coordinadas, no como una sola: añadir behavior CloudFront, añadir `location` nginx con `proxy_pass`, deployar la JAR Spring Boot con el controller. Cualquiera de las tres aislada deja al sistema en un estado mixto que puede ser peor que el pre-fix
- `CustomErrorResponses 404 -> /index.html (200)` es seguro mientras el `404` venga del bucket S3 sobre rutas SPA, pero degrada a "200 con contenido HTML inesperado" cuando el `404` viene del backend sobre rutas no-SPA. Para endpoints públicos no-SPA (sitemap, robots, futuras well-known) habría que evaluar si conviene excluirlos del `CustomErrorResponse` global o si nginx debe garantizar respuestas 2xx/5xx limpias antes
- los `PathPattern` exactos (`sitemap.xml` vs `/sitemap.xml`) NO son intercambiables en esta distribución a pesar de la documentación AWS; el patrón debe llevar leading slash, consistente con el resto de behaviors del proyecto. Esta observación queda documentada para futuros runbooks operativos
- el origen `api-test-backend` no es accesible directamente fuera de CloudFront, lo que dificulta validar la capa nginx en aislamiento desde un equipo de oficina; cualquier diagnóstico de routing nginx tiene que pasar por SSH a la EC2 o por un curl con `--resolve` desde un origen autorizado

Recomendación operativa:

- antes de reaplicar el routing CloudFront para `/sitemap.xml` y `/robots.txt` en TEST (y, por extensión, en AUDIT y PRO cuando corresponda), añadir en nginx de la EC2 backend dos `location` blocks que hagan `proxy_pass http://127.0.0.1:8080/<path>;` con las mismas cabeceras `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` que ya usan `/api/`, `/match`, `/messages`. La pieza CloudFront por sí sola no soluciona el problema; la pieza nginx por sí sola tampoco (CloudFront seguiría enviando a S3). Las dos en conjunto son condición necesaria
- una vez nginx esté nivelado, repetir exactamente el patrón aplicado en este intento: dos `CacheBehaviors` con `PathPattern=/sitemap.xml` y `/robots.txt`, leading slash, origen `api-test-backend`, mismas policies que `/api/*`, `AllowedMethods=[GET, HEAD]`, `Compress=true`, `ViewerProtocolPolicy=redirect-to-https`, sin function associations, seguidas de invalidación para los dos paths
- mantener los stubs versionados de las dos iteraciones de `DistributionConfig` en `.cf-backups/` solo hasta que el reaplicado se confirme; pasada esa validación, archivarlos
- considerar añadir a la guía de provisión de entornos nuevos un checklist de "cuando se introduce un endpoint público no-SPA": (a) controller backend, (b) location nginx, (c) cache behavior CloudFront, (d) invalidación, (e) validación curl desde fuera; los cuatro pasos en orden, validando cada uno antes de avanzar al siguiente

Reaplicación coordinada (2026-05-08):

- Fase 1 (nginx EC2 TEST): aplicada manualmente por el operador. Dos `location = /sitemap.xml { proxy_pass http://localhost:8080; ... }` y `location = /robots.txt { proxy_pass http://localhost:8080; ... }` añadidos al server `api.test.sharemechat.com` en `/etc/nginx/conf.d/api.test.sharemechat.com.conf`, justo antes del `location / { return 404; }` final, replicando el bloque de cabeceras de `location /api/` (con `proxy_hide_header` para CSP/HSTS/etc.). Backup en EC2 conservado como `.bak-seo-20260507`. Validación local en EC2: `curl -k -H "Host: api.test.sharemechat.com" https://127.0.0.1/sitemap.xml` → 200 + XML válido; `curl -k -H "Host: api.test.sharemechat.com" https://127.0.0.1/robots.txt` → 200 + texto plano con la directiva `Sitemap:`.
- Fase 2 (CloudFront): aplicada vía `aws cloudfront update-distribution` en la distribución TEST, desde `ETag` previo `E3586FMDDXN344` al nuevo `ETag=EW7QESF4JEXSY`. Se añadieron dos `CacheBehaviors` con `PathPattern=/sitemap.xml` y `/robots.txt`, `TargetOriginId=api-test-backend`, `CachePolicyId=4135ea2d-6df8-44a3-9df3-4b5a84be39ad` (Managed-CachingDisabled, mismo que `/api/*`), `OriginRequestPolicyId=b689b0a8-53d0-40ab-baf2-68738e2966ac` (Managed-AllViewerExceptHostHeader), `AllowedMethods=[GET, HEAD]`, `CachedMethods=[GET, HEAD]`, `ViewerProtocolPolicy=redirect-to-https`, `Compress=true`, sin `FunctionAssociations` ni `LambdaFunctionAssociations`. Backup pre-fase2 guardado en `.cf-backups/cf-test-E2Q4VNDDWD5QBU-pre-fase2-20260508T142546Z.json`. Tras `Status=Deployed`, invalidación creada para `/sitemap.xml` y `/robots.txt`.
- Validación end-to-end:
  - `GET https://test.sharemechat.com/sitemap.xml` → `HTTP/2 200`, `content-type: application/xml;charset=UTF-8`, `server: nginx/1.28.0`, `cache-control: public, max-age=3600`, body `<urlset>` con la home del blog y los artículos publicados (`pagos-modelos-plataformas`, `videochat-seguro-guia`).
  - `GET https://test.sharemechat.com/robots.txt` → `HTTP/2 200`, `content-type: text/plain;charset=UTF-8`, `server: nginx/1.28.0`, `cache-control: public, max-age=86400`, body con `User-agent: *`, `Allow: /blog`, `Disallow: /api/`, `Disallow: /admin`, `Disallow: /dashboard`, `Disallow: /login`, `Disallow: /register`, `Sitemap: https://test.sharemechat.com/sitemap.xml`.
  - Idéntica respuesta con UA `Googlebot/2.1`.
  - El antiguo `robots.txt` placeholder de Create React App (objeto en S3 frontend) sigue en el bucket pero ya no se sirve por la URL pública de TEST: el behavior `/robots.txt` matchea antes que el default y enruta al backend.
- Detalle residual conocido (no bloqueante, sin acción inmediata):
  - `HEAD /sitemap.xml` y `HEAD /robots.txt` devuelven `401`. Causa: `SecurityConfig` permite explícitamente `HttpMethod.GET` para esos paths pero no `HEAD`, por lo que la cadena cae en `.anyRequest().authenticated()`. Los crawlers de buscadores usan `GET` para indexar, así que la indexación no se ve afectada. Pendiente: cuando convenga, sustituir `HttpMethod.GET` por la pareja `(HttpMethod.GET, HttpMethod.HEAD)` en la directiva de SecurityConfig línea 69, o aceptar el comportamiento si se considera intencional (cookie/JWT validation defensiva).

### Cierre deuda cache policy /.well-known/acme-challenge/* en CloudFront TEST

Cambio operativo aplicado el 2026-05-20 ~17:42 UTC para cerrar la deuda anotada en [known-debt.md](known-debt.md) desde el 2026-05-09 (paquete 10.A.0, primer paso del frente 10.A de nivelación AUDIT). El behavior `/.well-known/acme-challenge/*` en la distribución CloudFront TEST `E2Q4VNDDWD5QBU` pasa de `Managed-CachingOptimized` (`658327ea-f89d-4fab-a63d-7e88639e58f6`, DefaultTTL=86400s) a `Managed-CachingDisabled` (`4135ea2d-6df8-44a3-9df3-4b5a84be39ad`, TTL=0) para alinearse con el patrón canónico ACME y eliminar el riesgo acotado de que un 404 transitorio o un 5xx en una renovación quede cacheado.

Contexto investigado (fase 1, read-only) antes de aplicar:

- backend Spring Boot: cero referencias a `acme-challenge` o `well-known` en `src/`; no participa
- nginx en EC2 TEST: `location ^~ /.well-known/acme-challenge/ { root /usr/share/nginx/html; default_type text/plain; try_files $uri =404; }` activo en `/etc/nginx/nginx.conf` (no en el vhost), webroot operativo
- Certbot: `certbot 2.6.0` instalado, `certbot-renew.timer` diario activo (próxima ejecución periódica al día siguiente del cambio; renovación efectiva real estimada ~2026-05-27 cuando ambos certs entren en ventana de 30 días previa a expiración 2026-06-26)
- dos certificados Let's Encrypt activos en TEST:
  - `test.sharemechat.com`: `authenticator=webroot`, `webroot_path=/usr/share/nginx/html`. Dominio detrás de CloudFront; las renovaciones futuras pasan por el behavior corregido en este cambio
  - `api.test.sharemechat.com`: `authenticator=nginx`. Dominio del origen directo, no pasa por CloudFront, no se ve afectado por el behavior
- ACM (us-east-1): certificados gestionados por Amazon para los frentes CloudFront (`*.test.sharemechat.com` wildcard y otros), validación DNS automática; sin relación con la deuda
- validación funcional pre-cambio: `curl -is https://test.sharemechat.com/.well-known/acme-challenge/probe-<rand>` devolvía `HTTP/2 404` desde nginx (`server: nginx/1.28.0`), confirmando que CloudFront proxyea correctamente al origen y la ruta no estaba rota

Cambio aplicado:

- entorno: TEST
- distribución: `E2Q4VNDDWD5QBU` (alias `test.sharemechat.com`, `www.test.sharemechat.com`)
- ETag previo: `E2NEU26H0UBU3V`
- ETag posterior: `E1Z8RZ5B6MIFUG`
- comando: `aws cloudfront update-distribution --id E2Q4VNDDWD5QBU --if-match E2NEU26H0UBU3V --distribution-config file://cf-test-new.json` (con `DistributionConfig` exportado de `get-distribution-config`, modificado el `CachePolicyId` del behavior `/.well-known/acme-challenge/*`, sin tocar nada más; JSON re-emitido con UTF-8 sin BOM por compatibilidad con AWS CLI v2 en Windows)
- propagación: distribución pasó de `InProgress` a `Deployed` en ~3 min (193 s polled cada 30 s)
- backup del `DistributionConfig` previo conservado localmente (no commiteado al repo)

Validación post-cambio:

- `aws cloudfront get-distribution-config --id E2Q4VNDDWD5QBU --query "DistributionConfig.CacheBehaviors.Items[?PathPattern=='/.well-known/acme-challenge/*'].[PathPattern,CachePolicyId]" --output text` → `/.well-known/acme-challenge/*	4135ea2d-6df8-44a3-9df3-4b5a84be39ad` (confirma cache policy aplicada)
- `curl -is https://test.sharemechat.com/.well-known/acme-challenge/probe-post-<rand>` → `HTTP/2 404`, `server: nginx/1.28.0`, `x-cache: Error from cloudfront`. La petición llega al origen igual que antes; CloudFront no cachea
- el resto de behaviors (api, match, messages, uploads, assets, sitemap, robots) intactos: el `DistributionConfig` se editó solo en el campo `CachePolicyId` del behavior acme-challenge
- ningún cambio en nginx, backend, S3, certbot ni en otros entornos

Lecciones / pendientes:

- la deuda análoga en AUDIT (`E1ILXV7P6ENUV8`) y en cualquier distribución PRO futura debe revisarse al inventariar esos entornos: si replican el mismo patrón `Managed-CachingOptimized` en el behavior acme-challenge, aplicar la misma corrección. Esto queda agendado dentro del paquete 10.A.1+ (nivelación AUDIT)
- el bucket de Certbot en TEST es híbrido (un cert por webroot detrás de CloudFront, otro por nginx directo). El runbook ausente "Renovación de certificados por entorno" sigue siendo deuda documental que se cerrará cuando se aborde explícitamente
- el cambio en sí es un caso textbook de "cache policy correcta para una ruta dinámica"; no requirió coordinación entre capas porque nginx y backend ya hacían lo correcto. Útil como referencia para validar que el patrón se repite en AUDIT y PRO

### Pre-flight AUDIT 2026-05-21 (paquete 10.A.1)

Inventario y acciones no destructivas previas a la nivelación AUDIT al estado actual de TEST (frente 10.A). Se prepara el terreno para 10.A.2 (corrección CloudFront AUDIT) y 10.A.3 (Flyway baseline + V2 + JAR nuevo + .env ampliado) sin tocar todavía la realidad operativa de AUDIT (backend, schema BD ni CloudFront).

Pre-condiciones confirmadas:

- SSH alias `audit-backend` añadido a `~/.ssh/config` del operador, apuntando a la EC2 AUDIT con la misma clave .pem que `test-backend`. Verificado con `ssh audit-backend "echo ok"`.
- Mapping local `~/.sharemechat/state-mapping.yaml` actualizado: bloque `audit:` rellenado con las 3 distribuciones CloudFront (`frontend_public=E1ILXV7P6ENUV8`, `backoffice_admin=E21IB0VBKYNNBW`, `assets_canonical=E2NC4TEJAWOI3L`), 6 buckets S3 (los 5 preexistentes más el nuevo `content_private`), `audit-backend` como alias SSH, endpoint RDS real, schema `db1_sharemechat_audit`, y la Function `redirect-spa-audit` ya asociada al `viewer-request` del `DefaultCacheBehavior` de `frontend_public`. Bloque `pro:` intacto.
- BD AUDIT pre-Flyway confirmado vía `mysql` desde la EC2 AUDIT (acceso resuelto sourceando `/opt/sharemechat/.env` igual que hace systemd; `DB_PASSWORD` viene con comillas dobles en el `.env` y necesita ese tratamiento, no `grep | cut`): MySQL 8.4.7, 43 tablas en `db1_sharemechat_audit`, cero tablas `content_*`, no existe `flyway_schema_history`. Esto coincide con la pre-condición del runbook `cms-v2-flyway-introduction.md`.

Acciones aplicadas:

- **Bucket S3 nuevo `sharemechat-backups`** (multi-env, eu-central-1) para backups operativos del proyecto. Block Public Access total, SSE-S3 AES256 + BucketKey, versionado `Enabled`, lifecycle `expire-90d` (current 90 días, noncurrent 30 días). Convenido prefijo por entorno: `s3://sharemechat-backups/audit/`, `/test/`, `/pro/`.
- **Backup completo BD AUDIT** generado con `mysqldump --single-transaction --routines --triggers --events --hex-blob --set-gtid-purged=OFF` desde la EC2 AUDIT, comprimido con gzip y subido a `s3://sharemechat-backups/audit/audit-backup-2026-05-20-2119.sql.gz`. Tamaño 128906 bytes. SHA256 `79f84a85f97446f010b64a514ec71f27c7b122f6ced5b4228fbe3ad5b6b491f8`. Integridad verificada (sha256sum coincidente entre EC2 origen y portátil local antes del upload). Upload realizado desde local (`sharemechat-deployer`) porque el instance profile de la EC2 AUDIT no tiene permisos sobre el bucket de backups.
- **Bucket S3 nuevo `sharemechat-content-private-audit`** (eu-central-1) para el CMS bilingüe del entorno. Replica la configuración del bucket equivalente de TEST: Block Public Access total, SSE-S3 AES256 + BucketKey, sin policy de bucket (acceso por IAM role del instance profile, no por bucket policy), sin CloudFront ni OAC. Bucket queda vacío, listo para recibir el árbol `content/articles/{id}/draft.md` y `v{n}.md` cuando 10.A.3 deje el CMS operativo en AUDIT.
- **Policy IAM inline `SharemechatContentPrivateAuditRW`** aplicada por el operador al role `sharemechat-ec2-audit-role` desde la consola IAM (el usuario `sharemechat-deployer` no tiene permisos IAM). Réplica literal de la policy `SharemechatContentPrivateTestRW` del role TEST, cambiando `content-private-test` por `content-private-audit`. Cubre `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` sobre `arn:aws:s3:::sharemechat-content-private-audit/*` y `s3:ListBucket` sobre `arn:aws:s3:::sharemechat-content-private-audit`. El role queda con 3 policies adjuntas: `sharemechat-audit-access-normalizer-s3` (preexistente, pipeline perimetral), `sharemechat-s3-storage-audit-inline` (preexistente, uploads sensibles) y `SharemechatContentPrivateAuditRW` (nueva).
- **Smoke test de escritura** desde la EC2 AUDIT al bucket nuevo: `aws s3 cp /tmp/probe.txt s3://sharemechat-content-private-audit/test/probe.txt` → `upload OK`; `aws s3 ls` → objeto visible (24 bytes); `aws s3api head-object` confirma `ServerSideEncryption: AES256`; `aws s3 rm` → delete OK. Las 4 actions (`PutObject`, `ListBucket`, `GetObject` implícito en head, `DeleteObject`) funcionan con el instance profile actual.
- **Snapshot YAML** del estado pre-cambio AUDIT generado en `docs/_snapshots/state-audit-2026-05-21-1503.yaml`. Schema v3. Marcado como generado manualmente fuera del flujo automatizado de la skill `state-inventory` (campos `repo.commits_last_24h` y `repo.adrs` vacíos por no ser relevantes para el pre-flight; los bloques de `content_articles` y `content_review_events` se reportan como `null` porque las tablas no existen todavía en AUDIT, las crea V2 en 10.A.3).

Estado pre-cambio de CloudFront AUDIT (`E1ILXV7P6ENUV8`, ETag `E3UN6WX5RRO2AG`) — bugs latentes confirmados, **se atajan en el paquete 10.A.2**:

- behavior `/.well-known/acme-challenge/*` con `CachePolicyId=658327ea-…` (`Managed-CachingOptimized`). Mismo bug que el corregido en TEST el 2026-05-20. Aplica el mismo fix.
- `CustomErrorResponses` con dos entradas: `403 → /index.html (200)` y `404 → /index.html (200)`. Mismo bug que el corregido en TEST el 2026-05-17. La Function `redirect-spa-audit` ya está asociada al `DefaultCacheBehavior` en `viewer-request`, así que eliminar ambos `CustomErrorResponses` es seguro siguiendo la misma lección del hotfix TEST.
- No hay behaviors `/sitemap.xml` ni `/robots.txt` (correcto: AUDIT no es entorno editorial hoy; no se añaden en 10.A.2).

Hallazgos colaterales relevantes para 10.A.3 (no se actúan en 10.A.1):

- **Ruta del JAR en AUDIT**: `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar`, no `/opt/sharemechat/`. El `.env` sí está en `/opt/sharemechat/.env`. El despliegue del JAR nuevo en 10.A.3 debe usar la ruta real, no la que asumía el plan 10.A.plan.
- **`.env` AUDIT** no tiene las tres keys del CMS bilingüe: `APP_STORAGE_S3_CONTENT_PRIVATE_BUCKET`, `APP_STORAGE_S3_CONTENT_PRIVATE_KEY_PREFIX`, `APP_STORAGE_S3_CONTENT_REGION`. Hay que añadirlas en 10.A.3 antes de reiniciar el backend, apuntando al bucket recién creado en este paquete.
- **JAR actual en AUDIT** es del 2026-05-02 09:55 UTC (`Implementation-Version: 0.0.1-SNAPSHOT`, Spring Boot 3.5.5). El systemd `sharemechat-audit.service` lleva activo desde el 2026-05-02 10:09 UTC (≥18 días sin reboot). Confirma que AUDIT no ha recibido el JAR desde antes de ADR-025 (2026-05-16) y antes del paquete 8 (2026-05-20).
- **Certbot en AUDIT** gestiona solo `api.audit.sharemechat.com` (`authenticator=nginx`, expira 2026-07-09 / ~50 días). El dominio público `audit.sharemechat.com` vive de ACM en us-east-1 (validación DNS automática). `systemctl list-timers --all | grep cert` no devuelve nada, así que el mecanismo de renovación automática de este cert Let's Encrypt está sin verificar; no urgente, no bloquea 10.A.1 ni 10.A.3.
- **Pipeline perimetral AUDIT** (`audit-access-{normalizer,classifier,reporter,blocker}.service`): según el `list-units`, las units están en `inactive dead` (excepto classifier que aparece `not-found`). Es consistente con units `Type=oneshot` arrancadas por timer y vivas sólo durante su ejecución; no es necesariamente un fallo. No se ha verificado el estado de los timers en este pre-flight.
- **Asimetría observada (sin acción)**: AUDIT tiene bucket `sharemechat-cf-logs-audit` para logs CloudFront; TEST no tiene equivalente versionado. Es asimetría intencional o histórica, no deuda.

Lecciones:

- `EnvironmentFile` de systemd recorta automáticamente las comillas dobles externas en los valores del `.env`; cualquier acceso manual desde shell debe sourcear el fichero (`set -a; source /opt/sharemechat/.env; set +a`) en lugar de extraer valores con `grep | cut`, o las comillas se quedan dentro y se rompe la autenticación.
- el upload de backups a S3 hay que hacerlo desde el equipo del operador (`sharemechat-deployer`), no desde la EC2: el instance profile del backend no tiene permisos sobre el bucket de backups, y dárselos sería innecesario (el backend no necesita escribir en el bucket de backups). Si en el futuro se quiere automatizar el backup desde la propia EC2, se ampliará la policy del role; por ahora el flujo manual basta.
- aplicar policy IAM nueva a un role debe hacerse desde la consola web por el propietario de la cuenta cuando el usuario operativo (`sharemechat-deployer`) no tiene `iam:*`. El procedimiento exacto se documentó en este turno como referencia para el siguiente paquete (10.A.2 no necesita IAM, pero 10.A.3+ podría requerirlo si se descubre alguna policy que ampliar).

### Fix CloudFront AUDIT 2026-05-21 (paquete 10.A.2)

Cambio operativo aplicado el 2026-05-21 ~15:28 UTC para cerrar los dos bugs latentes confirmados en el pre-flight 10.A.1 (segundo paso del frente 10.A de nivelación AUDIT, replicación pura de cambios ya validados en TEST). Un único `aws cloudfront update-distribution` sobre `E1ILXV7P6ENUV8` aplica los dos fixes simultáneamente: cache policy del behavior `/.well-known/acme-challenge/*` pasa de `Managed-CachingOptimized` (`658327ea-…`) a `Managed-CachingDisabled` (`4135ea2d-…`), y `CustomErrorResponses.Quantity` pasa de `2` a `0` (eliminadas las dos entradas `403 → /index.html (200)` y `404 → /index.html (200)`). Sin tocar nada más de la distribución.

Estado pre-cambio confirmado (ETag `E3UN6WX5RRO2AG`):

- behavior `/.well-known/acme-challenge/*` con `CachePolicyId=658327ea-f89d-4fab-a63d-7e88639e58f6` (`Managed-CachingOptimized`)
- `CustomErrorResponses.Quantity=2` con `403 → /index.html (200)` y `404 → /index.html (200)`
- precondición confirmada: `redirect-spa-audit` Function asociada al `viewer-request` del `DefaultCacheBehavior` con `FunctionARN=arn:aws:cloudfront::430118829334:function/redirect-spa-audit`

Validación funcional pre-cambio (refuerza la urgencia del fix 2):

- `curl -is https://audit.sharemechat.com/.well-known/acme-challenge/probe-pre-<rand>` → **`HTTP/2 200` + `index.html` desde S3** (`server: AmazonS3`, `etag: "0f990022da49554a4ec8cc01340c0a4f"`, `x-cache: Error from cloudfront`, `last-modified` del bucket frontend). Confirma que `CustomErrorResponses 404 → /index.html` estaba enmascarando el 404 del backend nginx y que **una renovación HTTP-01 vía CloudFront en AUDIT ahora mismo fallaría** porque Let's Encrypt recibiría 200 HTML del SPA en lugar del token. El cert público `audit.sharemechat.com` vive de ACM (validación DNS automática) y no usa esta ruta, así que el bug no se materializaba en una rotura visible, pero el camino HTTP-01 vía edge quedaba roto silenciosamente.
- `curl -is https://audit.sharemechat.com/api/public/content/articles/no-existe-pre-<rand>?locale=es` → `HTTP/2 401` desde el backend (`server: nginx/1.28.0`). El backend devuelve 401 porque `/api/public/content/**` no está completamente abierto en el JAR antiguo de AUDIT; `CustomErrorResponses` no intercepta 401 (solo 403/404), así que esta respuesta no estaba enmascarada.
- `curl -is https://audit.sharemechat.com/ruta-inexistente-pre-<rand>` → `HTTP/2 200` + `index.html` desde S3 con `x-cache: RefreshHit from cloudfront`. Este es comportamiento correcto: la Function `redirect-spa-audit` reescribe URIs sin extensión a `/index.html` para soporte SPA, sin pasar por origen y sin depender de `CustomErrorResponses`.

Cambio aplicado:

- entorno: AUDIT
- distribución: `E1ILXV7P6ENUV8` (alias `audit.sharemechat.com`)
- ETag previo: `E3UN6WX5RRO2AG`
- ETag posterior: `E1F83G8C2ARO7P`
- comando: `aws cloudfront update-distribution --id E1ILXV7P6ENUV8 --if-match E3UN6WX5RRO2AG --distribution-config file://cf-audit-new.json` (con `DistributionConfig` exportado de `get-distribution-config`, modificados solamente el `CachePolicyId` del behavior acme-challenge y el `CustomErrorResponses` (`Quantity=0` y array `Items` eliminado); JSON re-emitido con UTF-8 sin BOM por compatibilidad con AWS CLI v2 en Windows, mismo patrón operativo del paquete 10.A.0)
- propagación: distribución pasó de `InProgress` a `Deployed` en **32 s** (mucho más rápido que los 193 s de TEST en 10.A.0; ambos cambios eran exclusivamente metadata del behavior y de `CustomErrorResponses`, sin requerir invalidación de cache edge)
- backup del `DistributionConfig` previo conservado localmente (no commiteado al repo)

Validación post-cambio:

- API: `aws cloudfront get-distribution-config --id E1ILXV7P6ENUV8 --query "DistributionConfig.CacheBehaviors.Items[?PathPattern=='/.well-known/acme-challenge/*'].CachePolicyId" --output text` → `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`
- API: `aws cloudfront get-distribution-config --id E1ILXV7P6ENUV8 --query "DistributionConfig.CustomErrorResponses.Quantity" --output text` → `0`
- curl 1: `curl -is https://audit.sharemechat.com/.well-known/acme-challenge/probe-post-<rand>` → **`HTTP/2 404` desde nginx limpio** (`server: nginx/1.28.0`, body `<html><head><title>404 Not Found</title></head>...`, `x-cache: Error from cloudfront`). Eliminado el enmascaramiento. Si en el futuro AUDIT añadiera el `location /.well-known/acme-challenge/` en nginx (igual que TEST), la renovación HTTP-01 vía CloudFront funcionaría correctamente. Hoy no es necesario porque `audit.sharemechat.com` cubre con ACM y `api.audit.sharemechat.com` se renueva por nginx directo sin pasar por edge.
- curl 2: `curl -is https://audit.sharemechat.com/api/public/content/articles/no-existe-post-<rand>?locale=es` → `HTTP/2 401` igual que pre. Confirma que el comportamiento `/api/*` del backend no ha cambiado.
- curl 3: `curl -is https://audit.sharemechat.com/ruta-inexistente-post-<rand>` → `HTTP/2 200` + `index.html` con `x-cache: RefreshHit from cloudfront` igual que pre. **La Function `redirect-spa-audit` sigue gestionando el SPA-fallback correctamente**; eliminar `CustomErrorResponses` no rompe el SPA-routing, exactamente como predecía la lección operativa del hotfix TEST del 2026-05-17.

Lecciones / pendientes:

- el bug 2 (`CustomErrorResponses` enmascarando 404 del backend) **ya se manifestaba** en AUDIT, no era latente: cualquier intento de renovación HTTP-01 a través de CloudFront habría fallado silenciosamente. Anotarlo como dato relevante: cuando se detecta una deuda "no urgente" porque "no se manifiesta todavía", conviene verificar la asunción antes del fix; en este caso la asunción del 2026-05-17 de "no se manifiesta porque AUDIT no tiene endpoints públicos con path variable" era cierta para los endpoints REST, pero no para la ruta `acme-challenge` que sí estaba activa como behavior.
- en AUDIT no hay `location /.well-known/acme-challenge/` en nginx del backend (`api-audit-backend`), a diferencia de TEST que sí lo tiene en `/etc/nginx/nginx.conf:76`. Esto no es regresión: AUDIT no usa Certbot vía CloudFront actualmente. Se documenta como gap menor: si en el futuro se quisiera usar HTTP-01 vía CloudFront para un cert de `audit.sharemechat.com` (por ejemplo, si se decide salir de ACM), habría que añadir el `location` en nginx primero.
- la deuda análoga en una distribución PROD futura debe revisarse al crearla: la lección operativa de la regla "exclusivamente CloudFront Function en viewer-request para SPA-fallback, NUNCA `CustomErrorResponses` distribución-level para 403/404 → /index.html" queda explícita y debe estar reflejada en el runbook/ADR de despliegue PROD.
- el tiempo de propagación tan corto (32 s frente a 193 s del cambio análogo en TEST) sugiere que CloudFront optimiza más agresivamente cambios de metadata puros que no requieren purga de edge. No hay garantía de que esto se repita; el rango razonable a esperar sigue siendo 3-15 min.

### Página de mantenimiento: SPA overlay activa + bucket S3 preparado (paquete 10.A.3.pre)

Pre-requisito de 10.A.3: durante la ventana de parada del backend AUDIT para Flyway + JAR nuevo, los usuarios deben ver una indicación clara de mantenimiento en vez de errores feos. La realidad de la topología CloudFront (DefaultCacheBehavior sirve la SPA desde S3 sin tocar backend; solo behaviors `/api/*`, `/match*`, `/messages*`, `/uploads/*`, `/.well-known/acme-challenge/*`, `/assets/*`, `/sitemap.xml`, `/robots.txt` van al backend) cambia el diseño respecto al plan original. Se implementa una solución dual: capa SPA con interceptor + overlay (activa) + bucket S3 con HTML estático (preparado para uso futuro, no asignado a ningún behavior actualmente).

**Capa SPA (activa)**:

- `frontend/src/components/MaintenanceProvider.jsx` (nuevo, ~190 líneas): Context React + Provider con estado `active`. Escucha `window` evento `sharemechat:maintenance` (mismo patrón que `SessionProvider` con `auth:logout`). Cuando `active=true`, monta `setInterval` cada 30s que hace `fetch('/api/users/me')` directo (sin pasar por `apiFetch` para evitar loops). Si la respuesta lleva `Content-Type: application/json` (cualquier status, incluido 401/403), considera el backend recuperado y emite `active=false`. Renderiza `MaintenanceOverlay` interno (styled-components, z-index `2147483000`, bilingüe EN+ES hardcoded, marca "SHAREMECHAT" arriba, sin webfonts externos, sin imágenes, sin acciones). El overlay se hardcoded sin i18n porque un fallo de bootstrap del backend puede coincidir con i18n no inicializado.
- `frontend/src/config/http.js` (modificado): añadidas `isMaintenanceResponse(res)` y `notifyMaintenance(active)`. Tras `fetch(buildApiUrl(path))`, antes de la rama 401/403 con refresh, si la respuesta es 502/503/504 o `Content-Type: text/html`, se dispara `window.dispatchEvent('sharemechat:maintenance', { active: true })` y se lanza el error normalmente. La detección de HTML cubre dos casos: (a) 5xx directo del gateway antes de que CloudFront pudiera conmutar; (b) 200 HTML del bucket maintenance si en el futuro se asigna OriginGroup a algún behavior.
- `frontend/src/App.jsx` (modificado): nuevo wrapper `<MaintenanceProvider>` dentro del árbol existente (más interno que `ModalProvider` por convención del proyecto). Sustituye el fragmento `<>...</>` que envolvía el contenido del Router.
- Build: `npm run build` OK. Delta bundle gzipped: `main.js` +1 B, `572.chunk.js` −80 B. Sin warnings nuevos (solo los preexistentes del proyecto).

**Capa CloudFront / S3 (preparado, no asignado)**:

- Bucket S3 nuevo `sharemechat-maintenance` (multi-env, eu-central-1). PAB total, SSE-S3 AES256 + BucketKey, versionado `Enabled`, sin lifecycle. Convención de prefijo por entorno: `s3://sharemechat-maintenance/test/index.html` y `/audit/index.html`. Ambos objetos contienen el mismo HTML estático (`ops/maintenance/index.html` en el repo). `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store, max-age=0`, 1874 bytes.
- OAC nuevo `oac-sharemechat-maintenance` (id `EKY0V8P96XXWM`) para que CloudFront pueda leer el bucket vía sigv4 sin exposición pública.
- Bucket policy aplicada autorizando `s3:GetObject` desde las distribuciones CloudFront TEST (`E2Q4VNDDWD5QBU`) y AUDIT (`E1ILXV7P6ENUV8`) a través del OAC.
- Intento inicial de asignar OriginGroup (primario = backend EC2, secundario = bucket maintenance, failover 502/503/504) a los behaviors `/api/*`, `/uploads/*`, `/assets/*`, `/sitemap.xml`, `/robots.txt` falló con `InvalidArgument: The parameter AllowedMethods cannot include POST, PUT, PATCH, or DELETE for a cached behavior associated with an origin group`. Limitación documentada de CloudFront: OriginGroup solo admite GET/HEAD/OPTIONS. Eso excluye `/api/*` y `/uploads/*` (que necesitan escritura), que son justamente los behaviors críticos para detectar "backend caído" desde el SPA.
- Segundo intento aplicó OriginGroup solo a los behaviors GET/HEAD (`/assets/*`, `/sitemap.xml`, `/robots.txt`). Update OK (ETag `E1Z8RZ5B6MIFUG` → `E1R86WE7EQHGGU`, propagación 32 s). Validación funcional reveló segundo problema: con backend caído (la EC2 TEST estaba apagada por estado normal del entorno efímero), `curl /sitemap.xml` y `curl /robots.txt` devolvían `HTTP 403 + XML AccessDenied` desde S3 (`server: AmazonS3`) en lugar del HTML maintenance. Causa: el OriginGroup conmutó correctamente al secundario, pero el bucket solo tiene `/test/index.html`; al pedir `/test/sitemap.xml` o `/test/robots.txt`, S3 con OAC devuelve 403 para objetos inexistentes (no 404, comportamiento conocido). El bucket no puede servir el HTML maintenance para cualquier path sin pre-popular cada path posible o sin una CloudFront Function que reescriba la URI.
- Decisión: revertir CloudFront TEST al estado pre-cambio (`E1R86WE7EQHGGU` → `E2JF8D5JHXMIIC`, propagación 32 s). El bucket, el OAC y la bucket policy quedan creados como base para un diseño futuro más completo (por ejemplo, añadir CloudFront Function que reescriba toda URI a `/index.html` cuando se sirve desde el secundario). Distribución TEST vuelve a tener 2 origins y 0 origin groups, idéntica al estado pre-F2.
- AUDIT no se modifica en este paquete: la SPA con interceptor es la misma build para TEST y AUDIT (se desplegará en 10.A.3), y sin OriginGroup en TEST no tiene sentido replicar lo que no funciona.

Validación funcional post-revert (con backend TEST seguía caído):

- `curl /sitemap.xml` → `HTTP/2 504` desde CloudFront con HTML `Gateway Timeout` (estado normal de backend caído, no AccessDenied).
- `curl /api/users/me` → `HTTP/2 504` HTML. **El interceptor SPA detecta esto y dispara `sharemechat:maintenance active=true`** cuando se despliegue el frontend nuevo en 10.A.3.
- `curl /` → `HTTP/2 200 + index.html` del frontend S3 (DefaultBehavior no afectado).

Lecciones / pendientes:

- **CloudFront OriginGroup tiene una limitación dura**: solo behaviors con `AllowedMethods` ⊆ `{GET, HEAD, OPTIONS}` pueden tener OriginGroup. Esto choca frontalmente con el caso de uso típico de "failover para API REST", que casi siempre necesita POST/PUT/PATCH/DELETE. Es una restricción AWS, no del proyecto.
- **OAC + S3 + path inexistente = 403, no 404**: cualquier diseño que dependa de "el bucket sirve un mismo HTML para cualquier path" requiere o pre-popular paths o usar CloudFront Function de reescritura. Para PROD, si se reabre este frente, evaluar la opción CloudFront Function.
- **La SPA con interceptor cubre el caso de uso real**: durante ventana de mantenimiento, el usuario carga `/` (S3 directo, no afectado), la SPA arranca y al primer fetch a `/api/*` recibe 502/504/HTML, el interceptor activa el overlay full-screen y bloquea toda interacción. El poll cada 30s detecta recuperación cuando `/api/users/me` vuelve a responder JSON. No requiere ninguna acción manual ni en CloudFront ni en backend.
- **El bucket maintenance queda como red de seguridad ociosa**. Si en una sesión futura se quiere ofrecer también el HTML estático directo a curls externos (por ejemplo, para health-check de monitorización externo), basta con añadir CloudFront Function y reasignar OriginGroup a los behaviors GET/HEAD; toda la infraestructura ya está montada.
- Validación visual del operador (parada deliberada del backend para ver el overlay) queda diferida a 10.A.3, donde el backend AUDIT se parará intencionalmente para Flyway + V2 + JAR nuevo y la ventana es natural para ver el overlay en acción tras desplegar el frontend nuevo.

### Nivelación AUDIT cierre: Flyway baseline + V2 + JAR nuevo + .env ampliado 2026-05-22 (paquete 10.A.3)

Cuarto y último paso del frente 10.A. Ventana de mantenimiento del backend AUDIT ejecutada limpiamente, 77 segundos totales de backend abajo. Estado pre-cambio confirmado en el snapshot 10.A.1 (JAR del 2026-05-02, BD pre-Flyway con 43 tablas no-CMS y cero `content_*`, `.env` sin las tres keys del CMS bilingüe). Estado post-cambio: JAR del 2026-05-22 corriendo bajo systemd, schema BD con `flyway_schema_history` + 6 tablas `content_*`, `.env` ampliado.

**Fase 1 — Deploy frontend AUDIT (con backend arriba, red de seguridad activa antes de tocar nada)**:

- Build local con `npm run build:product` desde `frontend/`. Bundle nuevo: `main.12814779.js` (incluye `MaintenanceProvider` del paquete 10.A.3.pre).
- Deploy con `ops/scripts/deploy-frontend.ps1 audit product -SkipBuild`. Sync a `s3://sharemechat-frontend-audit/` (12.6 MiB), `index.html` con `Cache-Control: no-cache, no-store, must-revalidate` y `Content-Type: text/html; charset=utf-8`. Invalidación CloudFront `I4M2C4WB7HWDDPUNVE8VCKH5M0` sobre `E1ILXV7P6ENUV8` con paths `/*`.
- Validación con backend arriba: `curl https://audit.sharemechat.com/` → 200 con `index.html` que referencia `main.12814779.js` (igual que el build local). `curl /api/users/me` → 401 limpio. La SPA carga sin overlay falso (correcto).
- Nota operativa: el script `deploy-frontend.ps1` aborta con exit code 1 si npm escribe warnings por stderr (caso típico: `Browserslist: browsers data is X months old`), debido a `$ErrorActionPreference='Stop'`. Workaround usado: `npm run build:product` manual desde `frontend/`, luego `deploy-frontend.ps1 audit product -SkipBuild`. Deuda candidata a anotar si se repite en futuros despliegues.

**Fase 2 — `.env` ampliado y JAR nuevo subido (backend sigue arriba)**:

- Backup del `.env` actual a `/opt/sharemechat/.env.bak.10A3.2026-05-22` (1299 bytes, igual al original).
- Append de las tres keys del CMS bilingüe al `.env` (sin comillas dobles, según convención observada para valores simples):
  - `APP_STORAGE_S3_CONTENT_PRIVATE_BUCKET=sharemechat-content-private-audit`
  - `APP_STORAGE_S3_CONTENT_PRIVATE_KEY_PREFIX=content`
  - `APP_STORAGE_S3_CONTENT_REGION=eu-central-1`
- `scp` del JAR nuevo (106 MB, fecha 2026-05-22 19:31 local, SHA256 `7530b3b48e0bc5913ae9ef1d736c98b5fb72c45d0a3e0ba26fe1b6c346ec89ba`) a `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar.new` (20 segundos de transferencia). Checksum remoto idéntico al local. JAR antiguo del 2026-05-02 (82 MB) intacto en su sitio bajo el mismo nombre.

**Fase 3 — Ventana de mantenimiento (77 segundos totales)**:

- 18:31:00 UTC — `SPRING_FLYWAY_ENABLED=false` añadido al `.env` (temporal, override del default `true`).
- 18:31:00 UTC — `sudo systemctl stop sharemechat-audit.service`. Confirmado `inactive`, sin procesos `java sharemechat`.
- 18:31:00 UTC — `mv sharemechat-v1-0.0.1-SNAPSHOT.jar sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A3 && mv sharemechat-v1-0.0.1-SNAPSHOT.jar.new sharemechat-v1-0.0.1-SNAPSHOT.jar`. JAR antiguo del 2 mayo conservado como `.bak.10A3` para rollback rápido.
- 18:31:00 UTC — Baseline manual vía SQL sobre BD AUDIT, ejecutado desde la EC2 con `mysql` y password sourceada del `.env` (mismo patrón que el pre-flight 10.A.1):
  ```sql
  CREATE TABLE flyway_schema_history (installed_rank INT NOT NULL, version VARCHAR(50), ...);
  INSERT INTO flyway_schema_history VALUES (1, '1', '<< Flyway Baseline >>', 'BASELINE', ...);
  ```
  Confirmación inmediata: `SELECT installed_rank, version, description, type, success FROM flyway_schema_history` → 1 fila con baseline V1 success=1.
- 18:31:46 UTC — `SPRING_FLYWAY_ENABLED=false` eliminado del `.env` (vuelve al default `true`).
- 18:31:46 UTC — `sudo systemctl start sharemechat-audit.service`.
- 18:31:54 UTC — Flyway detectado `Current version of schema 'db1_sharemechat_audit': 1`, `Migrating schema to version "2 - cms v2 schema"`, `Successfully applied 1 migration to schema, now at version v2 (execution time 00:00.934s)`.
- 18:31:56 UTC — Hibernate 6.6.26 inicializado, `ddl-auto=validate` pasa sin errores.
- 18:32:17 UTC — `Started SharemechatV1Application in 29.955 seconds`. Backend operativo.

**Fase 4 — Validación post-cambio**:

- `curl https://audit.sharemechat.com/api/users/me` → `HTTP/2 401`, `server: nginx/1.28.0` (sin body, sin enmascaramiento a HTML).
- `curl https://audit.sharemechat.com/api/public/content/articles?locale=es` → `HTTP/2 200 application/json` con `cache-control: max-age=300, public`. **El CMS público responde**. Body es lista vacía (sin contenido cargado, esperado).
- `curl https://audit.sharemechat.com/api/public/content/articles/no-existe?locale=es` → `HTTP/2 404 application/json` desde el backend. Confirma que el fix de `CustomErrorResponses` del paquete 10.A.2 sigue activo: el 404 del backend llega sin transformarse en SPA shell.
- BD inspeccionada vía `mysql` desde EC2: `flyway_schema_history` tiene 2 filas (V1 baseline success=1, V2 `cms v2 schema` type=SQL success=1). Las 6 tablas `content_*` existen (`content_articles`, `content_article_translations`, `content_article_versions`, `content_article_translation_versions`, `content_generation_runs`, `content_review_events`). Total 50 tablas en `db1_sharemechat_audit`.
- `ssh audit-backend "aws s3 ls s3://sharemechat-content-private-audit/"` → exit 0 (bucket vacío, sin error). El instance profile con la policy `SharemechatContentPrivateAuditRW` aplicada por el operador en 10.A.1 tiene los permisos correctos.

Rollback preparado pero NO usado:

- JAR antiguo en `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A3`.
- `.env` backup en `/opt/sharemechat/.env.bak.10A3.2026-05-22`.
- Dump completo BD pre-cambio (de 10.A.1) en `s3://sharemechat-backups/audit/audit-backup-2026-05-20-2119.sql.gz` con SHA256 verificado.
- Procedimiento de rollback en el prompt operativo 10.A.3 sección "Ante fallo". No ejercitado porque la ventana cerró limpia.

Lecciones / observaciones:

- **Tiempo de ventana excelente**: 77 segundos de backend abajo (parada → `Started`). El cuello de botella fue Spring Boot bootstrap (30 s), no Flyway (1 s para V2) ni el systemd start (instantáneo). Margen sobrado dentro de cualquier SLA razonable.
- **Baseline manual con SQL directo funciona limpio**: alternativa más simple que instalar flyway CLI o usar `SPRING_FLYWAY_BASELINE_ON_MIGRATE=true` temporal. Reproducible: el SQL del schema `flyway_schema_history` es bien conocido y estable. Útil como patrón canónico para PROD desde cero (aunque PROD aplicará V1 + V2 normales, no necesita baseline manual).
- **Warning Flyway no bloqueante**: `Flyway upgrade recommended: MySQL 8.4 is newer than this version of Flyway and support has not been tested. The latest supported version of MySQL is 8.1`. La versión actual de Flyway (managed por Spring Boot 3.5.5) soporta hasta MySQL 8.1; AUDIT corre 8.4.7. La migración funcionó correctamente; el warning es informativo. Anotable como deuda menor si se quiere bumpear Flyway en un paquete futuro, no urgente.
- **`PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=true` en AUDIT** observado en el `.env` real durante este paquete, mientras [audit.md](../03-environments/audit.md) lo documentaba como `false`. Es desviación intencional probable del operador para alguna validación operativa puntual, no se modifica aquí. Anotable si se quiere reconciliar en una pasada documental futura.
- **deploy-frontend.ps1 aborta con `$ErrorActionPreference='Stop'` ante warnings npm por stderr**: workaround usado en este paquete = build manual desde `frontend/` + deploy con `-SkipBuild`. Patrón a considerar si se repite: ajustar el script para tolerar warnings npm que no son errores fatales.

### Refactor URLs hardcoded a properties 2026-05-22 (paquete 10.A.5)

Detonante: durante la inspección de 10.A.4 (sync de assets AUDIT ← TEST) se descubrió que `ModelContractManifestService.java` tiene la URL del manifest legal hardcoded en código Java a `https://assets.test.sharemechat.com/legal/model_contract.manifest.json`. AUDIT (y eventualmente PROD) hacían cross-environment fetch al bucket TEST. Se pausó el sync 10.A.4 y se abrió este paquete para refactorizar TODAS las URLs hardcoded de entorno en una sola pasada, antes de que 10.A.4 reanude.

Hallazgos exhaustivos por grep en `sharemechat-v1/src` y `sharemechat-v1/frontend/src`:

- **Backend Java críticos (5 puntos)**:
  - `service/ModelContractManifestService.java` L13-23: dos URLs hardcoded a `assets.test.sharemechat.com` (manifest + PDF esperado).
  - `config/WebSocketConfig.java` L29-32: array hardcoded de allowed origins WebSocket.
  - `security/SecurityConfig.java` L201-212: lista hardcoded de 10 allowed origins CORS.
  - `content/service/ContentArticleService.java` L1282: fallback hardcoded `"https://test.sharemechat.com"` si `app.public.base-url` no está configurada.
  - `content/publishing/SitemapController.java` L165: mismo fallback hardcoded.
- **Backend Java cosméticos (3 puntos)**:
  - `service/EmailVerificationService.java` L35, L38: `@Value` con default hardcoded a TEST.
  - `service/PasswordResetService.java` L34: idem.
- **Frontend React críticos (2 puntos)**:
  - `utils/runtimeSurface.js` L7-8: constantes `ADMIN_APP_ORIGIN` y `PRODUCT_APP_ORIGIN` hardcoded a TEST. Bug funcional en AUDIT: cualquier navegación cross-surface construía URLs apuntando a TEST.
  - `styles/public-styles/HomeStyles.js` L133, L141: `background-image: url('https://assets.test.sharemechat.com/home/hero/hero_desktop_v1.webp')` (y variante mobile). Bug visible: la home pública AUDIT cargaba los hero del CDN TEST.
- **Frontend React cosméticos (3 puntos)**:
  - `i18n/locales/cms/es.json` L42 + `en.json` L42 + `pages/admin/content/ContentArticleEditor.jsx` L815: placeholder de input con URL TEST.
- **Fuera de scope (anotado como deuda menor en known-debt)**:
  - `service/VeriffClientImpl.java` L28: URL mock interna inventada, sin uso productivo.

Cambios aplicados:

- **`application.properties`** (base): añadidas 5 properties nuevas con defaults TEST:
  - `app.assets.base-url=${APP_ASSETS_BASE_URL:https://assets.test.sharemechat.com}` (uso: `ModelContractManifestService`).
  - `app.frontend.product-origin` y `app.frontend.admin-origin` (uso futuro; reservadas para cross-surface si el backend necesita construir URLs absolutas a la otra superficie).
  - `app.cors.allowed-origins=${APP_CORS_ALLOWED_ORIGINS:...}` (CSV con 10 orígenes, cubre TEST+AUDIT+PROD+localhost).
  - `app.websocket.allowed-origins=${APP_WEBSOCKET_ALLOWED_ORIGINS:...}` (CSV con 3 orígenes: TEST, AUDIT, localhost).
- **`application-audit.properties`** (override AUDIT): 3 overrides:
  - `app.assets.base-url=https://assets.audit.sharemechat.com`.
  - `app.frontend.product-origin=https://audit.sharemechat.com`.
  - `app.frontend.admin-origin=https://admin.audit.sharemechat.com`.
  - CORS y WebSocket allowed-origins NO se overridean (la lista del base ya cubre los tres entornos).
- **`ModelContractManifestService.java`**: refactor constructor con `@Value("${app.assets.base-url}")`, métodos privados `manifestUrl()` y `expectedContractUrl()` construyen las URLs concatenando la property base con `MANIFEST_PATH` y `CONTRACT_PDF_PATH` constantes. Validación funcional intacta (mismo regex de versión y sha256, comparación exacta del URL).
- **`WebSocketConfig.java`**: inyecta `@Value("${app.websocket.allowed-origins}") String[] allowedOrigins`. Spring convierte CSV → array automáticamente.
- **`SecurityConfig.java`**: campo `@Value("${app.cors.allowed-origins}") String[] corsAllowedOrigins`, `configuration.setAllowedOrigins(Arrays.asList(corsAllowedOrigins))`.
- **`ContentArticleService.java` L1282** y **`SitemapController.java` L165**: fallback hardcoded reemplazado por `throw new IllegalStateException("app.public.base-url is not configured...")`. Sin fallback silencioso a TEST.
- **`EmailVerificationService.java` y `PasswordResetService.java`**: `@Value` sin default. Si la property no está, Spring falla el bootstrap con error claro en vez de silenciosamente usar URL TEST.
- **Frontend `config/runtimeEnv.js`** (NUEVO, ~50 líneas): mapa `ENV_MAP` con hostnames como llaves y `{product, admin, assets}` por entorno. `resolveOrigins()` detecta el entorno actual por `window.location.hostname` con fallback a TEST. Exporta `PRODUCT_ORIGIN`, `ADMIN_ORIGIN`, `ASSETS_BASE`.
- **`utils/runtimeSurface.js`**: importa `ADMIN_ORIGIN` y `PRODUCT_ORIGIN` de `runtimeEnv.js`. Constantes `ADMIN_APP_ORIGIN` y `PRODUCT_APP_ORIGIN` ahora se resuelven en runtime.
- **`styles/public-styles/HomeStyles.js`**: importa `ASSETS_BASE` de `runtimeEnv.js`. Las dos URLs del hero se construyen con `${ASSETS_BASE}/home/hero/hero_*.webp` dentro del template literal de styled-components.
- **`i18n/locales/cms/{es,en}.json` + `ContentArticleEditor.jsx`**: placeholder cambiado a `https://assets.sharemechat.com/blog/<slug>.webp` (dominio neutro tipo PROD, solo orientativo para el input).

Verificación post-refactor: grep en `src/main/java` y `frontend/src` confirma que las únicas referencias residuales a `assets.test.sharemechat.com`, `test.sharemechat.com` o equivalentes son: (a) el mapa `ENV_MAP` en `runtimeEnv.js` (correcto, es el sitio canónico donde viven los hostnames), (b) un comentario JavaDoc de `PublicSiteProperties.java:25` con un ejemplo. Cero hardcoded funcionales.

Build local: `./mvnw clean package -DskipTests` → BUILD SUCCESS en 22.887 s. JAR generado: `target/sharemechat-v1-0.0.1-SNAPSHOT.jar` (106 MB, 2026-05-22 22:29 local). `npm run build:product` → exit 0. Bundle delta: `main.js` +1 B, `572.chunk.js` −8 B, hash cambios en chunks por las modificaciones. Sin warnings nuevos del compilador (solo los preexistentes del proyecto). El JAR NO se ha desplegado a AUDIT ni a TEST; queda en local listo para deploy en próxima sesión operativa.

Próximos pasos:

- Desplegar el JAR refactorizado a TEST primero (validar con backend arriba), después a AUDIT con una ventana de mantenimiento corta (segundo restart del backend AUDIT desde 10.A.3; el sourcing del `.env` y el bootstrap ya están validados, solo cambia el JAR).
- Desplegar el frontend nuevo a `sharemechat-frontend-test` y `sharemechat-frontend-audit` con `deploy-frontend.ps1` + invalidación CloudFront.
- Reanudar el paquete 10.A.4 (sync de assets AUDIT ← TEST) ya con el manifest hardcoded resuelto: el backend AUDIT leerá su propio bucket `assets.audit.sharemechat.com`, no el de TEST. El sync sí tiene impacto funcional ahora.

Lecciones operativas:

- **Acoplamiento profundo descubierto durante inspección de assets**: el grep amplio del paquete 10.A.5 reveló que el problema del manifest no era aislado; había 10 puntos similares en el código entre backend y frontend. Refactorizar todos en una sola pasada (en vez de uno por uno) era la opción correcta para no tener que repetir build+deploy.
- **Diferencia entre "property con default TEST" y "constante hardcoded TEST"**: las primeras se overridean por entorno y funcionan, las segundas no. El `application-audit.properties` ya cubría las primeras desde antes (cookieDomain, base-url, etc.); las segundas (cinco en backend, dos en frontend) eran las que rompían el aislamiento de entornos.
- **Frontend con un solo build artifact**: la detección por `window.location.hostname` evita la complejidad de mantener `npm run build:test`, `:audit`, `:pro` separados. El mismo bundle funciona en los tres entornos y AUDIT/PROD se sirven desde sus buckets con el HTML idéntico.
- **`@Value` sin default**: filosofía adoptada para properties que DEBEN estar configuradas. Spring falla el bootstrap con error claro en lugar de silenciosamente caer a TEST. Más seguro operativamente, especialmente cuando se replique en PROD desde cero.

### Aviso AI eliminado del detalle del artículo público 2026-05-22 (paquete 10.A.6)

Cambio editorial menor en el frontend del blog público: el footer del detalle de cada artículo mostraba un aviso "Contenido elaborado con asistencia de IA. Más información." (con link a `/legal?tab=ai-disclosure`) cuando el artículo tenía `disclosureRequired=true` en el DTO público. El operador decide que ese aviso no es obligación legal embebida y que su lugar canónico es el Legal Center (pestaña `ai-disclosure` del footer global), no cada artículo.

Cambios aplicados (solo frontend, cero backend):

- **`frontend/src/pages/blog/BlogArticleView.jsx`**: eliminado el bloque condicional `{article.disclosureRequired ? (<span>...</span>) : null}` dentro de `<ArticleFooterMeta>` (líneas 571-576, 6 líneas en total). El campo `article.disclosureRequired` del DTO sigue llegando del backend pero ya no se consume en este componente.
- **`frontend/src/i18n/locales/blog/es.json`**: eliminadas las claves `disclosureText` ("Contenido elaborado con asistencia de IA.") y `disclosureLinkText` ("Más información.") del bloque `detail`. Sin consumidores residuales (confirmado por grep en todo `frontend/src`).
- **`frontend/src/i18n/locales/blog/en.json`**: equivalente en inglés (`"AI-assisted content."`, `"Learn more."`).

Lo que NO cambia:

- **Legal Center**: `frontend/src/footer/Legal.jsx` líneas 150, 287-291, 993 (pestaña `ai-disclosure` con su contenido propio) queda intacto. El link desde otros sitios a `/legal?tab=ai-disclosure` sigue funcionando.
- **Backend**: campo `disclosureRequired` se conserva en `ContentArticle` (entidad), `ArticleDetailDTO` (admin), `ArticlePublicSummaryDTO` y `ArticlePublicDetailDTO`. Útil para trazabilidad editorial (admin sabe qué artículos están marcados como AI-assisted), uso analítico, o reactivación futura.
- **JSON-LD / SEO**: el aviso nunca apareció en el JSON-LD `Article` que el SPA inyecta en `<head>`, ni en sitemap, ni en feeds. Eliminación visible solo en UI.

Build: `npm run build:product` → exit 0. Bundle delta: `863.chunk.js` −129 B, `572.chunk.js` −8 B. Hash nuevo `main.ff07af3c.js`. Sin warnings nuevos.

Pendiente operativo: cuando el bundle se despliegue a TEST y AUDIT (junto con el del paquete 10.A.5), la SPA deja de mostrar el aviso en el detalle del artículo. Los artículos publicados con `disclosureRequired=true` siguen marcados como tales en BD pero el flag no tiene efecto visible. Si en el futuro se decide reactivar el aviso (o mover su render a otro componente), el `git history` conserva el wording exacto en ES y EN.

### Despliegue refactor 10.A.5/10.A.6 a AUDIT + sync de assets 2026-05-22 (paquete 10.A.7)

Despliegue completo del refactor de URLs hardcoded (10.A.5) + eliminación del aviso AI del detalle del artículo (10.A.6) sobre AUDIT, generación del manifest específico de AUDIT que el `ModelContractManifestService` refactorizado espera, y reanudación del paquete 10.A.4 (sync de assets TEST → AUDIT) que había quedado pausado tras el descubrimiento de las URLs hardcoded en el manifest. Cinco fases ejecutadas limpiamente con dos pausas de validación visual del operador. Backend AUDIT abajo solo 33 segundos. Frente 10.A cerrado funcionalmente.

**Fase 1 — Manifest + PDF a AUDIT**:

- Descargado el manifest TEST (`s3://assets-sharemechat-test1/legal/model_contract.manifest.json`, 213 bytes): `{version: "model_contract_v4_2026-03-23", sha256: "783A747136951B848649A984A622A8A50E62B3538DDEE369257B2825B9B37B7B", url: "https://assets.test.sharemechat.com/legal/model_contract.pdf"}`.
- Descargado el PDF (`s3://assets-sharemechat-test1/legal/model_contract.pdf`, 159368 bytes). `sha256sum` del PDF coincide con el campo `sha256` del manifest, regla de validación del `ModelContractManifestService.validateSha256()` y `validateUrl()` respetada.
- Generado `manifest-audit.json` (211 bytes) localmente cambiando **solo** la URL a `https://assets.audit.sharemechat.com/legal/model_contract.pdf`. Mismo `version`, mismo `sha256`. JSON validado con `node -e "JSON.parse(...)"`.
- Subidos a AUDIT: `aws s3 cp ... s3://assets-sharemechat-audit/legal/model_contract.pdf --content-type application/pdf` y `aws s3 cp ... s3://assets-sharemechat-audit/legal/model_contract.manifest.json --content-type "application/json; charset=utf-8"`.
- Validación via CDN: `curl https://assets.audit.sharemechat.com/legal/model_contract.manifest.json` → `HTTP/2 200`, body con URL adaptada. `curl -I .../model_contract.pdf` → `HTTP/2 200 application/pdf`.

**Fase 2 — Frontend bundle (10.A.5 + 10.A.6) a AUDIT**:

- Bundle ya compilado localmente del paquete 10.A.6, hash `main.ff07af3c.js` (incluye `runtimeEnv.js` con detección por hostname + eliminación del aviso AI).
- `deploy-frontend.ps1 audit product -SkipBuild` (workaround conocido por warnings npm en stderr). Sync a `s3://sharemechat-frontend-audit/`. Invalidación CloudFront `E1ILXV7P6ENUV8` → ID `I7EMTHU57PQ44J0MM6S197KQ47`.
- Validación intermedia con backend AUDIT aún antiguo (JAR pre-refactor): `curl https://audit.sharemechat.com/` devuelve la SPA con `main.ff07af3c.js` correcto. Sin overlay falso. Confirmación visual del operador OK.

**Fase 3 — Ventana de mantenimiento del backend AUDIT**:

- JAR refactorizado compilado localmente (`target/sharemechat-v1-0.0.1-SNAPSHOT.jar`, 106056697 bytes, SHA256 `4b0679f4a34cb9305a75ee9fd80e67b3e6b053e9658b74a00c87c58178bb5a13`). El hash es distinto al reportado en el commit del paquete 10.A.5 porque Maven incluye timestamps de compilación; lo crítico es que SHA256 local = SHA256 remoto = `4b0679f4...` tras el scp.
- `scp` a `audit-backend:/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar.new` (20 s). SHA256 remoto idéntico al local. JAR previo (de 10.A.3, 106055594 bytes, 22 mayo 18:30) intacto en su nombre original.
- **21:36:20 UTC — `systemctl stop sharemechat-audit.service`**. Confirmado `inactive`, sin proceso java.
- **21:36:21 UTC — Rename JARs**: actual → `sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A7`, `.new` → actual. JAR antiguo de 10.A.3 conservado para rollback rápido.
- **21:36:24 UTC — `systemctl start`**. Bootstrap Spring Boot en marcha.
- **21:36:53 UTC — `Started SharemechatV1Application in 28.04 seconds`**. Tiempo total backend abajo: **33 segundos** (mejor aún que los 77 s del paquete 10.A.3 porque esta vez Flyway no aplica migración, solo valida).
- `journalctl` muestra logs limpios: `Successfully validated 3 migrations`, `Current version of schema: 2`, `Schema is up to date. No migration necessary.`, Hibernate 6.6.26 inicializado, `ddl-auto=validate` pasa, HikariPool montado contra MySQL 8.4.7, Tomcat puerto 8080. **Sin errores de placeholder** tipo `Could not resolve placeholder 'app.assets.base-url'`: el refactor 10.A.5 carga las nuevas properties correctamente desde `application-audit.properties` (3 overrides nuevos: `app.assets.base-url=https://assets.audit.sharemechat.com`, `app.frontend.product-origin`, `app.frontend.admin-origin`).

**Fase 4 — Validación funcional post-cambio (test crítico del refactor)**:

- `curl https://audit.sharemechat.com/api/users/me` → `HTTP/2 401 application/json` limpio (sin enmascaramiento HTML).
- **Test crítico**: `curl https://audit.sharemechat.com/api/consent/model-contract/current` → `HTTP/2 200 application/json` con body `{"sha256":"...","version":"model_contract_v4_2026-03-23","url":"https://assets.audit.sharemechat.com/legal/model_contract.pdf"}`. **El backend AUDIT lee el manifest desde su propio bucket y devuelve la URL del dominio AUDIT**, no la de TEST. Refactor 10.A.5 confirmado funcionando: `ModelContractManifestService` ahora usa `@Value("${app.assets.base-url}")` y construye las URLs dinámicamente por entorno.
- `curl https://audit.sharemechat.com/api/public/content/articles?locale=es` → `HTTP/2 200 application/json`. CMS público responde sin regresión.
- Confirmación visual del operador OK.

**Fase 5 — Sync de assets TEST → AUDIT (reanudación del paquete 10.A.4)**:

- Estado pre-sync: TEST 48 objetos / 3,167,760 bytes; AUDIT 4 objetos / 286,843 bytes (los 2 preexistentes + manifest custom + PDF de fase 1).
- `aws s3 sync s3://assets-sharemechat-test1/ s3://assets-sharemechat-audit/ --delete --exclude "legal/model_contract.manifest.json"`. Sincronizados 44 ficheros nuevos. El `--exclude` preserva el manifest custom de AUDIT (la única excepción real al sync; el PDF sí se sincroniza por compatibilidad pero es bit-a-bit idéntico al ya subido en fase 1).
- Estado post-sync: TEST 48 objetos / 3,167,760 bytes; AUDIT 48 objetos / **3,167,758 bytes**. Diferencia de **2 bytes** atribuible al manifest custom (las URLs `assets.test.sharemechat.com` y `assets.audit.sharemechat.com` difieren en longitud por 1 char, y la diferencia exacta puede tener ±1 byte por whitespace; el `--exclude` preserva el manifest AUDIT con 211 bytes en lugar del de TEST con 213).
- Manifest AUDIT verificado post-sync: sigue con `url: "https://assets.audit.sharemechat.com/..."`. El `--exclude` funcionó correctamente.
- Invalidación CloudFront assets AUDIT (`E2NC4TEJAWOI3L`) con paths `/*` → ID `IC4SXSW31N52ZY47X9OTGJG6TS`.
- Spot-check 3 ficheros via CDN AUDIT tras la propagación: `home/hero/hero_desktop_v1.webp` (41314 B, `image/webp`), `g/diamante.webp` (73844 B), `blog/elegir-videochat-seguro.webp` (92750 B). Todos `HTTP/2 200` con `x-amz-server-side-encryption: AES256`. Hero del home ahora se carga desde el bucket AUDIT propio (el `runtimeEnv.js` del frontend nuevo construye `${ASSETS_BASE}/home/hero/...` con `ASSETS_BASE=https://assets.audit.sharemechat.com`).

Estado final del frente 10.A:

- **Backend AUDIT**: JAR refactor 10.A.5 del 2026-05-22 22:29 local, SHA256 `4b0679f4a3...`, corriendo desde 21:36:53 UTC con perfil `audit`.
- **Frontend AUDIT**: bundle `main.ff07af3c.js` con `runtimeEnv.js` + aviso AI eliminado. SPA, navegación cross-surface, y asset URLs ahora 100% por entorno.
- **Schema BD AUDIT**: Flyway en v2 (sin cambios desde 10.A.3).
- **Bucket S3 `assets-sharemechat-audit`**: 48 objetos sincronizados desde TEST + manifest custom con URL `assets.audit.sharemechat.com`.
- **CloudFront**: dos invalidaciones aplicadas en este paquete (frontend `I7EMTHU57PQ44J0MM6S197KQ47`, assets `IC4SXSW31N52ZY47X9OTGJG6TS`).
- **Backups conservados en EC2 AUDIT**: `sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A7` (JAR pre-refactor, 22 mayo 18:30) y `sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A3` (JAR pre-CMS-v2, 2 mayo).
- **Backup BD pre-cambio en S3**: `s3://sharemechat-backups/audit/audit-backup-2026-05-20-2119.sql.gz` (de 10.A.1, sigue válido).

Lecciones / observaciones:

- **Segunda ventana de mantenimiento del backend AUDIT consecutiva sin Flyway nueva**: el bootstrap Spring Boot tarda 28 s (vs 30 s del primer arranque post-V2 en 10.A.3). Margen estable. La ventana neta de "backend abajo" baja de 77 s (10.A.3) a 33 s (10.A.7) porque esta vez no hay baseline manual ni aplicación de V2 entre stop y start: solo rename + start.
- **El refactor 10.A.5 prueba su valor end-to-end aquí**: el mismo JAR corre en TEST devolviendo URL `assets.test.sharemechat.com` y en AUDIT devolviendo URL `assets.audit.sharemechat.com`, sin necesidad de recompilación. El override de la property en `application-audit.properties` es lo único que diferencia el comportamiento por entorno. Cuando se monte PROD, basta con un `application-prod.properties` análogo.
- **`--exclude` en `aws s3 sync` es la herramienta correcta para preservar deltas intencionales**: el manifest AUDIT debe permanecer con su URL adaptada, no copiarse desde TEST. El operador puede plantear el mismo patrón en futuras sincronizaciones cross-environment donde haya ficheros que deben ser específicos por entorno aunque la mayoría sean idénticos.
- **Hero del home rotó silenciosamente entre Fase 2 y Fase 5**: durante ~5 minutos, el frontend AUDIT pidió las imágenes hero a `assets.audit.sharemechat.com/home/hero/...` cuando esos ficheros no existían todavía en el bucket AUDIT. Hubo degradación visual transitoria (hero negro o roto) pero no error funcional. Asunción aceptada por el operador. Para PROD será mejor sincronizar los assets ANTES del frontend para evitar este flash visual.

### Paquete 10.A.8: refactor brief per-locale (backend, fase 1 de 4) 2026-05-23

Refactor backend que reubica el campo `brief` desde el artículo lógico (`content_articles.brief`) a la traducción per-locale (`content_article_translations.brief`). Diagnóstico del bug en [ADR-027](../06-decisions/adr-027-brief-per-locale.md): el brief estaba clasificado como compartido por error de catalogación en ADR-025, lo que provocaba que el blog público EN sirviera el brief en español incluso cuando title/SEO/body sí estaban traducidos. Fase 1 de 4 del frente brief-per-locale: solo backend, **sin deploy y sin commit**. Las fases 2 (skills del pipeline), 3 (frontend admin) y 4 (despliegue coordinado con ventana de mantenimiento) se cubrirán en los paquetes 10.A.9, 10.A.10 y 10.A.11 respectivamente.

**Fase 1 — Inspección y plan**:

- Revisión del modelo actual: `content_articles.brief TEXT NULL` (compartido) vs JSON 2.0 emitido por las skills (`shared.brief`). Confirmado el defecto de modelado.
- Análisis de impacto: 1 migración Flyway, 2 entidades JPA, 6 DTOs, 1 service principal + 2 servicios secundarios, 1 controller, 5 skills externas (no tocadas), 1 frontend (no tocado). ADR + actualización de docs.
- Decisión de criterios:
  - **Snapshot brief en versions**: NO (opción A confirmada por operador). Razón: el brief es metadata de presentación editable libremente, no contenido auditable estilo body.
  - **Validación al pasar a IN_REVIEW**: exigir brief no vacío al menos en el locale primario ES (recomendado, confirmado). EN puede llegar a IN_REVIEW sin brief para no romper flujos donde el pipeline EN aún no se ha ejecutado.

**Fase 2 — Migración Flyway V3**:

- Creado `src/main/resources/db/migration/V3__brief_per_locale.sql`. Tres pasos secuenciales:
  1. `ALTER TABLE content_article_translations ADD COLUMN brief TEXT NULL AFTER meta_description;`
  2. `UPDATE content_article_translations t INNER JOIN content_articles a ON a.id = t.article_id SET t.brief = a.brief WHERE t.locale = 'es' AND a.brief IS NOT NULL;` — backfill ES desde brief actual del artículo.
  3. `ALTER TABLE content_articles DROP COLUMN brief;`
- **Migración NO aplicada todavía**. La aplicación efectiva contra TEST y AUDIT se hará en el paquete 10.A.11 junto con el despliegue del JAR refactorizado, dentro de la ventana de mantenimiento.

**Fase 3 — Refactor de entidades JPA**:

- `ContentArticle.java`: eliminada propiedad `brief` (campo + `@Column` + getter + setter). JavaDoc actualizado para indicar que brief ahora vive en la translation per ADR-027.
- `ContentArticleTranslation.java`: añadida propiedad `brief` con `@Column(name = "brief", columnDefinition = "TEXT")`, getter y setter. JavaDoc actualizado.

**Fase 4 — Refactor de DTOs**:

- `ArticleDetailDTO.java` (admin): eliminado campo `brief` de la raíz del record. JavaDoc actualizado.
- `TranslationDetailDTO.java` (admin, subobjeto per-locale): añadido campo `brief` al record.
- `ArticleUpdateRequest.java` (admin, PATCH compartido): eliminado campo `brief` + getter/setter. JavaDoc clarifica que brief se edita por el endpoint per-locale.
- `TranslationMetadataUpdateRequest.java` (admin, PATCH per-locale): añadido campo `brief` + getter/setter. JavaDoc actualizado.
- `ArticleCreateRequest.java`: mantiene `brief` (acompaña al locale primario al crear); JavaDoc añade nota ADR-027.
- `ArticlePublicSummaryDTO.java` (público): mantiene `brief` top-level por compatibilidad con frontend público (el contrato JSON no cambia); JavaDoc añade nota ADR-027 sobre la procedencia per-locale.
- `ArticlePublicDetailDTO.java` (público): mantiene `brief` top-level por compatibilidad; JavaDoc añade nota ADR-027.
- `TranslationPreviewDTO.java`: ya era per-locale; el campo `brief` se mantiene con su semántica per-locale ahora consistente con el modelo.

**Fase 5 — Refactor de servicios y controller**:

- `ContentArticleService.java`:
  - JavaDoc class-level (invariantes): actualizada la lista de campos del padre y nota sobre brief per-locale ES como precondición de IN_REVIEW.
  - `createArticle`: brief se escribe ahora en la translation ES recién creada (`tr.setBrief(brief)`), no en `article.setBrief(...)`.
  - `updateArticleMetadata` (PATCH compartido): eliminada la rama que actualizaba `article.setBrief(...)`.
  - `updateTranslationMetadata` (PATCH per-locale): añadida rama que valida y normaliza brief con el mismo trato que title/slug/seo_title (`null` se ignora, vacío dispara 400, no vacío se normaliza con `normalizeText(...)` y `BRIEF_MAX`).
  - `assertReadyForReview`: eliminado el check `article.getBrief() == null || isBlank()`. Añadido check al final que exige `byLocale.get(LOCALE_ES).getBrief()` no vacío con mensaje `Pendiente para revision: locales.es.brief`.
  - `toDetail` (mapper admin): eliminado `article.getBrief()` del constructor de `ArticleDetailDTO`.
  - `toTranslationDetail` (mapper admin): añadido `t.getBrief()` al constructor de `TranslationDetailDTO`.
  - Mapper de listado público (`listPublicByLocale`): `a.getBrief()` → `t.getBrief()` (lee el brief de la translation del locale solicitado).
  - Mapper de detalle público (`findPublicBySlugAndLocale`): `article.getBrief()` → `tr.getBrief()`.
- `ContentRunService.java` línea 107: `article.getBrief()` → `esTranslation.getBrief()` (el contexto del prompt IA lleva el brief ES de la translation).
- `ContentAIProvider.java` (record `PromptContext`): JavaDoc actualizado; el record sigue teniendo el campo `brief` pero la documentación clarifica que viene del locale ES.
- `ContentAdminController.java` línea 240: `detail.brief()` → `tr.brief()` en el mapper de `TranslationPreviewDTO`.

**Fase 6 — Build + ADR + documentación**:

- `./mvnw clean package -DskipTests` desde raíz: BUILD SUCCESS, 296 fuentes compiladas, JAR `sharemechat-v1-0.0.1-SNAPSHOT.jar` regenerado en `target/`. **JAR NO desplegado** (el despliegue es 10.A.11).
- Creado [ADR-027](../06-decisions/adr-027-brief-per-locale.md) (Reubicación de `brief` a per-locale): estado Aceptada, decisión D1-D7 cubriendo schema, snapshots, validación, DTOs, pipeline editorial, frontend admin y despliegue coordinado.
- Esta entrada en `incident-notes.md`.
- Entrada en `project-log.md`.

Estado al cierre del paquete 10.A.8:

- **Repositorio**: backend completamente refactorizado y compilando. ADR-027 publicada. Migración Flyway V3 lista pero no aplicada. Nada commiteado todavía (el operador decide cuándo y cómo agrupar el commit del frente brief-per-locale; los cuatro paquetes pueden quedar en una sola serie de commits o en uno consolidado al cierre de 10.A.11).
- **TEST**: sin cambios. BD en V2, JAR sin refactor, skills sin refactor.
- **AUDIT**: sin cambios. BD en V2, JAR sin refactor, skills sin refactor.
- **Skills**: sin tocar; siguen emitiendo `shared.brief` (incompatible con el backend nuevo). El backend nuevo no se desplegará hasta que las skills emitan el formato nuevo (10.A.9) y el frontend admin pueda editarlo per-locale (10.A.10). Hasta entonces, el repo tiene un backend "viable pero aislado" que solo se activa en bloque en 10.A.11.

Lecciones / observaciones:

- **El bug nació en ADR-025 por catalogación apresurada**. Cuando se decidió el modelo bilingüe se separaron campos "compartidos" vs "per-locale" pero `brief` se metió en el bucket equivocado sin discusión. La corrección retrospectiva requiere cuatro paquetes coordinados. Lección para futuras decisiones de schema: cualquier campo lingüístico (texto que un humano lee) debe vivir en la translation aunque parezca "metadata"; los compartidos deben quedar restringidos a identificadores, taxonomías, fechas y flags.
- **Frente refactor con cuatro fases secuenciales sin posibilidad de despliegue parcial**: el backend refactor 10.A.8 no se puede desplegar sin las skills 10.A.9 (rompe el pipeline) ni sin el frontend admin 10.A.10 (rompe el editor). Los tres tienen que llegar juntos a TEST y a AUDIT en 10.A.11. Riesgo aceptado por el operador.
- **Build limpio sin errores tras tocar 11 ficheros Java**: confirma que los DTOs son records con constructores generados, así que un cambio en el orden o número de campos hace fallar la compilación de los mappers automáticamente. Útil como red de seguridad: si un mapper hubiera quedado fuera, el build habría fallado en él.

### Paquete 10.A.9: refactor pipeline editorial brief per-locale (fase 2 de 4) 2026-05-23

Segundo paquete del frente brief-per-locale, fase 2 de 4: refactor del pipeline editorial (skills `docs/cms/skills/`) para que el brief viaje per-locale en el JSON 2.0 que el operador pega en `/api/admin/content/articles/{id}/runs/{runId}/apply-bilingual`. Incluye, por confirmación explícita del operador en el punto de control de fase 1, un cambio acotado en `ContentRunService.applyTranslationFromJson` para que el backend persista el brief leído del JSON (sin esa línea el adapter validaría el campo pero el backend lo descartaría, dejando el frente sin cerrar).

**Hallazgo de la fase 1 (inspección) que reformuló el alcance**:

El prompt original asumía que el JSON 2.0 contenía `shared.brief` y que el paquete debía moverlo a `locales.{es,en}.brief`. La inspección desmiente esa asunción: el JSON 2.0 actual **no contiene brief en absoluto**. Verificado cruzando cuatro fuentes independientes: (a) `cms-json-builder.md` no lista brief en su estructura ni en sus campos obligatorios; (b) `ManualClipboardClaudeAdapter.java` no incluye brief en `SHARED_REQUIRED_FIELDS` ni en `LOCALE_REQUIRED_FIELDS`, y `validateSharedSection`/`validateLocaleEntry` no contienen reglas para brief; (c) `ContentRunService.applyTranslationFromJson` no lee brief del JSON (aplica slug, title, seoTitle, metaDescription, body, targetKeywords pero no brief); (d) grep "brief" en `ContentRunService.java` solo encuentra la línea del PromptContext editada en 10.A.8. La única referencia residual a `shared.brief` es `cms-json-validator.md:48` como ejemplo defensivo en la lista de "campos de riesgo alto" para escape de comillas. El cambio en 10.A.9 es por tanto **aditivo** (introducir brief por primera vez en el JSON activo), no de movimiento. El operador confirmó la reformulación en el punto de control.

**Refactor aplicado en 5 fases**:

Fase 2 — Schema JSON 2.0 (cms-json-builder.md):
- Sección "ESTRUCTURA DEL JSON": comentario añadido `brief introducido per-locale por ADR-027` + nota explícita "Cualquier JSON que coloque brief bajo `shared` será rechazado por el backend como schema obsoleto".
- Sección "CAMPOS OBLIGATORIOS / Bloque locales.<es|en>": añadida línea `brief (string ≤8192, NO null no vacío; texto descriptivo 1-2 frases visible en cards de listado y cabecera del detalle del blog público; ADR-027). En ES proviene del <editorial_input><brief> del prompt; en EN proviene del bloque metadata final de 04_review/reviewed_en.md (campo SUGGESTED_BRIEF_EN)`.
- Sección "REGLAS DURAS": ampliada regla 14 para incluir SUGGESTED_BRIEF_EN entre los campos del bloque metadata leído; nueva regla 15 "BRIEF ES" obligando a copia literal del campo del editorial_input.
- Sección "VALIDACIÓN ANTES DE EMITIR / self-check": añadida verificación `brief no nulo no vacío y .length <= 8192 (ADR-027)`.
- Sección "CUANDO TERMINES": resumen final reporta también la longitud del brief en caracteres por locale.

Fase 3 — cms-translate-en.md:
- Sección "Campos PER-LOCALE": añadido bullet de brief con la regla de traducción adaptada al mercado anglosajón y referencia a sharemechat-voice EN.
- Sección "METADATOS EN AL FINAL DEL FICHERO": el bloque crece de 3 a 4 campos con `SUGGESTED_BRIEF_EN`. Texto actualizado: "cuatro campos de metadatos" en lugar de "tres".
- Sección "Reglas de seo_title y meta_description": añadido subbloque "Reglas de brief EN" con longitud máxima, tono, adaptación al mercado y obligatoriedad de comillas curvas.
- Sección "CUANDO TERMINES": resumen final reporta también la longitud del brief EN sugerido.

Fase 3 — cms-json-validator.md:
- Línea 48 de la sección "CAMPOS DE RIESGO ALTO": cambio referencial de `shared.brief (si está presente)` a `locales.{es,en}.brief (ADR-027: campo per-locale, descriptivo 1-2 frases; énfasis estilísticos posibles)`.

Fase 3 — cms-orchestrator.md:
- Sección "Validaciones clave" del reporte final: añadidos dos bullets sobre brief no vacío por locale (ES viene del editorial_input; EN viene de la fase 4.5).

Skills NO tocadas: `cms-research-seo`, `cms-draft-writer`, `cms-editorial-polish`, `cms-brand-legal-review`, `sharemechat-voice`. Consumen brief como input contextual pero no lo emiten al JSON; sin cambios estructurales.

Fase 4 — Backend Java:
- `ManualClipboardClaudeAdapter.java`: añadida constante `BRIEF_MAX = 8192`; `brief` añadido a `LOCALE_REQUIRED_FIELDS` (la lista crece de 9 a 10 campos); `validateLocaleEntry` gana rama de validación de brief con la misma forma que las de `seo_title` y `meta_description` (requerido, no vacío, longitud ≤ 8192); `validateSharedSection` gana rama defensiva: si llega `shared.brief` devuelve error `schema obsoleto: brief es per-locale por ADR-027; muevelo a locales.{es,en}.brief`. JavaDoc class-level actualizado con referencia a ADR-027.
- `ContentRunService.applyTranslationFromJson`: añadida línea `tr.setBrief(textOrNull(loc, "brief"));` entre meta_description y body, con comentario referenciando ADR-027 y nota de que la presencia/longitud ya fue validada por el adapter. Cambio mínimo (1 línea funcional + 1 de comentario) pero crítico: sin él el adapter validaría el campo pero el servicio lo descartaría al persistir, dejando la translation con `brief=NULL` y haciendo inútil todo el frente.
- Build local `./mvnw clean package -DskipTests` BUILD SUCCESS en 15 segundos. JAR regenerado en `target/`. **JAR NO desplegado** (el despliegue es 10.A.11).

Fase 5 — Documentación:
- `docs/06-decisions/adr-027-brief-per-locale.md`: sección D5 reescrita reflejando la realidad (cambio aditivo en lugar de movimiento). Nueva sección "D5.1 Comportamiento defensivo durante la transición". Nueva sección "Schema JSON 2.0: brief per-locale (diff explícito tras 10.A.9)" con bloques JSON antes/después comentados. Actualizada la consecuencia negativa que hablaba de "JSON 2.0 cambia su forma" para reflejar que es aditivo y que la elección es rechazo estricto, no tolerancia al campo legacy.
- Esta entrada en incident-notes.md.
- Entrada nueva al inicio de `docs/project-log.md`.

Estado al cierre del paquete 10.A.9:

- **Repositorio**: 4 skills tocadas (`cms-json-builder.md`, `cms-translate-en.md`, `cms-json-validator.md`, `cms-orchestrator.md`); 2 ficheros Java tocados (`ManualClipboardClaudeAdapter.java`, `ContentRunService.java`); ADR-027 ampliado con sección de schema JSON; 1 JAR regenerado sin desplegar. Nada commiteado.
- **Cowork**: el editor humano debe replicar manualmente los cambios de las 4 skills tocadas en su espacio personal de Claude Cowork **antes** del despliegue 10.A.11. La sincronización Cowork ↔ repo es manual por diseño (ver `docs/cms/skills/README.md`); si el editor olvida ese paso, los runs editoriales tras el despliegue seguirán emitiendo JSON sin brief y serán rechazados por el adapter nuevo.
- **TEST / AUDIT**: sin cambios. Los entornos siguen corriendo el backend de 10.A.7; las skills viejas en Cowork siguen emitiendo JSON sin brief y el adapter viejo los acepta sin problema. Ningún drift hasta el 10.A.11.

Lecciones / observaciones:

- **Inspección antes de aplicar evita reescritura cosmética del schema**. El prompt asumía un movimiento `shared.brief → locales.{es,en}.brief` y la fase 1 de inspección reveló que el campo no existía en el JSON activo. Si hubiera aplicado el prompt al pie de la letra (buscar `shared.brief` y reubicarlo), no habría encontrado nada y habría producido un cambio incompleto. La regla "punto de control tras inspección" del flujo del operador, materializada como fase 1.5 obligatoria, evitó ese fallo silencioso. Patrón aplicable a futuros refactors: cuando el plan asume un estado del schema, primero verificar el estado real.
- **El adapter Java ya tenía la disciplina de "campo obligatorio" formalizada en una lista constante**. Añadir un campo nuevo a `LOCALE_REQUIRED_FIELDS` y una rama de validación con la misma forma que las existentes son ~12 líneas; ningún cambio estructural del validador. Confirmación de un buen patrón de diseño: separar la lista de campos obligatorios de las reglas específicas de cada campo permite extender sin reescribir.
- **El cambio mínimo en `applyTranslationFromJson` (1 línea funcional) tiene un peso operativo desproporcionado al volumen del diff**. Sin esa línea el adapter validaría el contrato pero el servicio descartaría el dato. El operador acertó al ampliar el alcance del paquete cuando se le ofreció la opción en el punto de control; el coste de añadirla en 10.A.9 es trivial vs. el coste de un sub-paquete 10.A.9.bis posterior para corregir el gap.
- **El número de versión del schema JSON no se incrementa (sigue siendo "2.0") aunque el contrato cambie de forma backward-incompatible**. Decisión consciente justificada porque el cambio es coordinado en una sola ventana de despliegue (10.A.11) y no hay clientes externos al pipeline editorial interno. Una bump a 2.1 o 3.0 obligaría a tocar la constante `AI_OUTPUT_SCHEMA_VERSION` del backend y a versionar las skills explícitamente, complejidad innecesaria para este frente. Se reserva la bump para un cambio más amplio si surge.

### Paquete 10.A.10: refactor frontend admin brief per-locale (fase 3 de 4) 2026-05-23

Tercer paquete del frente brief-per-locale: refactor del editor admin (`ContentArticleEditor.jsx`) para que el input de brief viva dentro de cada tab de locale (junto a title, slug, seo_title, meta_description), no en la sección "Metadata compartida" del top del editor. Implementa el contrato backend cerrado en 10.A.8 y 10.A.9. **Sin deploy y sin commit**. Bundle regenerado para verificación local.

**Hallazgo de la fase 1 que amplió el alcance**:

La inspección reveló **tres bugs heredados de 10.A.8 que el frontend actual ya tiene en main**, no detectados durante el cierre del paquete 10.A.8 porque allí no se compiló el frontend. Ninguno se manifiesta hoy porque TEST y AUDIT corren el backend de 10.A.7 (`ArticleDetailDTO` aún tiene brief en root, `ArticleUpdateRequest` aún acepta brief), pero los tres rompen el editor en cuanto el backend de 10.A.8 llega a un entorno (10.A.11):

1. `ContentArticleEditor.jsx:250` — `applyArticle` leía `dto.brief` del root del `ArticleDetailDTO`. Tras 10.A.8 ese campo ya no existe y la lectura devuelve `undefined`; el textarea de brief quedaba vacío al cargar cualquier artículo existente. Cosmético hasta que el operador intenta editar.
2. `ContentArticleEditor.jsx:393` — `handleSaveSharedMeta` enviaba `brief: sharedMeta.brief` en el PATCH a `/articles/{id}`. Tras 10.A.8 el `ArticleUpdateRequest` no acepta brief; Jackson lo ignora silenciosamente. El operador ve el banner "Metadata guardada." y cree que el brief quedó persistido, pero el backend lo descarta sin error visible. Regresión funcional silenciosa.
3. `ReviewChecklist.jsx:83-84` — el invariante `brief` se calculaba con `isNonEmpty(article.brief)`. Tras 10.A.8 siempre vale `undefined` → el check siempre falla → el botón "Enviar a revisión" queda bloqueado permanentemente con warning "Faltan campos: Brief presente". Bloqueo total de la operación editorial.

El operador confirmó en el punto de control de fase 1 que los tres bugs se arreglan en este mismo paquete (en lugar de abrir un 10.A.10.bis). Sin esos fixes, el despliegue 10.A.11 dejaría el admin del CMS roto.

**Refactor aplicado en 6 fases**:

Fase 2 — Editor:

- `ContentArticleEditor.jsx`:
  - Cabecera JavaDoc-style del componente actualizada con nota sobre ADR-027 (brief ya no en metadata compartida; ahora per-locale).
  - `initialSharedMeta`: eliminado el campo `brief`.
  - `initialCreateMeta`: añadido campo `brief: ''` (el brief inicial acompaña a slug + title del locale primario, no a la metadata compartida).
  - Constante nueva `BRIEF_MAX = 8192` (espeja `BRIEF_MAX` del backend).
  - `applyArticle`: eliminada la lectura `brief: dto.brief || ''` (bug heredado #1).
  - `loadActiveBody`: el draft SEO ahora incluye `brief: tr.brief || ''` para que el campo per-locale se pre-cargue al cambiar de tab.
  - `handleCreate`: el brief inicial se lee de `createMeta.brief` y se envía en el root del POST (donde `ArticleCreateRequest` sigue aceptándolo y el servicio lo escribe en la translation ES tras 10.A.8).
  - `handleSaveSharedMeta`: eliminado `brief: sharedMeta.brief` del payload PATCH (bug heredado #2).
  - `handleSaveSeo`: añadida rama de diff para `brief`; si difiere del valor en BD lo incluye en el payload del `PATCH /translations/{locale}` (TranslationMetadataUpdateRequest acepta brief desde 10.A.8).
  - Sección "Campos solo de creación": añadido nuevo bloque para "Brief inicial (ES)" con `<BriefArea>`, contador de caracteres con umbrales 8000/8192 y asterisco rojo de obligatoriedad. Comentario inline explica que el brief inicial es un campo del locale primario, no de la metadata compartida.
  - Sección "Metadata compartida": eliminado el bloque del input brief que vivía entre keywords y heroImageUrl.
  - Botón "Crear artículo": disabled cuando slug/title/brief vacíos o brief > 8192. Tooltip explica que falta el brief obligatorio.

- `BodyLocaleTabs.jsx`:
  - Constante `LIMITS` ampliada con `brief: 8192`.
  - Constantes nuevas `BRIEF_REQUIRED_LOCALE = 'es'` y `BRIEF_WARN_THRESHOLD = 8000` para encapsular las dos reglas (ADR-027 D3 + umbral visual).
  - Cálculo nuevo de `briefWarn`, `briefRequired`, `briefEmpty`, `briefMissingRequired`, `briefWarnZone`.
  - Render: nuevo bloque `<BriefArea>` con `rows={4}` debajo del de meta_description, con asterisco rojo de obligatoriedad si `activeLocale === 'es'`. Contador con tres niveles de color: gris neutro hasta 8000, amber entre 8000-8192, rojo a partir de 8192 o si está vacío en ES. Helper text contextual distinto para ES (obligatorio) y EN (opcional con nota sobre que el pipeline IA lo genera).
  - Botón "Guardar campos SEO": disabled añade `briefWarn.exceeded || briefMissingRequired` al conjunto de condiciones bloqueantes.

- `ReviewChecklist.jsx`:
  - Cabecera JavaDoc-style actualizada con nota sobre ADR-027 y el cambio del invariante `brief` → `briefEs`.
  - Invariante renombrado: `{ key: 'brief', ok: isNonEmpty(article.brief) }` → `{ key: 'briefEs', ok: !!trEs && isNonEmpty(trEs.brief) }`. La regla refleja exactamente `assertReadyForReview` del backend: brief obligatorio en ES, opcional en EN. No hay invariante `briefEn` (bug heredado #3 corregido).

Fase 3 — i18n:

- `i18n/locales/cms/es.json` + `i18n/locales/cms/en.json`:
  - `editor.fieldBrief`: mantenido pero placeholder reescrito para reflejar el nuevo propósito ("Texto descriptivo de 1-2 frases visible en cards del blog…" en lugar del vago "Resumen interno del artículo").
  - Claves nuevas: `editor.briefRequired`, `editor.briefHelperEs`, `editor.briefHelperEn`, `editor.fieldInitialBrief`, `editor.fieldInitialBriefPlaceholder`.
  - Renombrado: `checklist.brief` → `checklist.briefEs` (texto pasa de "Brief presente" / "Brief present" a "Brief ES presente" / "ES brief present").
  - Paridad ES/EN verificada vía grep. Sin claves huérfanas en `checklist.brief` ni en `sharedMeta.brief` tras el refactor.

Fase 4 — Tests: el directorio del editor admin no contiene tests unitarios ni de integración. No se introduce deuda nueva; es observación: cualquier verificación pasa por compilación, lint y prueba manual del operador. Anotado aquí para no perder el contexto.

Fase 5 — Build local: `cd frontend && npm run build:product` → exit 0. Hash nuevo del main: `main.04724b8b.js` (anterior `main.ff07af3c.js`). Delta gzipped: +677 B en el chunk del admin (`863.fb6b0ec7.chunk.js`, donde vive el editor code-splitteado), +2 B en main. Sin warnings nuevos; los listados son los preexistentes del proyecto (no-unused-vars en otros componentes, react-hooks/exhaustive-deps en FavoritesXxxList). **Bundle NO desplegado**.

Fase 6 — Documentación: esta sección en incident-notes. Entrada nueva en `project-log.md`. Sin ADR nuevo (el frente vive bajo ADR-027 ya ampliado en 10.A.9). Sin tocar `known-debt.md`, `test.md`, `audit.md`.

Estado al cierre del paquete 10.A.10:

- **Repositorio**: 3 ficheros React tocados (`ContentArticleEditor.jsx`, `BodyLocaleTabs.jsx`, `ReviewChecklist.jsx`), 2 ficheros i18n tocados (`cms/es.json`, `cms/en.json`), 6 claves nuevas, 1 clave renombrada, 1 clave huérfana eliminada. Bundle regenerado en `frontend/build/`. Nada commiteado.
- **Backend**: sin cambios desde 10.A.9 (JAR sigue en `target/sharemechat-v1-0.0.1-SNAPSHOT.jar` tras el build de 10.A.9, esperando 10.A.11).
- **Skills CMS**: sin cambios desde 10.A.9.
- **TEST / AUDIT**: sin cambios. Siguen corriendo el código de 10.A.7. Ningún drift.
- **Frente brief-per-locale**: 3 de 4 paquetes completados. Solo queda 10.A.11 (despliegue coordinado con ventana de mantenimiento).

Lecciones / observaciones:

- **Compilar el frontend al cerrar cualquier paquete que toque el backend** (regla retroactiva para el flujo): el paquete 10.A.8 cerró backend sin compilar el frontend; eso dejó tres bugs heredados que se descubrieron solo en la inspección de 10.A.10. Para frentes futuros con cambios de schema o DTOs, incluir como "fase 7 opcional" del backend un `cd frontend && npm run build:product` que detectaría usos rotos vía linting/typecheck aunque no hay tests. Aplicabilidad limitada por la ausencia de TypeScript en el frontend (no detecta lecturas de campos inexistentes en objects), pero un linter ESLint con regla "no-undef" sobre propiedades sí podría ayudar; pendiente de evaluar.
- **El editor admin tiene tres puntos de toque de brief, no uno**: (a) input compartido del top, (b) invariante del checklist, (c) handler PATCH del artículo padre. Un refactor de schema que toque un campo presente en root + per-locale tiene que tocar los tres. El operador documenta esto explícitamente en el ADR-027 para que futuros frentes parecidos sepan dónde mirar.
- **El asterisco rojo de obligatoriedad ES + helper text diferenciado por locale dentro de `BodyLocaleTabs`** es un patrón nuevo en el editor: hasta ahora todos los campos per-locale tenían el mismo trato (todos requeridos o todos opcionales por igual). Brief introduce la primera asimetría real ES vs EN dentro del componente reusable. La implementación queda local a `BodyLocaleTabs` (la constante `BRIEF_REQUIRED_LOCALE = 'es'`), no se generaliza a "lista de campos requeridos por locale" porque no hay otros candidatos a futuro corto. Si surgen más asimetrías (hipotético: meta_description obligatoria solo en ES pero no en EN), generalizar entonces, no antes.
- **Bundle delta de +679 B gzipped es proporcional al volumen del cambio**: tres input blocks nuevos, seis claves i18n, una clase de validación. No hay regresiones de tamaño del bundle.

### Paquete 10.A.11 fase 1: despliegue brief-per-locale a TEST 2026-05-23

Despliegue completo del frente brief-per-locale (10.A.8 backend + 10.A.9 skills + 10.A.10 frontend) a TEST. Flyway V3 aplicada limpiamente, JAR y bundle desplegados, end-to-end del pipeline editorial validado con un run real. **Sin ventana de mantenimiento neta** porque al iniciar la sesión TEST estaba encendida con el backend caído (escenario distinto al asumido por el prompt). AUDIT queda intencionalmente sin tocar para una sesión aparte.

**Sorpresas que reformularon el procedimiento de la sesión**:

1. **TEST estaba encendido pero el JAR antiguo no se había lanzado tras el reboot** (uptime 8 min, sin proceso java). El prompt asumía "ENCENDIDO y operativo con la versión actual"; la realidad mostraba EC2 viva pero backend no arrancado. Causa probable: el operador encendió la EC2 sabiendo que el siguiente paso era reemplazar el JAR, así que evitó el bootstrap del JAR antiguo. El operador confirmó "saltar stop, arrancar directamente el JAR nuevo" en el AskUserQuestion, lo que ahorró un arranque innecesario. Patrón aplicable para futuros frentes que toquen backend en TEST: si el operador ha encendido la EC2 expresamente para una sesión de despliegue, probablemente no haya arrancado el backend antiguo — verificar antes de asumir ventana real de stop/start.

2. **TEST no usa systemd**; el backend corre como proceso `java -jar` arrancado a mano (confirmado en `test.md:56`). El prompt incluía `sudo systemctl stop sharemechat-test.service` que habría fallado con "Unit sharemechat-test.service could not be found". Procedimiento corregido en vivo: rename JARs + arranque con `nohup java -jar … --spring.profiles.active=test > backend.log 2>&1 &`.

3. **El role IAM `sharemechat-ec2-test-role` no tiene `s3:PutObject` sobre `sharemechat-backups`** (AccessDenied al intentar subir el dump desde test-backend). AUDIT sí tiene la policy (10.A.1). Pivot: descarga del dump via scp a la máquina local y subida con las credenciales del usuario IAM del operador. Deuda anotada para cierre futuro: replicar `SharemechatContentBackupsRW` (o equivalente) sobre el role TEST cuando convenga. No bloqueante para esta sesión.

**Fase 1 — Pre-flight**:

- SSH a test-backend OK (`ip-172-31-29-117.eu-central-1.compute.internal`, uptime 8 min).
- JAR local: `target/sharemechat-v1-0.0.1-SNAPSHOT.jar`, SHA256 `a840bec7723428ca3cf57b59b2380e4ece306a4aa795f273d348b4c07faba094`, 106.058.409 bytes, fecha local 2026-05-23 10:47 (zona horaria Madrid).
- Bundle frontend: `main.04724b8b.js` (de 10.A.10) ya en `frontend/build/`. Reutilizado, no se recompiló.
- Backup BD: `mysqldump --single-transaction --routines --triggers --events --hex-blob --set-gtid-purged=OFF` ejecutado en test-backend. Resultado: `test-backup-pre-10A11-2026-05-23-0902.sql.gz` (683.481 bytes, SHA256 `a7e77b2e85cba75c2a0f5cf01d1db9976ab75ea6b5fae5025599e2355ad5d2cb`). Subido a `s3://sharemechat-backups/test/test-backup-pre-10A11-2026-05-23-0902.sql.gz` (verified via head-object: ContentLength 683481, LastModified 2026-05-23T09:03:19+00:00).
- Estado BD pre-cambio: 50 tablas, Flyway v2 (baseline + V2 cms del 2026-05-16). `content_articles.brief` presente; `content_article_translations.brief` ausente. 2 artículos (id=1 PUBLISHED, id=2 IN_REVIEW), 4 translations con body.

**Fase 2 — Deploy bundle frontend (mientras backend caído)**:

- `deploy-frontend.ps1 test product -SkipBuild` ejecutado. Sync de 10 ficheros a `s3://sharemechat-frontend-test/`. El chunk admin antiguo `863.84a34307.chunk.js` eliminado; el nuevo `863.fb6b0ec7.chunk.js` (donde vive `ContentArticleEditor.jsx` refactor 10.A.10) subido. `main.04724b8b.js` subido.
- Invalidación CloudFront `E2Q4VNDDWD5QBU` con paths `/*` → ID `I48RBXIIW8TB4G1ZVDI3IIR6F2`. Espera de Completed: ~50 segundos.
- Validación post-invalidation: `curl -s https://test.sharemechat.com/` → HTTP 200, 736 bytes (index.html con script ref a `main.04724b8b.js`).
- No hay validación intermedia de API porque el backend estaba caído desde antes; el bundle nuevo no requiere backend para servirse.

**Fase 3 — Subir JAR nuevo**:

- `scp` del JAR local a `test-backend:/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar.new`.
- SHA256 remoto idéntico al local (`a840bec7…`). JAR antiguo (May 22 20:52, 106.056.697 bytes) intacto en su nombre original.

**Fase 4 — Rename + arranque del JAR nuevo (sin stop, no había servicio activo)**:

- 09:11:26 UTC — Inicio del comando rename + nohup.
- Rename: `sharemechat-v1-0.0.1-SNAPSHOT.jar` → `…jar.bak.10A11`; `…jar.new` → `sharemechat-v1-0.0.1-SNAPSHOT.jar`.
- Arranque: `nohup java -jar …jar --spring.profiles.active=test > /home/ec2-user/sharemechat-v1/backend.log 2>&1 &`. PID 3032.
- 09:11:35.182 UTC — Flyway conecta a la BD (MySQL 8.4; warning de Flyway "newer than tested" no bloquea).
- 09:11:35.400 UTC — `Successfully validated 4 migrations`. (Nota: la BD termina con 3 filas en `flyway_schema_history`. Flyway cuenta el baseline + V1 + V2 + V3 = 4 en su validación interna aunque V1 no esté presente como fila al ser marcado por el baseline; comportamiento normal documentado.)
- 09:11:35.541 UTC — `Migrating schema "db1_sharemechat_test" to version "3 - brief per locale"`.
- 09:11:35.758 UTC — `Successfully applied 1 migration to schema, now at version v3 (execution time 00:00.136s)`.
- 09:11:57.883 UTC — `Started SharemechatV1Application in 30.67 seconds`.

Ventana "neta de servicio interrumpido": 0 segundos (no había backend antiguo corriendo). Tiempo total desde rename hasta servicio listo: 31 segundos. Si la EC2 hubiera tenido el backend antiguo corriendo, la ventana habría sido ~33-40 s (5 s stop + 28 s arranque + 0.14 s Flyway V3).

**Fase 5 — Validación**:

- Smoke tests curl:
  - `GET /api/users/me` → HTTP 401 (content-length 0, sin enmascaramiento HTML).
  - `GET /api/public/content/articles?locale=es` → HTTP 200 application/json.
  - `GET /api/public/content/articles?locale=en` → HTTP 200 application/json.
- Detalle público article 1: ES con brief poblado (271 chars en español); EN con brief NULL (esperado per ADR-027 D5.1 — la migración solo backfilled ES, el EN se rellena con runs nuevos del pipeline).
- Verificación BD:
  - `flyway_schema_history`: 3 filas. V3 con execution_time=0.14 s, success=1, installed_on=2026-05-23 09:11:35.
  - `DESCRIBE content_articles`: columna `brief` **eliminada** ✓.
  - `DESCRIBE content_article_translations`: columna `brief TEXT NULL` **añadida** ✓, posicionada tras `meta_description` como ADR-027 D1 prescribe.
  - Briefs: tr_id=1 (article 1 ES) y tr_id=3 (article 2 ES) poblados via backfill (271 y 284 chars); tr_id=2 (article 1 EN) y tr_id=4 (article 2 EN) NULL.
- Validación visual del operador en navegador incógnito: OK (confirmado via AskUserQuestion).
- Validación end-to-end del pipeline editorial: el operador ejecutó un run en Cowork con las skills sincronizadas (10.A.9), copió el JSON resultante (con `locales.{es,en}.brief`) y lo pegó en admin TEST. Resultado en BD: artículo nuevo id=3 PUBLISHED, run 4 VALIDATED a 10:25:08. Translations: tr_id=5 (ES) brief 284 chars en español; tr_id=6 (EN) brief 266 chars en inglés. Confirma que skills emiten brief per-locale, adapter Java acepta el JSON, y `applyTranslationFromJson` persiste el brief en la translation EN.

Estado de TEST al cierre del paquete 10.A.11 fase 1:

- **Schema BD**: v3 (baseline + V2 + V3 brief per locale).
- **JAR backend**: `sharemechat-v1-0.0.1-SNAPSHOT.jar` SHA256 `a840bec7723428ca3cf57b59b2380e4ece306a4aa795f273d348b4c07faba094`, corriendo PID 3032 desde 09:11:57 UTC con perfil `test`.
- **JAR backup**: `sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A11` (pre-refactor 10.A.7 + 10.A.6 + 10.A.5, May 22 20:52) conservado en `/home/ec2-user/sharemechat-v1/` para rollback.
- **Bundle frontend**: `main.04724b8b.js` en `s3://sharemechat-frontend-test/` con `863.fb6b0ec7.chunk.js` para el editor admin refactorizado.
- **Backup BD pre-cambio**: en `s3://sharemechat-backups/test/test-backup-pre-10A11-2026-05-23-0902.sql.gz` (683.481 B).
- **Skills CMS en Cowork del editor**: sincronizadas con el repo por el operador antes del despliegue (confirmado en el prompt y validado end-to-end con el run del pipeline).
- **AUDIT**: sin cambios. Sigue corriendo el backend de 10.A.7 (sin V3 ni refactor). Despliegue AUDIT en sesión aparte.

Lecciones / observaciones:

- **El run editorial completo del pipeline nuevo funcionó al primer intento sin errores**, lo que valida tres meses de refactor coordinado (10.A.8 backend + 10.A.9 skills + 10.A.10 frontend) sin necesidad de fixups intermedios. La estrategia "tres paquetes locales sin desplegar, despliegue coordinado en uno solo" probó su valor: el riesgo de drift entre repo y entornos durante un mes fue cero porque todos los paquetes vivieron en local hasta esta sesión.
- **La ausencia de ventana neta es un efecto secundario afortunado del estado encontrado** (EC2 encendida sin backend), no del diseño del paquete. Para AUDIT no aplicará: AUDIT corre 24/7 como systemd, así que habrá ventana real de ~30-40 segundos. La página de mantenimiento (`MaintenanceProvider` activa, paquete 10.A.3.pre) cubrirá ese hueco.
- **La deuda IAM del role TEST sobre `sharemechat-backups` quedó pendiente** sin bloquear esta sesión gracias al pivot via scp + upload local. Si surge una sesión TEST que requiera subidas frecuentes a backups (por ejemplo, snapshots periódicos automatizados), conviene replicar la policy de AUDIT antes. Para el flujo manual actual el pivot es aceptable.
- **El `--spring.profiles.active=test` se pasó explícitamente al `java -jar`** porque test-backend no tiene `SPRING_PROFILES_ACTIVE` en el .env. La invariante "el JAR sabe en qué entorno corre" se mantiene via flag de línea de comando, no via variable. Conviene documentarlo en `test.md` si no está ya (ver D.3).

### Paquete 10.A.11 fase 2: despliegue brief-per-locale a AUDIT + sync assets 2026-05-23

Cierre del frente brief-per-locale: AUDIT nivelado al estado funcional de TEST. JAR fresco recompilado localmente + bundle product + bundle admin desplegados; ventana de mantenimiento real con systemd (47 segundos backend abajo), Flyway V3 aplicada en 190 ms; sync assets TEST → AUDIT ejecutado como no-op (los dos buckets ya estaban perfectamente sincronizados antes del comando). End-to-end del pipeline editorial NO se valida en esta sesión (AUDIT no es entorno editorial activo: tiene 1 artículo pre-migración con brief EN NULL, suficiente para confirmar refactor); la validación end-to-end queda cubierta por la sesión TEST (10.A.11 fase 1) del 2026-05-23 09:11 UTC. **Sin commit todavía**.

**Sorpresas operativas de la sesión**:

1. **Hostname RDS AUDIT no seguía el patrón asumido**: el prompt sugería extender la convención `db1-sharemechat-test-v2.…` reemplazando `test` por `audit`. La realidad: el endpoint AUDIT es `db1-sharemechat-audit.…` (sin sufijo `-v2`). El primer `mysqldump` falló con `Unknown MySQL server host`. Localización del endpoint correcto via grep de `spring.datasource.url` en `application-audit.properties`. Lección: nunca extrapolar endpoints RDS por convención de nombre; siempre leerlos de las properties versionadas o del mapping local.

2. **El role IAM `sharemechat-ec2-audit-role` NO tenía `s3:PutObject` sobre `sharemechat-backups`**, pese a que el prompt asumía "IAM correcto desde 10.A.1". Lo que aplicó el operador en 10.A.1 fue `SharemechatContentPrivateAuditRW` sobre el bucket `sharemechat-content-private-audit`, NO sobre `sharemechat-backups`. Mismo AccessDenied que vimos en TEST en la fase 1. Pivot conocido: descarga del dump a local via scp + upload con credenciales de usuario IAM del operador. Deuda IAM extendida: ahora confirmada en **AUDIT también**, no solo TEST. Ambos roles necesitan policy de write sobre `sharemechat-backups` si en algún momento se automatizan backups; por ahora el pivot manual funciona.

3. **El sync TEST → AUDIT fue no-op**: pre-sync ambos buckets ya tenían los mismos 48 objetos (mismas claves, mismos tamaños, salvo los 2 bytes esperados del manifest legal custom). El prompt asumía que TEST tendría un rename `foto-perfil-videochat.webp → foto-perfil-dating.webp` no propagado a AUDIT y assets nuevos del article 3 creado durante la validación 10.A.11 fase 1, pero ambos cambios ya estaban en AUDIT antes de esta sesión (el operador debió haberlos propagado fuera de banda, o el article 3 de TEST no generó assets nuevos al bucket). El comando `aws s3 sync` se ejecutó por completitud y confirmó "nada que transferir" (output vacío). Documentado como hecho operativo.

4. **`AUDIT tenía 1 artículo + 2 translations` pre-V3** (no 0 como sugería el prompt). El backfill V3 pobló la translation ES con el brief existente (271 chars); la EN queda NULL. Esto NO altera el procedimiento; solo el reporte cuantitativo final.

**Fase 1 — Pre-flight**:

- SSH `audit-backend` OK (`ip-172-31-19-114.eu-central-1.compute.internal`, uptime 37 días 9h, servicio activo 18h).
- JAR actual remoto: `sharemechat-v1-0.0.1-SNAPSHOT.jar` (106.056.697 B, fecha 2026-05-22 21:35 UTC, SHA256 `4b0679f4a34cb9305a75ee9fd80e67b3e6b053e9658b74a00c87c58178bb5a13` = JAR del 10.A.7).
- JAR local recompilado con `./mvnw clean package -DskipTests`: BUILD SUCCESS en 15.4 s. Resultado: `sharemechat-v1-0.0.1-SNAPSHOT.jar` 106.058.409 B, SHA256 `a760d8bde8d2e68914ba43b484c4d69d349792426d90cb3fbed23b8d918fff04` (diferente al de TEST en 10.A.11 fase 1 porque Maven incluye timestamps de compilación; el contenido lógico es idéntico).
- Bundle frontend recompilado:
  - `npm run build:product` → `main.04724b8b.js` + `863.fb6b0ec7.chunk.js` (mismos hashes que TEST 10.A.11 fase 1; CRA produce hashes determinísticos cuando el código no cambia).
  - `npm run build:admin` → `main.303de798.js` + `863.cd6c9d0f.chunk.js` (admin surface, primer build de admin desde el refactor de 10.A.10).
- Backup BD AUDIT: dump `audit-backup-pre-10A11-fase2-2026-05-23-1614.sql.gz` (137.395 B, SHA256 `f5c2f35bd09e58e07db8214081c548f0b8f230bb928dff9071ebf676046381b3`), subido a `s3://sharemechat-backups/audit/audit-backup-pre-10A11-fase2-2026-05-23-1614.sql.gz` a 16:17:02 UTC via pivot scp + upload local (sorpresa #2).
- Estado BD pre-cambio: 50 tablas, Flyway v2 (baseline + V2 del 2026-05-22 18:31 UTC). `content_articles.brief` presente; `content_article_translations.brief` ausente. 1 artículo, 2 translations (sorpresa #4).

**Fase 2 — Deploy bundles frontend (mientras backend antiguo sigue corriendo)**:

- `deploy-frontend.ps1 audit product -SkipBuild` → sync a `s3://sharemechat-frontend-audit/`, chunk admin antiguo `863.84a34307.chunk.js` eliminado, `main.04724b8b.js` + `863.fb6b0ec7.chunk.js` subidos. Invalidación CloudFront product `E1ILXV7P6ENUV8` con paths `/*` → ID `I921A5JSB1LXKG3EUSS2X96TBE`.
- Build admin (`npm run build:admin`) sobrescribe `frontend/build/` con surface admin. Hashes: `main.303de798.js`, `863.cd6c9d0f.chunk.js`.
- `deploy-frontend.ps1 audit admin -SkipBuild` → sync a `s3://sharemechat-admin-audit/`. Invalidación CloudFront admin `E21IB0VBKYNNBW` con paths `/*` → ID `I7B3DMF6VO3XBNDP315HP29BRK`.
- Validación intermedia (backend AUDIT aún antiguo): `curl https://audit.sharemechat.com/` → HTTP 200 con `main.04724b8b.js`; `curl https://admin.audit.sharemechat.com/` → HTTP 200 con `main.303de798.js`. Backend antiguo no bloquea servir los bundles nuevos (el contrato compartido del backend es aditivo).

**Fase 3 — Subir JAR nuevo a AUDIT**:

- `scp target/sharemechat-v1-0.0.1-SNAPSHOT.jar audit-backend:.../sharemechat-v1-0.0.1-SNAPSHOT.jar.new`.
- SHA256 remoto idéntico al local: `a760d8bde8d2e68914ba43b484c4d69d349792426d90cb3fbed23b8d918fff04` ✓.
- JAR antiguo intacto. Tres `.bak` previos: `.bak.10A3` (pre-CMS-v2, 2 mayo), `.bak.10A7` (pre-refactor 10.A.5, 22 mayo 18:30), `.bak.10A11-fase2` (este paquete; se crea en fase 4).

**Fase 4 — Ventana de mantenimiento (systemd)**:

| Timestamp UTC | Evento |
|---|---|
| 16:20:21 | `sudo systemctl stop sharemechat-audit.service` |
| 16:20:27 | Service inactive confirmado |
| 16:20:37 | Rename JARs + `sudo systemctl start` |
| 16:20:44.798 | Flyway conecta a BD |
| 16:20:45.121 | `Migrating schema "db1_sharemechat_audit" to version "3 - brief per locale"` |
| 16:20:45.369 | `Successfully applied 1 migration to schema, now at version v3 (execution time 00:00.185s)` |
| 16:21:08.369 | `Started SharemechatV1Application in 31.151 seconds` |

**Ventana total backend abajo: 47 segundos** (16:20:21 → 16:21:08). Margen estable vs 33 s del 10.A.7 (donde no había Flyway aplicando) y vs 77 s del 10.A.3 (donde había baseline manual previo). En este paquete la única operación BD adicional fue V3 (185 ms), por debajo del ruido del bootstrap.

El `MaintenanceProvider` del SPA del paquete 10.A.3.pre cubrió la ventana visualmente para cualquier usuario que navegase: durante los 47 s, los fetch a `/api/*` recibieron 502/503 desde nginx y el SPA mostró el overlay industrial bilingüe. No hubo validación de eso porque no había usuarios reales navegando AUDIT durante el cambio.

**Fase 5 — Validación funcional**:

- Smoke tests curl:
  - `GET /api/users/me` → HTTP 401 limpio (content-length 0, sin enmascaramiento HTML).
  - `GET /api/public/content/articles?locale=es` → HTTP 200 application/json.
  - `GET /api/public/content/articles?locale=en` → HTTP 200 application/json.
- Verificación BD:
  - `flyway_schema_history`: 3 filas. V3 con execution_time=0.19 s, success=1, installed_on=2026-05-23 16:20:45.
  - `DESCRIBE content_articles`: columna `brief` **eliminada** ✓.
  - `DESCRIBE content_article_translations`: columna `brief TEXT NULL` **añadida** tras `meta_description` ✓.
  - Translations: tr_id=1 (article 1 ES) brief 271 chars (backfill); tr_id=2 (article 1 EN) brief NULL.
- Validación visual del operador: OK confirmada via AskUserQuestion.
- **End-to-end del pipeline NO se ejecuta en esta sesión**: AUDIT no es entorno editorial. La validación end-to-end del pipeline 10.A.9 con run real ya está cerrada por la sesión TEST 10.A.11 fase 1 con article 3 / run 4 / tr 6 (266 chars en inglés).

**Fase 6 — Sync assets TEST → AUDIT**:

- Pre-sync inspección: TEST 48 objetos / 3.167.760 B; AUDIT 48 objetos / 3.167.758 B. Diff por clave + tamaño: **única diferencia**: `legal/model_contract.manifest.json` (213 B TEST vs 211 B AUDIT, los 2 bytes esperados del manifest custom). El resto (47 objetos) ya está perfectamente sincronizado entre los dos buckets.
- `aws s3 sync s3://assets-sharemechat-test1/ s3://assets-sharemechat-audit/ --delete --exclude "legal/model_contract.manifest.json"` ejecutado. Output: vacío (nada que transferir, nada que eliminar). El comando se confirmó por completitud documental, aunque resultó no-op. AUDIT mantiene 48 objetos / 3.167.758 B post-sync.
- Manifest legal AUDIT verificado: `assets.audit.sharemechat.com/legal/model_contract.pdf` (URL adaptada del 10.A.7 preservada).
- Invalidación CloudFront assets AUDIT `E2NC4TEJAWOI3L` con paths `/*` → ID `I4S3NBGRJRA2YYQ24FYKS7LRHK`.
- Spot-checks via CDN:
  - `foto-perfil-dating.webp`: HTTP 200, 84.748 B, image/webp ✓ (rename ya propagado a AUDIT antes de esta sesión, fecha 2026-05-23 17:52 local).
  - `foto-perfil-videochat.webp`: HTTP 403 (nombre viejo no existe; OAC enmascara 404 como 403, lección 10.A.3.pre) ✓.
  - `home/hero/hero_desktop_v1.webp`: HTTP 200, 41.314 B ✓.

Estado de AUDIT al cierre del paquete 10.A.11 fase 2:

- **Schema BD**: v3 (baseline + V2 + V3 brief per locale).
- **JAR backend**: `sharemechat-v1-0.0.1-SNAPSHOT.jar` SHA256 `a760d8bde8d2e68914ba43b484c4d69d349792426d90cb3fbed23b8d918fff04` corriendo PID 2046455 desde 16:21:08 UTC con perfil `audit` via systemd `sharemechat-audit.service`.
- **JAR backups**: `.bak.10A3` (pre-CMS-v2), `.bak.10A7` (pre-refactor 10.A.5), `.bak.10A11-fase2` (pre-refactor brief-per-locale, este paquete, 22 mayo 21:35 UTC).
- **Bundle frontend product**: `main.04724b8b.js` en `s3://sharemechat-frontend-audit/`.
- **Bundle frontend admin**: `main.303de798.js` en `s3://sharemechat-admin-audit/`.
- **Bucket assets**: 48 objetos sincronizados con TEST + manifest legal custom AUDIT preservado.
- **Backup BD pre-cambio**: `s3://sharemechat-backups/audit/audit-backup-pre-10A11-fase2-2026-05-23-1614.sql.gz` (137.395 B).
- **AUDIT y TEST funcionalmente paritarios** a nivel de schema, código backend, bundles frontend y skills (las skills viven en el Cowork del operador y son entorno-agnósticas).

Frente 10.A cerrado completamente. Frente brief-per-locale al 4/4 paquetes.

Lecciones / observaciones:

- **El despliegue AUDIT siguió el mismo patrón que TEST sin fricciones**, salvo las dos sorpresas IAM/hostname documentadas como #1 y #2. Esto valida la convergencia funcional alcanzada en el 10.A.7 (TEST y AUDIT compartiendo el mismo JAR + properties por entorno) y reafirma que la inversión en el refactor 10.A.5 (URLs por properties) paga dividendos: el mismo binario funciona en ambos sin recompilación, solo cambian las properties.
- **El sync TEST → AUDIT como no-op cierra el ciclo operativo del frente 10.A**: el operador había mantenido AUDIT casi al día de TEST entre sesiones (incluyendo el rename `videochat → dating` y posibles correcciones manuales). Llegar a este punto sin nada que sincronizar es la prueba de que la disciplina operativa "mantén AUDIT cercano a TEST" se ha consolidado.
- **Recompilar el JAR localmente justo antes del despliegue produce un SHA256 distinto al de TEST aunque el código sea idéntico** (Maven incluye timestamps). La verificación de integridad debe hacerse comparando local vs remoto del mismo build (`scp` de un JAR + `sha256sum` antes y después de la copia), no asumiendo que un mismo commit produce el mismo SHA256 en dos compilaciones distintas. Esto es disciplina ya establecida pero conviene reiterarlo cuando se hagan despliegues a distintos entornos con builds separados.
- **AUDIT mantiene 47 segundos de ventana real frente a 0 segundos de TEST** porque AUDIT corre 24/7 con systemd mientras TEST se enciende/apaga manualmente. La página de mantenimiento cubrió el hueco visualmente; no hubo validación de usuarios reales viendo el overlay durante la ventana (es entorno operativo del equipo, no producción).
- **Deuda IAM extendida**: ambos roles (`sharemechat-ec2-test-role` y `sharemechat-ec2-audit-role`) carecen de `s3:PutObject` sobre `sharemechat-backups`. El bucket de backups multi-env se creó en 10.A.1 pero la policy aplicada en su día (`SharemechatContentPrivateAuditRW`) era sobre `sharemechat-content-private-audit`, no sobre el bucket de backups. Si se quiere automatizar backups periódicos (por cron en EC2, por ejemplo), abrir paquete `10.A.11.bis` o similar para añadir policies de write sobre `sharemechat-backups` a ambos roles. Hasta entonces, el pivot scp + upload local es el patrón operativo.

### Limpieza de ficheros residuales en EC2 TEST y AUDIT 2026-05-23

Tras varias sesiones de despliegue del frente 10.A (paquetes 10.A.0 a 10.A.11), ambas EC2 acumularon ficheros residuales: dumps locales de BD ya superados por los backups oficiales en `s3://sharemechat-backups/`, `.jar.bak` de despliegues anteriores conservados como rollback histórico que el operador decidió descartar, scripts SQL pre-Flyway, ficheros de prueba sueltos, cookies de testing. Limpieza conservadora: borrar lo claro, preservar inciertos.

**TEST — 6 ficheros eliminados (~110 MB)**:

- `/home/ec2-user/backup-pre-flyway-test-20260516-2007.sql` (4.0 MB, 16 may 20:07) — dump local pre-Flyway de 10.A.3, oficial vive en S3.
- `/home/ec2-user/cookies.txt` (131 B, 17 may) — cookie de prueba operativa residual.
- `/home/ec2-user/openssl` (0 B, 29 dic 2024) — fichero vacío huérfano antiguo.
- `/home/ec2-user/test.txt` (24 B, 23 abr) — fichero de prueba.
- `/home/ec2-user/sharemechat-v1/rename.sql` (3.7 MB, 2 abr) — script SQL pre-Flyway de renombrado de tablas; ya aplicado, schema actual gestionado por Flyway.
- `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A11` (102 MB, 22 may 20:52) — `.jar.bak` del despliegue brief-per-locale; consigna del operador: descartar todos los rollbacks locales.

**AUDIT — 6 ficheros eliminados (~283 MB)**:

- `/home/ec2-user/V1__baseline.sql` (44 KB, 16 may 18:06) — copia local del baseline aplicado en 10.A.3; vive en BD y en el repo.
- `/home/ec2-user/audit.txt` (32 B, 11 abr) — fichero de prueba.
- `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A11-fase2` (102 MB, 22 may 21:35) — `.jar.bak` 10.A.11 fase 2.
- `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A3` (79 MB, 2 may 09:55) — `.jar.bak` pre-CMS-v2.
- `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A7` (102 MB, 22 may 18:30) — `.jar.bak` pre-refactor 10.A.5.
- `/tmp/audit-backup-pre-10A11-fase2-2026-05-23-1611.sql` (0 B, 23 may 16:15) — residuo del primer intento de `mysqldump` que falló por hostname RDS incorrecto en 10.A.11 fase 2; quedó como fichero vacío en `/tmp` porque el operador no había añadido cleanup explícito para el caso de fallo.

**Inciertos preservados (no borrados) para revisión futura**:

- TEST: `/opt/sharemechat/.env.backup-graph` (162 B), `/opt/sharemechat/.env.bak_turn_2026-04-22_191814` (803 B).
- AUDIT: `/home/ec2-user/turn-audit-credentials.txt` (78 B), `/opt/sharemechat/.env.bak.10A3.2026-05-22` (1.3 KB), `/opt/sharemechat/.env.bak.20260414135121` (746 B).

Total preservado: ~3 KB (despreciable). Razón: los `.env.bak*` son trazas históricas pequeñas que el operador puede querer mantener; `turn-audit-credentials.txt` contiene credenciales TURN en texto plano cuya eliminación amerita decisión explícita futura (mover a `.env`, eliminar definitivamente, o moverlo fuera del repo y de la EC2 a un gestor de secretos).

**Espacio recuperado**:

- TEST: `/` pasó de 3.6 G usado (46% de 8 GB) a 3.5 G usado (44%). Granularidad de `df` redondea a 100 MB; los 114 MB borrados se ven principalmente como reducción del 46% al 44%.
- AUDIT: `/` pasó de 3.1 G usado (39%) a 2.8 G usado (35%). 283 MB borrados se reflejan claramente.
- **Total: ~400 MB recuperados**, coherente con el estimado pre-limpieza de ~393 MB.

**Hallazgo lateral durante la verificación**:

Al hacer el check de salud post-limpieza, se observó que el **backend TEST no estaba corriendo** (HTTP 000 en `localhost:8080`, PID 3032 ausente). El log `backend.log` muestra un `Commencing graceful shutdown` a 17:11:09 UTC del 2026-05-23, **antes** del primer comando SSH de esta sesión (17:27 UTC). El backend recibió SIGTERM ordenado del operador entre el fin de la validación 10.A.11 fase 1 (último login real a 17:08:18 UTC) y el inicio de esta sesión de limpieza. No es efecto secundario del borrado: solo se eliminaron `.bak`, el JAR principal sigue intacto. El JAR principal `sharemechat-v1-0.0.1-SNAPSHOT.jar` queda en su sitio (102 MB, SHA256 sin cambios), listo para que el operador lo arranque cuando convenga con el comando documentado en `test.md` (`nohup java -jar … --spring.profiles.active=test &`).

Salud AUDIT post-limpieza: servicio `sharemechat-audit.service` activo, PID 2046455 estable desde 16:21 UTC, `GET localhost:8080/api/public/content/articles?locale=es` responde HTTP 200 en 12 ms. Sin regresión.

**Lecciones / observaciones**:

- **TEST no rearranca automáticamente tras reboot** (sin systemd unit del backend, ver `test.md`). Confirmado en esta sesión: la EC2 lleva uptime 8h41 con el backend caído desde 17:11. Si el operador encendió la EC2 esta mañana y no arrancó el JAR manualmente, TEST estuvo casi todo el día sin backend. Esto no es un problema operativo (TEST no sirve a producción) pero conviene tenerlo en cuenta cuando se planifique automatización: si en algún momento se quiere TEST always-on, añadir una unidad systemd. Mientras tanto, el arranque manual sigue siendo la convención.
- **Confirmar siempre que el dump remoto se limpia tras fallos**: el `/tmp/audit-backup-pre-10A11-fase2-2026-05-23-1611.sql` vacío quedó por un fallo del `mysqldump` cuando el hostname RDS estaba incorrecto (sesión 10.A.11 fase 2). El script `bash -s` se ejecutaba con `set -e` y abortó tras el fallo del dump, antes de poder limpiar. Si en el futuro se automatizan dumps con `cron`, añadir `trap` para limpiar `/tmp` tanto en éxito como en fallo.
- **`df -h` redondea a 100 MB**: para borrados que sumen menos de eso, el porcentaje no se mueve. Verificar con `du -sh` sobre rutas específicas si se quiere medir delta fino. En esta sesión la diferencia ~393 MB es lo suficientemente significativa para verse en `df` (TEST 46→44%, AUDIT 39→35%).

### Paquete 10.B.1: plus-addressing por entorno en pipeline perimetral 2026-05-23

Inauguración del frente 10.B (consolidación de observabilidad perimetral TEST). Se etiqueta el destinatario del email diario perimetral por entorno via sub-addressing RFC 5233 (Microsoft 365 lo soporta nativamente; verificado por el operador con pre-flight manual previo a la sesión). Diferencias post-paquete:

- AUDIT: destinatario pasa de `security+report@sharemechat.com` a `security+report-audit@sharemechat.com`.
- TEST: emails activados (antes el pipeline generaba reportes en disco pero no los enviaba). Destinatario `security+report-test@sharemechat.com`.

Frente operativamente trivial pese a su aparente envergadura: el pipeline TEST ya estaba desplegado en EC2 desde abril (normalizer + classifier + reporter + blocker, units systemd activas, scripts en `/opt/`, configs en `/etc/`), pero faltaban dos cosas para que el envío de email funcionase: las claves SMTP/EMAIL del `config.env` estaban vacías, y el `daily-report.service` invocaba al reporter sin `--send-email`. Ningún script ni unit nueva.

**Cambios aplicados (4 en EC2, 3 en repo)**:

EC2 AUDIT:
- `/etc/sharemechat-audit-access-reporter/config.env`: línea `EMAIL_TO` de `security+report@…` a `security+report-audit@…`. Backup previo `config.env.bak.10B1.2026-05-23`. Sin reinicio (el script hace `source` del config en cada ejecución).

EC2 TEST:
- `/etc/sharemechat-test-access-reporter/config.env`: rellenado con los mismos valores SMTP/EMAIL_FROM que AUDIT (mismo tenant Microsoft 365, misma cuenta emisora `operations@sharemechat.com`); destinatario `security+report-test@sharemechat.com`. Transferencia AUDIT → TEST por pipeline `ssh|sed|ssh tee` sin imprimir credenciales en logs locales. Backup previo `config.env.bak.10B1.2026-05-23`.
- `/etc/systemd/system/sharemechat-test-daily-report.service`: añadido `--send-email` al final del comando del reporter en ExecStart. Backup previo `.service.bak.10B1.2026-05-23`. `sudo systemctl daemon-reload` aplicado. Timer activo, próxima ejecución 2026-05-24 07:10 UTC.

Repo:
- `ops/audit-access/README.md` sección "Envio por email": destinatario actualizado a `security+report-audit@`, añadido párrafo sobre el patrón plus-addressing por entorno (audit/test/pro futuro) y la línea de estado "sub-addressing activo (validado 2026-05-23)".
- `ops/test-access/README.md`: sección nueva "Envio por email" (antes no existía) análoga a la de AUDIT, con destinatario `security+report-test@`, nota sobre intermitencia esperada por encendido/apagado manual de TEST, y nota explícita de que el cuerpo no marca DRY-RUN (sub-paquete 10.B.2 opcional).
- Esta entrada en incident-notes.
- Entrada en project-log.

**Validaciones manuales ejecutadas durante la sesión**:

- AUDIT: `sudo /opt/sharemechat-audit-access-reporter/bin/report-audit-access.sh --config /etc/sharemechat-audit-access-reporter/config.env --date 2026-05-22 --send-email` → exit 0. Body del reporte: 9 IPs analizadas, 2 CRITICA (`34.244.197.198` dotenv_probe+wordpress_scan score=217, `90.175.201.51` request_burst_500+many_routes_25 score=173), 1 MALICIOSA (`176.65.139.235`), 6 NORMAL. Operador confirma email recibido a `security+report-audit@`.
- TEST: `sudo /opt/sharemechat-test-access-reporter/bin/report-test-access.sh --config /etc/sharemechat-test-access-reporter/config.env --date 2026-05-22 --send-email` → exit 0. Body del reporte: 2 IPs analizadas, 1 CRITICA (`90.175.201.51` many_routes_25+request_burst_200 score=105), 1 NORMAL. Operador confirma email recibido a `security+report-test@` con subject `TEST access summary - 2026-05-22`.

**Sorpresas operativas**:

- **El pipeline TEST estaba "casi listo, faltaba la traca final"**: era una de las hipótesis del informe de investigación, confirmada al inspeccionar el ExecStart real del `daily-report.service` de TEST y descubrir que faltaba el flag `--send-email`. En AUDIT sí estaba (comparación directa de ambas units). El gap es de abril 2026 (cuando se desplegó el pipeline TEST como espejo de AUDIT), antes del frente brief-per-locale; pasó inadvertido porque el reporter SÍ generaba los ficheros `report.{txt,json}` localmente y la falta de email no levantaba ninguna alarma.
- **`SMTP_PASSWORD` en texto plano en `config.env`**: necesario para el flujo SMTP-AUTH actual. Apareció en stdout durante el primer `sudo cat` de Fase 1 (output del comando, no fichero del repo). Sanitizado en el reporte de sesión y en toda la documentación. Para futuras automatizaciones convendría mover SMTP_PASSWORD a un mecanismo más seguro (AWS Secrets Manager, systemd-creds), pero queda fuera del alcance del paquete actual.
- **Tamaño del config TEST post-cambio (548 B) vs AUDIT (547 B)**: 1 byte de diferencia explicado por `-test` vs `-audit` (mismo número de caracteres) más algún whitespace residual. Irrelevante.

**Deuda lateral detectada (NO se cierra en este paquete)**:

- `sharemechat-test-access-blocker.service` está en estado `failed` con error `Classifier summary not found: /var/log/sharemechat-test-access-classifier/2026-05-22.summary.jsonl`. La causa: el timer del blocker está programado a 05:45 UTC pero el classifier solo genera summary cuando se ejecuta el daily-report.service (07:10 UTC). Si TEST está apagado al pasar 05:45 UTC, al reencender la EC2, el catch-up del blocker se ejecuta antes que el del classifier (orden de timers) y falla. No bloquea el envío de email (el daily-report.service es independiente). Si conviene arreglarlo: sub-paquete `10.B.3` (separado, opcional).

- Cuerpo del email TEST NO menciona explícitamente el modo DRY-RUN del blocker. Solo el subject distingue entorno. Si conviene explicitar: sub-paquete `10.B.2` (separado, requiere tocar `ops/test-access-reporter/lib/report_access.py` y redesplegar el `lib/`).

**Estado de la EC2 TEST al cierre**: encendida (uptime 9h28min al inicio de esta sesión, sigue encendida al cerrar). Si el operador quiere apagarla, hacerlo manualmente desde la consola AWS o vía CLI.

Lecciones / observaciones:

- **El "pipeline TEST espejo de AUDIT" estaba al 95% desplegado pero al 0% funcional** en cuanto a email. Patrón aplicable: para frentes que replican un sistema existente, no asumir que estado-desplegado implica estado-funcional. Verificar los outputs finales del pipeline (en este caso: ¿llegó el email? no solo "¿hay reporte en disco?").
- **Plus-addressing es trivial cuando el tenant lo soporta**. El pre-flight manual del operador antes de la sesión fue clave: confirmó que Microsoft 365 enruta `security+<tag>@sharemechat.com` correctamente sin necesidad de crear aliases adicionales en Exchange Admin Center. Sin ese pre-flight, el frente habría tenido que incluir Bloque C "crear aliases" como contingencia; con la confirmación, ese bloque desapareció.
- **Pipeline `ssh audit | sed | ssh test tee` para transferir configs entre EC2 sin pasar por filesystem local**: técnica útil cuando el contenido tiene credenciales que no deben quedar ni en logs locales ni en filesystem local. Variante del patrón scp+upload local usado en frentes anteriores, pero aún más limpio porque ningún byte sensible toca la máquina del operador (solo pasa "en tránsito" por el pipe de bash).

### Paquete 10.B.4: allowlist de IPs operativas en classifier 2026-05-23

Cierre del segundo sub-paquete del frente 10.B (consolidación perimetral TEST). Resuelve un riesgo de self-block detectado tras el cierre del 10.B.1: en el primer email enviado por el pipeline TEST se marcó la IP del administrador del proyecto (`90.175.201.51`) como CRITICA score 105 con `main_reason=many_routes_25+request_burst_200`. Esa actividad correspondía a la validación manual del refactor brief-per-locale durante 10.A.10 y 10.A.11 fase 1 (680 requests en AUDIT, 230 en TEST, 60 y 53 rutas distintas respectivamente), no a un atacante. En TEST no causaba daño (blocker en DRY-RUN); en AUDIT (Carril A real desde 2026-04-24) la siguiente validación intensiva del operador habría escrito su propia IP a `/etc/nginx/deny-audit-ips.conf` y le habría dejado fuera de su entorno.

**Estrategia**:

Short-circuit del classifier por allowlist (mecanismo ya existente en el código del Python pero infrautilizado): el `apply_allowlist_rule` original aplicaba un descuento de `-30` puntos, claramente insuficiente para una IP con score natural >=100. Se reescribe `deterministic_assess` para que, si `features.allowlisted=True`, devuelva inmediatamente un Assessment(`NORMAL`, score=0, `main_reason=allowlisted_ip`, `recommended_action=ninguna`) sin aplicar ninguna otra regla. Esto incluye anular las `min_classification` de reglas con floor (shell_probe, sqlmap UA, etc.); el operador no usa esos UAs deliberadamente y, si lo hiciera en pruebas, el contexto lo justifica. El `features` completo se preserva en `summary.jsonl` para auditoría retrospectiva.

**Configuración**:

Variable `ALLOWLIST_IPS` (CSV de IPs literales) en `/etc/sharemechat-{audit,test}-access-classifier/config.env`. Ya existía en el bash wrapper y en el `config.env.example`; no requiere renaming. Valor aplicado en ambos entornos: `ALLOWLIST_IPS=90.175.201.51`.

**Cambios aplicados (4 ficheros código, 4 docs, 6 acciones EC2)**:

Código:

- `ops/audit-access-classifier/lib/classify_access.py` y `ops/test-access-classifier/lib/classify_access.py`: reescrito `deterministic_assess` con short-circuit; eliminado `apply_allowlist_rule` (función ya no se llama). Cambios simétricos en ambos entornos.
- `ops/audit-access-reporter/lib/report_access.py` y `ops/test-access-reporter/lib/report_access.py`: `build_report` añade campo `allowlisted_ips` (lista ordenada) leyendo `features.allowlisted` del summary; `render_text_report` emite una línea `IPs allowlisted: N - IP1, IP2` justo bajo `IPs analizadas`. Si la lista está vacía, la línea no se emite.

Documentación:

- `ops/audit-access-classifier/README.md` y `ops/test-access-classifier/README.md`: sección nueva "Allowlist operativa (paquete 10.B.4)" con formato, comportamiento short-circuit, casos de uso (validación manual, IP dinámica de ISP doméstico) y referencia al patrón futuro para PROD (header secreto HTTP cuando el operador trabaje desde IPs variables).
- `ops/audit-access/README.md` y `ops/test-access/README.md`: mención breve a la allowlist en la sección perimetral.

EC2 (3 por entorno):

- AUDIT: `scp` de `classify_access.py` y `report_access.py` actualizados a `/opt/sharemechat-audit-access-{classifier,reporter}/lib/`; modificación de `/etc/sharemechat-audit-access-classifier/config.env` con `ALLOWLIST_IPS=90.175.201.51`. Backups previos en `/tmp/*.bak.10B4.2026-05-23` y `/etc/.../config.env.bak.10B4.2026-05-23`.
- TEST: mismas 3 acciones espejadas. Backups previos análogos.

Sin `daemon-reload` necesario (los Python lib y los config.env se leen en cada ejecución del wrapper bash).

**Validación**:

- Sintaxis Python: `py_compile` OK sobre los 4 ficheros lib en local y en remoto.
- AUDIT: `classify-audit-access.sh --date 2026-05-22` muestra a `90.175.201.51` como NORMAL/score=0/`main_reason=allowlisted_ip` con `requests=680` y `distinct_routes=60` preservados. Resto de IPs sin cambio: `34.244.197.198` sigue CRITICA score 217 (atacante real dotenv_probe+wordpress_scan), `176.65.139.235` sigue MALICIOSA score 70 (dotenv_probe).
- TEST: `classify-test-access.sh --date 2026-05-22` muestra a `90.175.201.51` como NORMAL/score=0/`allowlisted_ip` (antes era CRITICA score 105). Resto de IPs (1 NORMAL adicional) sin cambio.
- Reporter regenerado en ambos entornos: la nueva línea `IPs allowlisted: 1 - 90.175.201.51` aparece bajo `IPs analizadas` en el body del reporte (.report.txt). El conteo `CRITICA: N` ya no incluye la IP operativa.
- Validación end-to-end por email diferida al ciclo natural del 24 may 07:10 UTC (no se ejecuta `--send-email` manual en esta sesión; el envío vía SMTP ya fue validado en 10.B.1 y la lógica de envío no cambió en este paquete).

**Sorpresas operativas**:

1. **El soporte de allowlist ya estaba 90% implementado en el código del classifier**. El bash wrapper ya leía `ALLOWLIST_IPS` y la pasaba como `--allowlist-ips`; el Python ya tenía `load_allowlist`, `FeatureSet.allowlisted`, y `apply_allowlist_rule`. El gap era operativo (variable vacía en `config.env`) y de magnitud (-30 puntos insuficiente). Patrón aplicable: cuando se necesite una feature, inspeccionar primero si el código ya la prepara. En este caso, hubo que reescribir la lógica del descuento por un short-circuit, pero no añadir parseo ni framework nuevo.

2. **El `config.env` de TEST tenía 3 IPs en `ALLOWLIST_IPS` antes de tocar nada** (`63.180.48.12,90.175.201.51,90.166.58.225`). Origen desconocido; probablemente IPs operativas antiguas que el operador o un agente anterior añadieron sin documentar. Tras consulta vía AskUserQuestion el operador confirmó que las dos IPs adicionales eran obsoletas y aceptó dejar solo `90.175.201.51`. Backup preservado en `/etc/sharemechat-test-access-classifier/config.env.bak.10B4.2026-05-23` por si en el futuro alguien necesita reconstruir esa lista. Lección: confirmar antes de sobrescribir variables con contenido preexistente, incluso cuando el prompt asume estado vacío.

3. **El descuento -30 original era cosmético**: la rebaja matemática nunca era suficiente para sacar al operador de la categoría MALICIOSA cuando score natural >=60. Era una protección teórica que no funcionaba en la práctica. El short-circuit garantiza el comportamiento independiente del score natural.

**Patrón futuro (no implementado en este paquete)**:

Para PROD futuro, cuando el operador trabaje desde IPs variables (móvil, cafetería, VPN), la allowlist por IP no escalará. La solución natural es un mecanismo de header HTTP secreto: el operador envía un header custom con un token en sus peticiones; el normalizer detecta esas peticiones antes de pasar al classifier y las marca con `allowlisted: true` directamente en el JSONL. Esto desacopla la allowlist de la IP del cliente. Queda como sub-paquete posterior si se necesita.

**Estado de las EC2 al cierre**:

- AUDIT: activa 24/7 con systemd, backend corriendo, classifier y reporter con código nuevo.
- TEST: encendida durante esta sesión (uptime ~11h40 al cierre). Si el operador quiere apagarla, hacerlo desde consola AWS o vía CLI.

**Frente 10.B al cierre**:

- 10.B.1 (plus-addressing por entorno): CERRADO 2026-05-23.
- 10.B.4 (allowlist de IPs operativas): CERRADO 2026-05-23 (esta sesión).
- 10.B.2 (sufijo DRY-RUN en body email TEST): pendiente, opcional.
- 10.B.3 (reparar test-access-blocker.service failed): pendiente, opcional.

Lecciones / observaciones:

- **El primer email perimetral real del 10.B.1 expuso el riesgo en menos de 24h**: el pipeline funcionaba pero clasificaba al operador como CRITICA. Si no hubiera sido por la inspección del primer email recibido, el operador podría haberse bloqueado a sí mismo en AUDIT en la siguiente validación intensiva. Patrón: cuando se activa un sistema de detección automática, la primera ejecución productiva debe revisarse manualmente para detectar falsos positivos sobre actividad legítima propia.
- **Reescribir lógica vs ajustar parámetro**: ante un descuento `-30` insuficiente, dos opciones eran subir el valor (`-200`) o reescribir el control (short-circuit). El short-circuit es preferible porque garantiza el comportamiento independientemente del score natural y desacopla la allowlist del scoring; no requiere recalibrar si en el futuro se añaden reglas con weights más altos. Patrón aplicable: cuando un mecanismo de protección tiene magnitud insuficiente, evaluar si conviene escalar el valor o reescribir como decisión booleana antes de la cadena.
- **Backup obligatorio antes de cualquier `sed -i`**: el caso de las 3 IPs preexistentes en TEST lo confirma. Si no hubiera sacado backup antes de aplicar la sed, la información se habría perdido sin posibilidad de recuperar fácilmente la lista anterior.

### Paquete 10.B.2: sufijo DRY-RUN en body del email TEST 2026-05-23

Tercer sub-paquete del frente 10.B. Añade una marca explícita del modo perimetral DRY-RUN del blocker en el body del email diario de TEST, para evitar que un lector del email confunda "1 CRITICA - actuar" con "el bloqueo ya se aplicó". Cambio mínimo: 1 línea Python funcional + 5 líneas de comentario en `ops/test-access-reporter/lib/report_access.py`. AUDIT (Carril A real desde 2026-04-24) no recibe esta línea.

**Decisión técnica**: hardcoded en TEST (opción A) en lugar de lectura dinámica del config del blocker (opción B). Justificación:

- El cambio `DRY_RUN=1` → `DRY_RUN=0` del blocker TEST requiere un checklist de 4 pasos documentado en `ops/test-access-blocker/config/config.env.example` (validar DRY-RUN 14+ días, consolidar allowlist, preparar `/etc/nginx/deny-test-ips.conf` con include, ejecutar manualmente una vez con DRY_RUN=0). Es una transición rara y consciente; el operador puede coordinar manualmente la eliminación de la línea del reporter en la misma sesión.
- Coherencia con la segregación existente: el reporter de TEST y el de AUDIT son ficheros distintos (`lib/report_access.py` cada uno) con subject diferente. Hardcoded encaja con esa segregación.
- Predecibilidad sobre dinamismo: la opción B tendría que cubrir casos de error (fichero del blocker no legible, permisos, parseo) que la A elimina. El precio del dinamismo no compensa el ahorro de coordinación manual en el futuro.

**Línea añadida**:

```
Modo: DRY-RUN (advisory; nginx NO se modifica)
```

Ubicación: inmediatamente bajo el header (`TEST access summary - YYYY-MM-DD`), antes de la línea en blanco que separa del bloque "IPs analizadas". Vista previa del email completo post-cambio:

```
TEST access summary - 2026-05-22
Modo: DRY-RUN (advisory; nginx NO se modifica)

IPs analizadas: 2
IPs allowlisted: 1 - 90.175.201.51

CRITICA: 0
MALICIOSA: 0
SOSPECHOSA: 0
NORMAL: 2

Hallazgos principales:
- sin hallazgos no normales

Fuentes:
- /var/log/sharemechat-test-access-classifier/2026-05-22.table.txt
- /var/log/sharemechat-test-access-classifier/2026-05-22.summary.jsonl
```

La línea es visible en el preview del cliente de email (Outlook/Apple Mail/etc. suelen mostrar las primeras 2-3 líneas en el panel de lista), no enterrada al final del body.

**Cambios aplicados**:

- `ops/test-access-reporter/lib/report_access.py`: nueva llamada `lines.append("Modo: DRY-RUN (advisory; nginx NO se modifica)")` en `render_text_report` justo tras el header. Comentario inline de 5 líneas explica la motivación, el carácter hardcoded y la regla de eliminación cuando TEST pase a Carril A.
- `ops/test-access/README.md`: sección "Envio por email" actualizada con el formato resultante y referencia al checklist del blocker.
- `ops/test-access-reporter/README.md`: nota sobre la línea DRY-RUN bajo "Envio por email".
- EC2 TEST: `scp` del lib actualizado a `/opt/sharemechat-test-access-reporter/lib/report_access.py` (chown root:root, chmod 644). Backup previo en `/tmp/report_access.py.bak.10B2.2026-05-23`. Sin `daemon-reload` (Python lib se relee en cada ejecución del wrapper).
- AUDIT: **NO tocado**. El `lib/report_access.py` de AUDIT permanece intacto.

**Validación**:

- Sintaxis: `py_compile` OK local y remoto.
- Diff TEST vs AUDIT reporter post-cambio: confirma que el bloque nuevo (5 comentarios + 1 línea funcional) existe solo en TEST. Strings "AUDIT/TEST access summary" siguen siendo la única otra diferencia esperada.
- Ejecución manual: `sudo /opt/sharemechat-test-access-reporter/bin/report-test-access.sh --config /etc/sharemechat-test-access-reporter/config.env --date 2026-05-22 --send-email` → exit 0. Body en stdout muestra la línea DRY-RUN en su posición correcta.
- Operador confirma email recibido a `security+report-test@sharemechat.com` con la línea visible y bien ubicada.

**Estado de las EC2 al cierre**:

- AUDIT: activa 24/7, sin cambios en esta sesión.
- TEST: encendida (uptime ~12h14 al cierre). Mismo estado que en 10.B.1/10.B.4.

**Frente 10.B al cierre**:

- ✅ 10.B.1 plus-addressing por entorno: CERRADO 2026-05-23.
- ✅ 10.B.4 allowlist de IPs operativas: CERRADO 2026-05-23.
- ✅ 10.B.2 sufijo DRY-RUN en body email TEST: CERRADO 2026-05-23 (esta sesión).
- ⏸️ 10.B.3 reparar `test-access-blocker.service` failed: pendiente, opcional.

Lecciones / observaciones:

- **Hardcoded simple cuando la inversión es rara**: la opción A es el caso típico de "elegir simple porque el caso de inversión está documentado y coordinado". Si en algún momento se acumulan condicionales hardcoded de este tipo (TEST tiene DRY-RUN, TEST tiene canary, TEST tiene...), valdría la pena consolidar en una variable de entorno tipo `REPORT_MODE_TAG` que cada reporter lee. Para una sola condición no merece la pena la abstracción.
- **Visibilidad en preview de email**: ubicar la línea bajo el header (no al final) hace que sea visible incluso si el operador solo ve la lista de emails sin abrir cada uno. Patrón útil para flags operativos importantes.
- **Diff TEST vs AUDIT reporter como red de seguridad**: el diff confirma que el cambio quedó aislado en TEST. Esa simetría es valiosa para detectar contaminación accidental (si alguna vez el diff mostrara cambios inesperados en líneas no relacionadas, sería señal de que un cambio mal aplicado se coló a AUDIT).

### Paquete 10.B.3: reparar test-access-blocker failed por race condition 2026-05-23

Cierre del frente 10.B (cuarto y último sub-paquete del día). Resuelve el estado `failed` permanente de `sharemechat-test-access-blocker.service` documentado en 10.B.1: tras un rearranque de TEST, el catch-up del timer del blocker (programado a 05:45 UTC) dispara antes del `daily-report.service` (07:10 UTC, contiene al classifier), buscando un `summary.jsonl` que no existe todavía, y falla con `Classifier summary not found: ...`. La unit queda en `failed` hasta intervención manual con `systemctl reset-failed`.

**Diagnóstico**:

Race condition entre timers con `Persistent=true` al rearrancar la EC2:

- TEST blocker.timer a **05:45 UTC** (genera catch-up al boot).
- TEST daily-report.timer a **07:10 UTC** (genera catch-up al boot, ejecuta classifier + reporter).
- Al rearrancar TEST a las 08:52 UTC del 23 may, ambos timers tienen ejecución pendiente. systemd los encola; el blocker se ejecuta primero (orden no determinístico estricto, pero suficientemente reproducible para fallar consistentemente).
- El blocker busca `summary.jsonl` del 22 may (yesterday en UTC). TEST estaba apagado el 22 may → no hay summary del 22. Fallo legítimo.

**Hallazgo lateral**: las units del blocker en TEST **y AUDIT** declaraban `After=sharemechat-{test,audit}-access-classifier.service`, una unit que **NO existe**. El classifier real vive como sub-paso dentro de `daily-report.service`. systemd ignoraba la dependencia silenciosamente. En operación 24/7 (AUDIT) el problema no se manifiesta porque las horas reales del calendario encajan (classifier 07:10 → blocker 07:30); en un reboot total de AUDIT con catch-up agresivo, podría reproducirse el mismo fallo.

**Estrategia elegida (opción D = A + C)**:

A. **Skip elegante en el blocker** (núcleo del fix):
   - Modificar `lib/block_access.py` para que cuando el `summary.jsonl` auto-resuelto desde `--date` o `yesterday` no exista, el blocker imprima un mensaje informativo a stdout (capturado por journald) y salga con código 0 en lugar de `raise SystemExit(...)` con código 1.
   - El skip aplica solo al path auto-resuelto. Si el operador pasa `--input /ruta/explicita.jsonl` que no existe, sigue siendo error (uso manual incorrecto).
   - **Justificación**: el blocker NO debe quejarse de un estado esperable. Si no hay summary, no es error, es ausencia de datos. La unit queda en `inactive (dead)`, no `failed`. Al siguiente disparo del timer (o al ejecutar manualmente con un día con summary), procesa normalmente.
   - **Robustez por diseño, no por temporización**: hace irrelevante el orden de los timers.

C. **Corregir dependencia rota en la unit** (limpieza colateral):
   - Cambiar `After=sharemechat-{test,audit}-access-classifier.service` (fantasma) → `After=sharemechat-{test,audit}-daily-report.service` (unidad real que ejecuta el classifier).
   - No garantiza orden absoluto en presencia de catch-up agresivo, pero documenta la intención correctamente y permite a systemd ordenar correctamente cuando ambas units están encoladas.

**Por qué no opción B (mover OnCalendar TEST a 07:30 UTC)**:

- No resuelve el catch-up. Cambiar la hora programada no evita que ambos timers acumulados disparen en cadena al boot.
- El comentario del timer TEST justifica 05:45 con "no solapar con AUDIT a 05:30 UTC", pero AUDIT está realmente a **07:30** (no 05:30). El comentario tiene un error histórico cuya intención original no está clara. Mejor no tocar la hora y dejar que la opción A absorba el race.

**Cambios aplicados**:

Código (2 ficheros del repo, simétricos):

- `ops/test-access-blocker/lib/block_access.py` (línea ~249): `raise SystemExit(...)` reemplazado por `print(...) + sys.exit(0)` con mensaje `Skipped: classifier summary not yet available for {day} (expected at {path}).` + comentario de 8 líneas explicando motivación y aplicación.
- `ops/audit-access-blocker/lib/block_access.py`: mismo cambio espejo. Comentario adaptado a contexto AUDIT ("tras rearrancar la EC2" en lugar de "tras rearrancar TEST").

Units systemd (2 ficheros del repo, simétricos):

- `ops/test-access-blocker/systemd/sharemechat-test-access-blocker.service`: `After=` corregido a `sharemechat-test-daily-report.service` con comentario explicativo de 6 líneas.
- `ops/audit-access-blocker/systemd/sharemechat-audit-access-blocker.service`: misma corrección espejo.

Documentación:

- `ops/test-access-blocker/README.md` y `ops/audit-access-blocker/README.md`: sub-sección nueva "Comportamiento si el summary no existe (paquete 10.B.3)" bajo la sección "Entrada", documentando el mensaje, el exit code 0, el estado `inactive (dead)`, la limitación al path auto-resuelto, y la corrección del `After=`.

EC2 (4 acciones, 2 por entorno):

- TEST: `scp` del lib + unit actualizados, backups previos en `/tmp/block_access.py.bak.10B3.2026-05-23` y `/etc/systemd/system/sharemechat-test-access-blocker.service.bak.10B3.2026-05-23`. `daemon-reload` aplicado. `systemctl reset-failed sharemechat-test-access-blocker.service` para limpiar el estado fallido del 08:52 UTC.
- AUDIT: misma operación espejada. Backup en `/tmp/block_access.py.bak.10B3.2026-05-23` y `/etc/systemd/system/sharemechat-audit-access-blocker.service.bak.10B3.2026-05-23`.

**Validación**:

- TEST caso SKIP (`--date 2026-04-01`, sin summary): exit 0, mensaje `Skipped: classifier summary not yet available for 2026-04-01 (expected at /var/log/sharemechat-test-access-classifier/2026-04-01.summary.jsonl).` ✓.
- TEST caso NORMAL (`--date 2026-05-22`, con summary): exit 0, log `[blocker DRY-RUN] 2026-05-22 ips=2 carril_A=0 carril_B=0 carril_C=2 allowlisted=0`. Generados `2026-05-22.blocker-diff.txt`, `2026-05-22.deny-test-ips.proposed.conf`, `2026-05-22.ips.json` ✓.
- TEST estado: `inactive (dead)`, ya no `failed` ✓.
- AUDIT caso SKIP (`--date 2026-01-01`): exit 0, mensaje skip elegante ✓.
- AUDIT caso NORMAL (`--date 2026-05-22`): exit 0, log `[blocker REAL carril_A] 2026-05-22 ips=9 carril_A=1 carril_B=1 carril_C=7 allowlisted=0 nginx_test_before=ok nginx_test_after=ok ips_bloqueadas=1 reload=ok`. Carril A real funcionando ✓.
- AUDIT estado: `inactive (dead)`, sin regresión ✓.

**Sorpresas**:

1. **`AUDIT está en Carril A REAL desde 2026-04-24**` (confirmado por el log `[blocker REAL carril_A] ... ips_bloqueadas=1 reload=ok` al ejecutar manualmente sobre 2026-05-22), pero la **descripción de la unit y el comentario del .service todavía dicen "DRY-RUN ONLY"**. Esa documentación obsoleta vive en `Description=Propose deny list for AUDIT based on classifier summary (DRY-RUN)` línea 2 del .service y en el comentario "DRY-RUN ONLY. This unit does NOT reload nginx..." líneas 10-12. Deuda documental detectada pero NO corregida en este paquete (fuera del alcance acotado de 10.B.3). Si se quiere arreglar, sub-paquete posterior trivial: editar 2 líneas de la unit AUDIT.

2. **El blocker AUDIT en Carril A escribió 1 IP en `/etc/nginx/deny-audit-ips.conf` y recargó nginx durante la validación manual** (`ips_bloqueadas=1, reload=ok`). Eso significa que el blocker se ejecutó dos veces hoy con escritura real (la del timer normal a 07:30 UTC + la validación manual a 21:25 UTC). Ambas terminaron OK y la deny list está actualizada con la IP detectada como Carril A del 22 may. Comportamiento esperado, no es problema, pero conviene notarlo: las validaciones manuales del blocker AUDIT TOCAN nginx real. Para validaciones futuras donde NO se quiera modificar nginx, usar `--input /ruta/inexistente.jsonl` para activar el path de error original (sigue siendo `SystemExit`), o exportar `DRY_RUN=1` para esa invocación.

### Selector de idioma bloqueado tras login en producto — 2026-05-31

Resolución de la deuda abierta el 2026-05-30 ("[BUG nuevo detectado en validación final] Selector de idioma UI bloqueado tras login", movida aquí desde `known-debt.md` al cerrarse). Diagnóstico previo y diseño completos en `project-log.md` 2026-05-31.

**Síntoma**: usuario autenticado en la superficie producto (cliente o modelo) no podía cambiar el idioma ES/EN desde el selector de la UI; el cambio "se disparaba y volvía" al idioma por defecto. Sin sesión (público) y en backoffice/admin funcionaba. Regresión.

**Causa raíz**: dos subsistemas de i18n en conflicto. (1) URL como fuente de verdad del locale mostrado (ADR-022: basename `/en` o su ausencia, resuelto en `App.jsx` e `i18n/index.js`). (2) `SessionProvider.applyLocale`, que reimponía `user.ui_locale` con `i18n.changeLanguage` en cada carga autenticada. Coexistían sin chocar mientras el `LocaleSwitcher` de producto persistía la elección en BD. El commit `7520029` (16 mayo, Paquete 1 rediseño CMS bilingüe) cambió el switcher de producto a navegación por URL **sin** persistir en BD → la BD se quedaba en el valor de registro y `applyLocale` revertía el display tras el reload.

**Fix** (2 ficheros frontend):

- `frontend/src/components/SessionProvider.jsx`: `applyLocale` solo llama a `i18n.changeLanguage` en superficie **admin** (donde la URL no transporta locale). En producto/blog no toca `i18n`: el display lo decide la URL. Sigue haciendo `setStoredLocale` (localStorage para `Accept-Language` y recordar preferencia).
- `frontend/src/components/LocaleSwitcher.jsx`: la rama de producto vuelve a **persistir** la elección con `await updateUiLocale(locale)` (→ `PUT /users/me/ui-locale`) solo cuando hay sesión, antes de navegar (`switchToLocaleByUrl` hace full reload). Admin y blog sin cambios. Público sin cambios (sin sesión no persiste, solo navega).

**Por qué persistir aunque la URL mande el display**: `user.ui_locale` alimenta el idioma de los emails transaccionales vía `EmailLocaleResolver.resolve(user)` → `EmailCopyRenderer` (bienvenida, baja, reset de contraseña, verificación de email, rechazo de assets de modelo). Si el switcher no persistiera, los emails saldrían en el idioma de registro pese al cambio del usuario.

**Limitación conocida (decisión consciente)**: un usuario logueado que entra a una URL sin prefijo `/en` verá español aunque su `ui_locale` sea inglés; los emails sí salen correctos. Cerrar el matiz (redirección inicial por preferencia) es feature aparte, en tensión con "no revertir una elección explícita" (una URL de producto sin prefijo no distingue "eligió ES" de "entró por defecto").

**Despliegue AUDIT (solo frontend, ambas surfaces)** — backups pre-deploy en `s3://sharemechat-backups/audit/frontend/{product,admin}/` (red de rollback estrenada; ver "Runbook de rollback de frontend" en `runbooks.md`):

- Producto: bucket `sharemechat-frontend-audit`, bundle nuevo `main.adaab50d.js` (anterior `main.09767365.js` en backup), invalidación `IEUV4XWHH3K3CC7QG1RALSEY75` sobre `E1ILXV7P6ENUV8` → Completed.
- Admin: bucket `sharemechat-admin-audit`, bundle nuevo `main.a566756a.js` (anterior `main.8fdc22b3.js` en backup), invalidación `I8XU4RQB20W3NIS0591RWHWQZI` sobre `E21IB0VBKYNNBW` → Completed.
- Smoke: `audit.sharemechat.com/` y `admin.audit.sharemechat.com/` → `200` sirviendo los bundles nuevos; `/api/users/me` sin sesión → `401` (esperado). Perfil AWS de despliegue: default (`sharemechat-deployer`), conforme a `deploy-frontend.ps1`. Validación funcional del selector a cargo del operador.

**Observación ajena al cambio**: `www.audit.sharemechat.com` no resolvió DNS (`HTTP 000`) pese a que ADR-015/`audit.md` prevén `301` www→apex. No tocado por este deploy (solo S3 + invalidación de las dos distribuciones); preexistente, anotado por si se revisa aparte.

TEST y PROD no recibieron este frente. Deuda de nivelación del patrón de backup de frontend a TEST/PROD abierta en `known-debt.md` (2026-05-31).

3. **Los dos `block_access.py` no son perfectamente simétricos**: además de los esperados nombres `audit/test`, AUDIT tiene un docstring más antiguo que omite la documentación de DRY_RUN=0; TEST lo añadió en una iteración posterior. No es problema para este paquete (el cambio del paquete sí es simétrico, son solo los docstrings de cabecera los que difieren) pero conviene unificarlos en algún momento.

**Estado del frente 10.B al cierre**:

- ✅ 10.B.1 plus-addressing por entorno: CERRADO 2026-05-23.
- ✅ 10.B.4 allowlist de IPs operativas: CERRADO 2026-05-23.
- ✅ 10.B.2 sufijo DRY-RUN en body email TEST: CERRADO 2026-05-23.
- ✅ 10.B.3 reparar blocker failed: CERRADO 2026-05-23 (esta sesión).

Los 4 sub-paquetes del frente 10.B cerrados en el mismo día. Frente completo.

**Estado de las EC2 al cierre**: TEST encendida (uptime ~12h al cierre). Si el operador quiere apagarla, hacerlo desde consola AWS o vía CLI. AUDIT siempre encendida 24/7.

Lecciones / observaciones:

- **Robustez por diseño, no por temporización**: el patrón "el componente downstream tolera ausencia de datos upstream" es más robusto que "el componente downstream se asegura de correr después del upstream". El segundo depende de orden temporal; el primero no. Aplicable a otros pipelines del proyecto donde haya dependencias entre fases con timers separados.
- **Dependencias systemd a unidades fantasma se ignoran silenciosamente**: el `After=sharemechat-*-access-classifier.service` apuntaba a una unit inexistente y systemd no emite ningún error ni warning. Eso hace fácil olvidar que la directiva no aporta nada. Conviene cuando se editan units verificar con `systemctl list-dependencies <unit>` o `systemctl cat <unit-dependida>` que la dependencia existe realmente.
- **Skip + exit 0 en lugar de raise + exit 1 para casos esperables**: el caso "no hay datos del día anterior" no es un error operativo, es ausencia legítima. El comportamiento por defecto de las herramientas Python (`raise SystemExit` con mensaje y exit code 1) es agresivo para este caso. Patrón aplicable: distinguir "input explícito del operador no existe" (error duro) vs "input auto-resuelto no existe" (skip clean).
- **El log `[blocker REAL carril_A]` vs `[blocker DRY-RUN]` es una buena señal de auto-documentación**: cualquier operador que mire journalctl sabe inmediatamente en qué modo está el blocker, independientemente de la documentación del .service. Patrón aplicable a otros componentes que tengan modos operativos distintos.



