# Entorno AUDIT

## Proposito

AUDIT se plantea como un entorno aislado para revision, validacion y preparacion de auditorias sin interferir con TEST.

## Aporte util consolidado del material previo

La documentacion previa permite sostener que AUDIT:

- replica la topologia logica de TEST
- dispone de superficie publica, superficie admin, backend y assets dedicados
- tiene profile de aplicacion propio
- utiliza base de datos separada
- se preparo con saneado funcional de datos para evitar arrastrar actividad operativa de TEST

## Estado documentable

AUDIT debe entenderse como entorno construido y funcional a nivel base, con estos hitos ya absorbidos a nivel logico:

- aislamiento de aplicacion y datos
- base de datos preparada como entorno limpio
- despliegue previsto para frontend, backend y validacion end-to-end
- despliegue TURN minimo ya implementado a nivel de infraestructura para validacion funcional y diagnostico

## Saneado aplicado

Se elimina del corpus principal el detalle de:

- identificadores de distribuciones y certificados
- buckets concretos
- endpoints exactos de base de datos
- direcciones IP publicas
- security groups y subnets especificas

## Riesgos y dudas

- la documentacion previa detectaba diferencias de fallback SPA entre TEST y AUDIT en la capa edge
- el realtime del entorno depende de Redis como componente operativo adicional al backend HTTP y WebSocket
- la validacion de uploads privados en AUDIT ya opera sobre S3 privado, pero el mismo nivel de activacion y validacion todavia puede seguir pendiente en otros entornos

Estos puntos deben revisarse cuando se actualice especificamente la documentacion y validacion tecnica del entorno AUDIT.

## Trazabilidad minima de accesos

AUDIT ya dispone de trazabilidad minima operativa de accesos sin cambios adicionales de arquitectura de aplicacion.

El estado documentable de esta mejora queda asi:

- la capa publica registra accesos de las superficies `audit` y `admin.audit`
- el vhost API/realtime del backend aporta trazabilidad complementaria para `/api`, `/match` y `/messages`
- la IP real del cliente puede correlacionarse en backend mediante cabeceras reenviadas por la cadena de proxies
- esta mejora aumenta la observabilidad operativa del entorno, pero no debe leerse como un sistema completo de seguridad, antiabuso o monitorizacion avanzada

## Storage privado activo

AUDIT ya opera con proveedor S3 privado para uploads sensibles sin cambios adicionales de arquitectura en frontend ni en backend.

La activacion funcional ha requerido en el despliegue del backend, como minimo:

- `APP_STORAGE_TYPE=s3`
- `APP_STORAGE_S3_BUCKET`
- `APP_STORAGE_S3_REGION`

Configuracion opcional segun el entorno real:

- `APP_STORAGE_S3_KEY_PREFIX`
- `APP_STORAGE_S3_ENDPOINT`
- `APP_STORAGE_S3_PATH_STYLE_ACCESS`
- `APP_STORAGE_S3_SERVER_SIDE_ENCRYPTION`

La aplicacion usa credenciales AWS estandar del host mediante `DefaultCredentialsProvider`, por lo que no necesita secretos hardcodeados en codigo ni en properties versionadas. La validacion operativa de AUDIT confirmo que este punto exige un instance profile operativo en la maquina del backend.

La validacion funcional de AUDIT ya ha confirmado:

- subida correcta de documentos a traves del backend
- lectura del media solo a traves de `/api/storage/content`
- acceso autenticado segun la matriz de roles ya documentada
- ausencia de dependencia operativa de `/usr/share/nginx/html/uploads`

El legacy asociado a referencias historicas `/uploads/...` ya ha quedado eliminado en AUDIT:

- limpieza completa de referencias persistidas antiguas
- eliminacion del filesystem local legado como fuente activa de estos uploads
- operacion efectiva del entorno exclusivamente sobre S3 privado y proxy backend

El error posterior de validacion de fichero ya pertenece a otra linea de trabajo y no a la activacion de infraestructura S3.

## Límite HTTP de subida

La subida de media grande en AUDIT depende tambien del limite efectivo de la capa HTTP publica y de Nginx.

Con los limites backend actualmente versionados:

- `spring.servlet.multipart.max-file-size=50MB`
- `spring.servlet.multipart.max-request-size=60MB`

la configuracion operativa de Nginx debe quedar alineada para no rechazar antes de tiempo peticiones multipart validas para backend. El ajuste minimo documentado para este entorno es fijar `client_max_body_size` en `60M`.

En una iteracion posterior se realizo una nivelacion controlada del vhost API de AUDIT respecto a TEST, sin tocar el `nginx.conf` base ni arrastrar bloques legacy no necesarios. Quedaron alineados en ese vhost:

- headers forward relevantes para `/api`, `/match` y `/messages`
- timeouts largos de `/messages`
- headers razonables de hardening a nivel server
- cierre explicito de rutas no previstas con `404`

La comparacion del resto de configuracion Nginx fuera de ese vhost sigue dependiendo de extraer y revisar los ficheros reales de entorno, porque no estan versionados en el repositorio principal.

## Realtime operativo

AUDIT ya ha validado funcionamiento completo de realtime tras nivelar la publicacion de WebSocket y completar la dependencia de Redis en la maquina del backend.

Para este entorno, Redis debe considerarse dependencia obligatoria del matching y de la coordinacion realtime, con servicio activo en localhost sobre el puerto esperado por la aplicacion.

## TURN minimo operativo

AUDIT ya dispone de una implementacion minima de TURN fuera del repositorio principal, ejecutada como despliegue operativo del entorno y alineada con la estrategia por entorno ya documentada.

El estado documentable de esta fase es:

- una unica instancia TURN para el entorno
- sin alta disponibilidad
- orientada a validacion funcional y diagnostico
- relay publicado sin depender de un camino operativo de media basado en NAT gestionado para esta fase minima

La evidencia operativa ya obtenida en el propio servidor TURN confirma actividad funcional de relay a nivel de protocolo:

- `ALLOCATE` procesado con exito
- `CREATE_PERMISSION` procesado con exito
- `CHANNEL_BIND` procesado con exito

La validacion tecnica principal de esta fase ya queda confirmada tambien desde la aplicacion:

- backend AUDIT consumiendo configuracion TURN por entorno
- `/api/webrtc/config` operativo
- frontend consumiendo configuracion ICE servida por backend
- evidencia frontend de `candidateType=relay`
- evidencia frontend de `ICE selected pair: relay (TURN)`
- evidencia frontend de `iceConnectionState=connected`
- evidencia frontend de `connectionState=connected`

La validacion funcional end-to-end de AUDIT ya confirma ademas:

- sesiones RANDOM confirmadas
- streaming visible
- gifts RANDOM operativos sobre sesiones confirmadas

La base operativa estable de TURN en AUDIT queda ademas cerrada con estos criterios ya validados:

- el arranque deja de hacerse con comandos manuales ad hoc y pasa a estar gestionado por un servicio persistente de systemd del entorno
- el servicio queda habilitado para arrancar automaticamente tras reinicio completo de la maquina
- la validacion operativa posterior al reboot confirma que el servicio vuelve en estado `active (running)` sin intervencion manual
- la configuracion runtime estable ya no depende del certificado de ejemplo de coturn y usa certificado valido del entorno
- la validacion final no se limita al proceso levantado: la aplicacion confirma uso real de relay TURN con candidatos `relay`, selected pair `relay (TURN)` y reproduccion remota funcional

Con ello, la fase minima de TURN en AUDIT puede darse por cerrada a nivel operativo del entorno.

El siguiente paso natural no es reabrir arquitectura en AUDIT, sino replicar de forma controlada el mismo patron en TEST manteniendo la misma logica de aplicacion.

## Product Operational Mode previsto (pendiente de implementación)

Cuando la capa Product Operational Mode esté implementada (ver [ADR-009](../06-decisions/adr-009-product-operational-mode.md)), la intención para AUDIT es:

- modo `OPEN` para preservar validación funcional sobre cuentas existentes
- registros de cliente y modelo **cerrados server-side**, para evitar creación accidental o externa de cuentas en un entorno destinado a revisión y validación

Hasta entonces, AUDIT se comporta de facto como `OPEN` con registros abiertos.
