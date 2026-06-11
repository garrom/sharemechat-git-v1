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
