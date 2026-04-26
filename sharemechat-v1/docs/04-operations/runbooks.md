# Runbooks

## Alcance

Los runbooks del repositorio principal deben servir para operar el sistema a nivel lógico sin exponer inventario sensible.

## Runbook de validación tras despliegue

- comprobar disponibilidad de superficie pública
- comprobar disponibilidad de superficie admin
- validar login de producto
- validar login de backoffice
- validar `/api` principal
- validar conexión a `/match`
- validar conexión a `/messages`
- comprobar uploads y assets legales

## Runbook de revisión de onboarding modelo

- verificar modo activo de onboarding
- revisar documentos o flujo KYC aplicable
- confirmar transición de estado hasta aprobación o rechazo
- validar trazabilidad administrativa asociada

## Runbook de revisión económica básica

- validar creación de transacciones
- validar snapshots de balance
- verificar gifts y su reparto
- revisar requests de payout o refund si aplican

## Runbook de Auth-risk en login producto

### Activación y desactivación por entorno

La capa Auth-risk se gobierna mediante propiedades versionadas en `application.properties`, todas con default seguro y resolubles via variables de entorno:

- `authrisk.enabled` activa o desactiva la observación y el scoring; sin esta variable a true no se escribe nada en Redis ni se emite log `[AUTH-RISK]`
- `authrisk.env` define el namespace Redis (`ar:{env}:`) y debe ser distinto por entorno para evitar colisiones
- `authrisk.email-hash-salt` debe estar definido cuando `authrisk.enabled=true`; sin salt el servicio queda en no-op y emite un único warn discreto
- `authrisk.response.enabled` es el interruptor independiente que activa la respuesta progresiva (delay y bloqueo); manteniendolo a false el sistema queda en modo OBSERVE puro
- `authrisk.response.high-delay-min-ms` y `authrisk.response.high-delay-max-ms` definen el rango aleatorio del retardo en nivel HIGH
- `authrisk.response.critical-block-seconds` controla el TTL del bloqueo temporal por `emailHash`

Procedimiento recomendado al introducir Auth-risk en un entorno nuevo:

1. desplegar con `authrisk.enabled=true` y `authrisk.response.enabled=false`
2. observar logs `[AUTH-RISK]` durante un periodo prudente para calibrar niveles y descartar falsos positivos
3. activar `authrisk.response.enabled=true` solo cuando el patrón de fondo sea coherente con uso legítimo

El rollback es simétrico: desactivar `authrisk.response.enabled` deja la capa en modo OBSERVE; desactivar `authrisk.enabled` la elimina por completo del flujo de login.

### Validación de logs

Los logs relevantes llevan el prefijo `[AUTH-RISK]` y siguen un formato estable con `env`, `event`, `channel`, `level`, `score`, `ip`, `uaHash`, `emailHash`, `userId` y `reasons`. Los niveles `HIGH` y `CRITICAL` se emiten como `warn`; `NORMAL` y `SUSPICIOUS` como `info`. Si el backend se ejecuta como servicio con redirección a archivo, basta filtrar por ese prefijo para obtener trazabilidad. Si se ejecuta de forma manual, los logs solo son visibles en la terminal activa, lo que limita la observabilidad a esa sesión.

### Listado de bloqueos activos

El bloqueo temporal por `emailHash` se materializa en una clave Redis dentro del namespace del entorno. Para enumerar los bloqueos vigentes basta un escaneo por patrón sobre el prefijo correspondiente (`ar:{env}:login:block:email:*`). Cada entrada representa un `emailHash` actualmente bloqueado; nunca contiene el email plano. La operación es informativa y no debe lanzarse en tight loop si el Redis tiene volumen alto.

### Liberación manual de un bloqueo

En caso de falso positivo confirmado, el procedimiento es:

1. identificar el `emailHash` exacto a partir de los logs `[AUTH-RISK]` recientes asociados a la cuenta legítima
2. eliminar la clave correspondiente en Redis (`DEL` sobre `ar:{env}:login:block:email:{emailHash}`)
3. dejar constancia de la liberación en `incident-notes.md` si la causa amerita seguimiento

Esta operación no resetea contadores de fallos ni sets distintos, lo cual es deliberado: si el patrón sigue siendo CRITICAL al siguiente fallo, el bloqueo se recreará y debe analizarse el origen antes de seguir liberando.

### Interpretación de niveles

- `NORMAL`: actividad por debajo de cualquier umbral; sin acción.
- `SUSPICIOUS`: hay señales agregadas pero aisladas. Útil para correlacionar con otros eventos sin actuar todavía.
- `HIGH`: el atacante o el usuario afectado ha cruzado al menos dos señales (típicamente fallos por email + fallos por IP). Activa retardo en la respuesta del fallo.
- `CRITICAL`: combinación de señales suficiente para considerarse abuso. Activa bloqueo temporal por `emailHash`.

Las reglas de scoring concretas y sus pesos viven en código (`AuthRiskService`) y deben revisarse allí ante cualquier ajuste; este runbook documenta su uso operativo, no su definición numérica.

### Diagnóstico de un usuario potencialmente bloqueado

Cuando un usuario reporta que no puede entrar y la sospecha es que está bajo bloqueo temporal de Auth-risk, el flujo operativo es:

1. **Listar bloqueos vigentes en el entorno afectado.**
   Sobre el Redis del entorno, escaneo por patrón lógico:
   ```
   redis6-cli --scan --pattern 'ar:{env}:login:block:email:*'
   ```
   Sustituir `{env}` por el valor real configurado en `authrisk.env` para ese backend (`test`, `audit`, etc.). El escaneo devuelve cero o más claves; cada una representa un `emailHash` actualmente bloqueado. Comprobar TTL restante con `redis6-cli TTL <clave>` para estimar si el bloqueo se liberará por sí solo dentro de un margen tolerable.

2. **Correlacionar con logs `[AUTH-RISK]`.**
   En la fuente de logs disponible para ese backend (terminal activa si arranque manual; archivo o `journald` si se desplegó como servicio), filtrar por el prefijo `[AUTH-RISK]` y por la ventana temporal en la que el usuario afirma que empezó el problema. Las líneas relevantes son las de `event=LOGIN_FAILURE` con `level=CRITICAL` y, si la causa fue varios `emailHash` distintos desde la misma IP, también líneas previas con `reasons=ip_distinct_emails_5`.

3. **Identificar el `emailHash` desde el log.**
   El `emailHash` aparece como campo dentro de cada línea `[AUTH-RISK]`. Es un fragmento hexadecimal corto y, por diseño, **no es reversible al email plano** sin la salt y el algoritmo HMAC; tampoco hay hoy una herramienta backend que calcule el `emailHash` a partir de un email real. Si para resolver una incidencia se necesitara esa correlación, debe crearse como tarea controlada con código versionado y revisión, **no improvisar scripts ad hoc con el salt**.
   Mientras esa herramienta no exista, la correlación habitual se hace por contexto: `ip`, `uaHash`, ventana temporal y patrón de eventos previos del mismo `emailHash`.

4. **Decidir si liberar.**
   Si el patrón observado es coherente con un usuario legítimo (mismas IP/UA habituales, sin variación brusca, sin múltiples emails desde la misma IP), el bloqueo puede liberarse aplicando el procedimiento de **Liberación manual de un bloqueo** descrito más arriba. Si el patrón es ambiguo o claramente abusivo, dejar que el TTL expire por sí solo.

**Regla de saneado específica de este flujo**: en cualquier ticket, runbook complementario o registro escrito derivado del diagnóstico, no plasmar nunca el email real del usuario afectado, el `emailHash` real ni el salt configurado. Para trazabilidad basta referenciar la incidencia por id interno y ventana temporal; los identificadores sensibles se resuelven en la fuente operativa correspondiente y no se duplican aquí.

### Validación operativa en entorno

Tras un despliegue o cambio de configuración relevante de Auth-risk en un entorno, conviene confirmar externamente que el control sigue comportándose como se espera. Las cuatro comprobaciones mínimas se pueden hacer como cliente HTTP externo sin necesidad de tocar el servidor:

1. **Verificar delay activo en `HIGH`.**
   Ejecutar una serie de fallos consecutivos contra un email válido del entorno, respetando el rate limit IP existente (esperar 60s entre tandas de 5). Medir tiempos de respuesta. Hasta cubrir los umbrales de scoring las latencias se mantienen en el orden de cientos de milisegundos; al cruzar `HIGH`, las latencias deben subir al rango configurado (`authrisk.response.high-delay-min-ms`–`high-delay-max-ms`) de forma claramente perceptible.

2. **Verificar bloqueo en `CRITICAL`.**
   Continuar la serie hasta provocar `CRITICAL` (combinación típica de `email_fail_5`, `ip_fail_10` y `ip_distinct_emails_5`). Inmediatamente después, intentar login con la **password correcta** del email afectado. La respuesta esperada es `HTTP 401` sin `Set-Cookie`, indistinguible de una credencial incorrecta. Si llegan cookies de sesión, el bloqueo no se está creando o ha expirado.

3. **Identificar short-circuit por latencia.**
   Si tras un bloqueo activo se sigue intentando el mismo email con password incorrecta, las latencias deben **bajar** respecto al delay de `HIGH`, no subir. Una respuesta rápida (orden de cientos de ms) tras un período de respuestas lentas confirma que el short-circuit `isEmailBlocked` está cortando antes del scoring y antes del delay, conforme al diseño.

4. **Inspeccionar la fuente de logs disponible.**
   - En **AUDIT**, los logs son persistentes en `journald` y se filtran con:
     ```
     sudo journalctl -u sharemechat-audit --since '15 minutes ago' | grep AUTH-RISK
     ```
     Comprobar que aparece `env=audit` (no `env=test`) en las líneas, que se observan los niveles esperados (`NORMAL`, `SUSPICIOUS`, `HIGH`, `CRITICAL`) y que existe al menos una línea con `reasons=temporal_block_active` tras provocar bloqueo.
   - En **TEST**, los logs viven en la terminal interactiva del proceso manual; la observación es posible solo si esa sesión sigue viva. Esta limitación está recogida en `known-risks.md`.

Estas cuatro comprobaciones cubren tanto la capa de detección como la de respuesta. Si alguna falla, contrastar primero con `redis6-cli --scan --pattern 'ar:{env}:login:*'` y confirmar que el namespace y los TTLs son los esperados antes de tocar configuración.

### Limpieza de artefactos temporales del repositorio

El pipeline de auditoría perimetral genera salidas locales (resúmenes, tablas y reportes en `.jsonl`/`.txt`/`.json`) durante pruebas o ejecuciones puntuales fuera del flujo `ops/` ya operativo. Esas salidas son **regenerables**: se obtienen volviendo a ejecutar el pipeline contra los datos de origen. No aportan valor durable, no deben formar parte del repositorio principal y consumen ruido en `git status` cuando se mezclan con cambios reales.

La regla aplicada en el repositorio es:

- ningún directorio o fichero con prefijo `tmp-` se versiona
- existe regla en `.gitignore` con los patrones `tmp-*/` y `tmp-*` para garantizarlo automáticamente
- el pipeline operativo y sus salidas estables permanecen en `ops/`, fuera del alcance de esta regla

Si una salida temporal del pipeline necesitara conservarse como evidencia de una decisión o incidencia, el procedimiento correcto es:

1. archivar esa salida como anexo de un documento durable (`docs/04-operations/incident-notes.md` o similar) **resumiendo el contenido**, no copiando el blob completo
2. nunca dejar el directorio `tmp-*` en el árbol con la intención de "documentar después"
3. si la salida es sensible (IPs, identificadores reales), aplicar la regla de saneado de gobierno documental antes de archivar

Esta limpieza ya se aplicó al repo y los artefactos `tmp-audit-access-*`, `tmp-audit-classifier-out` y `tmp-audit-reporter-*` que existían en raíz del módulo backend han sido eliminados.

## Modo de arranque actual del backend en TEST

A día de hoy el backend de TEST se arranca **manualmente** desde una sesión interactiva sobre la instancia, no como servicio gestionado. El comando lógico de arranque es:

```
set -a && source /opt/sharemechat/.env && set +a \
  && java -jar sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar
```

Consecuencias operativas relevantes:

- los logs del backend (incluidos los `[AUTH-RISK]`) se emiten a `stdout` de la terminal activa
- no se escriben en `journald` ni en archivo persistente
- al cerrar la terminal o desconectar la sesión, esos logs dejan de ser accesibles
- la trazabilidad forense de cualquier incidente de autenticación queda condicionada a mantener viva esa sesión interactiva

En **AUDIT**, en cambio, el backend se ejecuta como servicio `sharemechat-audit.service` con `EnvironmentFile=/opt/sharemechat/.env` y los logs persisten en `journald`, lo que elimina esa limitación para ese entorno.

Mientras el modo de arranque de TEST siga siendo manual, los procedimientos de diagnóstico que dependan de logs históricos deben asumir esta limitación. Esta deuda operativa está recogida también en `known-risks.md` como riesgo residual de logs no persistentes y debe consultarse desde allí. La mitigación natural —despliegue como servicio con redirección a archivo o `journald`— es objeto de iteración futura y no se improvisa caso a caso.

## Regla de saneado

Si un runbook necesita un dato sensible concreto para ejecución operativa, ese dato no debe fijarse en este corpus; debe resolverse desde la fuente operativa correspondiente.
