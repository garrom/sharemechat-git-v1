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

Mientras el modo de arranque siga siendo manual, los procedimientos de diagnóstico que dependan de logs históricos deben asumir esta limitación. Esta deuda operativa está recogida también en `known-risks.md` como riesgo residual de logs no persistentes y debe consultarse desde allí. La mitigación natural —despliegue como servicio con redirección a archivo— es objeto de iteración futura y no se improvisa caso a caso.

## Regla de saneado

Si un runbook necesita un dato sensible concreto para ejecución operativa, ese dato no debe fijarse en este corpus; debe resolverse desde la fuente operativa correspondiente.
