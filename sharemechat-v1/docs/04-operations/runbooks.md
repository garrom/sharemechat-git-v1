# Runbooks

## Alcance

Los runbooks del repositorio principal deben servir para operar el sistema a nivel lógico sin exponer inventario sensible.

## Runbook de despliegue (frontend con check de drift, backend manual con actualización del manifest)

### Regla de oro

**No se despliega saltándose el check de drift.** El check existe por el incidente del 2026-06-08 (ver `incident-notes.md`, entrada *"Drift backend↔frontend en AUDIT producto: dashboard MODEL/CLIENT en blanco (solo footer)"*): un frontend que esperaba el campo `productAccessMode` se desplegó sobre un backend de 9 días anterior al commit que introdujo ese campo; la consecuencia fue MODEL y CLIENT viendo solo `header + footer` sin contenido entre medio. El check evita que la situación vuelva.

### Deploy de frontend con `ops/scripts/deploy-frontend.ps1`

Flujo de pasos del script (un único orden de operaciones, ramas adicionales documentadas en cada paso):

| Paso | Qué hace |
|---|---|
| `[0/5]` Pre-flight | Resuelve repo root, mapping `~/.sharemechat/state-mapping.yaml`, bucket S3 y distribución CloudFront según `(env, surface)`; crea `frontend/.deploy.lock` para impedir invocaciones concurrentes. |
| `[0.5/N]` Check de drift pre-deploy | Compara el commit que se va a desplegar (HEAD del repo) contra el commit del backend ya desplegado según `ops/deploy-state/<env>.yaml`, considera edad y working tree. Emite severidad (ver tabla más abajo) y pide confirmación o aborta según el caso. Saltable con `-SkipDriftCheck`. |
| `[1/5]` Build | `npm run build:<surface>` con `BUILD_PATH=build-<surface>/` (carpeta exclusiva por surface). Limpia con `rm -rf` antes para evitar build mixto. |
| `[2/5]` Sync + invalidación CloudFront | `aws s3 sync --delete` con `cache-control immutable` para el bundle hashed, `aws s3 cp index.html` con `cache-control no-cache`, `aws cloudfront create-invalidation --output json` (captura `Invalidation.Id` para registrarlo en el manifest). En `-StandbyMode` se omite la invalidación. |
| `[3/5]` Smoke estático | Extrae `main.<hash>.js` del `index.html` local, confirma que la key existe en el bucket, hace `GET https://<alias>/` (200 + `text/html`) y `GET` del bundle hashed por su URL inmutable. En `-StandbyMode` usa `head-object` directo al bucket. |
| `[4/5]` Smoke funcional | Sondea backend; si responde y `X-Product-Mode=PRELAUNCH`, verifica que `POST /api/auth/login` no devuelva 503 y que `POST /api/models/documents` sí devuelva 503 con la cabecera. Se salta con `-SkipFunctionalSmoke` o si el backend no responde. |
| `[5.5/N]` Update deploy-state manifest | Tras smoke OK, escribe `ops/deploy-state/<env>.yaml` con el bloque `frontend_<surface>`: `bundle`, `bundle_sha256` (calculado con `Get-FileHash SHA256` sobre el fichero local subido), `git_commit` + `git_commit_short` (HEAD del repo), `built_at` y `deployed_at` (UTC), `working_tree_clean` (excluyendo `ops/deploy-state/*.yaml`), `deployed_by` (`USERNAME@COMPUTERNAME`), `bucket`, `cloudfront_distribution`, `cloudfront_invalidation_id`. **No hace commit del manifest**: el operador commitea cuando le conviene (decisión D2). Si la actualización falla, NO aborta el deploy ya hecho; solo avisa. |
| `[5/5]` Cierre | Mensaje final con `main.<hash>.js` desplegado y URL base. |

La lógica `[0/5]..[5/5]` original es inviolable: ninguna entrega futura debe alterarla, solo añadir pasos auxiliares con sufijo `.5/N` y comportamiento defensivo.

### Niveles de severidad del check

| Severidad | Qué significa | Qué pasa con el deploy |
|---|---|---|
| `OK` | Backend, frontend product y frontend admin están en el mismo commit. | Continúa sin prompt. |
| `INFO` | Commits distintos, pero todos ≤24 h y working tree limpio. | Continúa sin prompt. |
| `WARN` | Algún commit >24 h, o working tree dirty, o algún `git_commit_short` nulo (no inferible), o backend con `verification.method` empezando por `last_known_*`. | Humano: `Read-Host [s/N]`. IA: depende del flag (ver siguiente sub-sección). |
| `ALERT` | Algún commit >72 h, o backend POR DETRÁS de cualquier frontend sin tocar contrato. | Humano: `Read-Host [s/N]`. IA: depende del flag. |
| `CRITICAL` | Backend POR DETRÁS de algún frontend Y entre los dos commits hay cambios en la lista hardcoded de ficheros del contrato (los DTOs de user, `UserController`, `ProductOperationalModeService`, `RequireRole.jsx`, `SessionProvider.jsx`, `featureFlags.js`). | Humano: exige escribir `'yes'` literal. IA en sesión no interactiva: **aborta SIEMPRE**, con o sin flag. La IA debe PARAR y avisar al operador. |

### Cómo se despliega según quién lo hace

**Operador humano en consola** (terminal real, tty interactivo):

```
ops/scripts/deploy-frontend.ps1 -Environment <env> -Surface <product|admin>
```

El script invoca `Read-Host` cuando hace falta confirmación: `[s/N]` en `WARN`/`ALERT` (default `N`), `'yes'` literal en `CRITICAL` (cualquier otra cosa aborta).

**IA en sesión no interactiva** (PowerShell con `[Console]::IsInputRedirected = true`, harness del agente, automation en CI/cron):

```
ops/scripts/deploy-frontend.ps1 -Environment <env> -Surface <product|admin> -AssumeYesNonCritical
```

Con `-AssumeYesNonCritical`:
- El check `[0.5/N]` SIGUE corriendo y SIGUE evaluando la severidad.
- En `OK`/`INFO`/`WARN`/`ALERT` auto-confirma y continúa sin `Read-Host`.
- En `CRITICAL` **aborta SIEMPRE** (la IA no puede saltarse el contrato).

**La IA NO debe usar `-SkipDriftCheck` para sortear el prompt** — eso desactiva el check entero y reproduce exactamente el agujero del incidente 2026-06-08. **Ante un `CRITICAL`, la IA debe PARAR y avisar al operador**, no buscar workarounds.

Sin `-AssumeYesNonCritical` y en sesión no interactiva, el script aborta fail-safe ante cualquier severidad `>= WARN` con mensaje claro indicando que se invoque con el flag o desde consola humana.

**Reparación consciente** (revert tras un deploy roto, primera puesta a punto del manifest cuando aún no había estado registrado, etc.):

```
ops/scripts/deploy-frontend.ps1 -Environment <env> -Surface <surface> -SkipDriftCheck
```

`-SkipDriftCheck` apaga el `[0.5/N]` entero. Es la vía excepcional; **NO la vía normal**.

### Flags de `deploy-frontend.ps1`

| Flag | Qué hace |
|---|---|
| `-DryRun` | Ejecuta `[0/5]` + `[0.5/N]` y termina sin construir ni desplegar nada. Útil para ver la severidad del check antes de comprometerse. |
| `-Strict` | En `ALERT` o `CRITICAL` aborta con exit 1 sin prompt. Pensado para automation que necesite señal binaria (CI, scheduled jobs). |
| `-SkipDriftCheck` | Salta el `[0.5/N]` entero. Vía excepcional para reparaciones conscientes. La IA NO debe usar esto. |
| `-AllowDirtyWorkingTree` | Permite construir con árbol de código sucio (cambios sin commit) de forma consciente. Frecuente en AUDIT para testing puntual; raro en TEST/PROD. |
| `-AssumeYesNonCritical` | Auto-confirma `WARN`/`ALERT` en host no interactivo. NO permite pasar `CRITICAL` (sigue abortando siempre en no interactivo). Vía normal para IA y automation. |
| `-StandbyMode` | El bucket destino no es aún el origin vivo de la distribución (caso PROD pre-switch). Smoke estático contra el bucket directamente; sin invalidación CloudFront. |
| `-SkipFunctionalSmoke` | Salta el smoke funcional aunque el backend esté accesible. Útil en ventanas de mantenimiento. |
| `-SkipBuild` | Salta el build (asume que `build-<surface>/` ya existe del paso previo). |

### Deploy de backend (manual + actualización del manifest)

El deploy de backend no tiene script orquestador todavía (queda como Fase 2 del frente, `deploy-backend.ps1` opción A). El procedimiento actual:

1. Construir el JAR localmente (`mvn -DskipTests package` desde `sharemechat-v1/`).
2. `scp` del JAR al EC2 vía alias SSH (`audit-backend`, `test-backend`, `pro-backend`) a `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar`.
3. Backup del JAR previo en el propio EC2 con sufijo `.bak-<motivo>-<UTC>`.
4. `chown ec2-user:ec2-user` del JAR nuevo.
5. `systemctl restart sharemechat-{audit,test,prod}.service`.
6. Smoke según el entorno (mínimo: `/api/users/me` → 401; home → 200; `/api/clients/me` → 503 + `X-Product-Mode` según modo).

**Inmediatamente después del deploy**, ejecutar:

```
ops/scripts/update-manifest-backend.ps1 -Environment <env> [-RemoteVerify] [-DryRun]
```

Lee HEAD del repo, calcula `sha256` del JAR local (o también del remoto vía `ssh + sudo sha256sum` con `-RemoteVerify`), calcula `working_tree_clean` excluyendo `ops/deploy-state/*.yaml`, y actualiza la sección `backend` del manifest. `-DryRun` muestra el diff sin escribir. Sin `-DryRun`, exige confirmación `[s/N]` antes de aplicar.

**Limitación conocida** (la elimina Fase 2 con el endpoint `/api/health/version` + plugin `git-commit-id` en el JAR): este script ASUME que `HEAD` del repo es el commit con el que se construyó el JAR desplegado. Si tras construir el JAR el operador hizo commits adicionales antes de invocar el script, `HEAD` ya no representa el JAR. **Workflow seguro: invocar el script INMEDIATAMENTE tras hacer el deploy, antes de cualquier commit nuevo.** El `-DryRun` ayuda a detectar el error: si el `git_commit_short` que registraría no coincide con el JAR que se subió, no aplicar.

### Manifest `ops/deploy-state/{audit,test,prod}.yaml`

Es el estado real desplegado de cada entorno. Un fichero YAML por entorno, schema v1, con tres bloques: `backend`, `frontend_product`, `frontend_admin`. Cada bloque registra identificador del artefacto (`jar_sha256` o `bundle: main.<hash>.js`), `git_commit_short` y `git_commit`, `deployed_at`, `deployed_by`, `working_tree_clean`, identificadores de infra ya versionados en `docs/` (bucket, distribución CloudFront), e información de verificación (`verification.method`, `verification.notes`). El detalle completo de los campos y la convención de procedencia (`live_ssh_*`, `inferred_from_*`, `last_known_*`, `recorded_by_deploy_script`) está en la cabecera de cada fichero.

**Lo gestionan los scripts; no editar a mano salvo casos justificados** (primera puesta a punto, corrección puntual cuando el script no pudo registrar algo). Si se edita a mano, dejar nota en `verification.notes` explicando por qué.

El manifest se versiona en `git`. El commit del fichero lo decide el operador cuando le conviene (decisión D2, ver `project-log.md` 2026-06-09 Fase 1 paso 1); los scripts solo escriben el fichero, no auto-commitean.

### Inspeccionar el estado a mano sin desplegar

```
ops/scripts/check-deploy-drift.ps1 -Env <audit|test|prod> [-ManifestPath <ruta>]
```

Dot-source-able. Carga el manifest del entorno, compara los tres commits entre sí y contra `origin/main`, devuelve severidad + tabla legible sin tocar nada. `-ManifestPath` permite apuntar a un manifest sintético (útil para reproducir escenarios pasados, como el del incidente 2026-06-08). El script nunca falla con exit code distinto de 0 por severidad — solo informa.



- comprobar disponibilidad de superficie pública
- comprobar disponibilidad de superficie admin
- validar login de producto
- validar login de backoffice
- validar `/api` principal
- validar conexión a `/match`
- validar conexión a `/messages`
- comprobar uploads y assets legales

## Runbook de rollback de frontend (S3 + CloudFront)

El despliegue de frontend (`ops/scripts/deploy-frontend.ps1`) hace `aws s3 sync --delete` sobre el bucket de la surface, lo que **sobrescribe y borra** el bundle anterior. Los buckets frontend no tienen versionado, por lo que el deploy es irreversible salvo que exista un backup previo. Desde 2026-05-31 el flujo en AUDIT toma un backup antes de cada deploy en un prefijo dedicado del bucket de backups general; este runbook describe cómo revertir desde ahí.

**Convención de recursos** (los IDs concretos se resuelven en `~/.sharemechat/state-mapping.yaml`, no se fijan aquí; ver `access-and-tooling.md`):

| Surface | Bucket frontend (logical) | Distribución (logical) | Prefijo de backup |
|---|---|---|---|
| product | `frontend_product` | `frontend_public` | `s3://sharemechat-backups/<env>/frontend/product/` |
| admin | `frontend_admin` | `backoffice_admin` | `s3://sharemechat-backups/<env>/frontend/admin/` |

**Backup pre-deploy** (lo hace el operador antes de cada `deploy-frontend.ps1`, una surface a la vez). El prefijo es sobrescribible: siempre contiene exactamente un respaldo, el del estado inmediatamente anterior al último deploy. El bucket de backups tiene versionado, así que el estado previo a ese queda como versión noncurrent (~30 d por lifecycle) como red extra:

```
aws s3 sync s3://<frontend-bucket>/ s3://sharemechat-backups/<env>/frontend/<surface>/ --delete
```

**Rollback** (restaurar el bundle anterior + reinvalidar). Ejemplo concreto para AUDIT (sustituir bucket/distribución por los de la surface a revertir):

```
# Producto AUDIT (bucket sharemechat-frontend-audit, distribución E1ILXV7P6ENUV8)
aws s3 sync s3://sharemechat-backups/audit/frontend/product/ s3://sharemechat-frontend-audit/ --delete
aws s3 cp s3://sharemechat-frontend-audit/index.html s3://sharemechat-frontend-audit/index.html \
  --metadata-directive REPLACE \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"
aws cloudfront create-invalidation --distribution-id E1ILXV7P6ENUV8 --paths "/*"

# Admin AUDIT (bucket sharemechat-admin-audit, distribución E21IB0VBKYNNBW)
aws s3 sync s3://sharemechat-backups/audit/frontend/admin/ s3://sharemechat-admin-audit/ --delete
aws s3 cp s3://sharemechat-admin-audit/index.html s3://sharemechat-admin-audit/index.html \
  --metadata-directive REPLACE \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"
aws cloudfront create-invalidation --distribution-id E21IB0VBKYNNBW --paths "/*"
```

El `aws s3 cp` reaplica el `cache-control` no-cache sobre `index.html` que el deploy le pone (el resto del bundle es immutable por hash). Tras la invalidación, esperar 30-90 s a que CloudFront propague. Validar con el "Runbook de validación tras despliegue".

**Notas**:

- Hoy solo AUDIT tiene este patrón cableado. TEST y PROD están pendientes de nivelación (ver `known-debt.md` 2026-05-31, "[DEUDA operativa] Nivelar a TEST y PROD el patrón de backup de frontend estrenado en AUDIT").
- Perfil AWS: el despliegue y el rollback usan el perfil por defecto del operador (`sharemechat-deployer`), igual que `deploy-frontend.ps1`. Requiere `s3:GetObject/PutObject/DeleteObject` + `s3:ListBucket` sobre los buckets implicados y `cloudfront:CreateInvalidation` sobre la distribución.

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

## Runbook de facturacion de streams con doble ACK media

Estado: **IMPLEMENTADO y validado en TEST**.

### Garantias funcionales

- La confirmacion facturable del stream exige doble ACK media: cliente y modelo del mismo `streamRecordId`.
- El frontend emite `ack-media` solo tras media local `live`, media remota `live`, conexion WebRTC usable (`connected`/`completed`) y margen de estabilidad temporal.
- El backend valida que el usuario que emite ACK pertenece al stream.
- Un ACK individual no confirma la sesion.
- Un stream cerrado no se confirma despues.
- Si `confirmed_at` es `NULL`, `endSession` cierra sin cargo.
- `confirmed_at` y `billable_start` se escriben de forma atomica y coinciden por construccion.
- `endSession` calcula los segundos facturables desde `billable_start`, con fallback a `confirmed_at`; `start_time` no se usa como inicio facturable final.
- `endIfBelowThreshold` calcula desde `confirmed_at`, coherente con el inicio facturable real.

### Validacion minima tras cambios relacionados

1. Sesion sin doble ACK: cerrar y confirmar que no hay `STREAM_CHARGE`, `STREAM_EARNING` ni `STREAM_MARGIN`.
2. Sesion con un solo ACK: cerrar y confirmar que no hay cargo.
3. Sesion con doble ACK: confirmar que `confirmed_at` y `billable_start` existen y coinciden.
4. Comparar duracion tecnica y facturable: `seconds_from_billable` puede ser menor que `seconds_from_start`.
5. Confirmar que `STREAM_CHARGE`, `STREAM_EARNING` y `STREAM_MARGIN` usan segundos facturables.
6. Confirmar que gifts siguen operando sin cambios y no dependen del ajuste de segundos del stream.

### Resultado validado en TEST

- `seconds_from_billable` distinto de `seconds_from_start` en datos reales.
- `STREAM_CHARGE` correcto.
- `STREAM_EARNING` correcto.
- `STREAM_MARGIN` correcto.
- gifts no afectados.

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

## Runbook de Product Operational Mode

La capa Product Operational Mode está **implementada en backend con alcance parcial** según [ADR-009](../06-decisions/adr-009-product-operational-mode.md). Validada con tráfico real para el cierre de registro en TEST/AUDIT y para el gobierno de endpoints económicos directos en TEST; los modos restrictivos del producto están en código pero no se han ejercitado end-to-end.

### Configuración por entorno

La capa se gobierna mediante variables de entorno resueltas por las propiedades versionadas:

- `PRODUCT_ACCESS_MODE` → `product.access.mode`. Valores admitidos: `OPEN`, `PRELAUNCH`, `MAINTENANCE`, `CLOSED`. Default `OPEN`.
- `PRODUCT_REGISTRATION_CLIENT_ENABLED` → `product.registration.client.enabled`. Default `true`.
- `PRODUCT_REGISTRATION_MODEL_ENABLED` → `product.registration.model.enabled`. Default `true`.
- `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED` → `product.simulation.transactions-direct.enabled`. Default `false`.
- `PRODUCT_ACCESS_ALLOWLIST_USER_IDS` → `product.access.allowlist.user-ids`. Lista CSV de userIds exentos del gate cuando el modo es restrictivo. Default vacía.

Defaults seguros: con las variables sin setear, el sistema se comporta exactamente igual que antes de existir la capa.

El cambio de configuración requiere edición del fichero de entorno del host (`/opt/sharemechat/.env` en AUDIT) y reinicio controlado del backend; mientras no exista hot-reload, no se asume aplicación dinámica.

Matriz operativa por entorno:

- TEST: `PRODUCT_ACCESS_MODE=OPEN`, registros cliente/modelo cerrados. `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=true` solo cuando se necesite simulación interna; `false` cuando se quiera validar el cierre de simulación directa.
- AUDIT: `PRODUCT_ACCESS_MODE=OPEN`, registros cliente/modelo cerrados y `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false` por defecto.
- PRO: `PRODUCT_ACCESS_MODE` según fase y `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false` siempre.

### Endpoints afectados por el cierre de registro (alcance validado)

Con `PRODUCT_REGISTRATION_CLIENT_ENABLED=false` y/o `PRODUCT_REGISTRATION_MODEL_ENABLED=false`:

- `POST /api/users/register/client` → 503 `REGISTRATION_CLOSED` con `scope: client`
- `POST /api/users/register/model` → 503 `REGISTRATION_CLOSED` con `scope: model`

El resto de superficie de producto (login, refresh, endpoints autenticados, handshake WS) no se ve afectada cuando `PRODUCT_ACCESS_MODE=OPEN`.

### Endpoints económicos directos / simulación

Con `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false`:

- `POST /api/transactions/first` → 503 `SIMULATION_DISABLED` con `scope: transactions-direct`
- `POST /api/transactions/add-balance` → 503 `SIMULATION_DISABLED` con `scope: transactions-direct`
- `POST /api/transactions/payout` → no afectado por esta flag
- `POST /api/billing/ccbill/session` → afectado por modo operativo, no por esta flag
- `POST /api/billing/ccbill/notify` → whitelist permanente

Esta flag no gobierna payout, gifts, trials, refunds, cierre de streams ni webhook PSP. Esas superficies económicas no directas se tratan como backlog separado de hardening; `POST /api/billing/ccbill/notify` es bloqueante antes de dinero real hasta implementar validación de firma/origen PSP, idempotencia y protección anti-replay.

Respuesta esperada:

```json
{"code":"SIMULATION_DISABLED","scope":"transactions-direct","message":"La operación solicitada no está disponible en este entorno."}
```

### Respuesta HTTP de bloqueo

Status: `503 Service Unavailable`.
Header opcional `X-Product-Mode` cuando aplica un modo (no se emite en `REGISTRATION_CLOSED`).
Cuerpo JSON estable:

- `PRODUCT_UNAVAILABLE`:
  ```json
  {"code":"PRODUCT_UNAVAILABLE","scope":"product","mode":"PRELAUNCH","message":"El producto aún no está disponible."}
  ```
- `PRODUCT_MAINTENANCE`:
  ```json
  {"code":"PRODUCT_MAINTENANCE","scope":"product","mode":"MAINTENANCE","message":"Mantenimiento en curso. Vuelve a intentarlo en unos minutos."}
  ```
- `REGISTRATION_CLOSED`:
  ```json
  {"code":"REGISTRATION_CLOSED","scope":"client","message":"El registro de clientes está temporalmente cerrado."}
  ```
  (`scope` puede ser `client` o `model`).

En `/api/auth/refresh` bloqueado para sesión de producto, la respuesta incluye `Set-Cookie` con `Max-Age=0` para `access_token` y `refresh_token`. Cookies de backoffice no se tocan.

### Logs

Cada bloqueo emite una línea con prefijo `[PRODUCT-MODE]`. Campos: `path`, `method`, `mode`, `decision` (código), `reason` (razón interna estable). Nunca incluye email, password, token ni cookie.

Ejemplos reales observados:

```
[PRODUCT-MODE] path=/api/users/register/client method=POST mode=- decision=REGISTRATION_CLOSED reason=client_registration_disabled
[PRODUCT-MODE] path=/api/users/register/model method=POST mode=- decision=REGISTRATION_CLOSED reason=model_registration_disabled
[PRODUCT-MODE] path=/api/transactions/first method=POST mode=- decision=SIMULATION_DISABLED reason=transactions_first_disabled
[PRODUCT-MODE] path=/api/transactions/add-balance method=POST mode=- decision=SIMULATION_DISABLED reason=transactions_add_balance_disabled
```

En AUDIT se filtran con `journalctl`; en TEST viven en la sesión interactiva del backend manual mientras siga siendo el modo de arranque.

### Validación en entornos TEST y AUDIT

#### TEST

Configuración aplicada:

```
PRODUCT_ACCESS_MODE=OPEN
PRODUCT_REGISTRATION_CLIENT_ENABLED=false
PRODUCT_REGISTRATION_MODEL_ENABLED=false
PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false
```

Pruebas realizadas:

1. `POST /api/users/register/client` → **503 Service Unavailable**. Mensaje "El registro de clientes está temporalmente cerrado". Log:
   ```
   [PRODUCT-MODE] path=/api/users/register/client method=POST decision=REGISTRATION_CLOSED reason=client_registration_disabled
   ```
2. `POST /api/users/register/model` → **503 Service Unavailable**. Mensaje equivalente. Log con `reason=model_registration_disabled`.
3. **Login de usuario existente** → `LOGIN_SUCCESS` correcto, `AuthRiskService` operativo, sin bloqueo.
4. **Uso del producto**: matching WebRTC, sesiones, gifts y resto de flujos verificados sin impacto.
5. Con `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false`, `POST /api/transactions/first` y `POST /api/transactions/add-balance` responden 503 `SIMULATION_DISABLED`; `POST /api/transactions/payout` sigue funcionando.
6. Con `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=true`, los endpoints directos vuelven a operar para uso interno de TEST.

#### AUDIT

Misma configuración base aplicada en `/opt/sharemechat/.env`, con `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false` por defecto. Arranque mediante `sharemechat-audit.service` (systemd). Logs verificados con:

```
sudo journalctl -u sharemechat-audit -f
```

Pruebas realizadas:

1. `POST https://audit.sharemechat.com/api/users/register/client` → **503 Service Unavailable**. Mensaje correcto en frontend. Log `[PRODUCT-MODE] ... decision=REGISTRATION_CLOSED`.
2. `POST .../api/users/register/model` → mismo comportamiento.
3. **Login** → `LOGIN_SUCCESS` correcto. `AuthRisk` activo con `env=audit`.

#### Conclusión

- Comportamiento consistente entre TEST y AUDIT.
- Bloqueo efectivo server-side, independiente del frontend.
- Sin regresiones detectadas sobre flujos preexistentes (login, matching, gifts, sesiones).

### Limitaciones actuales / pendiente

Estos puntos están **fuera del alcance validado** en esta iteración. Hasta que se ejerciten en entornos no deben darse por garantizados:

- bloqueo de **login de producto** mediante modo `PRELAUNCH` o `CLOSED` (código presente, validación pendiente)
- modo **`MAINTENANCE`** completo (bloqueo de producto manteniendo backoffice)
- comportamiento detallado del **handshake WebSocket** en modos restrictivos más allá del corte por interceptor; el flujo end-to-end con cliente real no se ha probado en estos modos
- **integración con flujos PSP** durante modos restrictivos (los webhooks `/api/billing/ccbill/notify` y `/api/kyc/veriff/webhook` están en whitelist permanente, pero el cierre completo del circuito económico bajo `MAINTENANCE` o `CLOSED` no se ha ejercitado)
- **frontend**: tratamiento de los códigos `PRODUCT_UNAVAILABLE`, `PRODUCT_MAINTENANCE` y `REGISTRATION_CLOSED` en `apiFetch`, `SessionProvider`, `RequireRole`, modales de registro y engines WS — **pendiente** según [frontend-architecture.md](../02-architecture/frontend-architecture.md). Hoy el frontend recibe el 503 con cuerpo JSON pero no hay UX dedicada por código
- **frontend**: tratamiento de `SIMULATION_DISABLED` si alguna superficie invoca los endpoints directos en un entorno cerrado
- **allowlist por userId** dentro de modos restrictivos: implementada; no se ha ejercitado porque ningún modo restrictivo está activo en entornos
- **caso de access_token expirado en `/api/auth/refresh`**: limitación consciente. Una sesión backoffice cuyo access_token haya expirado puede ser tratada como producto y forzar re-login durante modos restrictivos. No se resuelve en esta iteración.

### Rollback

Reversión inmediata sin redeploy: setear `PRODUCT_ACCESS_MODE=OPEN`, ajustar las flags de registro según la operación requerida y mantener `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false` salvo uso interno explícito en TEST; después reiniciar el backend.

## Regla de saneado

Si un runbook necesita un dato sensible concreto para ejecución operativa, ese dato no debe fijarse en este corpus; debe resolverse desde la fuente operativa correspondiente.
