# Notas de incidencias

## Incidencias o tensiones tecnicas observables desde el material actual

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
