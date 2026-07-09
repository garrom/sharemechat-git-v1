# Accesos operativos y herramientas

Cómo accede el equipo de mantenimiento al sistema desde su portátil: AWS CLI, SSH a EC2, túnel RDS, cliente MySQL y el mapping local que traduce nombres lógicos a IDs reales.

El documento describe **convenciones, comandos y prerrequisitos**. No contiene IDs reales (cuenta AWS, distribuciones CloudFront, buckets S3, endpoints RDS), ni credenciales, ni nombres de usuario IAM. La información sensible vive **fuera del repo** en `~/.sharemechat/state-mapping.yaml`, según la regla de saneado de [documentation-governance.md](../documentation-governance.md) y la invariante D6 de [ADR-017](../06-decisions/adr-017-state-snapshots-and-docs-coexistence.md).

Si llegas aquí porque vas a operar contra infraestructura y no estás seguro de tener acceso, ejecuta el [smoke test](#verificación-rápida-del-equipo-smoke-test) antes de asumir nada.

## Tabla rápida

| Recurso | Mecanismo | Prerrequisito en el equipo | Detalle |
|---|---|---|---|
| AWS (CloudFront, S3, IAM read; write limitado a deploy) | AWS CLI v2 | `aws configure` con credenciales válidas | [AWS CLI](#aws-cli) |
| EC2 backend de un entorno | SSH con alias `<env>-backend` | Entrada en `~/.ssh/config` | [SSH a EC2](#ssh-a-ec2) |
| RDS MySQL de un entorno | Túnel SSH abierto por `ops/scripts/tunnel-rds.ps1 <env>` | `ssh`, `powershell-yaml`, mapping local | [Túnel a RDS](#túnel-a-rds) |
| Cliente MySQL contra el túnel | `mysqlsh` apuntando a `localhost:3307` | `mysqlsh` 8.0+ en PATH, `RDS_PASSWORD` User scope | [Túnel a RDS](#túnel-a-rds) |
| Mapping lógico↔real de IDs | `~/.sharemechat/state-mapping.yaml` | Fichero fuera del repo, poblado por entorno | [skill state-inventory](../state-inventory-skills/state-inventory.md) |

## AWS CLI

- **Versión recomendada**: AWS CLI v2 (`aws --version` debe mostrar `aws-cli/2.x`).
- **Perfil**: configuración por defecto en `~/.aws/credentials` y `~/.aws/config`. No se usa `AWS_PROFILE` nombrado; el perfil default es el del operador.
- **Identidad esperada**: usuario IAM dedicado al proyecto con permisos read sobre CloudFront y S3, y write limitado a `s3:PutObject*` y `cloudfront:CreateInvalidation` sobre las distribuciones del proyecto. No se documenta aquí el nombre exacto del usuario IAM; consultar al operador o `aws sts get-caller-identity` localmente.
- **Región default**: `eu-central-1`. Toda la infraestructura del proyecto vive ahí.
- **Verificación rápida**:

  ```powershell
  aws sts get-caller-identity
  aws cloudfront list-distributions --query "DistributionList.Items[].{Id:Id,Status:Status,Comment:Comment}" --output table
  ```

  La primera línea debe devolver un ARN de usuario IAM. La segunda, una tabla con las distribuciones del proyecto (TEST, AUDIT, PROD).

## SSH a EC2

Convención de alias en `~/.ssh/config`:

```
Host <env>-backend
    HostName <ip-publica-del-entorno>
    User ec2-user
    IdentityFile <ruta-completa-al-pem>
    ServerAliveInterval 60
    ServerAliveCountMax 10
```

Donde `<env>` es `test`, `audit` o `prod`. La IP pública y la ruta al `.pem` viven en `~/.ssh/config` del operador, no en el repo.

**Verificación**:

```powershell
ssh -o BatchMode=yes -o ConnectTimeout=5 <env>-backend "echo ok"
```

Debe devolver `ok`. `BatchMode=yes` evita prompts interactivos (passphrase, host fingerprint nuevo).

**Notas por entorno**:

- **TEST**: la EC2 se enciende y apaga manualmente. Si el alias no responde, la EC2 puede estar parada — verificar en la consola AWS antes de asumir problema de configuración. El backend de TEST corre como proceso de `ec2-user` (no systemd); ver detalle en [test.md](../03-environments/test.md).
- **AUDIT**: la EC2 está siempre encendida y el backend corre como `sharemechat-audit.service`. El alias debería responder en todo momento.
- **PROD**: el entorno aún no existe como producto (solo landing). El alias `prod-backend` se documentará cuando se monte la EC2 backend de PROD.

Si tu equipo aún no tiene los alias `audit-backend` o `prod-backend` configurados, añadirlos a `~/.ssh/config` antes de operar sobre esos entornos. Los datos para rellenarlos viven en el mapping local.

## Túnel a RDS

RDS no está expuesto a internet. Para conectar con cualquier cliente MySQL, hay que abrir un túnel SSH a través de la EC2 backend que actúa como bastión.

El script `ops/scripts/tunnel-rds.ps1` automatiza el proceso:

```powershell
.\ops\scripts\tunnel-rds.ps1 <env>
```

Donde `<env>` es `test`, `audit` o `prod`. El script:

1. Lee `~/.sharemechat/state-mapping.yaml` para resolver el endpoint RDS y el alias SSH del entorno.
2. Verifica que el puerto local 3307 está libre y que el alias SSH responde.
3. Abre `ssh -L 3307:<rds-endpoint>:3306 <ssh-alias> -N` en foreground.

La PowerShell queda colgada con un banner verde mientras el túnel está abierto. Cerrar con `Ctrl+C`.

Una vez abierto, conectar con cualquier cliente MySQL contra `localhost:3307`. Ejemplo recomendado con `mysqlsh`:

```powershell
$pwd = [Environment]::GetEnvironmentVariable("RDS_PASSWORD","User")
mysqlsh --sql --host 127.0.0.1 --port 3307 --user admin --password=$pwd
```

**Errores conocidos** del script (puerto ocupado, alias no responde, `powershell-yaml` no instalado): documentados en [state-inventory-runbook.md](../state-inventory-skills/state-inventory-runbook.md) sección "Errores conocidos y resolución".

## Variables de entorno persistentes

| Variable | Scope | Propósito |
|---|---|---|
| `RDS_PASSWORD` | User | Contraseña del usuario `admin` de RDS. Leída por la skill `state-inventory` y por sesiones manuales contra el túnel. |

Definir en PowerShell:

```powershell
[Environment]::SetEnvironmentVariable("RDS_PASSWORD", "<password>", "User")
```

Tras definirla, **cerrar y reabrir** cualquier PowerShell o aplicación que la necesite para que la herede (Claude Code Desktop incluido).

Verificar sin exponer el valor:

```powershell
$len = [Environment]::GetEnvironmentVariable("RDS_PASSWORD","User").Length
if ($len -gt 0) { "RDS_PASSWORD definido (longitud $len)" } else { "RDS_PASSWORD vacío" }
```

## Verificación rápida del equipo (smoke test)

Ejecutar este bloque antes de empezar una sesión operativa para confirmar que todo está OK. Todos los comandos son read-only.

```powershell
aws --version
aws sts get-caller-identity
ssh -o BatchMode=yes -o ConnectTimeout=5 test-backend "echo ok"
Test-Path "$HOME\.sharemechat\state-mapping.yaml"
mysqlsh --version
if ([Environment]::GetEnvironmentVariable("RDS_PASSWORD","User")) { "RDS_PASSWORD OK" } else { "RDS_PASSWORD FALTA" }
if (Get-Module -ListAvailable -Name powershell-yaml) { "powershell-yaml OK" } else { "powershell-yaml FALTA" }
```

Salida esperada en orden: versión AWS CLI v2, ARN del usuario IAM, `ok` del SSH a TEST, `True` para el mapping, versión `mysqlsh 8.x`, `RDS_PASSWORD OK`, `powershell-yaml OK`.

Si alguna línea falla, resolver antes de operar. Para SSH a otros entornos sustituir `test-backend` por `audit-backend` o `prod-backend` según convenga.

## Skills y scripts que dependen de estos accesos

| Pieza | Necesita | Documentación |
|---|---|---|
| Skill `state-inventory` (genera snapshot de un entorno) | AWS CLI, SSH al backend del entorno, túnel RDS, `mysqlsh`, mapping, `RDS_PASSWORD` | [state-inventory.md](../state-inventory-skills/state-inventory.md) + [runbook](../state-inventory-skills/state-inventory-runbook.md) |
| Skill `state-diff` (detecta drift entre snapshot y prosa) | Solo filesystem local | [state-diff.md](../state-inventory-skills/state-diff.md) |
| Script `tunnel-rds.ps1` | SSH, mapping, `powershell-yaml` | Docstring del propio script en `ops/scripts/tunnel-rds.ps1` |
| Script `deploy-frontend.ps1` | AWS CLI con permisos `s3:PutObject*` y `cloudfront:CreateInvalidation`, mapping, npm | Docstring del propio script en `ops/scripts/deploy-frontend.ps1` |

## Configuración runtime por entorno: `.env` del EC2 vs `application-*.properties` del repo

**Regla operativa fundamental**: antes de afirmar "feature X está apagada / activada" en un entorno, contrastar con el `.env` del EC2 correspondiente vía SSH. **No basta con leer `application-*.properties` del repo**: los defaults del repo son permisivos, y los flags críticos por entorno viven en el `.env` del EC2 y sobrescriben.

### Los dos ficheros y su rol

Cada EC2 backend tiene dos ficheros en `/opt/sharemechat/`:

| Fichero | Ownership canónico | Contenido |
|---|---|---|
| `config.env` | `root:root 0644` | Config **no sensible** por entorno: flags operativos activables/desactivables sin redeploy (registro cliente/modelo, modo operacional del producto, activación de Didit/Sightengine/Auth-risk, country-gating, URLs TURN, workflows KYC, callbacks). |
| `secrets.env` | `0600` (`root:root` en AUDIT/PROD, `ec2-user:ec2-user` en TEST según deuda cerrada #D-12) | **Secretos y credenciales**: `DB_PASSWORD`, `JWT_SECRET*`, `CONSENT_SECRET*`, `CLAUDE_API_KEY`, `KYC_DIDIT_API_KEY`, `KYC_DIDIT_API_SECRET`, `MODERATION_SIGHTENGINE_API_SECRET`, `EMAIL_GRAPH_CLIENT_SECRET`, `AUTHRISK_EMAIL_HASH_SALT`, `WEBRTC_TURN_CREDENTIAL`, `WEBRTC_TURN_USERNAME`. |

Los dos ficheros los carga el systemd unit `sharemechat-<env>.service` como `EnvironmentFile`:

```
EnvironmentFile=/opt/sharemechat/config.env
EnvironmentFile=/opt/sharemechat/secrets.env
ExecStart=/usr/lib/jvm/.../java -Dspring.profiles.active=<env> -jar /home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar
```

En TEST, mientras la deuda operativa de systemd no se cierre, el backend se arranca a mano vía `start-test.sh` haciendo `set -a && source /opt/sharemechat/.env && set +a && java -jar ...`. Hay un `.env` unificado en lugar de `config.env` + `secrets.env`, pero la semántica de origen de variables es equivalente.

### Precedencia Spring vs .env

Spring Boot resuelve un placeholder `${VAR:default}` en `application-*.properties` en este orden:

1. **Variable de entorno del proceso** (poblada por `EnvironmentFile` de systemd o por `source` en TEST). Si `VAR` está poblada, gana.
2. **Property override en `application-<env>.properties`** si está declarada explícita.
3. **Property base en `application.properties`**.
4. **Default literal tras `:`** si el placeholder lo declara, o error de arranque si no hay default y la variable no está poblada.

Consecuencia: **una feature con default `true` en `application.properties` (registro cliente activado por ejemplo) queda cerrada en un entorno solo si el `.env` de ese EC2 define `PRODUCT_REGISTRATION_CLIENT_ENABLED=false`**. Sin la línea en el `.env`, Spring resuelve el default y el registro está abierto. Un lector que solo mire el repo puede concluir erróneamente lo contrario.

### Qué tipo de flags vive en cada sitio

- **`application-*.properties` del repo** (versionado en git):
  - Config compartida por todos los entornos (endpoints, timeouts, tamaños máximos, cadencias, umbrales de moderación, políticas de retención, etc.).
  - Overrides deliberados por entorno (dominios canónicos, callbacks Didit/Sightengine, base URL de assets, cookie domain, RDS URL).
  - Defaults del comportamiento del código.
  - **Overrides "belt-and-suspenders"** cuando se quiere blindar por doble vía (ejemplo actual: `application-prod.properties` fija `kyc.didit.enabled=false` y `moderation.sightengine.enabled=false` como defensa en profundidad además del `.env`; ver deudas #D-9/#D-10/#D-11).

- **`/opt/sharemechat/config.env` del EC2** (no versionado, per-entorno):
  - Flags operativos que se activan/desactivan sin redeploy (`KYC_DIDIT_ENABLED`, `MODERATION_SIGHTENGINE_ENABLED`, `AUTHRISK_ENABLED`, `AUTHRISK_RESPONSE_ENABLED`, `COUNTRY_ACCESS_ENABLED`, `COUNTRY_ACCESS_BLOCK_WHEN_MISSING`, `PRODUCT_ACCESS_MODE`, `PRODUCT_REGISTRATION_CLIENT_ENABLED`, `PRODUCT_REGISTRATION_MODEL_ENABLED`, `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED`, `SPRING_FLYWAY_ENABLED`).
  - Configuración operativa no sensible (allowlists de países, IDs de workflow Didit, URLs de callback específicas, TURN URLs, buckets S3).
  - `APP_STORAGE_TYPE`, `APP_STORAGE_S3_*`, `MODERATION_EVIDENCE_S3_*`.

- **`/opt/sharemechat/secrets.env` del EC2** (no versionado, per-entorno, `0600`):
  - Credenciales de acceso a servicios externos: `CLAUDE_API_KEY`, `KYC_DIDIT_API_KEY`, `KYC_DIDIT_API_SECRET`, `MODERATION_SIGHTENGINE_API_SECRET`, `EMAIL_GRAPH_CLIENT_SECRET`, `MAIL_PASSWORD`.
  - Secretos del propio backend: `JWT_SECRET`/`JWT_SECRET_AUDIT`/`JWT_SECRET_PROD`, `CONSENT_SECRET`/`CONSENT_SECRET_AUDIT`/`CONSENT_SECRET_PROD`, `AUTHRISK_EMAIL_HASH_SALT`.
  - Contraseñas de infraestructura: `DB_PASSWORD`, `REDIS_PASSWORD`, `WEBRTC_TURN_CREDENTIAL`.

Nota sobre variables per-entorno con sufijo: AUDIT y PROD usan `JWT_SECRET_AUDIT`/`JWT_SECRET_PROD` y `CONSENT_SECRET_AUDIT`/`CONSENT_SECRET_PROD` porque `application-audit.properties` y `application-prod.properties` overridean los placeholders `jwt.secret=${JWT_SECRET_AUDIT}` / `consent.hmacSecret=${CONSENT_SECRET_PROD}` para aislar secretos entre entornos. TEST usa `JWT_SECRET` y `CONSENT_SECRET` sin sufijo porque hereda del `application.properties` base sin override.

### Ejemplos concretos por categoría

| Flag | Vive en | Efecto |
|---|---|---|
| `PRODUCT_REGISTRATION_CLIENT_ENABLED=false` | `.env` (AUDIT y PROD hoy) | Bloquea `POST /api/users/register/client` con 503 `REGISTRATION_CLOSED`. Sin la línea → registro abierto. |
| `PRODUCT_REGISTRATION_MODEL_ENABLED=false` | `.env` (AUDIT y PROD hoy) | Idem para modelo. |
| `PRODUCT_ACCESS_MODE=PRELAUNCH\|MAINTENANCE\|CLOSED` | `.env` (PROD `PRELAUNCH` hoy) | Bloquea toda la superficie de producto vía `ProductOperationalModeFilter`. Sin la línea → `OPEN`. |
| `KYC_DIDIT_ENABLED=true` + credenciales reales | `config.env` + `secrets.env` (TEST y AUDIT) | El cliente Didit llama a la API real. Sin credenciales → mock estable. En PROD `application-prod.properties` lo fuerza a `false` como belt-and-suspenders. |
| `MODERATION_SIGHTENGINE_ENABLED=true` + credenciales reales | `config.env` + `secrets.env` (TEST y AUDIT) | Idem para Sightengine. En PROD forzado a `false` por properties. |
| `CLAUDE_API_KEY=sk-ant-...` | `secrets.env` | El chat con el Agente IA llama a Anthropic. **Sin la línea → Claude API responde 401 `authentication_error: x-api-key header is required` y el bot devuelve "el agente no está disponible temporalmente"** (gap real detectado en AUDIT el 2026-07-09). |
| `COUNTRY_ACCESS_ENABLED=false` | `.env` (AUDIT durante fase PSP) | Desactiva `CountryAccessService` completo. Sin la línea → gate activo con las allowlists por flujo. |
| `AUTHRISK_ENABLED=true` + `AUTHRISK_RESPONSE_ENABLED=true` + `AUTHRISK_EMAIL_HASH_SALT` | `config.env` + `secrets.env` | Auth-risk activo con delay + bloqueo. Sin las tres, capa en no-op. |

### Regla operativa: contrastar antes de afirmar

Antes de escribir en un reporte "el registro está OFF en AUDIT" o "Didit está apagado en PROD" o similar, verificar el `.env` del EC2 correspondiente:

```powershell
# Nombres de variables presentes en cada fichero, sin valores
ssh audit-backend "sudo grep -oE '^[A-Z_]+=' /opt/sharemechat/config.env | sort -u"
ssh audit-backend "sudo grep -oE '^[A-Z_]+=' /opt/sharemechat/secrets.env | sort -u"

# Verificar que una variable concreta está poblada (sin exponer valor)
ssh audit-backend "sudo awk -F= '/^CLAUDE_API_KEY=/{print \"value_len=\" length(\$2)}' /opt/sharemechat/secrets.env"
```

Si la variable no aparece en el listado, la feature toma su default del repo. Si el default es permisivo (por ejemplo `product.registration.client.enabled=${PRODUCT_REGISTRATION_CLIENT_ENABLED:true}` en `application.properties`), la feature está **abierta**, no cerrada. Esto es lo que confundió a la auditoría exhaustiva del 2026-07-09 al etiquetar como "bugs de seguridad críticos" features apagadas intencionalmente por vía del `.env`.

### Higiene al tocar el `.env`

Cuando haya que añadir o modificar una línea en `config.env` o `secrets.env`:

- Backup preventivo del fichero antes del cambio: `sudo cp -a /opt/sharemechat/secrets.env /opt/sharemechat/secrets.env.bak-pre-<motivo>-<UTC>`.
- Preservar ownership y modo canónicos del entorno tras el cambio.
- Nunca pasar el valor de un secreto por argv de un comando ni imprimirlo por stdout. Vía stdin/heredoc o pipeline SSH atómico (ver ejemplo real del 2026-07-09 sobre `CLAUDE_API_KEY`).
- `sudo systemctl restart sharemechat-<env>` para que systemd relea los `EnvironmentFile` y Spring resuelva los placeholders con el valor nuevo.
- Verificar boot signals en journal y ausencia de errores relacionados con la variable tocada.

## Lo que NO se documenta aquí

Por la regla de saneado de [documentation-governance.md](../documentation-governance.md):

- IDs reales de distribuciones CloudFront, ARNs, IPs públicas, hostnames RDS reales, security group IDs, subnet IDs, account ID.
- Nombres de buckets S3 concretos del proyecto (algunos aparecen en logs operativos puntuales, pero no se enumeran aquí).
- Identidad exacta del usuario IAM del operador.
- Contraseñas, claves SSH privadas, tokens, secretos de aplicación.
- Pasos de alta de un equipo nuevo en AWS o de generación de claves SSH.

Toda esa información vive **fuera del repo**:

- IDs y endpoints: en `~/.sharemechat/state-mapping.yaml` del operador.
- Credenciales AWS: en `~/.aws/credentials` del operador.
- Claves SSH: en `~/.ssh/` del operador.
- Si necesitas alta o reemisión de credenciales, contacta al operador del proyecto.
