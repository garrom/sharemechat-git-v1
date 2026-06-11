# Skill: state-inventory

## Propósito

Generar un snapshot estructurado del estado real de un entorno de SharemeChat (TEST, AUDIT o PRO), inventariando los siguientes dominios: repositorio local, AWS CloudFront (todas las distribuciones del entorno), AWS S3 (todos los buckets del entorno), EC2 backend (vía SSH) y RDS MySQL (vía túnel SSH).

El snapshot es la fuente de verdad estructurada que después se usa para detectar drift entre la realidad operativa y la documentación en prosa del repositorio.

## Versión

Esta skill es `state-inventory@v1.2`. Cambios respecto a v1.1:

- Tras introducción de Flyway por [ADR-025](../06-decisions/adr-025-flyway-introduction-and-cms-v2-schema.md), la fuente de verdad de migraciones aplicadas es BD (`flyway_schema_history`), no carpeta del repo.
- Carpeta de migraciones canónica pasa de `src/main/resources/db/manual/` a `src/main/resources/db/migration/`. Los ficheros pre-Flyway viven archivados en `docs/_archive/db-manual-pre-flyway/` y NO se inventarían.
- Renombra `repo.schema_versioning.manual_migrations_dir` → `repo.schema_versioning.migrations_dir`.
- Renombra `repo.schema_versioning.last_manual_migration` → `repo.schema_versioning.last_repo_migration` (último `V*.sql` ordenado lexicográficamente en la carpeta del repo).
- Añade `repo.schema_versioning.last_applied_flyway_version`: máximo `version` con `success=TRUE` en la tabla `flyway_schema_history` de BD. `null` si la tabla no existe.
- Cambia la semántica de `flyway_runtime_present`: post-ADR-025 es `true` por defecto (porque Flyway está adoptado); `false` solo en entornos pre-Flyway que no han sido baselined todavía.
- Bump `metadata.schema_version` de `2` a `3`.

Cambios respecto a v1:

- Itera **todas** las distribuciones CloudFront del entorno (no solo una). Lee la lista del mapping local.
- Inventaría **todos** los buckets S3 del entorno.
- Sustituye `rds_database.flyway_table_present` por un objeto `schema_versioning` más expresivo.
- Amplía `systemd_services.state` para aceptar valores reales (incluido `failed`, `activating`, `deactivating`, etc.).
- Bump `metadata.schema_version` de `1` a `2`.

Cambios de esquema futuros requieren bump de `metadata.schema_version` y nota en este apartado.

## Cuándo usar esta skill

Usar al cerrar un frente técnico, antes de nivelar un entorno con otro, o cuando se sospeche que la documentación se ha desincronizado del estado real. No se ejecuta proactivamente; el usuario decide cuándo invocarla.

## Cuándo NO usar esta skill

No usar para auditar código fuente. No usar para tomar acción correctiva sobre la realidad. No usar para inventariar entornos no preparados (la tabla de mapeo debe existir para el entorno solicitado).

## Inputs requeridos

- `environment`: identificador del entorno objetivo. Valores válidos: `test`, `audit`, `prod`.
- Tabla de mapeo lógico↔real disponible en `~/.sharemechat/state-mapping.yaml` con bloque del entorno relleno (ver formato esperado más abajo).
- Túnel SSH a MySQL del entorno abierto en `localhost:3307` antes de invocar la skill.

## Formato esperado del mapping (esquema v2)

El mapping del entorno debe tener esta estructura mínima:

```yaml
environments:
  <env>:
    cloudfront_distributions:
      <logical_name>:
        id: "<E*>"
        alias: "<descripción humana>"
        domains: [<list>]
      ...
    s3_buckets:
      <logical_name>:
        name: "<bucket-name>"
        alias: "<descripción humana>"
        served_by_distribution: "<logical_name de cloudfront_distributions o null>"
      ...
    ec2_backend_ssh_alias: "<alias>"
    rds_endpoint_alias: "<alias>"
    rds_endpoint_real: "<endpoint-real>"
    rds_schema_name: "<schema>"
    cloudfront_functions:
      - name: "<nombre>"
        attached_to: "<logical_name de cloudfront_distributions>"
        event_type: "<viewer-request|...>"
```

Si el entorno solo tiene una distribución, el bloque `cloudfront_distributions` debe contenerla igualmente con su alias lógico.

## Prerrequisitos en la máquina local

1. AWS CLI configurado y con permisos read sobre las distribuciones CloudFront y los buckets S3 del entorno.
2. SSH alias del backend del entorno disponible en `~/.ssh/config`.
3. Cliente `mysqlsh` (MySQL Shell 8.0+) disponible en PATH.
4. `jq` instalado (recomendado, opcional). Si no, parsear con PowerShell `ConvertFrom-Json` o equivalente.
5. `yq` o `python+pyyaml` para validar el YAML producido.
6. Túnel SSH a RDS abierto en `localhost:3307`. Ejemplo:

   ssh -L 3307:<rds-endpoint>:3306 <ssh-alias> -N

   La skill no abre ni cierra el túnel; lo asume abierto.
7. Carpeta `docs/_snapshots/` existente en el repo.
8. Variable de entorno `RDS_PASSWORD` disponible en User scope.

## Output

Un fichero YAML válido en:

docs/_snapshots/state-<environment>-<YYYY-MM-DD-HHMM>.yaml

El fichero sigue el esquema v3 documentado más abajo.

## Esquema del snapshot v3

```yaml
metadata:
  schema_version: 3
  environment: <test|audit|prod>
  generated_at: <ISO 8601 UTC>
  generated_by: state-inventory@v1.2
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
  schema_versioning:
    flyway_runtime_present: <bool>            # ¿hay tabla flyway_schema_history en la BD?
                                              # post-ADR-025: true por defecto en entornos baselined;
                                              # false solo en entornos pre-Flyway no baselined todavia.
    migrations_dir: <string>                  # carpeta canonica del repo: src/main/resources/db/migration/
    last_repo_migration: <string>             # ultimo V*.sql ordenado lexicograficamente en la carpeta del repo
    last_applied_flyway_version: <string|null> # max(version) con success=TRUE en flyway_schema_history;
                                              # null si la tabla no existe (entorno pre-baseline)
  adrs:
    - id: <ADR-NNN>
      file: <nombre fichero>
      status: <texto extraído de la sección "## Estado">

cloudfront:
  distributions:
    - logical_name: <string>                  # del mapping
      alias: <string>                         # del mapping
      primary_aliases: [<dominios públicos>]  # de AWS
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

s3:
  buckets:
    - logical_name: <string>                  # del mapping
      name: <string>                          # nombre real del bucket
      alias: <string>                         # del mapping
      region: <string>                        # de AWS
      served_by_distribution: <logical_name|null>

ec2_backend:
  ssh_alias: <alias lógico>
  systemd_services:
    - name: <string>
      state: <string>                         # cualquier valor real: active, inactive, failed, activating, deactivating, not-found, etc.
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

Ejecutar en este orden. Si un dominio o sub-elemento falla, registrar el fallo en `metadata.notes` y continuar. El snapshot resultante quedará marcado como parcial.

### Paso 1 — Cargar tabla de mapeo

Leer `~/.sharemechat/state-mapping.yaml`. Localizar la entrada del entorno solicitado. Validar que contiene los siguientes campos mínimos:

- `cloudfront_distributions` (mapa, al menos una entrada)
- `s3_buckets` (mapa, al menos una entrada)
- `ec2_backend_ssh_alias` (string)
- `rds_endpoint_real` (string)
- `rds_schema_name` (string)

Si falta alguno, abortar con error claro indicando qué campo falta.

### Paso 2 — Inventariar repo (local)

Trabajar desde la raíz del repo.

- `git rev-parse --abbrev-ref HEAD` → `repo.branch`.
- `git log -1 --format='%h|%cI'` → `repo.head_commit` y `repo.head_commit_date`.
- `git log --since="24 hours ago" --format='%h|%s|%cI'` → `repo.commits_last_24h`.
- Leer `pom.xml`. Extraer `<artifactId>` y `<version>`. Construir `expected_filename`.
- `ls src/main/resources/db/migration/V*.sql | sort` → `repo.schema_versioning.last_repo_migration` (último fichero ordenado lexicográficamente; tras ADR-025 la carpeta canónica es `db/migration/`, no `db/manual/`).
- Fijar `repo.schema_versioning.migrations_dir = "src/main/resources/db/migration/"`.
- (`flyway_runtime_present` y `last_applied_flyway_version` se rellenan en el Paso 6 al consultar BD.)
- Listar `docs/06-decisions/adr-*.md`. Para cada uno: extraer ID, leer sección `## Estado`, escribir en `adrs`.

### Paso 3 — Inventariar CloudFront (todas las distribuciones del entorno)

Para cada entrada en `cloudfront_distributions` del mapping:

1. Extraer `id` (real) y `logical_name`.
2. Ejecutar `aws cloudfront get-distribution-config --id <id>`.
3. Ejecutar `aws cloudfront get-distribution --id <id>` para extraer `Status`.
4. Parsear:
  - `DistributionConfig.Aliases.Items` → `primary_aliases`.
  - `DistributionConfig.DefaultCacheBehavior.TargetOriginId` (traducir vía mapeo si está; si no, usar el ID tal cual con prefijo `<raw>:`).
  - `DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Items` → `default_behavior.function_associations`.
  - `DistributionConfig.CacheBehaviors.Items` → `cache_behaviors`.
  - `DistributionConfig.CustomErrorResponses.Items` → `custom_error_responses`.
5. **Saneado obligatorio**: NUNCA escribir el `id` real en el snapshot. Solo `logical_name` y `alias` del mapping.

Si una distribución del mapping falla al inventariar, registrar en `metadata.notes` y continuar con las siguientes.

### Paso 4 — Inventariar S3 (todos los buckets del entorno)

Para cada entrada en `s3_buckets` del mapping:

1. Extraer `name` (real) y `logical_name`.
2. Ejecutar `aws s3api get-bucket-location --bucket <name>`. Extraer `LocationConstraint` → `region` (si es `null`, equivale a `us-east-1`).
3. Volcar al snapshot: `logical_name`, `name`, `alias`, `region`, `served_by_distribution` (del mapping).

No inspeccionar políticas, ACLs ni contenido del bucket. Solo presencia y región.

Si un bucket falla (no existe, sin permisos), registrar en `metadata.notes` y continuar.

### Paso 5 — Inventariar EC2 backend (SSH)

Usar `ec2_backend_ssh_alias` del mapping. Ejecutar:

- `ssh <alias> "systemctl list-units --type=service --no-pager --all 2>/dev/null | grep -E 'sharemechat|coturn|redis|nginx' || true"` → parsear todas las líneas, extraer nombre del servicio y estado (LOAD/ACTIVE/SUB columns). El campo `state` del snapshot puede tener cualquier valor que devuelva systemd: `active`, `inactive`, `failed`, `activating`, `deactivating`, `not-found`. NO normalizar a un subset; reflejar la realidad.
- `ssh <alias> "ps -eo pid,user,lstart,cmd | grep 'java.*\\.jar' | grep -v grep"` → si hay output, capturar `lstart` del primer match → `jar_running.started_at` y `process_present: true`. Si no, `false` y `unknown`. (Sustituye `pgrep -af` de v1 que sufría falsos positivos.)
- Localizar config nginx: `ssh <alias> "ls /etc/nginx/conf.d/ | grep sharemechat"`. Para TEST típicamente `api.test.sharemechat.com.conf`.
- `ssh <alias> "sudo grep -nE '^\\s*location' <config_path>"` → parsear cada `location`, extraer `path`. Para cada path, extraer `proxy_pass` o `return` del bloque correspondiente.
- `ssh <alias> "sudo grep -E 'client_max_body_size' <config_path>"` → si aparece, capturar valor; si no, `client_max_body_size: default`.

### Paso 6 — Inventariar RDS MySQL (vía túnel SSH abierto)

Validar conectividad: `mysqlsh --sql --host 127.0.0.1 --port 3307 --user admin --password=<from RDS_PASSWORD> -e "SELECT 1;"`. Si falla, abortar el dominio RDS con nota en `metadata.notes`: "Túnel SSH a RDS no disponible en localhost:3307".

Queries contra `rds_schema_name`:

- `SELECT VERSION();` → `rds_database.mysql_version`.
- `SHOW TABLES LIKE 'flyway_schema_history';` → si devuelve fila, `repo.schema_versioning.flyway_runtime_present: true`; si no, `false`. **Semántica post-ADR-025**: el valor esperado en TEST/AUDIT/PRO es `true` (Flyway está adoptado). Encontrar `false` indica que el entorno no ha pasado por el procedimiento `flyway baseline` del runbook `cms-v2-flyway-introduction.md`; reportar en `metadata.notes`.
- Si `flyway_runtime_present: true`, ejecutar `SELECT MAX(version) AS v FROM flyway_schema_history WHERE success = TRUE;` → `repo.schema_versioning.last_applied_flyway_version`. Si la consulta devuelve `NULL` (tabla vacía), guardar `null` con nota: "flyway_schema_history existe pero está vacía". Si `flyway_runtime_present: false`, dejar `last_applied_flyway_version: null` sin nota adicional (esperado en entorno pre-baseline).
- CHECK constraints de `content_articles.state`:
  ```sql
  SELECT CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = '<schema>' AND CONSTRAINT_NAME = 'chk_content_articles_state';
  ```
- DEFAULT de `content_articles.state`:
  ```sql
  SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = '<schema>' AND TABLE_NAME = 'content_articles' AND COLUMN_NAME = 'state';
  ```
- `SELECT COUNT(*) FROM content_articles;` → `rows_total`.
- `SELECT state, COUNT(*) FROM content_articles GROUP BY state;` → `rows_by_state`.
- CHECK constraints de `content_review_events.event_type`:
  ```sql
  SELECT CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = '<schema>' AND CONSTRAINT_NAME = 'chk_content_review_events_type';
  ```

### Paso 7 — Componer YAML

Ensamblar todas las secciones bajo `metadata`. Validar con `yq` o Python+PyYAML antes de escribir el fichero.

Nombre del fichero: `state-<environment>-<YYYY-MM-DD-HHMM>.yaml`, con timestamp = `generated_at` truncado a minutos.

Escribir en `docs/_snapshots/<filename>`.

### Paso 8 — Resumen al usuario

Mostrar:

1. Ruta del fichero generado.
2. Líneas resumen por dominio: nombre del dominio + "OK" o "PARCIAL: <motivo>".
3. Recuento de elementos inventariados: N distribuciones, M buckets, K servicios systemd, etc.
4. Tamaño del fichero en líneas.
5. Sugerencia: "Para detectar drift contra documentación, ejecutar la skill state-diff."

## Errores conocidos y mitigaciones

### AWS CLI sin permisos sobre alguna distribución o bucket

`AccessDenied`. Registrar en `metadata.notes`: "Distribución `<logical_name>` inventariado parcial: AccessDenied" y dejar esa entrada con campos vacíos pero estructura presente.

### EC2 con SSH no disponible

Si `ssh <alias> "echo ok"` falla, registrar en `metadata.notes`: "EC2 backend no accesible vía SSH" y dejar `ec2_backend: null`.

### Túnel SSH a RDS no abierto

Mensaje: "Túnel SSH a RDS no disponible en localhost:3307. Abrir túnel y reintentar." Dejar `rds_database: null`.

### Contraseña de RDS no disponible

Si `RDS_PASSWORD` no está en User scope, abortar el dominio RDS con nota: "Credencial RDS no disponible". No prompt interactivo.

### CHECK constraint no encontrado

Si la query devuelve vacío, registrar el campo correspondiente como `[]` y añadir nota: "CHECK constraint `<nombre>` no encontrado en BD".

### Bucket inexistente o renombrado

Si `aws s3api get-bucket-location --bucket <name>` falla con `NoSuchBucket`, registrar en `metadata.notes`: "Bucket `<logical_name>` inexistente en AWS pero presente en mapping" y dejar la entrada con `region: null` y nota interna.

## Seguridad y saneado

- NUNCA escribir en el snapshot: distribution IDs reales, ARNs, IPs públicas, hostnames RDS reales, security group IDs, account IDs, bucket policies con principals reales.
- SIEMPRE traducir a aliases lógicos vía la tabla de mapeo.
- El fichero `~/.sharemechat/state-mapping.yaml` NUNCA debe versionarse en git.
- Los snapshots SÍ se versionan en git (no contienen IDs sensibles tras el saneado).

## Compatibilidad con esquemas v1 y v2

Los snapshots con `metadata.schema_version: 1` o `metadata.schema_version: 2` son compatibles solo de lectura. Cualquier nuevo snapshot generado con esta skill emite v3. La skill `state-diff` debe ser capaz de leer los tres.

Diferencias clave que afectan al lector entre versiones:

- v1 → v2: `rds_database.flyway_table_present` (bool plano) se sustituye por el objeto `repo.schema_versioning` con `flyway_runtime_present`, `manual_migrations_dir` y `last_manual_migration`.
- v2 → v3: dentro de `repo.schema_versioning`, los campos `manual_migrations_dir` y `last_manual_migration` se renombran a `migrations_dir` y `last_repo_migration` (ahora apuntan a `src/main/resources/db/migration/`); se añade `last_applied_flyway_version` leído de BD. Snapshots v2 con `manual_migrations_dir: "src/main/resources/db/manual/"` y `last_manual_migration: "V20260508__..."` siguen siendo lectura válida pero reflejan estado pre-ADR-025; el lector debe entender esto como contexto histórico, no como divergencia real.
