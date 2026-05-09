# Skill: state-inventory

## Propósito

Generar un snapshot estructurado del estado real de un entorno de SharemeChat (TEST, AUDIT o PRO), inventariando cuatro dominios: repositorio local, AWS CloudFront, EC2 backend (vía SSH) y RDS MySQL (vía túnel SSH).

El snapshot es la fuente de verdad estructurada que después se usa para detectar drift entre la realidad operativa y la documentación en prosa del repositorio.

## Cuándo usar esta skill

Usar al cerrar un frente técnico, antes de nivelar un entorno con otro, o cuando se sospeche que la documentación se ha desincronizado del estado real. No se ejecuta proactivamente; el usuario decide cuándo invocarla.

## Cuándo NO usar esta skill

No usar para auditar código fuente (otra skill se encargará). No usar para tomar acción correctiva sobre la realidad (eso es manual). No usar para inventariar otros entornos no preparados (la tabla de mapeo debe existir para el entorno solicitado).

## Inputs requeridos

- `environment`: identificador del entorno objetivo. Valores válidos: `test`, `audit`, `pro`.
- Tabla de mapeo lógico↔real disponible en `~/.sharemechat/state-mapping.yaml`.
- Túnel SSH a MySQL del entorno abierto en `localhost:3307` antes de invocar la skill.

## Prerrequisitos en la máquina local

1. AWS CLI configurado y con permisos read sobre la distribución CloudFront del entorno.
2. SSH alias del backend del entorno disponible en `~/.ssh/config`.
3. Cliente `mysqlsh` en PATH (MySQL Shell 8.0+).
4. `jq` instalado (para parsear respuestas AWS).
5. `yq` instalado (para validar el YAML producido).
6. Túnel SSH a RDS abierto en `localhost:3307` antes de ejecutar la skill. Comando típico:

ssh -L 3307:<rds-endpoint>:3306 <ssh-alias> -N

La skill no abre ni cierra el túnel; lo asume abierto.
7. Carpeta `docs/_snapshots/` existente en el repo.
8. Variable de entorno `RDS_PASSWORD` disponible en la sesión, o credenciales accesibles vía `~/.my.cnf` con sección `[client]`.

## Output

Un fichero YAML válido en:

docs/_snapshots/state-<environment>-<YYYY-MM-DD-HHMM>.yaml

El fichero sigue el esquema versión 1 documentado más abajo.

## Esquema del snapshot v1

```yaml
metadata:
  schema_version: 1
  environment: <test|audit|pro>
  generated_at: <ISO 8601 UTC>
  generated_by: state-inventory@v1
  notes: <texto libre opcional>

repo:
  branch: <string>
  head_commit: <sha corto>
  head_commit_date: <ISO 8601>
  commits_last_24h:
    - sha: <string>
      message: <primera línea>
      date: <ISO 8601>
  jar_artifact:
    name: <string>
    version: <string>
    expected_filename: <string>
  flyway_migrations:
    - <nombre fichero .sql ordenado>
  adrs:
    - id: <ADR-NNN>
      file: <nombre fichero>
      status: <texto extraído de la sección "## Estado">

cloudfront:
  distribution_alias: <alias lógico>
  primary_aliases: [<dominios públicos>]
  status: <Deployed|InProgress>
  default_behavior:
    target_origin: <alias lógico>
    function_associations:
      - name: <string>
        event_type: <viewer-request|origin-request|...>
  cache_behaviors:
    - path_pattern: <string>
      target_origin: <alias lógico>
      allowed_methods: [<lista>]
      cache_policy: <nombre managed o "custom">
  custom_error_responses:
    - error_code: <int>
      response_path: <string>
      response_code: <int>

ec2_backend:
  ssh_alias: <alias lógico>
  systemd_services:
    - name: <string>
      state: <active|inactive|not-installed>
  jar_running:
    started_at: <ISO 8601 o "unknown">
    process_present: <bool>
  nginx:
    config_file: <ruta>
    location_blocks:
      - path: <string>
        proxy_pass: <ruta o "n/a">
        action: <string opcional>
    client_max_body_size: <string>

rds_database:
  endpoint_alias: <alias lógico>
  mysql_version: <string>
  schema_name: <nombre BD>
  flyway_table_present: <bool>
  content_articles:
    state_check_constraint: [<lista>]
    state_default: <string>
    rows_total: <int>
    rows_by_state:
      <STATE>: <int>
  content_review_events:
    event_type_check_constraint: [<lista>]
```

## Procedimiento de inventariado

Ejecutar en este orden. Si un dominio falla, registrar el fallo en `metadata.notes` y continuar con los siguientes; el snapshot resultante quedará marcado como parcial.

### Paso 1 — Cargar tabla de mapeo

Leer `~/.sharemechat/state-mapping.yaml`. Localizar la entrada del entorno solicitado. Extraer:

- `cloudfront_distribution_id`
- `cloudfront_distribution_alias`
- `ec2_backend_ssh_alias`
- `rds_endpoint_alias`
- `s3_frontend_origin_alias`

Si la entrada no existe, abortar con error claro: "Entorno <env> no encontrado en state-mapping.yaml".

### Paso 2 — Inventariar repo (local)

Trabajar desde la raíz del repo (`pwd` debe ser `sharemechat-v1/` o equivalente).

- `git rev-parse --abbrev-ref HEAD` → `repo.branch`.
- `git log -1 --format='%h|%cI'` → `repo.head_commit` y `repo.head_commit_date`.
- `git log --since="24 hours ago" --format='%h|%s|%cI'` → `repo.commits_last_24h`.
- Leer `pom.xml`. Extraer `<artifactId>` y `<version>` del bloque `<project>`. Construir `expected_filename` como `<artifactId>-<version>.jar`.
- `ls src/main/resources/db/manual/V*.sql | sort` → `repo.flyway_migrations` (solo nombres de fichero, sin ruta).
- Listar `docs/06-decisions/adr-*.md`. Para cada uno: extraer ID del nombre (ej. `adr-016-...md` → `ADR-016`). Leer la primera sección `## Estado` (entre `## Estado` y el siguiente `##`) y poner el contenido limpio en `status`.

### Paso 3 — Inventariar CloudFront (AWS CLI)

Comando base:

aws cloudfront get-distribution-config --id <distribution_id>

Parsear el JSON resultante con `jq`:

- `DistributionConfig.Aliases.Items` → `cloudfront.primary_aliases`.
- Estado de la distribución se obtiene aparte con `aws cloudfront get-distribution --id <id>` (campo `Distribution.Status`) → `cloudfront.status`.
- `DistributionConfig.DefaultCacheBehavior`:
    - `TargetOriginId` → traducir vía mapeo a alias lógico → `cloudfront.default_behavior.target_origin`.
    - `FunctionAssociations.Items[].FunctionARN` (extraer nombre de función del ARN) y `EventType` → `cloudfront.default_behavior.function_associations`.
- `DistributionConfig.CacheBehaviors.Items` (lista):
    - Para cada item: `PathPattern`, `TargetOriginId` (traducir), `AllowedMethods.Items`, `CachePolicyId` (mapear a nombre legible si es managed; si no, "custom").
- `DistributionConfig.CustomErrorResponses.Items`:
    - Para cada item: `ErrorCode`, `ResponsePagePath`, `ResponseCode`.

Saneado obligatorio: NUNCA escribir el `distribution_id` real en el snapshot. Solo el `distribution_alias` lógico.

### Paso 4 — Inventariar EC2 backend (SSH)

Usar el alias SSH del mapeo. Ejecutar:

- `ssh <alias> "systemctl list-units --type=service --no-pager --state=active,inactive 2>/dev/null | grep -E 'sharemechat|coturn|redis|nginx' || true"` → parsear líneas, extraer nombre y estado → `ec2_backend.systemd_services`.
- `ssh <alias> "pgrep -af 'java.*\.jar' | head -1"` → si hay output, capturar el PID y obtener `ssh <alias> "ps -o lstart= -p <PID>"` → `ec2_backend.jar_running.started_at`. Si no hay output, `process_present: false` y `started_at: unknown`.
- Localizar config nginx del entorno. Para TEST típicamente `/etc/nginx/conf.d/api.test.sharemechat.com.conf`. Confirmar con: `ssh <alias> "ls /etc/nginx/conf.d/ | grep sharemechat"`.
- `ssh <alias> "sudo grep -nE '^\s*location' <config_path>"` → parsear cada `location` para extraer `path`. Para cada path, extraer también el `proxy_pass` o `return` correspondiente del bloque (lectura limitada al bloque entre llaves del location).
- `ssh <alias> "sudo grep -E 'client_max_body_size' <config_path>"` → si aparece, capturar el valor; si no, registrar `client_max_body_size: default`.

### Paso 5 — Inventariar RDS MySQL (vía túnel SSH abierto)

Antes de empezar, validar conectividad: `mysqlsh --sql --host 127.0.0.1 --port 3307 --user admin --password=$env:RDS_PASSWORD -e "SELECT 1;"`. Si falla, abortar el dominio RDS con nota: "Túnel SSH a RDS no disponible en localhost:3307".

Queries a ejecutar contra la BD del entorno (nombre obtenido del mapeo o `application-<env>.properties`):

- `SELECT VERSION();` → `rds_database.mysql_version`.
- `SHOW TABLES LIKE 'flyway_schema_history';` → si devuelve fila, `flyway_table_present: true`; si no, `false`.
- Para `content_articles.state`:
```sql
  SELECT CHECK_CLAUSE
  FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = '<schema>'
    AND CONSTRAINT_NAME = 'chk_content_articles_state';
```
Parsear la cláusula (ej. `state in ('DRAFT','IN_REVIEW',...)`) y extraer la lista entre paréntesis → `state_check_constraint`.
- Para el DEFAULT:
```sql
  SELECT COLUMN_DEFAULT
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = '<schema>'
    AND TABLE_NAME = 'content_articles'
    AND COLUMN_NAME = 'state';
```
- `SELECT COUNT(*) FROM content_articles;` → `rows_total`.
- `SELECT state, COUNT(*) FROM content_articles GROUP BY state;` → `rows_by_state`.
- Para `content_review_events.event_type`: misma query de CHECK_CONSTRAINTS con `chk_content_review_events_type` → `event_type_check_constraint`.

### Paso 6 — Componer el YAML final

Ensamblar las cuatro secciones bajo el bloque `metadata`. Validar con `yq eval '.' <fichero>` que es YAML sintácticamente correcto antes de escribir el fichero final.

Nombre del fichero: `state-<environment>-<YYYY-MM-DD-HHMM>.yaml`, donde el timestamp es el `generated_at` truncado a minutos.

Escribir en `docs/_snapshots/<filename>`.

### Paso 7 — Resumen al usuario

Mostrar al usuario:

1. Ruta del fichero generado.
2. Cuatro líneas resumen (una por dominio): nombre del dominio + "OK" o "PARCIAL: <motivo>".
3. Tamaño del fichero en líneas.
4. Sugerencia: "Para detectar drift contra documentación, ejecutar la skill `state-diff` (cuando esté disponible)" — esto es informativo, no se ejecuta nada.

## Errores conocidos y mitigaciones

### AWS CLI sin permisos

`aws cloudfront get-distribution-config` puede devolver `AccessDenied` si el perfil no tiene permisos sobre la distribución. Si ocurre, registrar en `metadata.notes`: "CloudFront inventariado parcial: AccessDenied" y dejar `cloudfront: null`.

### EC2 con SSH no disponible

Si `ssh <alias> "echo ok"` falla con timeout o conexión rechazada, registrar en `metadata.notes`: "EC2 backend no accesible vía SSH" y dejar `ec2_backend: null`.

### Túnel SSH a RDS no abierto

Detectado en el paso 5 con la query de validación. Mensaje: "Túnel SSH a RDS no disponible en localhost:3307. Abrir túnel y reintentar." Dejar `rds_database: null`.

### Contraseña de RDS no disponible

Si la variable de entorno `RDS_PASSWORD` no está disponible, abortar el dominio RDS con nota: "Credencial RDS no disponible". No prompt interactivo en v1.

### CHECK constraint no encontrado

Si la query a `INFORMATION_SCHEMA.CHECK_CONSTRAINTS` devuelve vacío, registrar el campo correspondiente como `[]` y añadir nota a `metadata.notes`: "CHECK constraint <nombre> no encontrado en BD".

## Seguridad y saneado

- NUNCA escribir en el snapshot: distribution IDs reales, ARNs, IPs públicas, hostnames RDS reales, security group IDs, account IDs.
- SIEMPRE traducir a alias lógicos vía la tabla de mapeo.
- El fichero `~/.sharemechat/state-mapping.yaml` NUNCA debe versionarse en git. Añadirlo a `.gitignore` global o local del usuario.
- Los snapshots SÍ se versionan en git (no contienen IDs sensibles tras el saneado).

## Versión

Esta skill es `state-inventory@v1`. Cambios de esquema requieren bump de `metadata.schema_version` y nota en este apartado.